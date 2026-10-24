/** Calendar dates are plain 'YYYY-MM-DD' strings in the gym's local time. */
export type ISODate = string;

const DAY_MS = 86_400_000;
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parts(iso: ISODate) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

export function fromISO(iso: ISODate) {
  const { y, m, d } = parts(iso);
  return new Date(y, m, d);
}

function utc(iso: ISODate) {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m, d);
}

export function today(): ISODate {
  return toISO(new Date());
}

export function addDays(iso: ISODate, n: number): ISODate {
  const t = new Date(utc(iso) + n * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate) {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

/** Inclusive day count of a range. */
export function spanDays(start: ISODate, end: ISODate) {
  return diffDays(start, end) + 1;
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parts(iso);
  const target = new Date(Date.UTC(y, m + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(d, lastDay))}`;
}

/** A plan of N months bought on `start` runs until the day before the same date N months later. */
export function termEnd(start: ISODate, months: number) {
  return addDays(addMonths(start, months), -1);
}

export function weekday(iso: ISODate) {
  return new Date(utc(iso)).getUTCDay();
}

/** Monday of the week containing iso. */
export function startOfWeek(iso: ISODate) {
  const wd = weekday(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

export function monthKey(iso: ISODate) {
  return iso.slice(0, 7);
}

export function isBetween(iso: ISODate, start: ISODate, end: ISODate) {
  return iso >= start && iso <= end;
}

export function daysInRange(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(mins: number) {
  return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
}

/** '18:30' → '6:30 pm' */
export function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** '18:30' → { clock: '6:30', suffix: 'pm' } for big numeral layouts. */
export function clockParts(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return { clock: `${h % 12 === 0 ? 12 : h % 12}:${pad(m)}`, suffix: h >= 12 ? 'pm' : 'am' };
}

export function fmtTimeRange(start: string, end: string) {
  const a = clockParts(start);
  const b = clockParts(end);
  return a.suffix === b.suffix ? `${a.clock} – ${b.clock} ${b.suffix}` : `${fmtTime(start)} – ${fmtTime(end)}`;
}

/** '19 Oct' */
export function fmtDay(iso: ISODate) {
  const { m, d } = parts(iso);
  return `${d} ${MONTHS_SHORT[m]}`;
}

/** '19 Oct 2026' */
export function fmtDate(iso: ISODate) {
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS_SHORT[m]} ${y}`;
}

/** 'Thu, 19 Oct' */
export function fmtWeekdayDay(iso: ISODate) {
  return `${WEEKDAYS_SHORT[weekday(iso)]}, ${fmtDay(iso)}`;
}

/** 'Thursday, 19 October' */
export function fmtLongDay(iso: ISODate) {
  const { m, d } = parts(iso);
  return `${WEEKDAYS_LONG[weekday(iso)]}, ${d} ${MONTHS_LONG[m]}`;
}

/** 'Today', 'Tomorrow', 'Yesterday' or 'Thu, 19 Oct' */
export function fmtRelativeDay(iso: ISODate, ref: ISODate = today()) {
  const diff = diffDays(ref, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return fmtWeekdayDay(iso);
}

/** For mid-sentence use: 'today', 'tomorrow', 'yesterday' or 'on Thu, 19 Oct'. */
export function fmtRelativeInline(iso: ISODate, ref: ISODate = today()) {
  const diff = diffDays(ref, iso);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return `on ${fmtWeekdayDay(iso)}`;
}

/** '7:00–8:30 pm', compact enough for tables. */
export function fmtClockRange(start: string, end: string) {
  const a = clockParts(start);
  const b = clockParts(end);
  return `${a.clock}–${b.clock} ${b.suffix}`;
}

export function fmtMonthYear(iso: ISODate) {
  const { y, m } = parts(iso);
  return `${MONTHS_LONG[m]} ${y}`;
}

export function fmtRange(start: ISODate, end: ISODate) {
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y && a.m === b.m) return `${a.d} – ${b.d} ${MONTHS_SHORT[b.m]}`;
  if (a.y === b.y) return `${fmtDay(start)} – ${fmtDay(end)}`;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** ISO timestamp → 'Today, 6:42 pm' style label. */
export function fmtStamp(isoStamp: string) {
  const d = new Date(isoStamp);
  const day = fmtRelativeDay(toISO(d));
  return `${day}, ${fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
}

/** For mid-sentence use: 'yesterday at 6:42 pm' or 'on Thu, 19 Oct at 6:42 pm'. */
export function fmtStampInline(isoStamp: string) {
  const d = new Date(isoStamp);
  return `${fmtRelativeInline(toISO(d))} at ${fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
}

export function stampToDate(isoStamp: string): ISODate {
  return toISO(new Date(isoStamp));
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
