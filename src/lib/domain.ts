/**
 * Business rules shared by the member and manager apps.
 * Everything here is pure: give it data and a date, get an answer. Swap the store for an API
 * later and these functions keep working.
 */
import { activeBrand } from '@/config/active';
import { AWAY_AFTER_DAYS, AWAY_MESSAGE, DEFAULT_TEST } from '@/data/constants';
import type {
  AttendanceDay,
  Booking,
  CheckIn,
  Closure,
  Data,
  GymClass,
  LedgerEntry,
  LineItem,
  Member,
  Pause,
  Payment,
  Plan,
  Product,
  Sale,
  Settings,
  Slot,
  TeamMember,
  TestItem,
  TestLine,
  TestMeasure,
  TestResult,
} from '@/store/types';

import {
  addDays,
  addMonths,
  daysInRange,
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
import { makePass, readPass } from './pass';

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

/** Undefined until the member's phone has its pass key from the server. */
export function memberQRValue(member: Member, windowSeconds = 30, at = Date.now()) {
  return member.passKey ? makePass(member.passKey, activeBrand().id, member.code, windowSeconds, at) : undefined;
}

export function parseQRValue(value: string, windowSeconds = 30, at = Date.now()) {
  return readPass(value, activeBrand().id, windowSeconds, at);
}

export function guestQRValue(code: string) {
  return `GYMGUEST:${activeBrand().id}:${code}`;
}

export function parseGuestQRValue(value: string) {
  const m = /^GYMGUEST:([^:]+):(G\d{4})$/.exec(value.trim());
  if (!m) return null;
  return m[1] === activeBrand().id ? m[2] : null;
}

// ---------------------------------------------------------------------------
// The shop
// ---------------------------------------------------------------------------
export const PRODUCT_CATEGORIES = ['Supplements', 'Drinks', 'Gear', 'Clothing', 'Other'] as const;

export const lineTotal = (items: LineItem[]) => items.reduce((sum, i) => sum + i.price * i.qty, 0);

/** Takes sold items off the shelf (or puts them back with sign -1). Products without a stock count are left alone. */
export function adjustStock(products: Product[], items: LineItem[], sign: 1 | -1 = 1): Product[] {
  const sold = new Map<string, number>();
  for (const i of items) sold.set(i.productId, (sold.get(i.productId) ?? 0) + i.qty);
  return products.map((p) => (typeof p.stock === 'number' && sold.has(p.id) ? { ...p, stock: p.stock - sign * sold.get(p.id)! } : p));
}

// ---------------------------------------------------------------------------
// Staff pay
// ---------------------------------------------------------------------------
export const TEAM_ROLES = ['Coach', 'Front desk', 'Manager', 'Cleaning', 'Other'];

/** First and last day of a month given as YYYY-MM. */
export function monthBounds(month: string) {
  const start = `${month}-01`;
  return { start, end: addDays(addMonths(start, 1), -1) };
}

export type PaySummary = {
  /** Working days this month from the day they joined, days off excluded. */
  workDays: number;
  /** Of those, the days up to today. */
  daysSoFar: number;
  absent: number;
  half: number;
  leave: number;
  /** Pay for the month: the salary less unpaid days, or the daily rate times the days worked so far. */
  earned: number;
  /** What the month pays if they miss nothing. */
  full: number;
  /** Salary already paid out for this month, advances included. */
  paid: number;
  /** Still to pay. Negative when more was advanced than earned. */
  balance: number;
};

/**
 * What someone has earned in a month from their attendance. A working day nobody marked counts as
 * present, so the desk only marks the exceptions. Absences cost a full day, half days half a day,
 * paid leave nothing. A monthly salary is spread evenly over the month's working days.
 */
export function payFor(t: TeamMember, month: string, attendance: Record<ISODate, AttendanceDay>, ledger: LedgerEntry[], todayISO: ISODate): PaySummary {
  const { start, end } = monthBounds(month);
  const off = new Set(t.offDays);
  const working = daysInRange(start, end).filter((d) => !off.has(weekday(d)));
  const eligible = working.filter((d) => d >= t.joinedOn);
  const soFar = eligible.filter((d) => d <= todayISO);
  const tally = (days: ISODate[]) => {
    let absent = 0;
    let half = 0;
    let leave = 0;
    for (const d of days) {
      const m = attendance[d]?.[t.id];
      if (m === 'A') absent++;
      else if (m === 'H') half++;
      else if (m === 'L') leave++;
    }
    return { absent, half, leave };
  };
  const all = tally(eligible);
  const pay = t.pay ?? 0;
  let earned: number;
  let full: number;
  if (t.payType === 'daily') {
    const past = tally(soFar);
    full = pay * eligible.length;
    earned = Math.max(0, Math.round(pay * (soFar.length - past.absent - past.half / 2)));
  } else {
    const rate = working.length ? pay / working.length : 0;
    full = Math.round(rate * eligible.length);
    earned = Math.max(0, Math.round(rate * (eligible.length - all.absent - all.half / 2)));
  }
  const paid = ledger.filter((e) => e.dir === 'out' && e.teamId === t.id && e.period === month).reduce((sum, e) => sum + e.amount, 0);
  return { workDays: eligible.length, daysSoFar: soFar.length, ...all, earned, full, paid, balance: earned - paid };
}

// ---------------------------------------------------------------------------
// The books
// ---------------------------------------------------------------------------
export const EXPENSE_CATEGORIES = ['Salaries', 'Rent', 'Electricity and water', 'Equipment', 'Shop stock', 'Repairs', 'Marketing', 'Other'];
export const INCOME_CATEGORIES = ['Personal training', 'Lockers', 'Events', 'Other'];

export type BookLine = { label: string; amount: number };
export type MonthBooks = { income: BookLine[]; expenses: BookLine[]; totalIn: number; totalOut: number; profit: number };

const grouped = (entries: LedgerEntry[]): BookLine[] => {
  const by = new Map<string, number>();
  for (const e of entries) by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
  return [...by].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
};

/** Profit and loss for a month (YYYY-MM): memberships, shop sales and other income against every expense. */
export function monthBooks(month: string, payments: Payment[], sales: Sale[], ledger: LedgerEntry[]): MonthBooks {
  const inMonth = (d: ISODate) => monthKey(d) === month;
  const memberships = payments.filter((p) => inMonth(p.date)).reduce((sum, p) => sum + p.amount, 0);
  const shop = sales.filter((s) => inMonth(s.date)).reduce((sum, s) => sum + s.total, 0);
  const entries = ledger.filter((e) => inMonth(e.date));
  const income = [{ label: 'Memberships', amount: memberships }, { label: 'Shop sales', amount: shop }, ...grouped(entries.filter((e) => e.dir === 'in'))].filter((l) => l.amount > 0);
  const expenses = grouped(entries.filter((e) => e.dir === 'out'));
  const totalIn = income.reduce((sum, l) => sum + l.amount, 0);
  const totalOut = expenses.reduce((sum, l) => sum + l.amount, 0);
  return { income, expenses, totalIn, totalOut, profit: totalIn - totalOut };
}

/** The `count` months ending with `month`, oldest first. */
export function monthsUpTo(month: string, count: number) {
  return Array.from({ length: count }, (_, i) => addMonths(`${month}-01`, i - count + 1).slice(0, 7));
}

// ---------------------------------------------------------------------------
// Members who stopped coming
// ---------------------------------------------------------------------------

export const awayAfterDays = (settings: Pick<Settings, 'awayAfterDays'>) => settings.awayAfterDays ?? AWAY_AFTER_DAYS;
export const awayTemplate = (settings: Pick<Settings, 'awayMessage'>) => settings.awayMessage?.trim() || AWAY_MESSAGE;

export type Away = { member: Member; days: number; lastVisit?: ISODate };

/**
 * Members who should be training but haven't been in for `afterDays` days or more, longest away first.
 * Paused, expired and not-yet-started members are left out, and so is time spent on a pause. A member
 * with no visits counts from their plan start, but never from before the gym's first check-in in the
 * app, so a gym that has just started using it isn't told everyone has vanished.
 */
export function awayMembers(data: Pick<Data, 'members' | 'plans' | 'pauses' | 'checkins'>, t: ISODate, afterDays: number): Away[] {
  if (!data.checkins.length) return [];
  const last = new Map<string, ISODate>();
  let tracking = t;
  for (const c of data.checkins) {
    const d = stampToDate(c.at);
    if (d < tracking) tracking = d;
    if ((last.get(c.memberId) ?? '') < d) last.set(c.memberId, d);
  }
  const out: Away[] = [];
  for (const m of data.members) {
    const info = membership(m, data.plans, data.pauses, t);
    if (info.status !== 'active') continue;
    const lastVisit = last.get(m.id);
    let from = lastVisit ?? (info.start > tracking ? info.start : tracking);
    // Days on an approved pause don't count as staying away.
    for (const p of data.pauses) {
      if (p.memberId === m.id && p.status === 'approved' && p.end < t && p.end >= from) from = p.end;
    }
    const days = diffDays(from, t);
    if (days >= afterDays) out.push({ member: m, days, lastVisit });
  }
  return out.sort((a, b) => b.days - a.days);
}

/** The gym's message with the member's first name, the days away and the gym's name filled in. */
export function awayMessageFor(template: string, member: Pick<Member, 'name'>, days: number, gym: string) {
  const first = member.name.trim().split(/\s+/)[0] || member.name;
  return template.replace(/\{name\}/gi, first).replace(/\{days\}/gi, String(days)).replace(/\{gym\}/gi, gym);
}

// ---------------------------------------------------------------------------
// Strength and endurance test
// ---------------------------------------------------------------------------

const MEASURES: TestMeasure[] = ['reps', 'kg', 'cm', 'time'];

/** The gym's test, with anything malformed dropped so one bad edit can't break the members' app. */
export function testItems(settings: Pick<Settings, 'strengthTest'>): TestItem[] {
  const list = Array.isArray(settings.strengthTest) ? settings.strengthTest : DEFAULT_TEST;
  return list.filter(
    (i): i is TestItem =>
      !!i &&
      typeof i.id === 'string' &&
      typeof i.name === 'string' &&
      MEASURES.includes(i.measure) &&
      Number.isFinite(i.sets) &&
      i.sets >= 1 &&
      Number.isFinite(i.target) &&
      i.target > 0,
  );
}

/** The result an item's sets add up to: reps are totalled, weight and reach keep the best, times the fastest (or longest). */
export function testValue(item: Pick<TestItem, 'measure' | 'better'>, sets: number[]) {
  const done = sets.filter((v) => Number.isFinite(v) && v > 0);
  if (!done.length) return 0;
  if (item.measure === 'reps') return done.reduce((a, b) => a + b, 0);
  if (item.measure === 'time' && item.better === 'lower') return Math.min(...done);
  return Math.max(...done);
}

/** What full marks takes, in the item's own unit. Bodyweight targets need the member's weight. */
export function testTarget(item: Pick<TestItem, 'target' | 'perBodyweight' | 'measure'>, bodyweight?: number) {
  if (item.measure === 'kg' && item.perBodyweight) return bodyweight ? Math.round(item.target * bodyweight * 2) / 2 : 0;
  return item.target;
}

/** 0 to 100 for one exercise: the share of the target reached, capped at full marks. */
export function testItemScore(value: number, target: number, better: 'higher' | 'lower') {
  if (!(value > 0) || !(target > 0)) return 0;
  const ratio = better === 'lower' ? target / value : value / target;
  return Math.round(clamp(ratio, 0, 1) * 100);
}

/** Scores every finished exercise and averages them. Skipped exercises don't count either way. */
export function scoreTest(items: TestItem[], sets: Record<string, number[]>, bodyweight?: number): { lines: TestLine[]; score: number } {
  const lines: TestLine[] = [];
  for (const item of items) {
    const raw = sets[item.id];
    if (!raw) continue;
    const value = testValue(item, raw);
    if (!(value > 0)) continue;
    const target = testTarget(item, bodyweight);
    lines.push({
      itemId: item.id,
      name: item.name,
      measure: item.measure,
      better: item.better,
      sets: raw.filter((v) => v > 0),
      value,
      target,
      score: testItemScore(value, target, item.better),
    });
  }
  const score = lines.length ? Math.round(lines.reduce((sum, l) => sum + l.score, 0) / lines.length) : 0;
  return { lines, score };
}

/** What a score means, in words a member understands. */
export function testBand(score: number): { label: string; note: string } {
  if (score >= 90) return { label: 'Peak shape', note: 'You hit almost every target. Keep it there.' };
  if (score >= 75) return { label: 'Strong', note: 'Well above average, with a few targets left to reach.' };
  if (score >= 60) return { label: 'Fit', note: 'A solid base. Steady training will push this up fast.' };
  if (score >= 40) return { label: 'Getting there', note: 'A good start. Test again in four to six weeks to see the change.' };
  return { label: 'Starting out', note: 'Everyone starts somewhere. This is the number you’ll beat next time.' };
}

/** A member's results, oldest first. */
export function testHistory(results: TestResult[], memberId: string) {
  return results.filter((r) => r.memberId === memberId).sort((a, b) => (a.at < b.at ? -1 : 1));
}

/** '42 reps', '60 kg', '28 cm', '13:45' */
export function fmtTestValue(measure: TestMeasure, v: number) {
  if (measure === 'time') {
    const total = Math.round(v);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }
  const n = Math.round(v * 10) / 10;
  return measure === 'reps' ? `${n} ${n === 1 ? 'rep' : 'reps'}` : `${n} ${measure}`;
}

/** Reads '13:45', '13.45', '13m 45s', '13 min' or plain seconds as seconds. */
export function parseDuration(input: string): number | null {
  const t = input.trim().toLowerCase();
  if (!t) return null;
  const clock = /^(\d{1,3})[:.](\d{1,2})$/.exec(t);
  if (clock) return Number(clock[2]) < 60 ? Number(clock[1]) * 60 + Number(clock[2]) : null;
  const words = /^(?:(\d{1,3})\s*m(?:in)?)?\s*(?:(\d{1,2})\s*s(?:ec)?)?$/.exec(t);
  if (words && (words[1] || words[2])) return Number(words[1] ?? 0) * 60 + Number(words[2] ?? 0);
  return /^\d{1,5}$/.test(t) ? Number(t) : null;
}

/** 90 → '90 s', 120 → '2 min', 150 → '2:30 min' */
export function fmtSeconds(sec: number) {
  if (sec < 90 && sec % 60 !== 0) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return r ? `${m}:${String(r).padStart(2, '0')} min` : `${m} min`;
}

/** "3 sets of 10 reps, 90 s rest" style summary of what an exercise asks for. */
export function testPrescription(item: TestItem) {
  const out: string[] = [];
  const attempts = item.measure === 'cm' || item.measure === 'time';
  const sets = item.sets === 1 ? (attempts ? '1 attempt' : '1 set') : `${item.sets} ${attempts ? 'attempts' : 'sets'}`;
  out.push(item.reps ? `${sets} of ${item.reps} reps` : sets);
  if (item.seconds) out.push(`${fmtSeconds(item.seconds)} ${item.sets === 1 ? 'on the clock' : 'each'}`);
  if (item.rest && item.sets > 1) out.push(`${fmtSeconds(item.rest)} rest`);
  return out.join(', ');
}

/** "Full marks: 40 reps" or "0.75 × bodyweight" for the owner's list. */
export function fmtTestTarget(item: TestItem) {
  if (item.measure === 'kg' && item.perBodyweight) return `${item.target} × bodyweight`;
  return `${item.better === 'lower' ? 'Under ' : ''}${fmtTestValue(item.measure, item.target)}`;
}
