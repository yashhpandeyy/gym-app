/**
 * "What you're best at": rankings that only ever surface wins.
 *
 * Members are compared with people of the same gender. Lifts are scored as a multiple of
 * bodyweight so a 60 kg member and a 95 kg member compete fairly. A result only becomes a
 * highlight when it is genuinely good: top 3, top 10% of a field of 20+, or most improved.
 * Everyone else sees their personal bests instead, so Home is always encouraging.
 */
import type { Challenge, ChallengeEntry, CheckIn, LiftEntry, LiftKey, Member, Pause, Plan, ProgressEntry, Slot } from '@/store/types';

import { addDays, fmtTime, monthKey, stampToDate, type ISODate } from './date';
import {
  bestLifts,
  bodyweightOn,
  formatScore,
  LIFT_KEYS,
  LIFT_LABEL,
  leaderboard,
  round1,
  strengthScore,
} from './game';

export type Scope = 'gym' | 'slot';
export type ChallengeGroup = 'cardio' | 'endurance';
export type BoardId = `lift:${LiftKey}` | `challenge:${string}` | 'consistency' | 'improved';

export type SpotlightInput = {
  me: Member;
  members: Member[];
  plans: Plan[];
  pauses: Pause[];
  lifts: LiftEntry[];
  progress: Record<string, ProgressEntry[]>;
  challenges: Challenge[];
  challengeEntries: ChallengeEntry[];
  checkins: CheckIn[];
  slots: Slot[];
  t: ISODate;
};

export type BoardRow = { memberId: string; value: number; display: string; rank: number; me: boolean };

export type Board = {
  id: BoardId;
  title: string;
  /** How results are measured, e.g. "Estimated max as a multiple of bodyweight". */
  measure: string;
  better: 'higher' | 'lower';
  rows: BoardRow[];
  mine?: BoardRow;
  /** Friendly nudge to the next place up, or undefined at the top. */
  nextUp?: string;
};

export type Highlight = {
  id: string;
  board: BoardId;
  scope: Scope;
  kind: 'rank' | 'top' | 'improved' | 'best';
  rank?: number;
  of?: number;
  title: string;
  where: string;
  value: string;
  icon: string;
};

export function challengeGroup(c: Challenge): ChallengeGroup {
  if (c.category === 'cardio' || c.category === 'endurance') return c.category;
  return c.unit === 'time' && c.better === 'lower' ? 'cardio' : 'endurance';
}

export function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

type Ctx = {
  input: SpotlightInput;
  active: Member[];
};

const ctxCache = new WeakMap<SpotlightInput, Ctx>();

function context(input: SpotlightInput): Ctx {
  const hit = ctxCache.get(input);
  if (hit) return hit;
  const ctx = { input, active: input.members };
  ctxCache.set(input, ctx);
  return ctx;
}

/** A member's body weight if they've logged one. Nobody is ranked on a guess. */
function knownWeight(entries: ProgressEntry[] | undefined) {
  return entries?.length ? entries[entries.length - 1].weight : undefined;
}

function pool(ctx: Ctx, scope: Scope) {
  const { me } = ctx.input;
  return ctx.active.filter(
    (m) => (me.gender === 'other' || m.gender === me.gender) && (scope === 'gym' || m.preferredSlotId === me.preferredSlotId),
  );
}

