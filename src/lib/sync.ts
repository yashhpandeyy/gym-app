import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState as AppLifecycle } from 'react-native';
import { create } from 'zustand';

import { toast } from '@/components/ui/Toast';
import { DEFAULT_SETTINGS, emptyData } from '@/data/empty';
import { useApp, type AppState } from '@/store';
import type { Celebration, CheckIn, Chest, SupplementItem } from '@/store/types';

import { api, type PushResult, type SyncDoc, type SyncOp } from './api';
import { brandFromGym } from './gymBrand';
import { XP } from './game';
import { uid } from './format';

/**
 * Keeps this phone's copy of the gym in step with the server, for every kind of record.
 *
 * The screens keep working on the in-app store exactly as before. This module watches the store,
 * sends whatever changed to the server (retrying until it gets through), and applies whatever other
 * devices changed. The server decides what each person may see and change; if it refuses a change,
 * the phone fetches the server's version and says so.
 */

const ARRAY_KINDS = [
  'plans',
  'members',
  'pauses',
  'slots',
  'closures',
  'classes',
  'bookings',
  'checkins',
  'payments',
  'announcements',
  'trainers',
  'ptRequests',
  'leads',
  'tickets',
  'notices',
  'xp',
  'chests',
  'lifts',
  'challenges',
  'challengeEntries',
  'guestPasses',
  'mindLog',
] as const;
type ArrayKind = (typeof ARRAY_KINDS)[number];

const RECORD_KINDS = ['progress', 'workouts', 'workoutLog', 'dietPlans', 'mealLog', 'water', 'leagueTier', 'leagueSettledWeek', 'ringClaims'] as const;
type RecordKind = (typeof RECORD_KINDS)[number];

const isArrayKind = (k: string): k is ArrayKind => (ARRAY_KINDS as readonly string[]).includes(k);
const isRecordKind = (k: string): k is RecordKind => (RECORD_KINDS as readonly string[]).includes(k);

/** The gym's own setup goes first, so what depends on it (a booking needs its slot) is never refused for arriving early. */
const PRIORITY = ['settings', 'plans', 'slots', 'classes', 'closures', 'trainers', 'challenges', 'announcements', 'members'];
const rank = (kind: string) => {
  const i = PRIORITY.indexOf(kind);
  return i === -1 ? PRIORITY.length : i;
};

const MAX_OPS = 20;
const POLL_MS = 20_000;
const QUEUE_KEY = 'gym.sync.queue';

export type SyncStatus = 'off' | 'loading' | 'ready' | 'error';
export const useSync = create<{ status: SyncStatus; error?: string; offline: boolean }>(() => ({ status: 'off', offline: false }));

const keyOf = (kind: string, id: string) => `${kind}/${id}`;

/** What the server has, as JSON per document. A change is only worth sending if it differs from this. */
const mirror = new Map<string, string>();
/** Local changes waiting to be sent, newest per document. */
const queue = new Map<string, SyncOp>();

let running = false;
let gymKey = '';
let busy = false;
let flushing = false;
let unsubscribe: (() => void) | undefined;
let poll: ReturnType<typeof setInterval> | undefined;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryStep = 0;
let lifecycle: { remove: () => void } | undefined;
let rounds = 0;

// ---- what counts as a document ---------------------------------------------------------------

/** Only supplements go to the server. Medicines stay on the phone. */
const shareable = (items: SupplementItem[] | undefined) => (items ?? []).filter((i) => i.kind === 'supplement');

function note(kind: string, id: string, data: unknown | null) {
  const key = keyOf(kind, id);
  const json = data === null ? null : JSON.stringify(data);
  if ((mirror.get(key) ?? null) === json) {
    queue.delete(key);
    return;
  }
  queue.set(key, { kind, id, data });
}

