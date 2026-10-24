import { Hono, type Context, type MiddlewareHandler } from 'hono';

import { DEFAULT_PLANS, DEFAULT_SETTINGS } from './defaults';
import { hashSecret, hmacCode, newId, randomToken, safeEqual, sha256 } from './crypto';

export type Env = { DB: D1Database; ADMIN_TOKEN: string; APP_SECRET: string; SIGNUP_REVIEW?: string };
export type Role = 'owner' | 'staff' | 'member';
export type Sess = { gymId: string; role: Role; userId: string | null; memberId: string | null };
export type AppEnv = { Bindings: Env; Variables: { s: Sess; admin: { id: string | null; master: boolean } } };
export type Ctx = Context<AppEnv>;


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const nowSec = () => Math.floor(Date.now() / 1000);
export const nowIso = () => new Date().toISOString();
/** Gyms are in India for now, so "today" means today in IST. */
export const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
export function addMonths(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export const fail = (c: Ctx, status: 400 | 401 | 403 | 404 | 409 | 410 | 429, error: string, message: string) => c.json({ error, message }, status);

export async function body(c: Ctx): Promise<Record<string, unknown>> {
  try {
    const b = await c.req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const text = (v: unknown, min: number, max: number) => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= min && t.length <= max ? t : null;
};

/** Indian mobile numbers are compared on their last ten digits. */
export const phoneOf = (v: unknown) => {
  if (typeof v !== 'string') return null;
  const d = v.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? d : null;
};

export const ip = (c: Ctx) => c.req.header('cf-connecting-ip') ?? 'local';

/** True once `key` has failed `max` times inside the window. */
export async function blocked(db: D1Database, key: string, max: number, windowSec: number) {
  const row = await db.prepare('SELECT count, window_start FROM attempts WHERE key = ?').bind(key).first<{ count: number; window_start: number }>();
  return !!row && nowSec() - row.window_start <= windowSec && row.count >= max;
}

export async function recordFail(db: D1Database, key: string, windowSec: number) {
  const t = nowSec();
  await db
    .prepare(
      `INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN ? - window_start > ? THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN ? - window_start > ? THEN ? ELSE window_start END`,
    )
    .bind(key, t, t, windowSec, t, windowSec, t)
    .run();
}

export const clearFails = (db: D1Database, key: string) => db.prepare('DELETE FROM attempts WHERE key = ?').bind(key).run();

/** How long a session lasts, and how close to its end it gets swapped for a fresh one. */
export const SESSION_DAYS: Record<Role, number> = { owner: 30, staff: 30, member: 14 };
export const RENEW_WITHIN_DAYS: Record<Role, number> = { owner: 5, staff: 5, member: 2 };

export async function issueSession(db: D1Database, s: { gymId: string; role: Role; userId?: string; memberId?: string }, days?: number) {
  const token = randomToken(32);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowSec() - 86400),
    db
      .prepare('INSERT INTO sessions (token_hash, gym_id, role, user_id, member_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(await sha256(token), s.gymId, s.role, s.userId ?? null, s.memberId ?? null, nowSec() + (days ?? SESSION_DAYS[s.role]) * 86400, nowIso()),
  ]);
  return token;
}

export type GymRow = {
  id: string;
  code: string;
  name: string;
  tagline: string;
  primary_color: string;
  logo_key: string | null;
  features: string;
  settings: string;
  status: 'pending' | 'active' | 'suspended';
};

export const gymByCode = (db: D1Database, code: unknown) =>
  typeof code === 'string' ? db.prepare('SELECT * FROM gyms WHERE code = ?').bind(code.trim().toUpperCase()).first<GymRow>() : Promise.resolve(null);

export const json = (s: string) => {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
};

/** What anyone holding the gym code may see: branding only, never people or numbers. */
export const publicGym = (g: GymRow) => ({
  code: g.code,
  name: g.name,
  tagline: g.tagline,
  primaryColor: g.primary_color,
  logoUrl: g.logo_key ? `/v1/gyms/${g.code}/logo?v=${g.logo_key}` : null,
  features: json(g.features),
});

