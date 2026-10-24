/**
 * Gamification engine. Pure functions only, so the same rules run on a server later.
 *
 * The four mechanics, and the behaviour each one is aimed at:
 * 1. Local competition: weekly leagues of 8 people from your own time slot, and monthly station
 *    leaderboards filtered to your slot. Small fields are winnable, and winnable is motivating.
 * 2. Variable reward size: every real check-in earns a chest whose contents are unknown until
 *    opened. Anticipation of the size keeps people coming back, not fear of losing a streak.
 * 3. Completion: three weekly rings (show up, train, fuel). An open ring is an unfinished shape,
 *    and people want to close it.
 * 4. Competence: logged lifts become personal records and a Strength score with concrete next
 *    milestones. XP is only earned for things done in the gym, never for opening the app.
 */
import type {
  Chest,
  ChallengeEntry,
  Challenge,
  CheckIn,
  DietPlan,
  LiftEntry,
  LiftKey,
  Member,
  ProgressEntry,
  RingKey,
  WorkoutPlan,
  XpEvent,
} from '@/store/types';

import { drawPrize, levelFor, XP } from '../../shared/rules';
import { addDays, diffDays, startOfWeek, stampToDate, today, type ISODate } from './date';
import { hash, rng } from './format';

// ---------------------------------------------------------------------------
// XP and levels
// ---------------------------------------------------------------------------

export { XP, levelFor };

export function xpTotal(xp: XpEvent[], memberId: string) {
  return xp.reduce((s, e) => (e.memberId === memberId ? s + e.amount : s), 0);
}

export function xpBetween(xp: XpEvent[], memberId: string, from: ISODate, to: ISODate) {
  return xp.reduce((s, e) => {
    if (e.memberId !== memberId) return s;
    const d = stampToDate(e.at);
    return d >= from && d <= to ? s + e.amount : s;
  }, 0);
}

// ---------------------------------------------------------------------------
// Chests: variable reward magnitude
// ---------------------------------------------------------------------------

export const CHEST_TEASE = 'Anything from 10 XP to a 250 XP jackpot, a free shake or an extra pause day.';

export { drawPrize };

/** Short code a member shows at the desk to collect a prize. Stable for the same chest. */
export function prizeCode(chestId: string) {
  return hash(chestId).toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

export function unopened(chests: Chest[], memberId: string) {
  return chests.filter((c) => c.memberId === memberId && !c.openedAt);
}

// ---------------------------------------------------------------------------
// Weekly rings: completion drive
// ---------------------------------------------------------------------------

export type Ring = { key: RingKey; label: string; value: number; target: number; unit: string; hint: string };

export function exercisesPerDay(plan?: WorkoutPlan) {
  if (!plan || plan.days.length === 0) return 4;
  return Math.round(plan.days.reduce((s, d) => s + d.exercises.length, 0) / plan.days.length);
}

export function fuelOnTrack(done: string[] | undefined, plan?: DietPlan) {
  const total = plan?.meals.length ?? 4;
  return (done?.length ?? 0) >= Math.ceil(total * 0.75);
}

export function weekRings(input: {
  member: Member;
  checkins: CheckIn[];
  workoutLog?: Record<ISODate, string[]>;
  workout?: WorkoutPlan;
  mealLog?: Record<ISODate, string[]>;
  diet?: DietPlan;
  t?: ISODate;
}): Ring[] {
  const t = input.t ?? today();
  const week = startOfWeek(t);
  const visits = new Set(
    input.checkins.filter((c) => c.memberId === input.member.id).map((c) => stampToDate(c.at)).filter((d) => d >= week && d <= t),
  ).size;
  let reps = 0;
  let fuelDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(week, i);
    if (d > t) break;
    reps += input.workoutLog?.[d]?.length ?? 0;
    if (fuelOnTrack(input.mealLog?.[d], input.diet)) fuelDays += 1;
  }
  const goal = input.member.weeklyGoal;
  return [
    { key: 'show', label: 'Show up', value: visits, target: goal, unit: 'visits', hint: `Train ${goal} times this week` },
    {
      key: 'train',
      label: 'Train',
      value: reps,
      target: goal * exercisesPerDay(input.workout),
      unit: 'exercises',
      hint: 'Tick off exercises from your plan',
    },
    { key: 'fuel', label: 'Fuel', value: fuelDays, target: 5, unit: 'days', hint: 'Eat most of your planned meals on 5 days' },
  ];
}

