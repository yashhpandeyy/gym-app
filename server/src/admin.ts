import type { Hono } from 'hono';

import {
  adminOnly,
  adminToken,
  blocked,
  body,
  adminLoginOf,
  emailTaken,
  fail,
  fullGym,
  ip,
  json,
  nowIso,
  nowSec,
  publicGym,
  recordFail,
  text,
  type AppEnv,
  type Ctx,
  type GymRow,
} from './core';
import { hashSecret, newId, randomToken, sha256 } from './crypto';
import adminPage from './pages/admin.html';
import resetPage from './pages/reset.html';

/**
 * The developer console (/admin) and what only it needs: a gym in full, a backup, deleting a gym,
 * one-time password reset links for owners, and one-time links that create an admin account.
 * The first admin routes (list, create, status, open as owner, set password) stay in index.ts.
 */

const RESET_HOURS = 24;
const LINK_GONE = 'This link has expired or was already used. Ask for a new one.';

/** Every table holding a gym's rows, children before parents so foreign keys never block a delete. */
const GYM_TABLES = ['sessions', 'invites', 'pairings', 'password_resets', 'docs', 'gym_logos', 'gym_seq', 'members', 'users'] as const;

type Gym = GymRow & { created_at: string };

const passwordOf = (v: unknown) => (typeof v === 'string' && v.length >= 8 && v.length <= 100 ? v : null);
const isToken = (v: unknown): v is string => typeof v === 'string' && v.length >= 20 && v.length <= 100;
const gymById = (db: D1Database, id: string) => db.prepare('SELECT * FROM gyms WHERE id = ?').bind(id).first<Gym>();
const isoOf = (sec: number) => new Date(sec * 1000).toISOString();