/** Compares the store with how it was a moment ago and queues whatever changed. */
function collect(cur: AppState, prev: AppState) {
  for (const kind of ARRAY_KINDS) {
    const a = cur[kind] as { id: string }[];
    const b = prev[kind] as { id: string }[];
    if (a === b) continue;
    const before = new Map(b.map((x) => [x.id, x]));
    const seen = new Set<string>();
    for (const item of a) {
      seen.add(item.id);
      if (before.get(item.id) !== item) note(kind, item.id, item);
    }
    for (const id of before.keys()) if (!seen.has(id)) note(kind, id, null);
  }
  for (const kind of RECORD_KINDS) {
    const a = cur[kind] as Record<string, unknown>;
    const b = prev[kind] as Record<string, unknown>;
    if (a === b) continue;
    for (const id of Object.keys(a)) if (a[id] !== b[id]) note(kind, id, a[id]);
    for (const id of Object.keys(b)) if (!(id in a)) note(kind, id, null);
  }
  if (cur.settings !== prev.settings) note('settings', 'gym', cur.settings);
  if (cur.supplements !== prev.supplements) {
    for (const id of Object.keys(cur.supplements)) {
      if (cur.supplements[id] !== prev.supplements[id]) {
        const list = shareable(cur.supplements[id]);
        if (list.length || mirror.has(keyOf('supplements', id))) note('supplements', id, list);
      }
    }
  }
}

/** Every document the store currently holds, to learn what "already on the server" looks like at start. */
function eachDoc(s: AppState, fn: (kind: string, id: string, data: unknown) => void) {
  for (const kind of ARRAY_KINDS) for (const item of s[kind] as { id: string }[]) fn(kind, item.id, item);
  for (const kind of RECORD_KINDS) for (const [id, v] of Object.entries(s[kind] as Record<string, unknown>)) fn(kind, id, v);
  fn('settings', 'gym', s.settings);
  for (const [id, items] of Object.entries(s.supplements)) {
    const list = shareable(items);
    if (list.length) fn('supplements', id, list);
  }
}

// ---- applying what the server sent ----------------------------------------------------------------

export function applyDocs(docs: SyncDoc[], opts: { force?: boolean } = {}) {
  const s = useApp.getState();
  const patch: Record<string, unknown> = {};
  const byKind = new Map<string, SyncDoc[]>();
  for (const d of docs) {
    if (!opts.force && queue.has(keyOf(d.kind, d.id))) continue; // a change of ours is on its way and wins
    (byKind.get(d.kind) ?? byKind.set(d.kind, []).get(d.kind)!).push(d);
  }

  for (const [kind, list] of byKind) {
    if (isArrayKind(kind)) {
      const map = new Map(((patch[kind] ?? s[kind]) as { id: string }[]).map((x) => [x.id, x]));
      for (const d of list) {
        const key = keyOf(kind, d.id);
        if (d.deleted || d.data == null) {
          map.delete(d.id);
          mirror.delete(key);
        } else {
          map.set(d.id, d.data as { id: string });
          mirror.set(key, JSON.stringify(d.data));
        }
      }
      patch[kind] = [...map.values()];
    } else if (isRecordKind(kind)) {
      const next = { ...((patch[kind] ?? s[kind]) as Record<string, unknown>) };
      for (const d of list) {
        const key = keyOf(kind, d.id);
        if (d.deleted || d.data == null) {
          delete next[d.id];
          mirror.delete(key);
        } else {
          next[d.id] = d.data;
          mirror.set(key, JSON.stringify(d.data));
        }
      }
      patch[kind] = next;
    } else if (kind === 'settings') {
      const d = list[list.length - 1];
      if (!d.deleted && d.data) {
        patch.settings = { ...DEFAULT_SETTINGS, ...(d.data as object) };
        mirror.set(keyOf('settings', 'gym'), JSON.stringify(patch.settings));
      }
    } else if (kind === 'supplements') {
      const next = { ...((patch.supplements ?? s.supplements) as Record<string, SupplementItem[]>) };
      for (const d of list) {
        const mine = (next[d.id] ?? []).filter((i) => i.kind === 'medicine'); // medicines are only ever local
        const shared = d.deleted || !Array.isArray(d.data) ? [] : (d.data as SupplementItem[]);
        next[d.id] = [...shared, ...mine];
        mirror.set(keyOf('supplements', d.id), JSON.stringify(shared));
      }
      patch.supplements = next;
    }
  }

  // A check-in done at the desk while the member isn't looking: give them their moment when it reaches their phone.
  const me = s.session?.role === 'member' ? s.session.memberId : undefined;
  if (me && patch.checkins) {
    const fresh = (patch.checkins as CheckIn[]).find((c) => c.memberId === me && !s.checkins.some((x) => x.id === c.id) && Date.now() - new Date(c.at).getTime() < 10 * 60_000);
    if (fresh) {
      const gotChest = ((patch.chests as Chest[] | undefined) ?? []).some((c) => c.memberId === me && !s.chests.some((x) => x.id === c.id));
      const cel: Celebration = {
        id: uid('cel'),
        memberId: me,
        kind: 'checkin',
        title: 'You’re in',
        body: gotChest ? 'You earned a chest, open it to see what’s inside.' : 'Have a great session.',
        xp: XP.checkIn,
        chest: gotChest,
      };
      patch.celebrations = [...s.celebrations, cel].slice(-12);
    }
  }

  if (Object.keys(patch).length) useApp.setState(patch);
}