export function ringClosed(r: Ring) {
  return r.value >= r.target;
}

// ---------------------------------------------------------------------------
// Strength score: competence feedback
// ---------------------------------------------------------------------------

export const LIFT_LABEL: Record<LiftKey, string> = {
  squat: 'Back squat',
  bench: 'Bench press',
  deadlift: 'Deadlift',
  ohp: 'Overhead press',
};

/** Bodyweight multiples an intermediate lifter can do for one rep. */
export const STANDARD: Record<LiftKey, number> = { squat: 1.25, bench: 1.0, deadlift: 1.5, ohp: 0.65 };
export const LIFT_KEYS: LiftKey[] = ['squat', 'bench', 'deadlift', 'ohp'];

export const TIERS = [
  { name: 'Starter', floor: 0 },
  { name: 'Novice', floor: 500 },
  { name: 'Intermediate', floor: 800 },
  { name: 'Advanced', floor: 1100 },
  { name: 'Elite', floor: 1400 },
];

/** Estimated one-rep max (Epley). Sets above 12 reps are capped because the estimate drifts. */
export function e1rm(weight: number, reps: number) {
  return reps <= 1 ? weight : weight * (1 + Math.min(reps, 12) / 30);
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function bodyweightOn(entries: ProgressEntry[] | undefined, date: ISODate, fallback = 75) {
  const before = (entries ?? []).filter((e) => e.date <= date);
  return before.length ? before[before.length - 1].weight : (entries?.[0]?.weight ?? fallback);
}

export function bestLifts(lifts: LiftEntry[], memberId: string, upTo: ISODate = '9999-12-31') {
  const best: Partial<Record<LiftKey, { e1rm: number; entry: LiftEntry }>> = {};
  for (const l of lifts) {
    if (l.memberId !== memberId || !l.liftKey || l.date > upTo) continue;
    const v = e1rm(l.weight, l.reps);
    if (!best[l.liftKey] || v > best[l.liftKey]!.e1rm) best[l.liftKey] = { e1rm: v, entry: l };
  }
  return best;
}

export function strengthScore(best: ReturnType<typeof bestLifts>, bodyweight: number) {
  let score = 0;
  for (const k of LIFT_KEYS) {
    const b = best[k];
    if (!b) continue;
    score += 250 * Math.min(b.e1rm / bodyweight / STANDARD[k], 1.7);
  }
  return Math.round(score);
}

export function tierFor(score: number) {
  let i = 0;
  while (i + 1 < TIERS.length && score >= TIERS[i + 1].floor) i++;
  const next = TIERS[i + 1];
  return { ...TIERS[i], index: i, next, toNext: next ? next.floor - score : 0 };
}

/** Weekly score history so members see the line go up. */
export function strengthHistory(lifts: LiftEntry[], memberId: string, progress: ProgressEntry[] | undefined, weeks = 10, t: ISODate = today()) {
  const out: { date: ISODate; score: number }[] = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const d = addDays(t, -7 * k);
    out.push({ date: d, score: strengthScore(bestLifts(lifts, memberId, d), bodyweightOn(progress, d)) });
  }
  return out;
}

