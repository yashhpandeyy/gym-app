import type { Hono } from 'hono';

import { drawPrize } from '../../shared/rules';
import { addDays, auth, body, fail, nowIso, todayIST, type AppEnv, type Role } from './core';
import { newId } from './crypto';

/**
 * How every device keeps the same gym in step. Each record the app stores is a small JSON document
 * with a `kind` ("bookings"), an `id`, and a position in the gym's change log (`seq`). Devices ask
 * for "everything after N" and send their own changes. This file decides who may see and change
 * what, so the app can't be talked into doing more than its role allows.
 */

type Doc = Record<string, unknown> | unknown[];

type Spec = {
  /** gym: one shared document. member: it belongs to a member. */
  scope: 'gym' | 'member';
  /** Where the owning member's id lives: the document id, or one of its fields. */
  owner?: 'id' | 'memberId' | 'hostId';
  /** What other members may see of it: nothing, all of it, or a reduced version. */
  others: 'none' | 'all' | 'project';
  /** For other members' documents: only this many days back are sent. */
  windowDays?: number;
  /** Who may change it. */
  write: 'staff' | 'own';
  /** Timestamp or date used for the window. */
  at?: (d: Record<string, unknown>) => string | null;
  project?: (d: Doc) => Doc;
};

const str = (v: unknown) => (typeof v === 'string' ? v : null);
const dateOf = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : null);

const config = (): Spec => ({ scope: 'gym', others: 'all', write: 'staff' });
const mine = (owner: 'id' | 'memberId' | 'hostId', extra: Partial<Spec> = {}): Spec => ({ scope: 'member', owner, others: 'none', write: 'own', ...extra });

const SPECS: Record<string, Spec> = {
  // The gym's own setup. Everyone reads it, staff change it.
  plans: config(),
  settings: config(),
  slots: config(),
  closures: config(),
  classes: config(),
  trainers: config(),
  announcements: config(),
  challenges: config(),
  leads: { scope: 'gym', others: 'none', write: 'staff' },

  // People and what they did. Other members see only what a leaderboard or a "spots left" count needs.
  members: mine('id', {
    others: 'project',
    project: (d) => {
      const m = d as Record<string, unknown>;
      const parts = String(m.name ?? '').trim().split(/\s+/);
      const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] ?? '';
      return { id: m.id, name: short, gender: m.gender, preferredSlotId: m.preferredSlotId, joinedOn: m.joinedOn, weeklyGoal: m.weeklyGoal, referredBy: m.referredBy };
    },
  }),
  bookings: mine('memberId', { others: 'project', windowDays: 1, at: (d) => dateOf(d.date), project: (d) => d }),
  checkins: mine('memberId', { others: 'project', windowDays: 30, write: 'staff', at: (d) => dateOf(d.at), project: (d) => d }),
  xp: mine('memberId', {
    others: 'project',
    windowDays: 14,
    at: (d) => dateOf(d.at),
    project: (d) => {
      const e = d as Record<string, unknown>;
      return { id: e.id, memberId: e.memberId, amount: e.amount, at: e.at, reason: '' };
    },
  }),
  lifts: mine('memberId', { others: 'all', windowDays: 90, at: (d) => dateOf(d.date) }),
  challengeEntries: mine('memberId', { others: 'all', windowDays: 40, at: (d) => dateOf(d.date) }),
  progress: mine('id', {
    others: 'project',
    project: (d) => {
      const list = Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
      const last = list[list.length - 1];
      return last ? [{ id: last.id, date: last.date, weight: last.weight }] : [];
    },
  }),

  // Private to the member and the gym team.
  pauses: mine('memberId'),
  payments: mine('memberId', { write: 'staff' }),
  ptRequests: mine('memberId'),
  tickets: mine('memberId'),
  notices: mine('memberId', { at: (d) => dateOf(d.at) }),
  chests: mine('memberId', { at: (d) => dateOf(d.earnedAt) }),
  guestPasses: mine('hostId'),
  mindLog: mine('memberId', { at: (d) => dateOf(d.at) }),
  workouts: mine('id', { write: 'staff' }),
  dietPlans: mine('id', { write: 'staff' }),
  workoutLog: mine('id'),
  mealLog: mine('id'),
  water: mine('id'),
  leagueTier: mine('id'),
  leagueSettledWeek: mine('id'),
  ringClaims: mine('id'),
  supplements: mine('id'),
};

