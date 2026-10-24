/**
 * Business rules shared by the member and manager apps.
 * Everything here is pure: give it data and a date, get an answer. Swap the store for an API
 * later and these functions keep working.
 */
import { activeBrand } from '@/config/active';
import type {
  Booking,
  CheckIn,
  Closure,
  Data,
  GymClass,
  Member,
  Pause,
  Plan,
  Slot,
} from '@/store/types';

import {
  addDays,
  diffDays,
  fmtTime,
  monthKey,
  MONTHS_SHORT,
  parts,
  spanDays,
  stampToDate,
  startOfWeek,
  today,
  toMinutes,
  weekday,
  WEEKDAYS_LONG,
  type ISODate,
} from './date';
import { clamp } from './format';

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export type MemberStatus = 'active' | 'paused' | 'expired' | 'upcoming';

export function pauseLength(p: Pick<Pause, 'start' | 'end'>) {
  return spanDays(p.start, p.end);
}

export function membership(member: Member, plans: Plan[], pauses: Pause[], t: ISODate = today()) {
  const plan = plans.find((p) => p.id === member.planId);
  const termPauses = pauses
    .filter((p) => p.memberId === member.id && p.start >= member.startDate)
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  const approved = termPauses.filter((p) => p.status === 'approved');
  const pending = termPauses.filter((p) => p.status === 'pending');
  const extendedBy = approved.reduce((s, p) => s + pauseLength(p), 0);
  const end = addDays(member.endDate, extendedBy);
  const pauseUsed = extendedBy + pending.reduce((s, p) => s + pauseLength(p), 0);
  const pauseLeft = Math.max(0, member.pauseAllowance - pauseUsed);
  const activePause = approved.find((p) => t >= p.start && t <= p.end);
  const upcomingPause = approved.find((p) => p.start > t);
  const pendingPause = pending[0];

  const status: MemberStatus =
    t < member.startDate ? 'upcoming' : t > end ? 'expired' : activePause ? 'paused' : 'active';
  const totalDays = spanDays(member.startDate, end);
  const from = t < member.startDate ? member.startDate : t;
  const daysLeft = status === 'expired' ? 0 : spanDays(from, end);
  const elapsed = clamp(diffDays(member.startDate, t) + 1, 0, totalDays);

  return {
    plan,
    status,
    start: member.startDate,
    end,
    baseEnd: member.endDate,
    extendedBy,
    daysLeft,
    totalDays,
    progress: totalDays > 0 ? elapsed / totalDays : 1,
    pauseAllowance: member.pauseAllowance,
    pauseUsed,
    pauseLeft,
    activePause,
    upcomingPause,
    pendingPause,
    termPauses,
    expiringSoon: status === 'active' && daysLeft <= 7,
    expiredDaysAgo: status === 'expired' ? diffDays(end, t) : 0,
  };
}

export type MembershipInfo = ReturnType<typeof membership>;

export function isPausedOn(memberId: string, date: ISODate, pauses: Pause[]) {
  return pauses.some((p) => p.memberId === memberId && p.status === 'approved' && date >= p.start && date <= p.end);
}

/** Can this member train on `date`? Returns a reason when they can't. */
export function canTrainOn(member: Member, plans: Plan[], pauses: Pause[], date: ISODate): string | null {
  const info = membership(member, plans, pauses, date);
  if (date < member.startDate) return 'Your membership hasn’t started yet on this day.';
  if (date > info.end) return 'Your membership ends before this day. Renew to book.';
  if (isPausedOn(member.id, date, pauses)) return 'Your membership is paused on this day.';
  return null;
}

// ---------------------------------------------------------------------------
// Opening hours
// ---------------------------------------------------------------------------

export function hoursOn(date: ISODate) {
  const wd = weekday(date);
  const h = activeBrand().hours.find((x) => x.days.includes(wd));
  return h ? { open: h.open, close: h.close } : null;
}

