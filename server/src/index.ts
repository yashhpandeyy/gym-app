import { Hono } from 'hono';
import { cors } from 'hono/cors';

import {
  adminOnly,
  adminToken,
  cleanProfile,
  fullGym,
  auth,
  blocked,
  body,
  clearFails,
  createGym,
  dummyHash,
  emailOf,
  emailTaken,
  fail,
  gymByCode,
  ip,
  issueSession,
  json,
  nowIso,
  nowSec,
  ownerOnly,
  phoneOf,
  publicGym,
  recordFail,
  signupFields,
  staffOnly,
  text,
  type AppEnv,
  type Ctx,
  type GymRow,
} from './core';
import { hashSecret, hmacCode, newId, randomDigits, randomToken, safeEqual, sha256, verifySecret } from './crypto';
import { registerSync } from './sync';

const app = new Hono<AppEnv>();
app.use('*', cors({ origin: '*', allowHeaders: ['authorization', 'content-type'], exposeHeaders: ['x-session-token'], maxAge: 600 }));
registerSync(app);

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

app.get('/health', (c) => c.json({ ok: true }));

/**
 * Owner self-serve sign-up. The gym is live at once, unless SIGNUP_REVIEW is "on": then it stays
 * pending until a platform admin activates it.
 */
app.post('/v1/gyms', async (c) => {
  const key = `signup:${ip(c)}`;
  if (await blocked(c.env.DB, key, 5, 3600)) return fail(c, 429, 'too_many', 'Too many sign-ups from here. Try again later.');
  const f = signupFields(await body(c));
  if (!f) return fail(c, 400, 'invalid', 'Enter the gym name, your name, a valid email and a password of 8 or more characters.');
  if (await emailTaken(c.env.DB, f.email)) return fail(c, 409, 'email_taken', 'That email already runs a gym. Sign in instead.');
  await recordFail(c.env.DB, key, 3600);
  const status = c.env.SIGNUP_REVIEW === 'on' ? 'pending' : 'active';
  const g = await createGym(c.env.DB, { ...f, status }, c.env.APP_SECRET);
  const token = await issueSession(c.env.DB, { gymId: g.gymId, role: 'owner', userId: g.userId });
  return c.json({ gym: { id: g.gymId, code: g.code, status }, token }, 201);
});

/** Branding for the gym-code screen. Pending and unknown codes look identical. */
app.get('/v1/gyms/:code/public', async (c) => {
  const g = await gymByCode(c.env.DB, c.req.param('code'));
  if (!g || g.status !== 'active') return fail(c, 404, 'not_found', 'No gym with that code.');
  return c.json(publicGym(g));
});