/** The next 0.1× bodyweight milestone for a lift. Works from the rounded ratio people see, so labels agree. */
export function nextMilestone(e1: number, bodyweight: number) {
  const hundredths = Math.round((e1 / bodyweight) * 100);
  const nextTenths = Math.floor(hundredths / 10) + 1;
  const nextRatio = nextTenths / 10;
  return {
    ratio: hundredths / 100,
    nextRatio,
    progress: (hundredths % 10) / 10,
    kg: Math.ceil((nextRatio * bodyweight) / 2.5) * 2.5,
  };
}

/** Would this set beat every earlier set of the same exercise? */
export function isPR(lifts: LiftEntry[], memberId: string, exercise: string, weight: number, reps: number) {
  const prev = lifts.filter((l) => l.memberId === memberId && l.exercise === exercise);
  if (prev.length === 0) return false;
  const best = Math.max(...prev.map((l) => e1rm(l.weight, l.reps)));
  return e1rm(weight, reps) > best + 0.01;
}

export function prCount(lifts: LiftEntry[], memberId: string) {
  const best: Record<string, number> = {};
  let n = 0;
  for (const l of [...lifts].filter((x) => x.memberId === memberId).sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const v = e1rm(l.weight, l.reps);
    if (best[l.exercise] !== undefined && v > best[l.exercise] + 0.01) n++;
    best[l.exercise] = Math.max(best[l.exercise] ?? 0, v);
  }
  return n;
}

export function lastSet(lifts: LiftEntry[], memberId: string, exercise: string) {
  return lifts.filter((l) => l.memberId === memberId && l.exercise === exercise).sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
}

// ---------------------------------------------------------------------------
// Leagues: hyper-local weekly competition
// ---------------------------------------------------------------------------

export const LEAGUES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
export const LEAGUE_SIZE = 8;
export const PROMOTE = 3;
export const DEMOTE = 2;