/** 'Opens at 5:30 am' today, or 'Opens tomorrow at 5:30 am' / 'Opens Sunday at 7:00 am'. */
export function nextOpening(date: ISODate, mins: number) {
  const h = hoursOn(date);
  if (h && mins < toMinutes(h.open)) return `Opens at ${fmtTime(h.open)}`;
  for (let k = 1; k <= 7; k++) {
    const d = addDays(date, k);
    const next = hoursOn(d);
    if (next) return `Opens ${k === 1 ? 'tomorrow' : `on ${WEEKDAYS_LONG[weekday(d)]}`} at ${fmtTime(next.open)}`;
  }
  return 'Closed';
}

export function isOpenNow(date: ISODate, mins: number) {
  const h = hoursOn(date);
  return !!h && mins >= toMinutes(h.open) && mins < toMinutes(h.close);
}

// ---------------------------------------------------------------------------
// Slots and classes
// ---------------------------------------------------------------------------

export function slotsOn(slots: Slot[], date: ISODate) {
  const wd = weekday(date);
  return slots.filter((s) => s.days.includes(wd)).sort((a, b) => (a.start < b.start ? -1 : 1));
}

export function classesOn(classes: GymClass[], date: ISODate) {
  const wd = weekday(date);
  return classes.filter((c) => c.days.includes(wd)).sort((a, b) => (a.start < b.start ? -1 : 1));
}

export function closureFor(closures: Closure[], date: ISODate, slotId: string) {
  return closures.find((c) => c.date === date && (c.slotId === null || c.slotId === slotId));
}

/** Resolve a booking's slot or class into one shape the UI can render. */
export function sessionRef(data: Pick<Data, 'slots' | 'classes'>, kind: 'slot' | 'class', refId: string) {
  if (kind === 'slot') {
    const s = data.slots.find((x) => x.id === refId);
    return s ? { id: s.id, kind, start: s.start, end: s.end, capacity: s.capacity, title: undefined as string | undefined, coachId: undefined as string | undefined } : undefined;
  }
  const c = data.classes.find((x) => x.id === refId);
  return c ? { id: c.id, kind, start: c.start, end: classEnd(c), capacity: c.capacity, title: c.name as string | undefined, coachId: c.coachId as string | undefined } : undefined;
}

export function startsIn(minutes: number) {
  if (minutes <= 0) return 'Happening now';
  if (minutes < 60) return `Starts in ${minutes} min`;
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `Starts in ${h} h ${m} min` : `Starts in ${h} h`;
  }
  const d = Math.round(minutes / 1440);
  return `In ${d} day${d === 1 ? '' : 's'}`;
}