/** The gym's logo, for the gym-code screen. Same rules as the branding: active gyms only. */
app.get('/v1/gyms/:code/logo', async (c) => {
  const g = await gymByCode(c.env.DB, c.req.param('code'));
  const logo = g && g.status === 'active' ? await c.env.DB.prepare('SELECT type, data FROM gym_logos WHERE gym_id = ?').bind(g.id).first<{ type: string; data: string }>() : null;
  if (!logo) return fail(c, 404, 'not_found', 'No logo.');
  const bytes = Uint8Array.from(atob(logo.data), (ch) => ch.charCodeAt(0));
  return new Response(bytes, { headers: { 'content-type': logo.type, 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff', 'access-control-allow-origin': '*' } });
});

/** Owner password or staff PIN sign-in. */
app.post('/v1/auth/login', async (c) => {
  const b = await body(c);
  const phone = phoneOf(b.phone);
  const secret = typeof b.secret === 'string' ? b.secret : '';
  const code = typeof b.gymCode === 'string' ? b.gymCode.trim().toUpperCase() : '';
  const keys = [`login:${code}:${phone}`, `login-ip:${ip(c)}`];
  if ((await blocked(c.env.DB, keys[0], 5, 900)) || (await blocked(c.env.DB, keys[1], 30, 900))) {
    return fail(c, 429, 'too_many', 'Too many tries. Wait 15 minutes.');
  }
  const g = await gymByCode(c.env.DB, code);
  const user = g && phone ? await c.env.DB.prepare('SELECT * FROM users WHERE gym_id = ? AND phone = ?').bind(g.id, phone).first<{ id: string; role: 'owner' | 'staff'; name: string; secret: string }>() : null;
  const ok = await verifySecret(secret, user?.secret ?? (await dummyHash(c.env.APP_SECRET)), c.env.APP_SECRET);
  if (!g || !user || !ok || g.status === 'suspended') {
    await Promise.all(keys.map((k) => recordFail(c.env.DB, k, 900)));
    return fail(c, 401, 'invalid_credentials', 'That gym code, number or password doesn’t match.');
  }
  await clearFails(c.env.DB, keys[0]);
  const token = await issueSession(c.env.DB, { gymId: g.id, role: user.role, userId: user.id });
  return c.json({ token, role: user.role, name: user.name, gymStatus: g.status });
});

/**
 * Owners sign in with their email. The gym comes from the account, so no gym code is needed.
 * Platform admins (you) use the same screen: if the email belongs to an admin account, that's who signs in.
 */
app.post('/v1/auth/owner-login', async (c) => {
  const b = await body(c);
  const email = emailOf(b.email);
  const secret = typeof b.password === 'string' ? b.password : '';
  const keys = [`owner:${email}`, `owner-ip:${ip(c)}`];
  if ((await blocked(c.env.DB, keys[0], 5, 900)) || (await blocked(c.env.DB, keys[1], 30, 900))) {
    return fail(c, 429, 'too_many', 'Too many tries. Wait 15 minutes.');
  }
  const user = email
    ? await c.env.DB.prepare("SELECT id, gym_id, name, secret FROM users WHERE role = 'owner' AND lower(email) = ?").bind(email).first<{ id: string; gym_id: string; name: string; secret: string }>()
    : null;
  const admin = !user && email ? await c.env.DB.prepare('SELECT id, name, secret FROM admins WHERE email = ?').bind(email).first<{ id: string; name: string; secret: string }>() : null;
  const ok = await verifySecret(secret, (user ?? admin)?.secret ?? (await dummyHash(c.env.APP_SECRET)), c.env.APP_SECRET);
  if (admin && ok) {
    await clearFails(c.env.DB, keys[0]);
    return c.json({ token: await adminToken(c.env, admin.id), role: 'admin', name: admin.name });
  }
  const g = user ? await c.env.DB.prepare('SELECT * FROM gyms WHERE id = ?').bind(user.gym_id).first<GymRow>() : null;
  if (!user || !ok || !g || g.status === 'suspended') {
    await Promise.all(keys.map((k) => recordFail(c.env.DB, k, 900)));
    return fail(c, 401, 'invalid_credentials', 'That email or password doesn’t match.');
  }
  await clearFails(c.env.DB, keys[0]);
  const token = await issueSession(c.env.DB, { gymId: g.id, role: 'owner', userId: user.id });
  return c.json({ token, role: 'owner', name: user.name, gym: fullGym(g) });
});

/** Ends this session on the server, so a lost or sold phone can't keep using the old token. */
app.post('/v1/auth/logout', async (c) => {
  const m = /^Bearer (.{20,})$/.exec(c.req.header('authorization') ?? '');
  if (m) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(m[1])).run();
  return c.json({ ok: true });
});

type CodeRow = { member_id: string; name: string; gym_id: string; invite_id: string; salt: string; code_hash: string; attempts: number; expires_at: number };

/**
 * Checks a member's 6-digit login code against every live code their phone has (one per gym they
 * belong to). The code is the member's login: it keeps working until the gym issues a new one.
 * Five wrong tries lock it; the gym then sends a fresh one.
 */
async function memberSignIn(c: Ctx, rows: CodeRow[], code: string, keys: string[]) {
  const bad = async () => {
    await Promise.all(keys.map((k) => recordFail(c.env.DB, k, 900)));
    return fail(c, 401, 'invalid_code', 'That number and code don’t match. Check them, or ask your gym for a new code.');
  };
  const live = rows.filter((r) => r.attempts < 5 && r.expires_at >= nowSec());
  // Always do at least one hash, so an unknown phone and a wrong code take the same time.
  const hashes = await Promise.all((live.length ? live : [null]).map((r) => hmacCode(c.env.APP_SECRET, r?.salt ?? 'none', code)));
  const hit = live.find((r, i) => safeEqual(hashes[i], r.code_hash));
  if (!/^\d{6}$/.test(code) || !hit) {
    if (live.length) await c.env.DB.batch(live.map((r) => c.env.DB.prepare('UPDATE invites SET attempts = attempts + 1 WHERE id = ?').bind(r.invite_id)));
    return bad();
  }
  await c.env.DB.prepare('UPDATE invites SET attempts = 0 WHERE id = ?').bind(hit.invite_id).run();
  await clearFails(c.env.DB, keys[0]);
  const token = await issueSession(c.env.DB, { gymId: hit.gym_id, role: 'member', memberId: hit.member_id });
  const g = await c.env.DB.prepare('SELECT * FROM gyms WHERE id = ?').bind(hit.gym_id).first<GymRow>();
  return c.json({ token, role: 'member', name: hit.name, memberId: hit.member_id, gym: g && fullGym(g) });
}

const CODE_ROWS = `SELECT m.id AS member_id, m.name, m.gym_id, i.id AS invite_id, i.salt, i.code_hash, i.attempts, i.expires_at
  FROM members m JOIN gyms g ON g.id = m.gym_id JOIN invites i ON i.member_id = m.id AND i.used_at IS NULL
  WHERE g.status = 'active' AND m.phone = ?`;

/** The first screen: a member signs in with just their phone and the code their gym gave them. */
app.post('/v1/auth/member-login', async (c) => {
  const b = await body(c);
  const phone = phoneOf(b.phone);
  const code = typeof b.code === 'string' ? b.code.replace(/\D/g, '') : '';
  const keys = [`member:${phone}`, `member-ip:${ip(c)}`];
  if ((await blocked(c.env.DB, keys[0], 10, 900)) || (await blocked(c.env.DB, keys[1], 40, 900))) {
    return fail(c, 429, 'too_many', 'Too many tries. Wait 15 minutes, or ask your gym for a new code.');
  }
  const rows = phone ? (await c.env.DB.prepare(`${CODE_ROWS} LIMIT 10`).bind(phone).all<CodeRow>()).results : [];
  return memberSignIn(c, rows, code, keys);
});

/** The same sign-in, from the gym-code screen, limited to that one gym. */
app.post('/v1/auth/redeem', async (c) => {
  const b = await body(c);
  const phone = phoneOf(b.phone);
  const code = typeof b.code === 'string' ? b.code.replace(/\D/g, '') : '';
  const gCode = typeof b.gymCode === 'string' ? b.gymCode.trim().toUpperCase() : '';
  const keys = [`redeem:${gCode}:${phone}`, `redeem-ip:${ip(c)}`];
  if ((await blocked(c.env.DB, keys[0], 10, 900)) || (await blocked(c.env.DB, keys[1], 40, 900))) {
    return fail(c, 429, 'too_many', 'Too many tries. Wait 15 minutes, or ask the front desk for a new code.');
  }
  const rows = phone ? (await c.env.DB.prepare(`${CODE_ROWS} AND g.code = ?`).bind(phone, gCode).all<CodeRow>()).results : [];
  return memberSignIn(c, rows, code, keys);
});

/** A member without an invite asks to join. Staff approve it at the desk by scanning the QR. */
app.post('/v1/pair', async (c) => {
  const b = await body(c);
  const g = await gymByCode(c.env.DB, b.gymCode);
  const name = text(b.name, 2, 60);
  const phone = phoneOf(b.phone);
  const key = `pair:${ip(c)}`;
  if (await blocked(c.env.DB, key, 10, 3600)) return fail(c, 429, 'too_many', 'Too many requests. Try again later.');
  if (!g || g.status !== 'active') return fail(c, 404, 'not_found', 'No gym with that code.');
  if (!name || !phone) return fail(c, 400, 'invalid', 'Enter your name and 10-digit mobile number.');
  const waiting = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM pairings WHERE gym_id = ? AND status = 'waiting' AND expires_at > ?").bind(g.id, nowSec()).first<{ n: number }>();
  if ((waiting?.n ?? 0) >= 50) return fail(c, 429, 'too_many', 'The front desk has too many open requests. Ask them to clear the queue.');
  await recordFail(c.env.DB, key, 3600);
  const id = newId('pair');
  const secret = randomToken(16);
  await c.env.DB.prepare('INSERT INTO pairings (id, gym_id, name, phone, secret_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, g.id, name, phone, await sha256(secret), nowSec() + 900, nowIso())
    .run();
  return c.json({ pairingId: id, secret, qr: `GYMPAIR:${id}.${secret}`, expiresInSeconds: 900 }, 201);
});

/** The member's app polls this. Once staff approve, it returns a session exactly once. */
app.get('/v1/pair/:id', async (c) => {
  const secret = c.req.query('secret') ?? '';
  const p = await c.env.DB.prepare('SELECT * FROM pairings WHERE id = ?').bind(c.req.param('id')).first<{
    id: string; gym_id: string; secret_hash: string; status: string; member_id: string | null; expires_at: number;
  }>();
  if (!p || !safeEqual(await sha256(secret), p.secret_hash)) return fail(c, 404, 'not_found', 'Request not found.');
  if (p.expires_at < nowSec()) return fail(c, 410, 'expired', 'This request expired. Start again.');
  if (p.status === 'waiting') return c.json({ status: 'waiting' });
  if (p.status === 'claimed' || !p.member_id) return fail(c, 410, 'expired', 'This request was already used.');
  const claim = await c.env.DB.prepare("UPDATE pairings SET status = 'claimed' WHERE id = ? AND status = 'approved'").bind(p.id).run();
  if (claim.meta.changes !== 1) return fail(c, 410, 'expired', 'This request was already used.');
  const token = await issueSession(c.env.DB, { gymId: p.gym_id, role: 'member', memberId: p.member_id });
  return c.json({ status: 'approved', token, role: 'member', memberId: p.member_id });
});

// ---------------------------------------------------------------------------
// Owner and staff
// ---------------------------------------------------------------------------

app.get('/v1/me', auth({ allowPending: true }), async (c) => {
  const s = c.get('s');
  const g = await c.env.DB.prepare('SELECT * FROM gyms WHERE id = ?').bind(s.gymId).first<GymRow>();
  const me = s.userId ? await c.env.DB.prepare('SELECT name, email FROM users WHERE id = ?').bind(s.userId).first<{ name: string; email: string | null }>() : null;
  return c.json({ role: s.role, name: me?.name, email: me?.email, gym: g && fullGym(g) });
});

/** Gym branding, modules and settings. Owners can set these up while still waiting for activation. */
app.patch('/v1/gym', auth({ roles: ['owner'], allowPending: true }), async (c) => {
  const b = await body(c);
  const s = c.get('s');
  const sets: string[] = [];
  const vals: (string | null)[] = [];
  const name = text(b.name, 2, 60);
  if (name) (sets.push('name = ?'), vals.push(name));
  if (typeof b.tagline === 'string' && b.tagline.length <= 120) (sets.push('tagline = ?'), vals.push(b.tagline.trim()));
  if (typeof b.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.primaryColor)) (sets.push('primary_color = ?'), vals.push(b.primaryColor));
  if (b.features && typeof b.features === 'object' && !Array.isArray(b.features)) {
    const f = Object.fromEntries(Object.entries(b.features as Record<string, unknown>).filter(([k, v]) => /^[a-zA-Z]{2,24}$/.test(k) && typeof v === 'boolean'));
    sets.push('features = ?');
    vals.push(JSON.stringify(f));
  }
  const profile = cleanProfile(b.profile);
  if (profile) {
    const cur = await c.env.DB.prepare('SELECT settings FROM gyms WHERE id = ?').bind(s.gymId).first<{ settings: string }>();
    sets.push('settings = ?');
    vals.push(JSON.stringify({ ...json(cur?.settings ?? '{}'), profile }));
  }
  if (typeof b.logo === 'string') {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.logo);
    if (!m || m[2].length > 280_000) return fail(c, 400, 'invalid', 'Logo must be a PNG, JPEG or WebP under about 200 KB.');
    const v = String(Date.now());
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO gym_logos (gym_id, type, data) VALUES (?, ?, ?) ON CONFLICT(gym_id) DO UPDATE SET type = excluded.type, data = excluded.data').bind(s.gymId, m[1], m[2]),
      c.env.DB.prepare('UPDATE gyms SET logo_key = ? WHERE id = ?').bind(v, s.gymId),
    ]);
    if (!sets.length) return c.json({ ok: true });
  }
  if (!sets.length) return fail(c, 400, 'invalid', 'Nothing to change.');
  await c.env.DB.prepare(`UPDATE gyms SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, s.gymId).run();
  return c.json({ ok: true });
});

app.post('/v1/staff', ownerOnly, async (c) => {
  const b = await body(c);
  const name = text(b.name, 2, 60);
  const phone = phoneOf(b.phone);
  const pin = typeof b.pin === 'string' && /^\d{4,8}$/.test(b.pin) ? b.pin : null;
  if (!name || !phone || !pin) return fail(c, 400, 'invalid', 'Enter a name, a 10-digit number and a PIN of 4 to 8 digits.');
  try {
    const id = newId('usr');
    await c.env.DB.prepare('INSERT INTO users (id, gym_id, role, name, phone, secret, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, c.get('s').gymId, 'staff', name, phone, await hashSecret(pin, c.env.APP_SECRET), nowIso())
      .run();
    return c.json({ id }, 201);
  } catch (e) {
    if (String(e).includes('UNIQUE')) return fail(c, 409, 'exists', 'Someone with that number already has a login.');
    throw e;
  }
});

app.get('/v1/staff', ownerOnly, async (c) => {
  const rows = await c.env.DB.prepare("SELECT id, name, phone, role FROM users WHERE gym_id = ? AND role = 'staff' ORDER BY name").bind(c.get('s').gymId).all();
  return c.json({ staff: rows.results });
});

app.delete('/v1/staff/:id', ownerOnly, async (c) => {
  const s = c.get('s');
  const row = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND gym_id = ? AND role = 'staff'").bind(c.req.param('id'), s.gymId).first();
  if (!row) return fail(c, 404, 'not_found', 'Staff member not found.');
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.id), c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(row.id)]);
  return c.json({ ok: true });
});

/** A new PIN for a front-desk login. Their current sessions end, so the old PIN stops working everywhere. */
app.patch('/v1/staff/:id', ownerOnly, async (c) => {
  const s = c.get('s');
  const b = await body(c);
  const pin = typeof b.pin === 'string' && /^\d{4,8}$/.test(b.pin) ? b.pin : null;
  if (!pin) return fail(c, 400, 'invalid', 'Use a PIN of 4 to 8 digits.');
  const row = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND gym_id = ? AND role = 'staff'").bind(c.req.param('id'), s.gymId).first();
  if (!row) return fail(c, 404, 'not_found', 'Staff member not found.');
  await c.env.DB.batch([c.env.DB.prepare('UPDATE users SET secret = ? WHERE id = ?').bind(await hashSecret(pin, c.env.APP_SECRET), row.id), c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.id)]);
  return c.json({ ok: true });
});

/** Member login codes don't expire on their own. Issuing a new one retires the old one. */
const CODE_DAYS = 3650;

async function prepareInvite(c: Ctx, gymId: string, memberId: string) {
  const code = randomDigits(6);
  const salt = randomToken(8);
  return {
    code,
    statements: [
      c.env.DB.prepare('UPDATE invites SET used_at = ? WHERE member_id = ? AND used_at IS NULL').bind(nowSec(), memberId),
      c.env.DB.prepare('INSERT INTO invites (id, gym_id, member_id, salt, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
        newId('inv'),
        gymId,
        memberId,
        salt,
        await hmacCode(c.env.APP_SECRET, salt, code),
        nowSec() + CODE_DAYS * 86400,
        nowIso(),
      ),
    ],
  };
}

async function makeInvite(c: Ctx, gymId: string, memberId: string) {
  const { code, statements } = await prepareInvite(c, gymId, memberId);
  await c.env.DB.batch(statements);
  return code;
}

async function inviteReply(c: Ctx, gymId: string, member: { id: string; name: string; phone: string }, code: string) {
  const g = await c.env.DB.prepare('SELECT code, name FROM gyms WHERE id = ?').bind(gymId).first<{ code: string; name: string }>();
  return {
    inviteCode: code,
    expiresInDays: CODE_DAYS,
    whatsapp: {
      phone: member.phone,
      text: `Hi ${member.name}, welcome to ${g?.name}! Open the GYM app and sign in with your phone number and this code: ${code}. Keep it: it's your login.`,
    },
  };
}