// ---- sending our changes ---------------------------------------------------------------------------

const REASONS: Record<string, string> = {
  slot_full: 'That session just filled up. Pick another time.',
  forbidden: 'That change isn’t allowed for your account.',
  phone_taken: 'That phone number belongs to another member.',
  needs_approval: 'The gym has to approve that first.',
  no_such_session: 'That session no longer exists.',
  use_invite: 'New members have to be added with an invite.',
  invalid: 'The gym couldn’t accept that.',
  too_large: 'That was too big to save.',
};
/** Quiet refusals: the app already limits these, so there's nothing useful to tell the person. */
const SILENT = new Set(['daily_limit']);

function persistQueue() {
  AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue.values()])).catch(() => {});
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void flush(), 350);
}

function scheduleRetry() {
  if (retryTimer || !running) return;
  retryStep = Math.min(retryStep + 1, 4);
  retryTimer = setTimeout(
    () => {
      retryTimer = undefined;
      void syncNow();
    },
    [2000, 5000, 15_000, 30_000, 60_000][retryStep],
  );
}

async function repair(failed: { key: string; error: string }[]) {
  const r = await api.syncGet(failed.map((f) => f.key));
  if (r.ok) applyDocs(r.data.docs, { force: true });
  const loud = failed.find((f) => !SILENT.has(f.error));
  if (loud) toast.error(REASONS[loud.error] ?? 'One of your changes couldn’t be saved.');
}

async function flush() {
  if (flushing || !running) return;
  flushing = true;
  const failed: { key: string; error: string }[] = [];
  try {
    while (queue.size && running) {
      const ops = [...queue.values()].sort((a, b) => rank(a.kind) - rank(b.kind)).slice(0, MAX_OPS);
      const r = await api.syncPush(ops);
      if (!r.ok) {
        if (r.status === 0 || r.status >= 500) {
          useSync.setState({ offline: true });
          scheduleRetry();
        } else if (r.error === 'gym_suspended' || r.error === 'gym_pending') {
          useSync.setState({ status: 'error', error: r.message });
        } else {
          for (const o of ops) {
            queue.delete(keyOf(o.kind, o.id));
            failed.push({ key: keyOf(o.kind, o.id), error: r.error });
          }
          continue;
        }
        break;
      }
      retryStep = 0;
      useSync.setState({ offline: false });
      const adjusted: SyncDoc[] = [];
      r.data.results.forEach((res: PushResult) => {
        const key = keyOf(res.kind, res.id);
        const sent = ops.find((o) => o.kind === res.kind && o.id === res.id);
        // If the person changed it again while this was in flight, leave the newer change queued.
        if (sent && queue.get(key) === sent) queue.delete(key);
        if (res.ok) {
          if (sent) {
            if (sent.data === null) mirror.delete(key);
            else mirror.set(key, JSON.stringify(sent.data));
          }
          if (res.data) adjusted.push({ kind: res.kind, id: res.id, seq: 0, deleted: false, data: res.data });
        } else failed.push({ key, error: res.error ?? 'invalid' });
      });
      if (adjusted.length) applyDocs(adjusted, { force: true });
      persistQueue();
    }
  } finally {
    flushing = false;
    persistQueue();
  }
  if (failed.length) await repair(failed);
}

// ---- reading what others changed ----------------------------------------------------------------------

