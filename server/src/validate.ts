/**
 * What each stored record has to look like. Screens read these fields without checking them, so one
 * member's malformed record could otherwise crash the app of everyone else who loads it. Member
 * writes are refused if they don't fit, and anything already stored that doesn't fit is held back
 * when phones read. Only fields the app relies on are listed; extra fields are left alone.
 */

type Check = (v: unknown) => boolean;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const text = (max = 500, min = 0): Check => (v) => typeof v === 'string' && v.length >= min && v.length <= max;
const id = text(100, 1);
const num = (min: number, max: number): Check => (v) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const bool: Check = (v) => typeof v === 'boolean';
const date: Check = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const stamp: Check = (v) => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const oneOf = (...allowed: string[]): Check => (v) => typeof v === 'string' && allowed.includes(v);
const opt = (check: Check): Check => (v) => v === undefined || v === null || check(v);
const list = (each: Check, max = 2000): Check => (v) => Array.isArray(v) && v.length <= max && v.every(each);
const shape = (fields: Record<string, Check>): Check => (v) => isObject(v) && Object.entries(fields).every(([k, check]) => check(v[k]));
const byDate = (each: Check): Check => (v) => isObject(v) && Object.entries(v).every(([k, x]) => date(k) && each(x));

const KG = num(0, 2000);

const dayLog = byDate(list(text(100)));

/** Records that are a single item carry their own id, and it has to match the one they're stored under. */
const ITEMS: Record<string, Record<string, Check>> = {
  members: { name: text(120, 1), code: text(40, 1), phone: text(20), joinedOn: date, gender: opt(text(20)), weeklyGoal: opt(num(0, 50)), goalWeight: opt(KG), preferredSlotId: opt(text(100)), bonusUsed: opt(num(0, 100_000)) },
  bookings: { memberId: id, kind: oneOf('slot', 'class'), refId: id, date, status: oneOf('booked', 'waitlist', 'cancelled'), createdAt: opt(stamp) },
  pauses: { memberId: id, start: date, end: date, reason: text(), note: opt(text()), status: oneOf('pending', 'approved', 'rejected', 'cancelled'), createdAt: opt(stamp) },
  ptRequests: { memberId: id, trainerId: id, preferredTime: text(), goal: text(), status: oneOf('pending', 'scheduled', 'declined'), createdAt: opt(stamp) },
  tickets: { memberId: id, category: text(40), message: text(2000), status: oneOf('open', 'resolved'), createdAt: opt(stamp), reply: opt(text(2000)) },
  notices: { memberId: opt(id), title: text(), body: text(2000), kind: oneOf('booking', 'pause', 'payment', 'announcement', 'reminder', 'class'), at: stamp, read: bool },
  guestPasses: { hostId: id, name: text(120), phone: text(20), code: text(20), createdOn: date, activatedOn: opt(date), visits: list(date), joinedAs: opt(text(100)) },
  xp: { memberId: id, amount: num(-100_000, 100_000), reason: text(), at: stamp, key: opt(text(200)) },
  chests: { memberId: id, reason: text(), earnedAt: stamp, openedAt: opt(stamp), prize: opt(shape({ kind: text(20), amount: num(0, 100_000), label: text(80) })), redeemedAt: opt(stamp), selfEarned: opt(bool) },
  lifts: { memberId: id, exercise: text(120, 1), liftKey: opt(oneOf('squat', 'bench', 'deadlift', 'ohp')), weight: KG, reps: num(0, 1000), date },
  challengeEntries: { memberId: id, challengeId: id, value: num(0, 1_000_000), date },
  mindLog: { memberId: id, sessionId: id, minutes: num(0, 1440), at: stamp },
  testResults: {
    memberId: id,
    date,
    at: stamp,
    score: num(0, 100),
    bodyweight: opt(KG),
    lines: list(
      shape({
        itemId: id,
        name: text(80, 1),
        measure: oneOf('reps', 'kg', 'cm', 'time'),
        better: oneOf('higher', 'lower'),
        sets: list(num(0, 100_000), 20),
        value: num(0, 100_000),
        target: num(0, 100_000),
        score: num(0, 100),
      }),
      30,
    ),
    skipped: opt(list(text(80), 30)),
    by: opt(text(120)),
  },
  products: { name: text(80, 1), category: text(40, 1), price: num(0, 10_000_000), stock: opt(num(-1_000_000, 1_000_000)), about: opt(text(1000)), photo: opt(text(80_000)), active: bool },
  orders: {
    memberId: id,
    items: list(shape({ productId: id, name: text(80), price: num(0, 10_000_000), qty: num(1, 100) }), 20),
    total: num(0, 1_000_000_000),
    status: oneOf('requested', 'ready', 'done', 'cancelled'),
    createdAt: stamp,
    saleId: opt(id),
  },
};

/** Records kept per member, stored under the member's id. */
const RECORDS: Record<string, Check> = {
  progress: list(shape({ id, date, weight: KG, bodyFat: opt(num(0, 100)), waist: opt(num(0, 500)) })),
  workoutLog: dayLog,
  mealLog: dayLog,
  water: byDate(num(0, 200)),
  ringClaims: byDate(list(text(20), 10)),
  leagueTier: num(0, 20),
  leagueSettledWeek: date,
  supplements: list(shape({ id, name: text(120), dose: text(120), time: text(40), kind: oneOf('supplement', 'medicine'), addedBy: oneOf('coach', 'member'), note: opt(text()) })),
};

/** Whether a record is safe to store and hand to other people's apps. Staff-only setup such as plans has no rules here. */
export function validDoc(kind: string, docId: string, data: unknown) {
  const item = ITEMS[kind];
  if (item) return shape({ ...item, id: (v) => v === docId })(data);
  const record = RECORDS[kind];
  return record ? record(data) : true;
}

/** The few records that are a bare value rather than an object or list. */
export const BARE_VALUES = new Set(['leagueTier', 'leagueSettledWeek']);