/** Fields the gym may set on a new member's record. The server adds the id and the member number. */
const NEW_MEMBER_FIELDS = ['gender', 'joinedOn', 'planId', 'startDate', 'endDate', 'pauseAllowance', 'dues', 'preferredSlotId', 'trainerId', 'goalWeight', 'notes', 'weeklyGoal', 'referredBy'];

/**
 * The gym adds a member. That creates their identity (so they can sign in), their full record,
 * and a one-time invite code to send them. The record comes back so the desk's app has it at once.
 */
app.post('/v1/members', staffOnly, async (c) => {
  const b = await body(c);
  const s = c.get('s');
  const name = text(b.name, 2, 60);
  const phone = phoneOf(b.phone);
  const email = b.email === undefined || b.email === '' ? null : emailOf(b.email);
  if (b.email && !email) return fail(c, 400, 'invalid', 'That email doesn’t look right. It’s optional, so you can leave it empty.');
  if (!name || !phone) return fail(c, 400, 'invalid', 'Enter the member’s name and 10-digit mobile number.');
  const taken = await c.env.DB.prepare('SELECT 1 AS x FROM members WHERE gym_id = ? AND phone = ?').bind(s.gymId, phone).first();
  if (taken) return fail(c, 409, 'exists', 'A member with that number already exists.');

  const fields = Object.fromEntries(Object.entries((b.member && typeof b.member === 'object' ? b.member : {}) as Record<string, unknown>).filter(([k]) => NEW_MEMBER_FIELDS.includes(k)));
  const counter = await c.env.DB.prepare('UPDATE gym_seq SET member_no = member_no + 1, seq = seq + 1 WHERE gym_id = ? RETURNING member_no, seq').bind(s.gymId).first<{ member_no: number; seq: number }>();
  const gym = await c.env.DB.prepare('SELECT code, name FROM gyms WHERE id = ?').bind(s.gymId).first<{ code: string; name: string }>();
  if (!counter || !gym) return fail(c, 404, 'not_found', 'Gym not found.');
  const id = newId('m');
  const code = `${gym.code.slice(0, 2)}-${counter.member_no}`;
  const doc: Record<string, unknown> = { weeklyGoal: 4, joinedOn: new Date().toISOString().slice(0, 10), pauseAllowance: 0, dues: 0, ...fields, id, code, name, phone };
  const invite = await prepareInvite(c, s.gymId, id);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO members (id, gym_id, name, phone, email, gender, code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, s.gymId, name, phone, email, typeof doc.gender === 'string' ? doc.gender : null, code, nowIso()),
    c.env.DB.prepare('INSERT INTO docs (gym_id, kind, id, member_id, data, seq, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)').bind(s.gymId, 'members', id, id, JSON.stringify(doc), counter.seq),
    ...invite.statements,
  ]);
  return c.json({ member: doc, ...(await inviteReply(c, s.gymId, { id, name, phone }, invite.code)) }, 201);
});