/** Picks up changes the owner made to the gym's name, logo, colours, hours or features. */
async function refreshGym() {
  const r = await api.me();
  if (!r.ok || !running) return;
  const next = brandFromGym(r.data.gym);
  const s = useApp.getState();
  if (JSON.stringify(next) !== JSON.stringify(s.brandOverride)) useApp.setState({ brandOverride: next });
  if (s.link && s.link.gymName !== r.data.gym.name) useApp.setState({ link: { ...s.link, gymName: r.data.gym.name } });
}

/** One round of sync: send ours, then read theirs. Safe to call whenever; overlapping calls are skipped. */
export async function syncNow() {
  if (!running || busy) return;
  busy = true;
  try {
    await flush();
    let more = true;
    while (more && running) {
      const since = useApp.getState().syncCursor;
      const r = await api.syncPull(since);
      if (!r.ok) {
        if (r.status === 0 || r.status >= 500) {
          useSync.setState({ offline: true });
          if (useSync.getState().status === 'loading') useSync.setState({ status: 'error', error: r.message });
          scheduleRetry();
        } else if (r.error === 'gym_suspended' || r.error === 'gym_pending') {
          useSync.setState({ status: 'error', error: r.message });
        }
        return;
      }
      applyDocs(r.data.docs);
      useApp.setState({ syncCursor: r.data.seq });
      more = r.data.more;
    }
    useSync.setState({ status: 'ready', error: undefined, offline: false });
    retryStep = 0;
    if (rounds++ % 6 === 0) void refreshGym();
  } finally {
    busy = false;
  }
}

/** Reads the server right now, for after something the server did on our behalf (opening a chest). */
export const refreshNow = () => syncNow();

// ---- starting and stopping ------------------------------------------------------------------------------

export async function startSync(key: string) {
  stopSync();
  running = true;
  gymKey = key;
  mirror.clear();
  queue.clear();
  retryStep = 0;
  rounds = 0;

  const s = useApp.getState();
  if (s.syncGym !== key) {
    // A different gym or a different person: whatever is on the phone isn't theirs.
    await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
    useApp.setState({ ...emptyData(), syncCursor: 0, syncGym: key });
  } else {
    // Same person as last time: what's on the phone is what the server last told us, plus anything unsent.
    eachDoc(useApp.getState(), (kind, id, data) => mirror.set(keyOf(kind, id), JSON.stringify(data)));
    try {
      const saved = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]') as SyncOp[];
      for (const op of saved) {
        mirror.delete(keyOf(op.kind, op.id));
        queue.set(keyOf(op.kind, op.id), op);
      }
    } catch {
      // A damaged queue is dropped; the next pull repairs the phone.
    }
  }

  useSync.setState({ status: useApp.getState().syncCursor > 0 ? 'ready' : 'loading', error: undefined });
  unsubscribe = useApp.subscribe((cur, prev) => {
    if (!running || cur === prev) return;
    collect(cur, prev);
    if (queue.size) {
      persistQueue();
      schedulePush();
    }
  });
  poll = setInterval(() => void syncNow(), POLL_MS);
  lifecycle = AppLifecycle.addEventListener('change', (st) => {
    if (st === 'active') void syncNow();
  });
  await syncNow();
}

export function stopSync() {
  running = false;
  unsubscribe?.();
  unsubscribe = undefined;
  if (poll) clearInterval(poll);
  poll = undefined;
  if (pushTimer) clearTimeout(pushTimer);
  if (retryTimer) clearTimeout(retryTimer);
  pushTimer = undefined;
  retryTimer = undefined;
  lifecycle?.remove();
  lifecycle = undefined;
  useSync.setState({ status: 'off', error: undefined, offline: false });
}

/** After a deliberate sign-out the queue and key must not leak into the next person's session. */
export async function forgetSync() {
  stopSync();
  queue.clear();
  mirror.clear();
  gymKey = '';
  await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
}

export const currentSyncKey = () => gymKey;

/** Records that the server already has this document exactly as given, so it isn't sent back. */
export function markSynced(kind: string, id: string, data: unknown) {
  mirror.set(keyOf(kind, id), JSON.stringify(data));
}