const MAX_DOC_CHARS = 200_000;
const MAX_OPS = 20;
const PAGE = 5000;

type Row = { kind: string; id: string; member_id: string | null; data: string; seq: number; deleted: number; at: string | null };
type Out = { kind: string; id: string; seq: number; deleted: boolean; data?: Doc };

const ownerOf = (spec: Spec, id: string, data: unknown): string | null => {
  if (spec.scope === 'gym') return null;
  if (spec.owner === 'id') return id;
  const d = data as Record<string, unknown> | null;
  const v = d && !Array.isArray(d) ? str(d[spec.owner as string]) : null;
  return v;
};

/** What a viewer is allowed to see of a stored row. */
function view(row: Row, role: Role, me: string | null, today: string): Out | null {
  const spec = SPECS[row.kind];
  if (!spec) return null;
  const base = { kind: row.kind, id: row.id, seq: row.seq };
  if (row.deleted) return { ...base, deleted: true };
  const data = JSON.parse(row.data) as Doc;
  if (role !== 'member') return { ...base, deleted: false, data };
  if (row.member_id !== null && row.member_id === me) return { ...base, deleted: false, data };
  if (spec.scope === 'gym') return spec.others === 'all' ? { ...base, deleted: false, data } : null;
  if (row.kind === 'notices' && row.member_id === null) return { ...base, deleted: false, data };
  if (spec.others === 'none') return null;
  if (spec.windowDays !== undefined && row.at && row.at < addDays(today, -spec.windowDays)) return null;
  return { ...base, deleted: false, data: spec.others === 'project' && spec.project ? spec.project(data) : data };
}

const pick = (src: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((k) => k in src).map((k) => [k, src[k]]));

/** The few fields a member may change on their own record. Everything else stays as the gym set it. */
const MEMBER_SELF_FIELDS = ['name', 'gender', 'goalWeight', 'weeklyGoal', 'preferredSlotId', 'bonusUsed'];

type Existing = Map<string, { member_id: string | null; data: Doc; deleted: boolean }>;

type Verdict = { ok: true; data?: Doc } | { ok: false; error: string };
const no = (error: string): Verdict => ({ ok: false, error });

type Ctx = { role: Role; me: string | null; settings: Record<string, unknown>; xpToday: number; chestsToday: number };