function rank(rows: Omit<BoardRow, 'rank'>[], better: 'higher' | 'lower'): BoardRow[] {
  return [...rows]
    .sort((a, b) => (better === 'higher' ? b.value - a.value : a.value - b.value))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function liftRatio(ctx: Ctx, m: Member, k: LiftKey): number | undefined {
  const { lifts, progress } = ctx.input;
  const bw = knownWeight(progress[m.id]);
  const b = bestLifts(lifts, m.id)[k];
  return b && bw ? b.e1rm / bw : undefined;
}

function strengthGain(ctx: Ctx, m: Member): number | undefined {
  const { lifts, progress, t } = ctx.input;
  if (!knownWeight(progress[m.id])) return undefined;
  const before = strengthScore(bestLifts(lifts, m.id, addDays(t, -30)), bodyweightOn(progress[m.id], addDays(t, -30)));
  const now = strengthScore(bestLifts(lifts, m.id), bodyweightOn(progress[m.id], t));
  return before > 0 ? now / before - 1 : undefined;
}

function slotLabel(input: SpotlightInput) {
  const s = input.slots.find((x) => x.id === input.me.preferredSlotId);
  return s ? `${fmtTime(s.start).replace(':00', '')} crew` : 'your slot';
}

function people(input: SpotlightInput) {
  return input.me.gender === 'female' ? 'women' : input.me.gender === 'male' ? 'men' : 'members';
}

export function buildBoard(input: SpotlightInput, id: BoardId, scope: Scope): Board | undefined {
  const ctx = context(input);
  const members = pool(ctx, scope);
  const me = input.me;
  let board: Omit<Board, 'mine' | 'nextUp'>;
  let gapText: (mine: BoardRow, above: BoardRow, aboveName: string) => string;

  if (id.startsWith('lift:')) {
    const k = id.slice(5) as LiftKey;
    const rows = members
      .map((m) => ({ m, v: liftRatio(ctx, m, k) }))
      .filter((x): x is { m: Member; v: number } => x.v !== undefined)
      .map(({ m, v }) => ({ memberId: m.id, value: Math.round(v * 100) / 100, display: `${(Math.round(v * 100) / 100).toFixed(2)}×`, me: m.id === me.id }));
    board = { id, title: LIFT_LABEL[k], measure: 'Estimated one-rep max as a multiple of bodyweight', better: 'higher', rows: rank(rows, 'higher') };
    const bw = bodyweightOn(input.progress[me.id], input.t);
    gapText = (mine, above, name) => {
      const kg = Math.max(2.5, Math.ceil(((above.value - mine.value) * bw + 0.01) / 2.5) * 2.5);
      return `Add about ${kg} kg to your estimated max to pass ${name}.`;
    };
  } else if (id.startsWith('challenge:')) {
    const c = input.challenges.find((x) => x.id === id.slice(10));
    if (!c) return undefined;
    const month = input.t.slice(0, 7);
    const ids = new Set(members.map((m) => m.id));
    const entries = input.challengeEntries.filter((e) => e.date.startsWith(month));
    const rows = leaderboard(c, entries, me.id, ids)
      .filter((r) => ids.has(r.memberId))
      .map((r) => ({ memberId: r.memberId, value: r.value, display: formatScore(c, r.value), me: r.me }));
    board = { id, title: c.name, measure: `${c.station}, this month`, better: c.better, rows: rank(rows, c.better) };
    gapText = (_mine, above, name) => `Beat ${formatScore(c, above.value)} to pass ${name}.`;
  } else if (id === 'consistency') {
    const days = new Map<string, Set<string>>();
    for (const x of input.checkins) {
      const d = stampToDate(x.at);
      if (monthKey(d) !== monthKey(input.t)) continue;
      (days.get(x.memberId) ?? days.set(x.memberId, new Set()).get(x.memberId)!).add(d);
    }
    // Only people who have been in this month are ranked.
    const rows = members
      .filter((m) => (days.get(m.id)?.size ?? 0) > 0)
      .map((m) => {
        const v = days.get(m.id)!.size;
        return { memberId: m.id, value: v, display: `${v} ${v === 1 ? 'visit' : 'visits'}`, me: m.id === me.id };
      });
    board = { id, title: 'Consistency', measure: 'Visits this month', better: 'higher', rows: rank(rows, 'higher') };
    gapText = (mineRow, above, name) => {
      const n = above.value - mineRow.value + 1;
      return `${n} more ${n === 1 ? 'visit' : 'visits'} this month to pass ${name}.`;
    };
  } else {
    const rows = members
      .map((m) => ({ m, v: strengthGain(ctx, m) }))
      .filter((x): x is { m: Member; v: number } => x.v !== undefined)
      .map(({ m, v }) => ({ memberId: m.id, value: Math.round(v * 1000) / 10, display: `+${(Math.round(v * 1000) / 10).toFixed(1)}%`, me: m.id === me.id }));
    board = { id, title: 'Most improved', measure: 'Strength score gain over 30 days', better: 'higher', rows: rank(rows, 'higher') };
    gapText = () => 'Keep logging your lifts. Every new best counts here.';
  }

  const mine = board.rows.find((r) => r.me);
  const above = mine && mine.rank > 1 ? board.rows[mine.rank - 2] : undefined;
  const name = above ? displayName(input.members, above.memberId) : '';
  return { ...board, mine, nextUp: mine && above ? gapText(mine, above, name) : undefined };
}

export function displayName(members: Member[], id: string) {
  const m = members.find((x) => x.id === id);
  if (!m) return 'Member';
  const [first, last] = m.name.split(' ');
  return `${first}${last ? ` ${last[0]}.` : ''}`;
}

// ---------------------------------------------------------------------------
// Highlights
// ---------------------------------------------------------------------------

/** A ranking only counts as a win in a real field: at least four people, and you finished in the top half or the top three. */
function isWin(row: BoardRow | undefined, size: number) {
  if (!row || size < 4) return false;
  return row.rank <= Math.min(3, Math.floor(size / 2)) || (size >= 20 && row.rank <= Math.ceil(size * 0.1));
}

const LIFT_SHORT: Record<LiftKey, string> = { squat: 'squat', bench: 'bench press', deadlift: 'deadlift', ohp: 'overhead press' };

export function spotlight(input: SpotlightInput): Highlight[] {
  const out: (Highlight & { score: number })[] = [];
  const crew = slotLabel(input);
  const who = people(input);

  const consider = (id: BoardId, label: string, icon: string, describe: (row: BoardRow, b: Board) => string, sameScopeLabel?: boolean) => {
    for (const scope of ['gym', 'slot'] as Scope[]) {
      const b = buildBoard(input, id, scope);
      if (!b?.mine || !isWin(b.mine, b.rows.length)) continue;
      const top = b.mine.rank > 3;
      out.push({
        id: `${id}-${scope}`,
        board: id,
        scope,
        kind: top ? 'top' : 'rank',
        rank: b.mine.rank,
        of: b.rows.length,
        title: top ? `Top ${Math.max(1, Math.round((b.mine.rank / b.rows.length) * 100))}% in ${label}` : `${ordinal(b.mine.rank)} in ${label}`,
        where:
          scope === 'gym'
            ? sameScopeLabel
              ? `among ${who} in the gym`
              : `among ${who} in the gym, for your bodyweight`
            : `in the ${crew}`,
        value: describe(b.mine, b),
        icon,
        // Gym-wide beats slot-level, and a better rank beats a worse one.
        score: (scope === 'gym' ? 100 : 40) + (top ? 0 : (4 - b.mine.rank) * 15),
      });
      break; // the gym-wide win is the one worth showing; only fall back to the slot
    }
  };

  const bw = knownWeight(input.progress[input.me.id]) ?? bodyweightOn(input.progress[input.me.id], input.t);
  for (const k of LIFT_KEYS) {
    consider(`lift:${k}`, LIFT_SHORT[k], 'barbell', (row) => `${row.value.toFixed(2)}× bodyweight, about ${Math.round(row.value * bw)} kg`);
  }

  for (const group of ['cardio', 'endurance'] as ChallengeGroup[]) {
    const before = out.length;
    for (const c of input.challenges.filter((x) => x.active && challengeGroup(x) === group)) {
      consider(`challenge:${c.id}`, group, group === 'cardio' ? 'heart' : 'timer', (row) => `${c.name}, ${formatScore(c, row.value)}`, true);
    }
    // Keep only the best cardio (or endurance) result so one category doesn't crowd the row.
    const added = out.splice(before).sort((a, b) => b.score - a.score);
    if (added[0]) out.push(added[0]);
  }

  consider('consistency', 'consistency', 'calendar', (row) => `${row.value} ${row.value === 1 ? 'visit' : 'visits'} this month`, true);

  const imp = buildBoard(input, 'improved', 'gym');
  if (imp?.mine && imp.mine.rank <= 3 && imp.mine.value > 0) {
    out.push({
      id: 'improved-gym',
      board: 'improved',
      scope: 'gym',
      kind: 'improved',
      rank: imp.mine.rank,
      of: imp.rows.length,
      title: imp.mine.rank === 1 ? 'Most improved' : `${ordinal(imp.mine.rank)} most improved`,
      where: `among ${who} in the gym`,
      value: `${imp.mine.display} strength in 30 days`,
      icon: 'trending-up',
      score: 120 - imp.mine.rank * 10,
    });
  }

  const wins = out.sort((a, b) => b.score - a.score).slice(0, 5);
  if (wins.length) return wins.map(({ score: _s, ...h }) => h);
  return personalBests(input);
}

/** Shown when a member has no ranking wins yet: their own records, never anyone else's. */
function personalBests(input: SpotlightInput): Highlight[] {
  const out: Highlight[] = [];
  const best = bestLifts(input.lifts, input.me.id);
  const top = LIFT_KEYS.map((k) => ({ k, b: best[k] })).filter((x) => x.b).sort((a, b) => b.b!.e1rm - a.b!.e1rm)[0];
  if (top?.b) {
    out.push({
      id: 'pb-lift',
      board: `lift:${top.k}`,
      scope: 'gym',
      kind: 'best',
      title: `Your best ${LIFT_SHORT[top.k]} yet`,
      where: 'personal record',
      value: `${top.b.entry.weight} kg × ${top.b.entry.reps}, about ${round1(top.b.e1rm)} kg max`,
      icon: 'barbell',
    });
  }
  const visits = new Set(input.checkins.filter((c) => c.memberId === input.me.id && monthKey(stampToDate(c.at)) === monthKey(input.t)).map((c) => stampToDate(c.at))).size;
  if (visits) {
    out.push({ id: 'pb-visits', board: 'consistency', scope: 'gym', kind: 'best', title: `${visits} visits this month`, where: 'keep the streak going', value: 'Every visit counts towards your rings', icon: 'calendar' });
  }
  if (!out.length) {
    out.push({ id: 'pb-start', board: 'consistency', scope: 'gym', kind: 'best', title: 'Your first win is close', where: 'log a lift or try a station', value: 'Personal records show up here', icon: 'star' });
  }
  return out;
}