/** Business details the gym fills in: how to reach it, where it is, when it's open. Shown only to signed-in people. */
export function cleanProfile(p: unknown) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const o = p as Record<string, any>;
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  const hours = (Array.isArray(o.hours) ? o.hours : [])
    .slice(0, 7)
    .map((h: any) => ({
      label: s(h?.label, 40),
      days: (Array.isArray(h?.days) ? h.days : []).filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6),
      open: s(h?.open, 5),
      close: s(h?.close, 5),
    }))
    .filter((h: { days: number[]; open: string; close: string }) => h.days.length > 0 && hhmm.test(h.open) && hhmm.test(h.close) && h.close > h.open);
  return {
    contact: {
      phone: s(o.contact?.phone, 20),
      phoneDisplay: s(o.contact?.phoneDisplay, 30),
      whatsapp: s(o.contact?.whatsapp, 20).replace(/\D/g, ''),
      email: s(o.contact?.email, 120),
      instagram: s(o.contact?.instagram, 40).replace(/^@/, ''),
    },
    address: { line1: s(o.address?.line1, 80), line2: s(o.address?.line2, 80), mapsQuery: s(o.address?.mapsQuery, 120) },
    hours,
    amenities: (Array.isArray(o.amenities) ? o.amenities : []).map((a: unknown) => s(a, 40)).filter(Boolean).slice(0, 24),
    currency: { code: s(o.currency?.code, 3) || 'INR', locale: s(o.currency?.locale, 12) || 'en-IN', symbol: s(o.currency?.symbol, 3) || '₹' },
    referral: { reward: s(o.referral?.reward, 160) },
  };
}

/** What a signed-in person sees of their gym: branding plus the business details. */
export const fullGym = (g: GymRow) => ({ ...publicGym(g), id: g.id, status: g.status, profile: (json(g.settings).profile as unknown) ?? null });

// A real hash to compare against when the account doesn't exist, so timing doesn't reveal it.
let dummy: Promise<string> | undefined;
export const dummyHash = (pepper: string) => (dummy ??= hashSecret(randomToken(8), pepper));

/**
 * A short code the owner can say out loud: the gym's initials and two digits, such as FK20 for
 * "Fitness King". It only unlocks the gym's branding, so being guessable costs nothing. When a
 * code is taken, later attempts use three and then four digits.
 */
export function gymCode(name: string, attempt: number) {
  const words = name.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? 'GY').slice(0, 2).padEnd(2, 'X');
  const digits = attempt < 10 ? 2 : attempt < 16 ? 3 : 4;
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % (9 * 10 ** (digits - 1));
  return letters + String(10 ** (digits - 1) + n);
}