export function classEnd(c: GymClass) {
  const end = toMinutes(c.start) + c.minutes;
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

export function periodOf(start: string): 'Morning' | 'Afternoon' | 'Evening' {
  const m = toMinutes(start);
  if (m < 12 * 60) return 'Morning';
  if (m < 17 * 60) return 'Afternoon';
  return 'Evening';
}

export type CapacityLevel = 'open' | 'filling' | 'full';

export function levelFor(booked: number, capacity: number): CapacityLevel {
  if (capacity <= 0 || booked >= capacity) return 'full';
  return booked / capacity >= 0.7 ? 'filling' : 'open';
}

type SlotInput = Pick<Data, 'slots' | 'classes' | 'closures' | 'bookings'>;

export function slotState(
  data: SlotInput,
  date: ISODate,
  ref: { id: string; start: string; end: string; capacity: number },
  kind: 'slot' | 'class',
  memberId: string | undefined,
  now: { date: ISODate; mins: number },
) {
  const closure = kind === 'slot' ? closureFor(data.closures, date, ref.id) : undefined;
  const stored = data.bookings.filter((b) => b.kind === kind && b.refId === ref.id && b.date === date);
  const booked = stored.filter((b) => b.status === 'booked');
  const waitlist = stored
    .filter((b) => b.status === 'waitlist')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const count = closure ? 0 : Math.min(ref.capacity, booked.length);
  const left = Math.max(0, ref.capacity - count);
  const startMin = toMinutes(ref.start);
  const endMin = toMinutes(ref.end);
  const isToday = date === now.date;
  const over = date < now.date || (isToday && now.mins >= endMin);
  const started = date < now.date || (isToday && now.mins >= startMin);
  const mine = memberId ? booked.find((b) => b.memberId === memberId) : undefined;
  const myWait = memberId ? waitlist.find((b) => b.memberId === memberId) : undefined;
  return {
    closure,
    capacity: ref.capacity,
    count,
    left,
    level: levelFor(count, ref.capacity),
    storedBooked: booked,
    waitlist,
    over,
    started,
    minutesToStart: isToday ? startMin - now.mins : (diffDays(now.date, date) * 1440) + startMin - now.mins,
    mine,
    myWait,
    waitPosition: myWait ? waitlist.indexOf(myWait) + 1 : 0,
  };
}

export type SlotState = ReturnType<typeof slotState>;

// ---------------------------------------------------------------------------
// Crowd
// ---------------------------------------------------------------------------

export type CrowdLevel = 'Closed' | 'Quiet' | 'Steady' | 'Busy' | 'Packed';

export function crowdLevel(ratio: number): Exclude<CrowdLevel, 'Closed'> {
  if (ratio < 0.35) return 'Quiet';
  if (ratio < 0.65) return 'Steady';
  if (ratio < 0.9) return 'Busy';
  return 'Packed';
}

/**
 * Who is in the gym right now: members who checked in during the last 90 minutes. The gym's size is
 * the capacity of the slots running now, or of the biggest slot when none is running.
 */
export function crowdNow(data: SlotInput & Pick<Data, 'checkins'>, date: ISODate, mins: number) {
  if (!isOpenNow(date, mins)) return { level: 'Closed' as CrowdLevel, inside: 0, capacity: 0, ratio: 0 };
  const since = Date.now() - 90 * 60_000;
  const inside = new Set(data.checkins.filter((c) => new Date(c.at).getTime() >= since).map((c) => c.memberId)).size;
  const ongoing = slotsOn(data.slots, date).filter((s) => mins >= toMinutes(s.start) && mins < toMinutes(s.end));
  const capacity = ongoing.length ? ongoing.reduce((n, s) => n + s.capacity, 0) : Math.max(0, ...data.slots.map((s) => s.capacity));
  if (capacity === 0) return { level: crowdLevel(inside / 20) as CrowdLevel, inside, capacity: 0, ratio: inside / 20 };
  const ratio = inside / capacity;
  return { level: crowdLevel(ratio) as CrowdLevel, inside, capacity, ratio };
}

/**
 * How busy each opening hour usually is on this weekday, from the last eight weeks of real
 * check-ins. Shown relative to the busiest hour. Empty until there's enough history to say.
 */
export function hourlyLoad(data: Pick<Data, 'checkins'>, date: ISODate) {
  const h = hoursOn(date);
  if (!h) return [];
  const wd = weekday(date);
  const from = addDays(date, -56);
  const counts: Record<number, number> = {};
  let total = 0;
  for (const c of data.checkins) {
    const d = stampToDate(c.at);
    if (d >= date || d < from || weekday(d) !== wd) continue;
    const hour = new Date(c.at).getHours();
    counts[hour] = (counts[hour] ?? 0) + 1;
    total++;
  }
  if (total < 10) return [];
  const first = Math.floor(toMinutes(h.open) / 60);
  const last = Math.ceil(toMinutes(h.close) / 60);
  const peak = Math.max(1, ...Object.values(counts));
  const out: { hour: number; ratio: number }[] = [];
  for (let hour = first; hour < last; hour++) out.push({ hour, ratio: (counts[hour] ?? 0) / peak });
  return out;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export function visitDates(checkins: CheckIn[], memberId: string) {
  return [...new Set(checkins.filter((c) => c.memberId === memberId).map((c) => stampToDate(c.at)))].sort();
}

export function visitStats(
  checkins: CheckIn[],
  memberId: string,
  weeklyGoal: number,
  t: ISODate = today(),
  /** Weeks with a paused day neither count towards nor break a streak. */
  isPaused?: (d: ISODate) => boolean,
) {
  const dates = visitDates(checkins, memberId);
  const set = new Set(dates);
  const week = startOfWeek(t);
  const thisWeek = dates.filter((d) => d >= week).length;
  const thisMonth = dates.filter((d) => monthKey(d) === monthKey(t)).length;
  const countWeek = (monday: ISODate) => {
    let n = 0;
    for (let i = 0; i < 7; i++) if (set.has(addDays(monday, i))) n++;
    return n;
  };
  // The current week only counts once the goal is met, so an unfinished week never breaks a streak.
  let streak = 0;
  let cursor = thisWeek >= weeklyGoal ? week : addDays(week, -7);
  const pausedWeek = (monday: ISODate) => !!isPaused && [0, 1, 2, 3, 4, 5, 6].some((i) => isPaused(addDays(monday, i)));
  for (let i = 0; i < 52; i++) {
    if (countWeek(cursor) >= weeklyGoal) streak++;
    else if (!pausedWeek(cursor)) break;
    cursor = addDays(cursor, -7);
  }
  const hours = checkins
    .filter((c) => c.memberId === memberId)
    .map((c) => new Date(c.at).getHours());
  const freq: Record<number, number> = {};
  hours.forEach((h) => (freq[h] = (freq[h] ?? 0) + 1));
  const favHour = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
  const last4 = [0, 1, 2, 3].map((k) => countWeek(addDays(week, -7 * (k + 1))));
  return {
    total: dates.length,
    thisWeek,
    thisMonth,
    streak,
    favHour: favHour !== undefined ? Number(favHour) : undefined,
    avgPerWeek: last4.reduce((a, b) => a + b, 0) / 4,
    lastVisit: dates[dates.length - 1],
    dates,
  };
}

// ---------------------------------------------------------------------------
// Manager numbers
// ---------------------------------------------------------------------------

/** How many people checked in on a date, optionally only up to a time of day. */
export function checkinsOn(data: Pick<Data, 'checkins'>, date: ISODate, uptoMins?: number) {
  return data.checkins.filter((c) => {
    if (stampToDate(c.at) !== date) return false;
    if (uptoMins === undefined) return true;
    const d = new Date(c.at);
    return d.getHours() * 60 + d.getMinutes() <= uptoMins;
  }).length;
}

export function revenueByMonth(payments: Data['payments'], t: ISODate, months = 6) {
  const out: { key: string; label: string; total: number }[] = [];
  const { y, m } = parts(t);
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(y, m - k, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: MONTHS_SHORT[d.getUTCMonth()], total: 0 });
  }
  for (const p of payments) {
    const row = out.find((o) => o.key === monthKey(p.date));
    if (row) row.total += p.amount;
  }
  return out;
}