/** A fresh login code when the member lost theirs or it locked. The old one stops working. */
app.post('/v1/members/:id/invite', staffOnly, async (c) => {
  const s = c.get('s');
  const m = await c.env.DB.prepare('SELECT id, name, phone FROM members WHERE id = ? AND gym_id = ?').bind(c.req.param('id'), s.gymId).first<{ id: string; name: string; phone: string }>();
  if (!m) return fail(c, 404, 'not_found', 'Member not found.');
  return c.json(await inviteReply(c, s.gymId, m, await makeInvite(c, s.gymId, m.id)));
});

/** Staff scan the member's pairing QR and say who they are. Only then does the member's app unlock. */
app.post('/v1/pairings/approve', staffOnly, async (c) => {
  const b = await body(c);
  const s = c.get('s');
  const m = /^GYMPAIR:([\w-]+)\.([\w-]+)$/.exec(typeof b.qr === 'string' ? b.qr : '');
  if (!m) return fail(c, 400, 'invalid', 'That isn’t a pairing code.');
  const p = await c.env.DB.prepare('SELECT * FROM pairings WHERE id = ? AND gym_id = ?').bind(m[1], s.gymId).first<{ id: string; name: string; phone: string; secret_hash: string; status: string; expires_at: number }>();
  if (!p || !safeEqual(await sha256(m[2]), p.secret_hash)) return fail(c, 404, 'not_found', 'Pairing request not found.');
  if (p.expires_at < nowSec() || p.status !== 'waiting') return fail(c, 410, 'expired', 'That request expired or was already used.');
  const memberId = typeof b.memberId === 'string' ? b.memberId : null;
  const member = memberId
    ? await c.env.DB.prepare('SELECT id, name, phone FROM members WHERE id = ? AND gym_id = ?').bind(memberId, s.gymId).first<{ id: string; name: string; phone: string }>()
    : await c.env.DB.prepare('SELECT id, name, phone FROM members WHERE gym_id = ? AND phone = ?').bind(s.gymId, p.phone).first<{ id: string; name: string; phone: string }>();
  // Staff look at who is asking before anything is unlocked.
  if (b.preview === true) return c.json({ preview: true, request: { name: p.name, phone: p.phone }, member: member ?? null });
  if (!member) return c.json({ error: 'no_member', message: 'No member matches. Add them first, or pick the right member.', request: { name: p.name, phone: p.phone } }, 404);
  const done = await c.env.DB.prepare("UPDATE pairings SET status = 'approved', member_id = ? WHERE id = ? AND status = 'waiting'").bind(member.id, p.id).run();
  if (done.meta.changes !== 1) return fail(c, 410, 'expired', 'That request was already used.');
  return c.json({ ok: true, member });
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

app.get('/v1/bootstrap', auth(), async (c) => {
  const s = c.get('s');
  const g = await c.env.DB.prepare('SELECT * FROM gyms WHERE id = ?').bind(s.gymId).first<GymRow>();
  if (!g) return fail(c, 404, 'not_found', 'Gym not found.');
  return c.json({ role: s.role, memberId: s.memberId, gym: fullGym(g) });
});

// ---------------------------------------------------------------------------
// Platform admin: you, creating and looking after gyms. Signed in with your own email and password,
// or with the master ADMIN_TOKEN for scripts.
// ---------------------------------------------------------------------------

/** Creates a platform admin account. Only the master token can do this. */
app.post('/v1/admin/accounts', adminOnly, async (c) => {
  if (!c.get('admin').master) return fail(c, 403, 'forbidden', 'Only the master token can add admins.');
  const b = await body(c);
  const email = emailOf(b.email);
  const name = text(b.name, 2, 60);
  const password = typeof b.password === 'string' && b.password.length >= 8 && b.password.length <= 100 ? b.password : null;
  if (!email || !name || !password) return fail(c, 400, 'invalid', 'Needs a valid email, a name and a password of 8 or more characters.');
  const clash = await c.env.DB.prepare('SELECT 1 AS x FROM admins WHERE email = ?').bind(email).first();
  if (clash) return fail(c, 409, 'exists', 'That admin already exists.');
  await c.env.DB.prepare('INSERT INTO admins (id, email, name, secret, created_at) VALUES (?, ?, ?, ?, ?)').bind(newId('adm'), email, name, await hashSecret(password, c.env.APP_SECRET), nowIso()).run();
  return c.json({ ok: true }, 201);
});

app.get('/v1/admin/gyms', adminOnly, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT g.id, g.code, g.name, g.status, g.created_at,
            (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id) AS members,
            (SELECT u.email FROM users u WHERE u.gym_id = g.id AND u.role = 'owner' LIMIT 1) AS owner_email,
            (SELECT u.name FROM users u WHERE u.gym_id = g.id AND u.role = 'owner' LIMIT 1) AS owner_name,
            (SELECT u.phone FROM users u WHERE u.gym_id = g.id AND u.role = 'owner' LIMIT 1) AS owner_phone
     FROM gyms g ORDER BY g.created_at DESC`,
  ).all();
  return c.json({ gyms: rows.results });
});

/** Creates a gym that is live straight away, for an owner who has just paid. */
app.post('/v1/admin/gyms', adminOnly, async (c) => {
  const b = await body(c);
  const f = signupFields(b);
  if (!f) return fail(c, 400, 'invalid', 'Needs gymName, ownerName, email and a password of 8+ characters.');
  if (await emailTaken(c.env.DB, f.email)) return fail(c, 409, 'email_taken', 'That email already runs a gym.');
  const g = await createGym(c.env.DB, { ...f, status: 'active' }, c.env.APP_SECRET);
  return c.json({ id: g.gymId, code: g.code, status: 'active' }, 201);
});

app.post('/v1/admin/gyms/:id/status', adminOnly, async (c) => {
  const b = await body(c);
  if (b.status !== 'active' && b.status !== 'pending' && b.status !== 'suspended') return fail(c, 400, 'invalid', 'status must be active, pending or suspended.');
  const r = await c.env.DB.prepare('UPDATE gyms SET status = ? WHERE id = ?').bind(b.status, c.req.param('id')).run();
  return r.meta.changes === 1 ? c.json({ ok: true, status: b.status }) : fail(c, 404, 'not_found', 'Gym not found.');
});

/** Opens a gym as its owner for a day, so you can set it up for them on the spot. */
app.post('/v1/admin/gyms/:id/open', adminOnly, async (c) => {
  const owner = await c.env.DB.prepare("SELECT u.id, u.name, u.gym_id FROM users u WHERE u.gym_id = ? AND u.role = 'owner'").bind(c.req.param('id')).first<{ id: string; name: string; gym_id: string }>();
  const g = owner ? await c.env.DB.prepare('SELECT * FROM gyms WHERE id = ?').bind(owner.gym_id).first<GymRow>() : null;
  if (!owner || !g) return fail(c, 404, 'not_found', 'Gym not found.');
  const token = await issueSession(c.env.DB, { gymId: g.id, role: 'owner', userId: owner.id }, 1);
  return c.json({ token, name: owner.name, gym: fullGym(g) });
});

/** Sets a new password for an owner who has forgotten theirs. */
app.post('/v1/admin/gyms/:id/password', adminOnly, async (c) => {
  const b = await body(c);
  const password = typeof b.password === 'string' && b.password.length >= 8 && b.password.length <= 100 ? b.password : null;
  if (!password) return fail(c, 400, 'invalid', 'Use a password of 8 or more characters.');
  const r = await c.env.DB.prepare("UPDATE users SET secret = ? WHERE gym_id = ? AND role = 'owner'").bind(await hashSecret(password, c.env.APP_SECRET), c.req.param('id')).run();
  if (r.meta.changes === 0) return fail(c, 404, 'not_found', 'Gym not found.');
  await c.env.DB.prepare("DELETE FROM sessions WHERE gym_id = ? AND role = 'owner'").bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

app.notFound((c) => c.json({ error: 'not_found', message: 'No such route.' }, 404));
app.onError((e, c) => {
  console.error(e);
  return c.json({ error: 'server_error', message: 'Something went wrong on our side.' }, 500);
});

export default app;