/** Extra rules for what members, as opposed to staff, may write. Staff are trusted with everything else. */
function memberMayWrite(kind: string, id: string, d: Doc, ex: Existing, c: Ctx): Verdict {
  const spec = SPECS[kind];
  const old = ex.get(`${kind}/${id}`);
  const had = !!old && !old.deleted;
  const me = c.me;
  const rec = (Array.isArray(d) ? {} : d) as Record<string, unknown>;
  const was = (had ? old!.data : {}) as Record<string, unknown>;

  if (spec.write === 'staff') return no('forbidden');
  const owner = ownerOf(spec, id, d);

  switch (kind) {
    case 'members': {
      if (!had || id !== me) return no('forbidden');
      return { ok: true, data: { ...was, ...pick(rec, MEMBER_SELF_FIELDS) } };
    }
    case 'bookings': {
      if (owner === me) {
        if (had && (was.memberId !== me || was.refId !== rec.refId || was.date !== rec.date)) return no('forbidden');
        return { ok: true };
      }
      // A cancelled booking frees a spot, and the next person on the waitlist moves up.
      if (had && was.status === 'waitlist' && rec.status === 'booked' && was.memberId === rec.memberId && was.refId === rec.refId && was.date === rec.date) return { ok: true };
      return no('forbidden');
    }
    case 'pauses': {
      if (owner !== me) return no('forbidden');
      if (!had) {
        if (rec.status === 'pending') return { ok: true };
        if (rec.status === 'approved' && c.settings.autoApprovePause === true) return { ok: true };
        return no('needs_approval');
      }
      if (was.memberId !== me || was.start !== rec.start) return no('forbidden');
      if (rec.status === 'cancelled' && (was.status === 'pending' || was.status === 'approved')) return { ok: true };
      if (was.status === 'approved' && rec.status === 'approved' && typeof rec.end === 'string' && typeof was.end === 'string' && rec.end <= was.end) return { ok: true };
      return no('forbidden');
    }
    case 'ptRequests':
    case 'tickets':
      return owner === me && !had ? { ok: true } : no('forbidden');
    case 'notices': {
      if (owner === me) return had && was.memberId !== me ? no('forbidden') : { ok: true };
      if (!had && (rec.kind === 'booking' || rec.kind === 'class') && owner) return { ok: true };
      return no('forbidden');
    }
    case 'guestPasses':
      return owner === me && !had ? { ok: true } : no('forbidden');
    case 'leads':
      return !had && rec.hostId === me ? { ok: true } : no('forbidden');
    case 'xp': {
      if (owner !== me || had) return no('forbidden');
      const amount = Number(rec.amount);
      if (!Number.isInteger(amount) || amount < 1 || amount > 150) return no('invalid');
      if (c.xpToday + amount > 600) return no('daily_limit');
      return { ok: true };
    }
    case 'chests': {
      if (owner !== me) return no('forbidden');
      if (!had) {
        if (rec.openedAt || rec.prize || rec.redeemedAt) return no('forbidden');
        if (c.chestsToday >= 4) return no('daily_limit');
        return { ok: true };
      }
      // Opening and redeeming are the server's and the desk's business, never the app's.
      if (was.openedAt !== rec.openedAt || JSON.stringify(was.prize) !== JSON.stringify(rec.prize) || was.redeemedAt !== rec.redeemedAt) return no('forbidden');
      return { ok: true };
    }
    case 'lifts':
    case 'challengeEntries':
    case 'mindLog':
      if (owner !== me) return no('forbidden');
      return had && was.memberId !== me ? no('forbidden') : { ok: true };
    default:
      // Per-member records keyed by member id (progress, meal log, water, supplements...).
      return spec.owner === 'id' && id === me ? { ok: true } : no('forbidden');
  }
}