/** Up to seven rivals, people from your own time slot first. Same group all week, a fresh group every Monday. */
export function leagueRivals(members: Member[], me: Member, week: ISODate) {
  const r = rng(`league-${me.id}-${week}`);
  const shuffle = (ids: string[]) => {
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sameSlot = shuffle(members.filter((m) => m.id !== me.id && m.preferredSlotId === me.preferredSlotId).map((m) => m.id));
  const others = shuffle(members.filter((m) => m.id !== me.id && m.preferredSlotId !== me.preferredSlotId).map((m) => m.id));
  return [...sameSlot, ...others].slice(0, LEAGUE_SIZE - 1);
}

export type LeagueRow = { id: string; xp: number; me: boolean };

export function leagueStandings(input: { members: Member[]; me: Member; xp: XpEvent[]; week: ISODate; t?: ISODate }): LeagueRow[] {
  const t = input.t ?? today();
  const end = addDays(input.week, 6) < t ? addDays(input.week, 6) : t;
  const rows: LeagueRow[] = leagueRivals(input.members, input.me, input.week).map((id) => ({
    id,
    xp: xpBetween(input.xp, id, input.week, end),
    me: false,
  }));
  rows.push({ id: input.me.id, xp: xpBetween(input.xp, input.me.id, input.week, end), me: true });
  return rows.sort((a, b) => b.xp - a.xp || (a.me ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Station challenges: Strava-style segments with local leaderboards
// ---------------------------------------------------------------------------

export function formatScore(c: Pick<Challenge, 'unit'>, value: number) {
  if (c.unit === 'reps') return `${value} reps`;
  const m = Math.floor(value / 60);
  const s = Math.round(value % 60);
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s} s`;
}

/** Accepts '1:52', '112' (seconds) for time, or a whole number of reps. */
export function parseScore(c: Pick<Challenge, 'unit'>, text: string): number | null {
  const t = text.trim();
  if (c.unit === 'reps') {
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function beats(c: Pick<Challenge, 'better'>, a: number, b: number) {
  return c.better === 'lower' ? a < b : a > b;
}

export type BoardRow = { memberId: string; value: number; rank: number; me: boolean };

export function leaderboard(c: Challenge, entries: ChallengeEntry[], meId: string, scope?: Set<string>): BoardRow[] {
  const best = new Map<string, number>();
  for (const e of entries) {
    if (e.challengeId !== c.id) continue;
    if (scope && !scope.has(e.memberId) && e.memberId !== meId) continue;
    const cur = best.get(e.memberId);
    if (cur === undefined || beats(c, e.value, cur)) best.set(e.memberId, e.value);
  }
  return [...best.entries()]
    .sort((a, b) => (c.better === 'lower' ? a[1] - b[1] : b[1] - a[1]))
    .map(([memberId, value], i) => ({ memberId, value, rank: i + 1, me: memberId === meId }));
}

// ---------------------------------------------------------------------------
// Badges: collections with visible progress
// ---------------------------------------------------------------------------

export type Badge = { id: string; name: string; how: string; icon: string; have: number; need: number; earned: boolean };

export function badges(input: {
  visits: string[];
  prs: number;
  score: number;
  guests: number;
  mindMinutes: number;
  ringWeeks: number;
  legend: boolean;
  kings?: { id: string; name: string; won: boolean }[];
}): Badge[] {
  const days = [...new Set(input.visits.map((s) => stampToDate(s)))].sort();
  let streak = 0;
  let runStart = 0;
  days.forEach((d, i) => {
    if (i > 0 && diffDays(days[i - 1], d) > 2) runStart = i;
    streak = Math.max(streak, diffDays(days[runStart], d) + 1);
  });
  const hours = input.visits.map((s) => new Date(s).getHours());
  const early = hours.filter((h) => h < 7).length;
  const late = hours.filter((h) => h >= 20).length;
  const visitDays = new Set(input.visits.map((s) => stampToDate(s))).size;
  const list: Omit<Badge, 'earned'>[] = [
    { id: 'first', name: 'First step', how: 'Check in once', icon: 'footsteps', have: visitDays, need: 1 },
    { id: 'regular', name: 'Regular', how: 'Train 25 times', icon: 'repeat', have: visitDays, need: 25 },
    { id: 'century', name: 'Century', how: 'Train 100 times', icon: 'ribbon', have: visitDays, need: 100 },
    { id: 'early', name: 'Early bird', how: '10 visits before 7 am', icon: 'sunny', have: early, need: 10 },
    { id: 'owl', name: 'Night owl', how: '10 visits after 8 pm', icon: 'moon', have: late, need: 10 },
    { id: 'pr', name: 'PR hunter', how: 'Set 5 personal records', icon: 'trophy', have: input.prs, need: 5 },
    { id: 'strong', name: 'Strong', how: 'Reach an Intermediate Strength score', icon: 'barbell', have: Math.min(input.score, 800), need: 800 },
    { id: 'rings', name: 'Ring master', how: 'Close all three rings in a week', icon: 'aperture', have: input.ringWeeks, need: 1 },
    { id: 'guest', name: 'Good company', how: 'Bring a guest', icon: 'people', have: input.guests, need: 1 },
    { id: 'mind', name: 'Calm mind', how: '30 minutes of guided breathing', icon: 'leaf', have: input.mindMinutes, need: 30 },
    { id: 'legend', name: 'Local legend', how: 'Top a station board in your slot', icon: 'medal', have: input.legend ? 1 : 0, need: 1 },
    { id: 'streak30', name: '30-day streak', how: 'Train at least every other day for 30 days', icon: 'flame', have: streak, need: 30 },
    ...(input.kings ?? []).map((k) => ({
      id: `king-${k.id}`,
      name: `${k.name} king`,
      how: `Hold 1st place on the ${k.name} board in your slot`,
      icon: 'trophy',
      have: k.won ? 1 : 0,
      need: 1,
    })),
  ];
  return list.map((b) => ({ ...b, have: Math.min(b.have, b.need), earned: b.have >= b.need }));
}