export function memberBookings(bookings: Booking[], memberId: string, from: ISODate) {
  return bookings
    .filter((b) => b.memberId === memberId && b.status !== 'cancelled' && b.date >= from)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

export function memberQRValue(member: Member, windowSeconds = 30, at = Date.now()) {
  const w = Math.floor(at / (windowSeconds * 1000));
  return `GYMPASS:${activeBrand().id}:${member.code}:${w}`;
}

export function parseQRValue(value: string, windowSeconds = 30, at = Date.now()) {
  const m = /^GYMPASS:([^:]+):([^:]+):(\d+)$/.exec(value.trim());
  if (!m) return { ok: false as const, reason: 'This isn’t a member pass.' };
  if (m[1] !== activeBrand().id) return { ok: false as const, reason: 'This pass belongs to a different gym.' };
  const w = Math.floor(at / (windowSeconds * 1000));
  if (Math.abs(w - Number(m[3])) > 2) return { ok: false as const, reason: 'This code has expired. Ask the member to reopen their pass.' };
  return { ok: true as const, code: m[2] };
}

export function guestQRValue(code: string) {
  return `GYMGUEST:${activeBrand().id}:${code}`;
}

export function parseGuestQRValue(value: string) {
  const m = /^GYMGUEST:([^:]+):(G\d{4})$/.exec(value.trim());
  if (!m) return null;
  return m[1] === activeBrand().id ? m[2] : null;
}