export function registerSync(app: Hono<AppEnv>) {
  /** Everything that changed after `since` that this person may see. */
  app.get('/v1/sync', auth(), async (c) => {
    const s = c.get('s');
    const since = Math.max(0, Number(c.req.query('since')) || 0);
    const today = todayIST();
    const args: (string | number)[] = [s.gymId, since];
    let where = 'gym_id = ? AND seq > ?';

    if (s.role === 'member') {
      const gymKinds = Object.entries(SPECS).filter(([, v]) => v.scope === 'gym' && v.others === 'all').map(([k]) => k);
      const unwindowed = Object.entries(SPECS).filter(([, v]) => v.scope === 'member' && v.others !== 'none' && v.windowDays === undefined).map(([k]) => k);
      const windowed = Object.entries(SPECS).filter(([, v]) => v.scope === 'member' && v.others !== 'none' && v.windowDays !== undefined);
      const parts = [`kind IN (${gymKinds.map(() => '?').join(',')})`, 'member_id = ?', `kind IN (${unwindowed.map(() => '?').join(',')})`, "(kind = 'notices' AND member_id IS NULL)"];
      args.push(...gymKinds, s.memberId ?? '', ...unwindowed);
      for (const [k, v] of windowed) {
        parts.push('(kind = ? AND (at IS NULL OR at >= ? OR deleted = 1))');
        args.push(k, addDays(today, -(v.windowDays as number)));
      }
      where += ` AND (${parts.join(' OR ')})`;
    }

    const rows = await c.env.DB.prepare(`SELECT kind, id, member_id, data, seq, deleted, at FROM docs WHERE ${where} ORDER BY seq LIMIT ${PAGE}`)
      .bind(...args)
      .all<Row>();
    const docs = rows.results.map((r) => view(r, s.role, s.memberId, today)).filter((x): x is Out => x !== null);
    const more = rows.results.length === PAGE;
    let cursor = rows.results.length ? rows.results[rows.results.length - 1].seq : since;
    if (!more) {
      const head = await c.env.DB.prepare('SELECT seq FROM gym_seq WHERE gym_id = ?').bind(s.gymId).first<{ seq: number }>();
      cursor = Math.max(cursor, head?.seq ?? 0);
    }
    return c.json({ seq: cursor, more, docs });
  });

  /** Fetches specific documents, used by a device to repair itself after a change was refused. */
  app.post('/v1/sync/get', auth(), async (c) => {
    const s = c.get('s');
    const b = await body(c);
    const keys = (Array.isArray(b.keys) ? b.keys : []).filter((k): k is string => typeof k === 'string' && k.includes('/')).slice(0, MAX_OPS * 2);
    if (!keys.length) return c.json({ docs: [] });
    const pairs = keys.map((k) => [k.slice(0, k.indexOf('/')), k.slice(k.indexOf('/') + 1)] as const);
    const rows = await c.env.DB.prepare(`SELECT kind, id, member_id, data, seq, deleted, at FROM docs WHERE gym_id = ? AND (${pairs.map(() => '(kind = ? AND id = ?)').join(' OR ')})`)
      .bind(s.gymId, ...pairs.flat())
      .all<Row>();
    const found = new Set(rows.results.map((r) => `${r.kind}/${r.id}`));
    const today = todayIST();
    const docs = rows.results.map((r) => view(r, s.role, s.memberId, today)).filter((x): x is Out => x !== null);
    // Anything the server doesn't have is reported as deleted so the device drops its copy.
    for (const [kind, id] of pairs) if (!found.has(`${kind}/${id}`)) docs.push({ kind, id, seq: 0, deleted: true });
    return c.json({ docs });
  });

  /** Applies a batch of changes from one device. Each change is accepted or refused on its own. */
  app.post('/v1/sync/push', auth(), async (c) => {
    const s = c.get('s');
    const b = await body(c);
    const rawOps = Array.isArray(b.ops) ? (b.ops as unknown[]) : [];
    if (rawOps.length === 0) return c.json({ results: [] });
    if (rawOps.length > MAX_OPS) return fail(c, 400, 'invalid', `Send at most ${MAX_OPS} changes at a time.`);

    type Op = { kind: string; id: string; data: Doc | null };
    const results: { kind: string; id: string; ok: boolean; error?: string; data?: Doc }[] = [];
    const ops: (Op | null)[] = rawOps.map((o) => {
      const r = o as Record<string, unknown>;
      const kind = str(r.kind);
      const id = str(r.id);
      const data = r.data === null ? null : r.data && typeof r.data === 'object' ? (r.data as Doc) : undefined;
      if (!kind || !id || id.length > 100 || data === undefined || !SPECS[kind]) {
        results.push({ kind: kind ?? '?', id: id ?? '?', ok: false, error: 'invalid' });
        return null;
      }
      if (data !== null && JSON.stringify(data).length > MAX_DOC_CHARS) {
        results.push({ kind, id, ok: false, error: 'too_large' });
        return null;
      }
      return { kind, id, data };
    });
    const valid = ops.filter((o): o is Op => o !== null);
    if (!valid.length) return c.json({ results });

    // One read for every document these changes touch, plus what the rules need to look at.
    const need = new Set<string>(valid.map((o) => `${o.kind}/${o.id}`));
    for (const o of valid) {
      if (o.kind === 'bookings' && o.data && !Array.isArray(o.data) && typeof o.data.refId === 'string') {
        need.add(`${o.data.kind === 'class' ? 'classes' : 'slots'}/${o.data.refId}`);
      }
      if (o.kind === 'pauses') need.add('settings/gym');
    }
    const pairs = [...need].map((k) => [k.slice(0, k.indexOf('/')), k.slice(k.indexOf('/') + 1)] as const);
    const found = await c.env.DB.prepare(`SELECT kind, id, member_id, data, deleted FROM docs WHERE gym_id = ? AND (${pairs.map(() => '(kind = ? AND id = ?)').join(' OR ')})`)
      .bind(s.gymId, ...pairs.flat())
      .all<{ kind: string; id: string; member_id: string | null; data: string; deleted: number }>();
    const existing: Existing = new Map(found.results.map((r) => [`${r.kind}/${r.id}`, { member_id: r.member_id, data: JSON.parse(r.data) as Doc, deleted: !!r.deleted }]));

    const today = todayIST();
    const isMember = s.role === 'member';
    let xpToday = 0;
    let chestsToday = 0;
    if (isMember) {
      if (valid.some((o) => o.kind === 'xp' && o.data)) {
        const r = await c.env.DB.prepare("SELECT COALESCE(SUM(json_extract(data, '$.amount')), 0) AS n FROM docs WHERE gym_id = ? AND kind = 'xp' AND k1 = ? AND deleted = 0")
          .bind(s.gymId, `${s.memberId}:${today}`)
          .first<{ n: number }>();
        xpToday = r?.n ?? 0;
      }
      if (valid.some((o) => o.kind === 'chests' && o.data)) {
        const r = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE gym_id = ? AND kind = 'chests' AND k1 = ? AND deleted = 0")
          .bind(s.gymId, `${s.memberId}:${today}`)
          .first<{ n: number }>();
        chestsToday = r?.n ?? 0;
      }
    }
    const settingsDoc = existing.get('settings/gym');
    const ctx: Ctx = { role: s.role, me: s.memberId, settings: (settingsDoc && !Array.isArray(settingsDoc.data) ? settingsDoc.data : {}) as Record<string, unknown>, xpToday, chestsToday };

    type Plan = { op: Op; data: Doc | null; owner: string | null; conditional: boolean; capacity: number };
    const plan: Plan[] = [];
    const takenPhones = new Set<string>();

    for (const op of valid) {
      const spec = SPECS[op.kind];
      const key = `${op.kind}/${op.id}`;
      const old = existing.get(key);
      const had = !!old && !old.deleted;
      let data = op.data;
      let error: string | null = null;

      if (data === null) {
        if (isMember) error = 'forbidden';
        else if (!had) {
          // Nothing to delete. Report success so the device stops retrying.
          results.push({ kind: op.kind, id: op.id, ok: true });
          continue;
        }
      } else {
        if (op.kind === 'members' && s.role !== 'member' && !had) error = 'use_invite';
        else if (isMember) {
          const v = memberMayWrite(op.kind, op.id, data, existing, ctx);
          if (!v.ok) error = v.error;
          else if (v.data) data = v.data;
          if (op.kind === 'xp' && !error) ctx.xpToday += Number((data as Record<string, unknown>).amount) || 0;
          if (op.kind === 'chests' && !had && !error) ctx.chestsToday += 1;
        }
        if (!error && ownerOf(spec, op.id, data) === null && spec.scope === 'member' && op.kind !== 'notices') error = 'invalid';
        if (!error && op.kind === 'members' && !Array.isArray(data)) {
          if ((data as Record<string, unknown>).id !== op.id) error = 'invalid';
          const phone = String((data as Record<string, unknown>).phone ?? '').replace(/\D/g, '').slice(-10);
          if (!error && phone.length === 10 && s.role !== 'member') takenPhones.add(phone);
        }
      }

      let capacity = 0;
      let conditional = false;
      if (!error && op.kind === 'bookings' && data && !Array.isArray(data) && data.status === 'booked' && (!had || (old!.data as Record<string, unknown>).status !== 'booked')) {
        const ref = existing.get(`${data.kind === 'class' ? 'classes' : 'slots'}/${data.refId}`);
        const cap = ref && !ref.deleted && !Array.isArray(ref.data) ? Number(ref.data.capacity) : NaN;
        if (!Number.isFinite(cap)) error = 'no_such_session';
        else (conditional = true), (capacity = cap);
      }

      if (error) results.push({ kind: op.kind, id: op.id, ok: false, error });
      else plan.push({ op, data, owner: ownerOf(spec, op.id, data), conditional, capacity });
    }

    // A phone number belongs to one member in a gym, whoever edits it.
    if (takenPhones.size) {
      const list = [...takenPhones];
      const clash = await c.env.DB.prepare(`SELECT id, phone FROM members WHERE gym_id = ? AND phone IN (${list.map(() => '?').join(',')})`).bind(s.gymId, ...list).all<{ id: string; phone: string }>();
      const owners = new Map(clash.results.map((r) => [r.phone, r.id]));
      for (let i = plan.length - 1; i >= 0; i--) {
        const p = plan[i];
        if (p.op.kind !== 'members' || !p.data || Array.isArray(p.data)) continue;
        const phone = String(p.data.phone ?? '').replace(/\D/g, '').slice(-10);
        const holder = owners.get(phone);
        if (holder && holder !== p.op.id) {
          results.push({ kind: p.op.kind, id: p.op.id, ok: false, error: 'phone_taken' });
          plan.splice(i, 1);
        }
      }
    }

    if (!plan.length) return c.json({ results });

    // Build one transaction: advance the change log, then write each document with its own position.
    const n = plan.length;
    const DB = c.env.DB;
    const stmts: D1PreparedStatement[] = [DB.prepare('UPDATE gym_seq SET seq = seq + ? WHERE gym_id = ?').bind(n, s.gymId)];
    const SEQ = '(SELECT seq FROM gym_seq WHERE gym_id = ?) - ?';
    const at: { planIndex: number; stmt: number }[] = [];
    const putCols = 'gym_id, kind, id, member_id, data, seq, deleted, k1, k2, at';

    plan.forEach((p, i) => {
      const off = n - 1 - i;
      const { op, data, owner } = p;
      const rec = (data && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
      const spec = SPECS[op.kind];
      if (data === null) {
        stmts.push(DB.prepare(`UPDATE docs SET deleted = 1, data = 'null', seq = ${SEQ}, k1 = NULL, k2 = NULL WHERE gym_id = ? AND kind = ? AND id = ?`).bind(s.gymId, off, s.gymId, op.kind, op.id));
        if (op.kind === 'members') {
          stmts.push(DB.prepare('DELETE FROM sessions WHERE gym_id = ? AND member_id = ?').bind(s.gymId, op.id));
          stmts.push(DB.prepare('DELETE FROM invites WHERE gym_id = ? AND member_id = ?').bind(s.gymId, op.id));
          stmts.push(DB.prepare('DELETE FROM pairings WHERE gym_id = ? AND member_id = ?').bind(s.gymId, op.id));
          stmts.push(DB.prepare(`UPDATE docs SET deleted = 1, data = 'null', seq = ${SEQ}, k1 = NULL, k2 = NULL WHERE gym_id = ? AND member_id = ? AND deleted = 0`).bind(s.gymId, off, s.gymId, op.id));
          stmts.push(DB.prepare('DELETE FROM members WHERE gym_id = ? AND id = ?').bind(s.gymId, op.id));
        }
        return;
      }
      const when = spec.at ? spec.at(rec) : null;
      let k1: string | null = null;
      let k2: string | null = null;
      if (op.kind === 'bookings') {
        k1 = `${rec.kind}:${rec.refId}:${rec.date}`;
        k2 = String(rec.status ?? '');
      } else if (op.kind === 'xp' || op.kind === 'chests') {
        k1 = `${owner}:${(when ?? today).slice(0, 10)}`;
      }
      const json = JSON.stringify(data);
      const upsert = `ON CONFLICT(gym_id, kind, id) DO UPDATE SET member_id = excluded.member_id, data = excluded.data, seq = excluded.seq, deleted = 0, k1 = excluded.k1, k2 = excluded.k2, at = excluded.at`;
      if (p.conditional) {
        // The count and the insert are one statement, so two people can never take the last spot.
        stmts.push(
          DB.prepare(
            `INSERT INTO docs (${putCols}) SELECT ?, ?, ?, ?, ?, ${SEQ}, 0, ?, ?, ? WHERE (SELECT COUNT(*) FROM docs WHERE gym_id = ? AND kind = 'bookings' AND k1 = ? AND k2 = 'booked' AND deleted = 0 AND id <> ?) < ? ${upsert}`,
          ).bind(s.gymId, op.kind, op.id, owner, json, s.gymId, off, k1, k2, when, s.gymId, k1, op.id, p.capacity),
        );
      } else {
        stmts.push(
          DB.prepare(`INSERT INTO docs (${putCols}) VALUES (?, ?, ?, ?, ?, ${SEQ}, 0, ?, ?, ?) ${upsert}`).bind(s.gymId, op.kind, op.id, owner, json, s.gymId, off, k1, k2, when),
        );
      }
      at.push({ planIndex: i, stmt: stmts.length - 1 });
      if (op.kind === 'members') {
        const phone = String(rec.phone ?? '').replace(/\D/g, '').slice(-10);
        if (s.role !== 'member' && phone.length === 10) stmts.push(DB.prepare('UPDATE members SET name = ?, phone = ?, code = ? WHERE gym_id = ? AND id = ?').bind(String(rec.name ?? ''), phone, rec.code ?? null, s.gymId, op.id));
        else if (s.role === 'member') stmts.push(DB.prepare('UPDATE members SET name = ? WHERE gym_id = ? AND id = ?').bind(String(rec.name ?? ''), s.gymId, op.id));
      }
    });
    stmts.push(DB.prepare('SELECT seq FROM gym_seq WHERE gym_id = ?').bind(s.gymId));

    const out = await DB.batch(stmts);
    const refused = new Set<number>();
    for (const a of at) {
      if (plan[a.planIndex].conditional && out[a.stmt].meta.changes === 0) refused.add(a.planIndex);
    }
    plan.forEach((p, i) => {
      if (refused.has(i)) results.push({ kind: p.op.kind, id: p.op.id, ok: false, error: 'slot_full' });
      else {
        const changed = p.op.kind === 'members' && s.role === 'member';
        results.push({ kind: p.op.kind, id: p.op.id, ok: true, ...(changed && p.data ? { data: p.data } : {}) });
      }
    });
    const head = (out[out.length - 1].results as { seq: number }[])[0];
    return c.json({ seq: head?.seq ?? 0, results });
  });

  /**
   * Opening a chest. The prize is drawn here, with real randomness, so no phone can pick its own.
   * Whatever the prize does (XP, an extra pause day, a guest pass) is applied in the same step.
   */
  app.post('/v1/chests/:id/open', auth({ roles: ['member'] }), async (c) => {
    const s = c.get('s');
    const id = c.req.param('id');
    const rows = await c.env.DB.prepare("SELECT kind, id, data FROM docs WHERE gym_id = ? AND deleted = 0 AND ((kind = 'chests' AND id = ?) OR (kind = 'members' AND id = ?))")
      .bind(s.gymId, id, s.memberId)
      .all<{ kind: string; id: string; data: string }>();
    const chestRow = rows.results.find((r) => r.kind === 'chests');
    const memberRow = rows.results.find((r) => r.kind === 'members');
    const chest = chestRow ? (JSON.parse(chestRow.data) as Record<string, unknown>) : null;
    if (!chest || chest.memberId !== s.memberId || chest.openedAt || !memberRow) return fail(c, 404, 'not_found', 'That chest isn’t available.');

    const prize = drawPrize(() => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000);
    const openedAt = nowIso();
    const member = JSON.parse(memberRow.data) as Record<string, unknown>;
    const DB = c.env.DB;
    const SEQ = '(SELECT seq FROM gym_seq WHERE gym_id = ?) - ?';

    type Write = { kind: string; id: string; owner: string; data: unknown; k1?: string; at?: string; update: boolean };
    const writes: Write[] = [{ kind: 'chests', id, owner: s.memberId!, data: { ...chest, openedAt, prize }, update: true }];
    if (prize.kind === 'xp') {
      writes.push({ kind: 'xp', id: newId('xp'), owner: s.memberId!, k1: `${s.memberId}:${todayIST()}`, at: openedAt, update: false, data: { id: '', memberId: s.memberId, amount: prize.amount, reason: 'Chest prize', at: openedAt, key: `chest-${id}` } });
    } else if (prize.kind === 'pauseDay') {
      writes.push({ kind: 'members', id: s.memberId!, owner: s.memberId!, data: { ...member, pauseAllowance: Number(member.pauseAllowance ?? 0) + 1 }, update: true });
    } else if (prize.kind === 'guestPass') {
      writes.push({ kind: 'members', id: s.memberId!, owner: s.memberId!, data: { ...member, bonusGuestPasses: Number(member.bonusGuestPasses ?? 0) + 1 }, update: true });
    }
    const n = writes.length;
    const stmts: D1PreparedStatement[] = [DB.prepare('UPDATE gym_seq SET seq = seq + ? WHERE gym_id = ?').bind(n, s.gymId)];
    // Only the first caller to flip the chest from unopened wins, so double taps and retries can't pay twice.
    stmts.push(
      DB.prepare(`UPDATE docs SET data = ?, seq = ${SEQ} WHERE gym_id = ? AND kind = 'chests' AND id = ? AND json_extract(data, '$.openedAt') IS NULL`).bind(JSON.stringify(writes[0].data), s.gymId, n - 1, s.gymId, id),
    );
    writes.slice(1).forEach((w, i) => {
      const off = n - 2 - i;
      const data = w.kind === 'xp' ? { ...(w.data as Record<string, unknown>), id: w.id } : w.data;
      const guard = `EXISTS (SELECT 1 FROM docs WHERE gym_id = ? AND kind = 'chests' AND id = ? AND json_extract(data, '$.openedAt') = ?)`;
      if (w.update) {
        stmts.push(DB.prepare(`UPDATE docs SET data = ?, seq = ${SEQ} WHERE gym_id = ? AND kind = ? AND id = ? AND ${guard}`).bind(JSON.stringify(data), s.gymId, off, s.gymId, w.kind, w.id, s.gymId, id, openedAt));
      } else {
        stmts.push(
          DB.prepare(`INSERT INTO docs (gym_id, kind, id, member_id, data, seq, deleted, k1, k2, at) SELECT ?, ?, ?, ?, ?, ${SEQ}, 0, ?, NULL, ? WHERE ${guard}`).bind(s.gymId, w.kind, w.id, w.owner, JSON.stringify(data), s.gymId, off, w.k1 ?? null, w.at ?? null, s.gymId, id, openedAt),
        );
      }
    });
    const res = await DB.batch(stmts);
    if (res[1].meta.changes !== 1) return fail(c, 409, 'already_open', 'That chest was already opened.');
    return c.json({ prize });
  });
}