export async function createGym(
  db: D1Database,
  p: { gymName: string; ownerName: string; email: string; phone: string; password: string; status: 'pending' | 'active'; primaryColor?: string },
  pepper: string,
) {
  const gymId = newId('gym');
  const userId = newId('usr');
  const secret = await hashSecret(p.password, pepper);
  for (let i = 0; i < 20; i++) {
    const code = gymCode(p.gymName, i);
    try {
      const starter = [{ kind: 'settings', id: 'gym', data: DEFAULT_SETTINGS }, ...DEFAULT_PLANS.map((plan) => ({ kind: 'plans', id: plan.id, data: plan }))];
      await db.batch([
        db
          .prepare('INSERT INTO gyms (id, code, name, primary_color, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(gymId, code, p.gymName, p.primaryColor ?? '#2F45FF', p.status, nowIso()),
        db
          .prepare('INSERT INTO users (id, gym_id, role, name, phone, email, secret, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(userId, gymId, 'owner', p.ownerName, p.phone, p.email, secret, nowIso()),
        db.prepare('INSERT INTO gym_seq (gym_id, seq) VALUES (?, ?)').bind(gymId, starter.length),
        ...starter.map((d, i) =>
          db
            .prepare('INSERT INTO docs (gym_id, kind, id, member_id, data, seq, deleted) VALUES (?, ?, ?, NULL, ?, ?, 0)')
            .bind(gymId, d.kind, d.id, JSON.stringify(d.data), i + 1),
        ),
      ]);
      return { gymId, userId, code };
    } catch (e) {
      // Only a clash on the gym code is worth retrying with a new one.
      if (!String(e).includes('gyms.code')) throw e;
    }
  }
  throw new Error('could not allocate a gym code');
}

export const emailOf = (v: unknown) => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
};

export const emailTaken = (db: D1Database, email: string) => db.prepare("SELECT 1 AS x FROM users WHERE role = 'owner' AND lower(email) = ?").bind(email).first();

export function signupFields(b: Record<string, unknown>) {
  const gymName = text(b.gymName, 2, 60);
  const ownerName = text(b.ownerName, 2, 60);
  const email = emailOf(b.email);
  const phone = phoneOf(b.phone) ?? '';
  const password = typeof b.password === 'string' && b.password.length >= 8 && b.password.length <= 100 ? b.password : null;
  const primaryColor = typeof b.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.primaryColor) ? b.primaryColor : undefined;
  return gymName && ownerName && email && password ? { gymName, ownerName, email, phone, password, primaryColor } : null;
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

/**
 * Resolves the bearer token to a session and the gym it belongs to. Everything downstream scopes
 * its queries by `s.gymId`, so a token can never reach another gym's rows.
 */
export function auth(opts: { roles?: Role[]; allowPending?: boolean } = {}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const m = /^Bearer (.{20,})$/.exec(c.req.header('authorization') ?? '');
    if (!m) return fail(c, 401, 'unauthorized', 'Sign in first.');
    const row = await c.env.DB.prepare(
      `SELECT s.gym_id, s.role, s.user_id, s.member_id, s.expires_at, s.renewed_at, g.status
       FROM sessions s JOIN gyms g ON g.id = s.gym_id WHERE s.token_hash = ?`,
    )
      .bind(await sha256(m[1]))
      .first<{ gym_id: string; role: Role; user_id: string | null; member_id: string | null; expires_at: number; renewed_at: number | null; status: string }>();
    if (!row || row.expires_at < nowSec()) return fail(c, 401, 'unauthorized', 'Your session has ended. Sign in again.');
    if (row.status === 'suspended') return fail(c, 403, 'gym_suspended', 'This gym’s app access is paused.');
    if (row.status === 'pending' && !opts.allowPending) return fail(c, 403, 'gym_pending', 'This gym is waiting to be activated.');
    if (opts.roles && !opts.roles.includes(row.role)) return fail(c, 403, 'forbidden', 'You can’t do that.');
    c.set('s', { gymId: row.gym_id, role: row.role, userId: row.user_id, memberId: row.member_id });

    // Keep people signed in while they use the app: close to expiry, hand back a fresh token. The
    // old one lives on for ten minutes so a lost response doesn't sign anyone out, and the
    // `renewed_at` guard makes sure only one of several simultaneous requests does the swap.
    if (row.renewed_at === null && row.expires_at - nowSec() < RENEW_WITHIN_DAYS[row.role] * 86400) {
      const swap = await c.env.DB.prepare('UPDATE sessions SET renewed_at = ?, expires_at = ? WHERE token_hash = ? AND renewed_at IS NULL')
        .bind(nowSec(), nowSec() + 600, await sha256(m[1]))
        .run();
      if (swap.meta.changes === 1) {
        c.header('x-session-token', await issueSession(c.env.DB, { gymId: row.gym_id, role: row.role, userId: row.user_id ?? undefined, memberId: row.member_id ?? undefined }));
      }
    }
    await next();
  };
}

export const staffOnly = auth({ roles: ['owner', 'staff'] });
export const ownerOnly = auth({ roles: ['owner'] });

const ADMIN_DAYS = 30;
const ADMIN_RENEW_DAYS = 5;

/** A signed token for a platform admin. Nothing is stored; the signature and expiry are the proof. */
export async function adminToken(env: Env, adminId: string) {
  const exp = nowSec() + ADMIN_DAYS * 86400;
  return `adm.${adminId}.${exp}.${await hmacCode(env.APP_SECRET, 'admin', `${adminId}.${exp}`)}`;
}

/** Who is calling an admin route: the master token (for scripts) or a signed-in admin. */
async function adminFrom(c: Ctx): Promise<{ id: string | null; master: boolean; renew?: boolean } | null> {
  const m = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '');
  if (!m) return null;
  if (c.env.ADMIN_TOKEN && safeEqual(m[1], c.env.ADMIN_TOKEN)) return { id: null, master: true };
  const [kind, id, exp, sig] = m[1].split('.');
  if (kind !== 'adm' || !id || !sig || !/^\d+$/.test(exp ?? '') || Number(exp) < nowSec()) return null;
  if (!safeEqual(await hmacCode(c.env.APP_SECRET, 'admin', `${id}.${exp}`), sig)) return null;
  const row = await c.env.DB.prepare('SELECT id FROM admins WHERE id = ?').bind(id).first();
  return row ? { id, master: false, renew: Number(exp) - nowSec() < ADMIN_RENEW_DAYS * 86400 } : null;
}

export const adminOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  const who = await adminFrom(c);
  if (!who) return fail(c, 401, 'unauthorized', 'Admin only.');
  c.set('admin', who);
  if (who.renew && who.id) c.header('x-session-token', await adminToken(c.env, who.id));
  await next();
};