/** Serves one of the HTML pages with a fresh script nonce and a strict content policy. */
function page(c: Ctx, html: string) {
  const nonce = randomToken(16);
  return c.html(html.replaceAll('__NONCE__', nonce), 200, {
    'content-security-policy': [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      "style-src 'unsafe-inline' https://fonts.googleapis.com",
      'font-src https://fonts.gstatic.com',
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
    'x-content-type-options': 'nosniff',
  });
}

/** Everything worth keeping about a gym. Leaves out password hashes and sign-in state. */
async function backupOf(db: D1Database, g: Gym) {
  const [users, members, docs, logo] = await db.batch([
    db.prepare('SELECT id, role, name, phone, email, created_at FROM users WHERE gym_id = ?').bind(g.id),
    db.prepare('SELECT * FROM members WHERE gym_id = ?').bind(g.id),
    db.prepare('SELECT kind, id, member_id, data, seq, deleted, at FROM docs WHERE gym_id = ? ORDER BY seq').bind(g.id),
    db.prepare('SELECT type, data FROM gym_logos WHERE gym_id = ?').bind(g.id),
  ]);
  return {
    exportedAt: nowIso(),
    gym: { ...g, features: json(g.features), settings: json(g.settings) },
    users: users.results as { role: string; email: string | null }[],
    members: members.results,
    docs: (docs.results as { data: string }[]).map((d) => ({ ...d, data: json(d.data) })),
    logo: logo.results[0] ?? null,
  };
}

export function registerAdmin(app: Hono<AppEnv>) {
  app.get('/admin', (c) => page(c, adminPage));
  app.get('/reset', (c) => page(c, resetPage));

  // -------------------------------------------------------------------------
  // Looking after one gym
  // -------------------------------------------------------------------------

  /** One gym in full: owner and staff, members, what it has set up, and who is signed in. */
  app.get('/v1/admin/gyms/:id', adminOnly, async (c) => {
    const db = c.env.DB;
    const g = await gymById(db, c.req.param('id'));
    if (!g) return fail(c, 404, 'not_found', 'Gym not found.');
    const now = nowSec();
    const [people, members, records, sessions, reset] = await db.batch([
      db.prepare("SELECT id, role, name, phone, email, created_at FROM users WHERE gym_id = ? ORDER BY role = 'staff', created_at").bind(g.id),
      db.prepare('SELECT id, code, name, phone, email, created_at FROM members WHERE gym_id = ? ORDER BY created_at DESC LIMIT 500').bind(g.id),
      db.prepare('SELECT kind, COUNT(*) AS n FROM docs WHERE gym_id = ? AND deleted = 0 GROUP BY kind ORDER BY kind').bind(g.id),
      db.prepare('SELECT role, COUNT(*) AS n, MAX(created_at) AS last FROM sessions WHERE gym_id = ? AND expires_at > ? GROUP BY role').bind(g.id, now),
      db.prepare('SELECT MAX(expires_at) AS until FROM password_resets WHERE gym_id = ? AND expires_at > ?').bind(g.id, now),
    ]);
    const until = (reset.results[0] as { until: number | null } | undefined)?.until;
    return c.json({
      gym: { ...fullGym(g), createdAt: g.created_at },
      people: people.results,
      members: members.results,
      records: records.results,
      sessions: sessions.results,
      resetLinkUntil: until ? isoOf(until) : null,
    });
  });

  /** A backup of one gym as JSON, without passwords. */
  app.get('/v1/admin/gyms/:id/export', adminOnly, async (c) => {
    const g = await gymById(c.env.DB, c.req.param('id'));
    if (!g) return fail(c, 404, 'not_found', 'Gym not found.');
    return c.json(await backupOf(c.env.DB, g));
  });

  /** Deletes a gym and everything in it, for good. The body must repeat the gym's code; the reply carries a backup. */
  app.delete('/v1/admin/gyms/:id', adminOnly, async (c) => {
    const db = c.env.DB;
    const g = await gymById(db, c.req.param('id'));
    if (!g) return fail(c, 404, 'not_found', 'Gym not found.');
    const b = await body(c);
    if (typeof b.confirm !== 'string' || b.confirm.trim().toUpperCase() !== g.code) return fail(c, 400, 'confirm', `Type the gym code ${g.code} to confirm.`);
    const backup = await backupOf(db, g);
    const lockouts = backup.users.filter((u) => u.role === 'owner' && u.email).map((u) => `owner:${u.email!.toLowerCase()}`);
    await db.batch([
      ...GYM_TABLES.map((t) => db.prepare(`DELETE FROM ${t} WHERE gym_id = ?`).bind(g.id)),
      db.prepare('DELETE FROM gyms WHERE id = ?').bind(g.id),
      ...lockouts.map((k) => db.prepare('DELETE FROM attempts WHERE key = ?').bind(k)),
    ]);
    return c.json({ ok: true, backup });
  });

  // -------------------------------------------------------------------------
  // Password reset links: the admin makes one, the owner opens /reset#<token>
  // -------------------------------------------------------------------------

  /** A one-time link the owner opens to pick their own password. A new link cancels the last one. */
  app.post('/v1/admin/gyms/:id/reset-link', adminOnly, async (c) => {
    const db = c.env.DB;
    const owner = await db.prepare("SELECT id, email FROM users WHERE gym_id = ? AND role = 'owner'").bind(c.req.param('id')).first<{ id: string; email: string | null }>();
    if (!owner) return fail(c, 404, 'not_found', 'Gym not found.');
    const token = randomToken(32);
    const expiresAt = nowSec() + RESET_HOURS * 3600;
    await db.batch([
      db.prepare('DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?').bind(owner.id, nowSec()),
      db.prepare('INSERT INTO password_resets (token_hash, user_id, gym_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(await sha256(token), owner.id, c.req.param('id'), expiresAt, nowIso()),
    ]);
    return c.json({ url: `${new URL(c.req.url).origin}/reset#${token}`, email: owner.email, expiresAt: isoOf(expiresAt) }, 201);
  });

  const resetFor = async (db: D1Database, token: unknown) =>
    isToken(token)
      ? db
          .prepare(
            `SELECT r.token_hash, r.user_id, u.email, g.* FROM password_resets r
             JOIN users u ON u.id = r.user_id JOIN gyms g ON g.id = r.gym_id
             WHERE r.token_hash = ? AND r.expires_at > ?`,
          )
          .bind(await sha256(token), nowSec())
          .first<Gym & { token_hash: string; user_id: string; email: string | null }>()
      : null;

  /** What the reset page shows before the owner picks a password: the gym and the email they sign in with. */
  app.post('/v1/auth/reset/check', async (c) => {
    const key = `link-ip:${ip(c)}`;
    if (await blocked(c.env.DB, key, 30, 900)) return fail(c, 429, 'too_many', 'Too many tries. Wait 15 minutes.');
    const r = await resetFor(c.env.DB, (await body(c)).token);
    if (!r) {
      await recordFail(c.env.DB, key, 900);
      return fail(c, 410, 'expired', LINK_GONE);
    }
    const g = publicGym(r);
    return c.json({ gymName: g.name, primaryColor: g.primaryColor, logoUrl: r.status === 'active' ? g.logoUrl : null, email: r.email });
  });

  /** Sets the new password, uses up the link, lifts any sign-in lockout and signs the owner out everywhere. */
  app.post('/v1/auth/reset', async (c) => {
    const db = c.env.DB;
    const key = `link-ip:${ip(c)}`;
    if (await blocked(db, key, 30, 900)) return fail(c, 429, 'too_many', 'Too many tries. Wait 15 minutes.');
    const b = await body(c);
    const password = passwordOf(b.password);
    if (!password) return fail(c, 400, 'invalid', 'Use a password of 8 or more characters.');
    const r = await resetFor(db, b.token);
    if (!r) {
      await recordFail(db, key, 900);
      return fail(c, 410, 'expired', LINK_GONE);
    }
    // The update only lands while the link still exists, so two taps at once can't both use it.
    const [changed] = await db.batch([
      db.prepare('UPDATE users SET secret = ? WHERE id = ? AND EXISTS (SELECT 1 FROM password_resets WHERE token_hash = ?)').bind(await hashSecret(password, c.env.APP_SECRET), r.user_id, r.token_hash),
      db.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(r.user_id),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(r.user_id),
      db.prepare('DELETE FROM attempts WHERE key = ?').bind(`owner:${(r.email ?? '').toLowerCase()}`),
    ]);
    if (changed.meta.changes !== 1) return fail(c, 410, 'expired', LINK_GONE);
    return c.json({ ok: true, email: r.email });
  });

  // -------------------------------------------------------------------------
  // Admin setup links: /admin#setup=<token>, made by scripts/admin-link.mjs
  // -------------------------------------------------------------------------

  const inviteFor = async (db: D1Database, token: unknown) =>
    isToken(token) ? db.prepare('SELECT token_hash FROM admin_invites WHERE token_hash = ? AND expires_at > ?').bind(await sha256(token), nowSec()).first<{ token_hash: string }>() : null;

  app.post('/v1/admin/setup/check', async (c) => {
    const key = `link-ip:${ip(c)}`;
    if (await blocked(c.env.DB, key, 30, 900)) return fail(c, 429, 'too_many', 'Too many tries. Wait 15 minutes.');
    if (await inviteFor(c.env.DB, (await body(c)).token)) return c.json({ ok: true });
    await recordFail(c.env.DB, key, 900);
    return fail(c, 410, 'expired', 'This setup link has expired or was already used. Make a new one.');
  });

  /** Creates an admin account from a setup link, once, and signs it in. */
  app.post('/v1/admin/setup', async (c) => {
    const db = c.env.DB;
    const key = `link-ip:${ip(c)}`;
    if (await blocked(db, key, 30, 900)) return fail(c, 429, 'too_many', 'Too many tries. Wait 15 minutes.');
    const b = await body(c);
    const email = adminLoginOf(b.email);
    const name = text(b.name, 2, 60);
    const password = passwordOf(b.password);
    if (!email || !name || !password) return fail(c, 400, 'invalid', 'Enter your name, an email or a username (3 to 40 letters, digits, dots, dashes or underscores), and a password of 8 or more characters.');
    const invite = await inviteFor(db, b.token);
    if (!invite) {
      await recordFail(db, key, 900);
      return fail(c, 410, 'expired', 'This setup link has expired or was already used. Make a new one.');
    }
    if (await emailTaken(db, email)) return fail(c, 409, 'email_taken', 'That email signs in to a gym. Use a different one for your admin account.');
    if (await db.prepare('SELECT 1 AS x FROM admins WHERE email = ?').bind(email).first()) return fail(c, 409, 'exists', 'That admin already exists. Sign in instead.');
    const id = newId('adm');
    const [created] = await db.batch([
      db
        .prepare('INSERT INTO admins (id, email, name, secret, created_at) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM admin_invites WHERE token_hash = ?)')
        .bind(id, email, name, await hashSecret(password, c.env.APP_SECRET), nowIso(), invite.token_hash),
      db.prepare('DELETE FROM admin_invites WHERE token_hash = ? OR expires_at < ?').bind(invite.token_hash, nowSec()),
    ]);
    if (created.meta.changes !== 1) return fail(c, 410, 'expired', 'This setup link was already used. Sign in instead.');
    return c.json({ token: await adminToken(c.env, id), role: 'admin', name }, 201);
  });
}
