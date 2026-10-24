import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { activeBrand, setActiveOverride } from '@/config/active';
import type { BrandOverride } from '@/config/brand';
import { DIET_TEMPLATES } from '@/data/diet';
import { WORKOUT_TEMPLATES } from '@/data/workouts';
import { emptyData } from '@/data/empty';
import {
  addDays,
  diffDays,
  fmtDay,
  fmtRange,
  fmtTimeRange,
  minutesNow,
  spanDays,
  startOfWeek,
  stampToDate,
  termEnd,
  today,
  toMinutes,
  type ISODate,
} from '@/lib/date';
import {
  canTrainOn,
  classEnd,
  closureFor,
  membership,
  pauseLength,
  slotState,
} from '@/lib/domain';
import { firstName, money, uid } from '@/lib/format';
import {
  beats,
  bestLifts,
  bodyweightOn,
  e1rm,
  formatScore,
  isPR,
  LEAGUE_SIZE,
  LEAGUES,
  leaderboard,
  leagueStandings,
  levelFor,
  PROMOTE,
  DEMOTE,
  round1,
  strengthScore,
  tierFor,
  weekRings,
  XP,
  xpTotal,
} from '@/lib/game';

import type {
  Announcement,
  AnnouncementKind,
  Booking,
  Celebration,
  Challenge,
  Chest,
  GuestPass,
  LiftKey,
  SupplementItem,
  XpEvent,
  Data,
  Lead,
  Member,
  Notice,
  PayMethod,
  Payment,
  Plan,
  Prefs,
  ProgressEntry,
  Result,
  Session,
  GymClass,
  GymLink,
  Role,
  Trainer,
  Settings,
  TicketCategory,
} from './types';

export * from './types';

type Actions = {
  // session
  logout: () => void;
  joinRemote: (role: Role, link: GymLink, brand: BrandOverride, memberId?: string) => void;
  joinAdmin: (name: string) => void;
  leaveRemote: () => void;
  // member: bookings
  book: (date: ISODate, kind: 'slot' | 'class', refId: string, opts?: { replace?: string }) => Result;
  joinWaitlist: (date: ISODate, kind: 'slot' | 'class', refId: string) => Result;
  cancelBooking: (bookingId: string) => Result;
  // member: pauses
  requestPause: (input: { start: ISODate; end: ISODate; reason: string; note?: string; memberId?: string; byManager?: boolean }) => Result;
  cancelPause: (pauseId: string) => Result;
  endPauseEarly: (pauseId: string) => Result;
  // member: other
  renew: (memberId: string, planId: string, method: PayMethod, amount?: number) => Payment;
  checkIn: (memberId: string, method: 'qr' | 'desk') => Result;
  requestTrainer: (trainerId: string, preferredTime: string, goal: string) => Result;
  addTicket: (category: TicketCategory, message: string) => Result;
  addProgress: (entry: Omit<ProgressEntry, 'id'>) => void;
  deleteProgress: (id: string) => void;
  toggleExercise: (date: ISODate, exerciseId: string) => void;
  updateMe: (patch: Partial<Pick<Member, 'name' | 'phone' | 'gender' | 'goalWeight' | 'weeklyGoal' | 'preferredSlotId'>>) => void;
  markNoticesRead: () => void;
  // manager
  decidePause: (pauseId: string, approve: boolean, note?: string) => void;
  /** Finishes adding a member the server has already created: payment, lead, referral reward. */
  addMember: (
    input: { paid: number; method: PayMethod; leadId?: string },
    created: Member,
  ) => string;
  updateMember: (id: string, patch: Partial<Member>) => void;
  removeMember: (id: string) => void;
  recordPayment: (memberId: string, amount: number, method: PayMethod, note?: string) => Payment;
  setSlotCapacity: (slotId: string, capacity: number) => void;
  addSlot: (input: { start: string; end: string; capacity: number; days: number[] }) => Result;
  removeSlot: (id: string) => Result;
  addClass: (c: Omit<GymClass, 'id'>) => void;
  removeClass: (id: string) => Result;
  addTrainer: (t: Omit<Trainer, 'id'>) => void;
  removeTrainer: (id: string) => void;
  addPlan: (p: Omit<Plan, 'id' | 'active'>) => void;
  toggleClosure: (date: ISODate, slotId: string | null, reason?: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updatePlan: (id: string, patch: Partial<Plan>) => void;
  addAnnouncement: (a: { title: string; body: string; kind: AnnouncementKind; pinned: boolean }) => void;
  removeAnnouncement: (id: string) => void;
  togglePin: (id: string) => void;
  addLead: (l: Omit<Lead, 'id' | 'date' | 'stage'>) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  resolveTicket: (id: string, reply: string) => void;
  decideTrainer: (id: string, scheduled: boolean) => void;
  // gamification
  redeemPrize: (chestId: string) => void;
  logLift: (input: { exercise: string; exerciseId?: string; liftKey?: LiftKey; weight: number; reps: number }) => Result & { pr?: boolean };
  logAttempt: (challengeId: string, value: number) => Result & { rank?: number };
  settleLeague: () => void;
  dismissCelebration: (id: string) => void;
  addChallenge: (c: Omit<Challenge, 'id' | 'active'>) => void;
  toggleChallenge: (id: string) => void;
  // guests
  createGuestPass: (name: string, phone: string) => Result & { pass?: GuestPass };
  checkInGuest: (code: string, override?: boolean) => Result & { pass?: GuestPass; needsHost?: boolean };
  // nutrition and recovery
  toggleMeal: (date: ISODate, mealId: string) => void;
  setWater: (date: ISODate, glasses: number) => void;
  toggleSupplement: (date: ISODate, itemId: string) => void;
  addSupplement: (item: Omit<SupplementItem, 'id' | 'addedBy'>, memberId?: string) => void;
  removeSupplement: (itemId: string, memberId?: string) => void;
  assignDiet: (memberId: string, templateId: string) => void;
  assignWorkout: (memberId: string, templateId: string) => void;
  completeMind: (sessionId: string, minutes: number, title: string) => void;
  // app
  setPrefs: (patch: Partial<Prefs>) => void;
  setBrandOverride: (o: BrandOverride | null) => void;
};

export type AppState = Data & {
  session: Session | null;
  prefs: Prefs;
  brandOverride: BrandOverride | null;
  link: GymLink | null;
  /** How far through the gym's change log this device has read, and for which sign-in. */
  syncCursor: number;
  syncGym: string;
  hydrated: boolean;
} & Actions;

const fail = (message: string): Result => ({ ok: false, message });
const ok = (message?: string): Result => ({ ok: true, message });
const nowStamp = () => new Date().toISOString();

const DEFAULT_PREFS: Prefs = { scheme: 'system', notifyBookings: true, notifyOffers: true, notifyExpiry: true };

function notice(memberId: string | null, title: string, body: string, kind: Notice['kind']): Notice {
  return { id: uid('nt'), memberId, title, body, kind, at: nowStamp(), read: false };
}

/**
 * Collects XP, chests and celebrations for one member during an action, then folds level-ups
 * and newly closed rings into a single state patch. Awards with a key are paid once.
 */
function rewarder(s: AppState, memberId: string) {
  const xp: XpEvent[] = [];
  const chests: Chest[] = [];
  const cel: Celebration[] = [];
  const before = xpTotal(s.xp, memberId);
  const paid = new Set(s.xp.filter((e) => e.memberId === memberId && e.key).map((e) => e.key));
  return {
    xp(amount: number, reason: string, key?: string) {
      if (key && paid.has(key)) return false;
      if (key) paid.add(key);
      xp.push({ id: uid('xp'), memberId, amount, reason, at: nowStamp(), key });
      return true;
    },
    chest(reason: string) {
      chests.push({ id: uid('chest'), memberId, reason, earnedAt: nowStamp() });
    },
    celebrate(c: Omit<Celebration, 'id' | 'memberId'>) {
      cel.push({ ...c, id: uid('cel'), memberId });
    },
    /** Compare rings before and after the change, paying for any ring closed for the first time this week. */
    rings(next: Pick<AppState, 'checkins' | 'workoutLog' | 'mealLog'>, claimsIn: AppState['ringClaims']) {
      const m = s.members.find((x) => x.id === memberId);
      if (!m) return claimsIn;
      const t = today();
      const week = startOfWeek(t);
      const rings = weekRings({
        member: m,
        checkins: next.checkins,
        workoutLog: next.workoutLog[memberId],
        workout: s.workouts[memberId],
        mealLog: next.mealLog[memberId],
        diet: s.dietPlans[memberId],
        t,
      });
      const claimed = claimsIn[memberId]?.[week] ?? [];
      const fresh = rings.filter((r) => r.value >= r.target && !claimed.includes(r.key));
      if (!fresh.length) return claimsIn;
      const allClosed = rings.every((r) => r.value >= r.target) && !claimed.includes('all');
      for (const r of fresh) this.xp(XP.ring, `Closed the ${r.label} ring`, `ring-${week}-${r.key}`);
      if (allClosed) {
        this.xp(XP.allRings, 'Closed all three rings', `ring-${week}-all`);
        this.chest('Closed all three rings');
        this.celebrate({
          kind: 'allRings',
          title: 'All three rings closed',
          body: 'Show up, Train and Fuel, all done this week. That earns a bonus chest.',
          xp: XP.ring * fresh.length + XP.allRings,
          chest: true,
        });
      } else {
        const r = fresh[fresh.length - 1];
        const open = rings.filter((x) => x.value < x.target).map((x) => x.label);
        this.celebrate({
          kind: 'ring',
          title: `${r.label} ring closed`,
          body: open.length ? `Close ${open.join(' and ')} too for a bonus chest.` : 'Nice work this week.',
          xp: XP.ring * fresh.length,
        });
      }
      const nextClaims = [...claimed, ...fresh.map((r) => r.key), ...(allClosed ? (['all'] as const) : [])];
      return { ...claimsIn, [memberId]: { ...(claimsIn[memberId] ?? {}), [week]: nextClaims } };
    },
    commit(): Pick<AppState, 'xp' | 'chests' | 'celebrations'> {
      const gained = xp.reduce((sum, e) => sum + e.amount, 0);
      const a = levelFor(before);
      const b = levelFor(before + gained);
      if (b.level > a.level) {
        cel.push({
          id: uid('cel'),
          memberId,
          kind: 'level',
          title: `Level ${b.level}`,
          body: `You've earned ${before + gained} XP training here. ${b.next - (before + gained)} XP to level ${b.level + 1}.`,
        });
      }
      return { xp: [...s.xp, ...xp], chests: [...s.chests, ...chests], celebrations: [...s.celebrations, ...cel].slice(-12) };
    },
  };
}

function ordinal(n: number) {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function nextInvoice(payments: Payment[], date: ISODate) {
  const y = date.slice(0, 4);
  const prefix = `${activeBrand().monogram.toUpperCase()}-${y}-`;
  const max = payments
    .filter((p) => p.invoice.startsWith(prefix))
    .reduce((m, p) => Math.max(m, Number(p.invoice.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

let beforeLeave: (() => void) | undefined;
/** The sync engine registers here so it can stop before the store is emptied on sign-out. */
export function setBeforeLeave(fn: () => void) {
  beforeLeave = fn;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const me = () => {
        const s = get();
        return s.session?.memberId ? s.members.find((m) => m.id === s.session!.memberId) : undefined;
      };

      /** Cancel stored bookings that fall inside a pause. Returns the updated list and how many were dropped. */
      const dropBookingsIn = (bookings: Booking[], memberId: string, start: ISODate, end: ISODate) => {
        let dropped = 0;
        const next = bookings.map((b) => {
          if (b.memberId === memberId && b.status !== 'cancelled' && b.date >= start && b.date <= end) {
            dropped++;
            return { ...b, status: 'cancelled' as const };
          }
          return b;
        });
        return { next, dropped };
      };

      return {
        ...emptyData(),
        session: null,
        prefs: DEFAULT_PREFS,
        brandOverride: null,
        link: null,
        syncCursor: 0,
        syncGym: '',
        hydrated: false,

        // ---- session ---------------------------------------------------------
        logout: () => get().leaveRemote(),
        joinRemote: (role, link, brand, memberId) =>
          set({
            // Moving to a different gym starts from nothing; the sync brings in the new gym's data.
            ...(get().link && get().link!.gymCode !== link.gymCode ? { ...emptyData(), syncCursor: 0, syncGym: '' } : {}),
            session: { role, remote: true, staffName: role === 'manager' ? link.name : undefined, memberId: memberId ?? get().session?.memberId },
            link,
            brandOverride: brand,
          }),
        joinAdmin: (name) => {
          beforeLeave?.();
          set({ ...emptyData(), syncCursor: 0, syncGym: '', session: { role: 'admin', remote: true, staffName: name }, link: null, brandOverride: null });
        },
        leaveRemote: () => {
          // Stop watching for changes first, or emptying the store would look like deleting everything.
          beforeLeave?.();
          set({ ...emptyData(), syncCursor: 0, syncGym: '', session: null, link: null, brandOverride: null });
        },

        // ---- bookings --------------------------------------------------------
        book: (date, kind, refId, opts) => {
          const s = get();
          const m = me();
          if (!m) return fail('Sign in to book.');
          const blocked = canTrainOn(m, s.plans, s.pauses, date);
          if (blocked) return fail(blocked);
          const t = today();
          if (date < t || diffDays(t, date) >= s.settings.bookingWindowDays) {
            return fail(`You can book up to ${s.settings.bookingWindowDays} days ahead.`);
          }
          const ref =
            kind === 'slot'
              ? s.slots.find((x) => x.id === refId)
              : (() => {
                  const c = s.classes.find((x) => x.id === refId);
                  return c ? { id: c.id, start: c.start, end: classEnd(c), capacity: c.capacity } : undefined;
                })();
          if (!ref) return fail('That session no longer exists.');
          if (kind === 'slot' && closureFor(s.closures, date, refId)) return fail('This slot is closed on that day.');
          const st = slotState(s, date, ref, kind, m.id, { date: t, mins: minutesNow() });
          if (st.started) return fail('This session has already started.');
          if (st.mine) return fail('You’re already booked into this session.');

          let bookings = s.bookings;
          if (opts?.replace) {
            bookings = bookings.map((b) => (b.id === opts.replace ? { ...b, status: 'cancelled' as const } : b));
          } else if (kind === 'slot') {
            const sameDay = bookings.filter(
              (b) => b.memberId === m.id && b.kind === 'slot' && b.date === date && b.status === 'booked',
            );
            if (sameDay.length >= s.settings.maxBookingsPerDay) {
              return fail(`You can book ${s.settings.maxBookingsPerDay} gym slot a day. Switch your booking instead.`);
            }
          }
          if (st.left <= 0) return fail('This session is full.');
          // Drop any waitlist entry for the same session.
          bookings = bookings.map((b) =>
            b.memberId === m.id && b.refId === refId && b.date === date && b.status === 'waitlist'
              ? { ...b, status: 'cancelled' as const }
              : b,
          );
          const booking: Booking = { id: uid('bk'), memberId: m.id, kind, refId, date, status: 'booked', createdAt: nowStamp() };
          set({ bookings: [...bookings, booking] });
          return ok(`You're in for ${fmtDay(date)}, ${fmtTimeRange(ref.start, ref.end)}.`);
        },

        joinWaitlist: (date, kind, refId) => {
          const s = get();
          const m = me();
          if (!m) return fail('Sign in to join the waitlist.');
          if (!s.settings.waitlist) return fail('Waitlists are turned off at this gym.');
          const exists = s.bookings.some(
            (b) => b.memberId === m.id && b.refId === refId && b.date === date && b.status !== 'cancelled',
          );
          if (exists) return fail('You’re already on this list.');
          const entry: Booking = { id: uid('bk'), memberId: m.id, kind, refId, date, status: 'waitlist', createdAt: nowStamp() };
          set({ bookings: [...s.bookings, entry] });
          return ok('You’re on the waitlist. We’ll book you in automatically if a spot opens.');
        },

        cancelBooking: (bookingId) => {
          const s = get();
          const b = s.bookings.find((x) => x.id === bookingId);
          if (!b) return fail('Booking not found.');
          if (b.status === 'booked' && b.date === today()) {
            const start =
              b.kind === 'slot'
                ? s.slots.find((x) => x.id === b.refId)?.start
                : s.classes.find((x) => x.id === b.refId)?.start;
            if (start && toMinutes(start) - minutesNow() < s.settings.cancelCutoffMinutes) {
              return fail(`Cancellations close ${s.settings.cancelCutoffMinutes} minutes before the start. Let the desk know instead.`);
            }
          }
          set({ bookings: s.bookings.map((x) => (x.id === bookingId ? { ...x, status: 'cancelled' } : x)) });
          return ok(b.status === 'waitlist' ? 'You’ve left the waitlist.' : 'Booking cancelled.');
        },

        // ---- pauses ----------------------------------------------------------
        requestPause: ({ start, end, reason, note, memberId, byManager }) => {
          const s = get();
          const m = memberId ? s.members.find((x) => x.id === memberId) : me();
          if (!m) return fail('Member not found.');
          const t = today();
          const info = membership(m, s.plans, s.pauses, t);
          const days = spanDays(start, end);
          if (end < start) return fail('The end date must be after the start date.');
          if (info.status === 'expired') return fail('This membership has ended. Renew it first.');
          if (!byManager && diffDays(t, start) < s.settings.pauseNoticeDays) {
            return fail(`Pauses need ${s.settings.pauseNoticeDays} day's notice. The earliest start is ${fmtDay(addDays(t, s.settings.pauseNoticeDays))}.`);
          }
          if (days < s.settings.minPauseDays) return fail(`A pause needs to be at least ${s.settings.minPauseDays} days.`);
          if (days > info.pauseLeft) return fail(`You have ${info.pauseLeft} pause days left this term.`);
          if (start > info.end) return fail('The pause has to start before your membership ends.');
          const overlaps = s.pauses.some(
            (p) => p.memberId === m.id && (p.status === 'approved' || p.status === 'pending') && p.start <= end && p.end >= start,
          );
          if (overlaps) return fail('These dates overlap a pause you already have.');

          const approved = byManager || s.settings.autoApprovePause;
          const pause = {
            id: uid('pz'),
            memberId: m.id,
            start,
            end,
            reason,
            note,
            status: approved ? ('approved' as const) : ('pending' as const),
            createdAt: nowStamp(),
            decidedAt: approved ? nowStamp() : undefined,
          };
          let bookings = s.bookings;
          let notices = s.notices;
          if (approved) {
            bookings = dropBookingsIn(bookings, m.id, start, end).next;
            notices = [
              notice(m.id, 'Pause confirmed', `You're paused ${fmtRange(start, end)}. Your end date moved ${days} days later.`, 'pause'),
              ...notices,
            ];
          }
          set({ pauses: [...s.pauses, pause], bookings, notices });
          return ok(approved ? 'Pause confirmed.' : 'Pause requested. The gym will confirm shortly.');
        },

        cancelPause: (pauseId) => {
          const s = get();
          const p = s.pauses.find((x) => x.id === pauseId);
          if (!p) return fail('Pause not found.');
          if (p.status === 'approved' && p.start <= today()) return fail('This pause has started. End it early instead.');
          set({ pauses: s.pauses.map((x) => (x.id === pauseId ? { ...x, status: 'cancelled' } : x)) });
          return ok(p.status === 'pending' ? 'Request withdrawn.' : 'Pause cancelled. Your end date is back to normal.');
        },

        endPauseEarly: (pauseId) => {
          const s = get();
          const p = s.pauses.find((x) => x.id === pauseId);
          const t = today();
          if (!p || p.status !== 'approved' || p.start > t || p.end < t) return fail('There’s no active pause to end.');
          const newEnd = addDays(t, -1);
          const refunded = spanDays(t, p.end);
          set({
            pauses: s.pauses.map((x) =>
              x.id === pauseId ? (newEnd < x.start ? { ...x, status: 'cancelled' } : { ...x, end: newEnd }) : x,
            ),
          });
          return ok(`Welcome back. ${refunded} unused pause days went back to your balance.`);
        },

        decidePause: (pauseId, approve, note) => {
          const s = get();
          const p = s.pauses.find((x) => x.id === pauseId);
          if (!p) return;
          let bookings = s.bookings;
          if (approve) bookings = dropBookingsIn(bookings, p.memberId, p.start, p.end).next;
          const days = pauseLength(p);
          set({
            pauses: s.pauses.map((x) =>
              x.id === pauseId
                ? { ...x, status: approve ? 'approved' : 'rejected', decidedAt: nowStamp(), decisionNote: note }
                : x,
            ),
            bookings,
            notices: [
              approve
                ? notice(p.memberId, 'Pause approved', `You're paused ${fmtRange(p.start, p.end)}. Your end date moved ${days} days later.`, 'pause')
                : notice(p.memberId, 'Pause not approved', note || 'Talk to the front desk about other dates.', 'pause'),
              ...s.notices,
            ],
          });
        },

        // ---- membership ------------------------------------------------------
        renew: (memberId, planId, method, amount) => {
          const s = get();
          const m = s.members.find((x) => x.id === memberId)!;
          const plan = s.plans.find((p) => p.id === planId)!;
          const t = today();
          const info = membership(m, s.plans, s.pauses, t);
          const extending = info.status !== 'expired';
          const updated: Member = extending
            ? {
                ...m,
                planId,
                endDate: termEnd(addDays(m.endDate, 1), plan.months),
                pauseAllowance: m.pauseAllowance + plan.pauseDays,
              }
            : { ...m, planId, startDate: t, endDate: termEnd(t, plan.months), pauseAllowance: plan.pauseDays };
          const payment: Payment = {
            id: uid('pay'),
            memberId,
            invoice: nextInvoice(s.payments, t),
            date: t,
            amount: amount ?? plan.price,
            method,
            planId,
            note: extending ? 'Renewal' : 'Rejoined',
          };
          set({
            members: s.members.map((x) => (x.id === memberId ? updated : x)),
            payments: [...s.payments, payment],
            notices: [
              notice(memberId, 'Payment received', `${money(payment.amount)} by ${method} for the ${plan.name} plan. Invoice ${payment.invoice}.`, 'payment'),
              ...s.notices,
            ],
          });
          return payment;
        },

        checkIn: (memberId, method) => {
          const s = get();
          const m = s.members.find((x) => x.id === memberId);
          if (!m) return fail('Member not found.');
          const t = today();
          const info = membership(m, s.plans, s.pauses, t);
          if (info.status === 'expired') return fail(`${m.name}'s membership ended on ${fmtDay(info.end)}.`);
          if (info.status === 'paused') return fail(`${m.name} is paused until ${fmtDay(info.activePause!.end)}.`);
          if (info.status === 'upcoming') return fail(`${m.name}'s membership starts on ${fmtDay(info.start)}.`);
          const recent = s.checkins.find(
            (c) => c.memberId === memberId && Date.now() - new Date(c.at).getTime() < 3 * 3600_000,
          );
          if (recent) return ok(`${m.name} is already checked in.`);
          if (s.settings.requireBooking) {
            const booked = s.bookings.some((b) => b.memberId === memberId && b.date === t && b.status === 'booked');
            if (!booked) return fail(`${m.name} hasn’t booked a slot for today. Book one for them first.`);
          }
          const checkins = [...s.checkins, { id: uid('ci'), memberId, at: nowStamp(), method }];
          const rw = rewarder(s, memberId);
          const firstToday = rw.xp(XP.checkIn, 'Checked in', `ci-${t}`);
          if (firstToday) rw.chest('Checked in');
          const week = startOfWeek(t);
          const visits = new Set(checkins.filter((c) => c.memberId === memberId && stampToDate(c.at) >= week).map((c) => stampToDate(c.at))).size;
          // Only the member's own scan gets the full-screen moment; desk check-ins stay quiet.
          if (firstToday && method === 'qr') rw.celebrate({
            kind: 'checkin',
            title: 'You’re in',
            body: `${
              visits > m.weeklyGoal
                ? `Visit ${visits} this week, ${visits - m.weeklyGoal} more than your goal.`
                : visits === m.weeklyGoal
                  ? `That’s ${visits} of ${visits} this week, goal done.`
                  : `Visit ${visits} of ${m.weeklyGoal} this week.`
            } You earned a chest, open it to see what’s inside.`,
            xp: XP.checkIn,
            chest: true,
          });
          const ringClaims = rw.rings({ checkins, workoutLog: s.workoutLog, mealLog: s.mealLog }, s.ringClaims);
          set({ checkins, ringClaims, ...rw.commit() });
          return ok(`${m.name} checked in.`);
        },

        requestTrainer: (trainerId, preferredTime, goal) => {
          const s = get();
          const m = me();
          if (!m) return fail('Sign in first.');
          if (s.ptRequests.some((r) => r.memberId === m.id && r.trainerId === trainerId && r.status === 'pending')) {
            return fail('You already have a request with this coach. The gym will call you.');
          }
          set({
            ptRequests: [
              ...s.ptRequests,
              { id: uid('pt'), memberId: m.id, trainerId, preferredTime, goal, status: 'pending', createdAt: nowStamp() },
            ],
          });
          return ok('Request sent. The coach will call you within a day.');
        },

        addTicket: (category, message) => {
          const s = get();
          const m = me();
          if (!m) return fail('Sign in first.');
          if (message.trim().length < 6) return fail('Tell us a little more so we can fix it.');
          set({
            tickets: [
              { id: uid('tk'), memberId: m.id, category, message: message.trim(), status: 'open', createdAt: nowStamp() },
              ...s.tickets,
            ],
          });
          return ok('Sent to the gym team. You’ll see their reply here.');
        },

        addProgress: (entry) => {
          const s = get();
          const m = me();
          if (!m) return;
          const list = (s.progress[m.id] ?? []).filter((e) => e.date !== entry.date);
          set({
            progress: {
              ...s.progress,
              [m.id]: [...list, { ...entry, id: uid('pg') }].sort((a, b) => (a.date < b.date ? -1 : 1)),
            },
          });
        },
        deleteProgress: (id) => {
          const s = get();
          const m = me();
          if (!m) return;
          set({ progress: { ...s.progress, [m.id]: (s.progress[m.id] ?? []).filter((e) => e.id !== id) } });
        },
        toggleExercise: (date, exerciseId) => {
          const s = get();
          const m = me();
          if (!m) return;
          const log = s.workoutLog[m.id] ?? {};
          const done = log[date] ?? [];
          const ticking = !done.includes(exerciseId);
          const next = ticking ? [...done, exerciseId] : done.filter((x) => x !== exerciseId);
          const workoutLog = { ...s.workoutLog, [m.id]: { ...log, [date]: next } };
          const rw = rewarder(s, m.id);
          if (ticking) rw.xp(XP.exercise, 'Exercise done', `ex-${date}-${exerciseId}`);
          const ringClaims = ticking ? rw.rings({ checkins: s.checkins, workoutLog, mealLog: s.mealLog }, s.ringClaims) : s.ringClaims;
          set({ workoutLog, ringClaims, ...rw.commit() });
        },
        updateMe: (patch) => {
          const m = me();
          if (!m) return;
          set({ members: get().members.map((x) => (x.id === m.id ? { ...x, ...patch } : x)) });
        },
        markNoticesRead: () => {
          const s = get();
          const id = s.session?.memberId;
          const broadcast = s.notices.filter((n) => n.memberId === null).map((n) => n.id);
          set({
            notices: s.notices.map((n) => (n.memberId === id && !n.read ? { ...n, read: true } : n)),
            prefs: { ...s.prefs, readBroadcast: [...new Set([...(s.prefs.readBroadcast ?? []), ...broadcast])].slice(-200) },
          });
        },

        // ---- manager ---------------------------------------------------------
        addMember: (input, created) => {
          const s = get();
          const id = created.id;
          const member: Member = { ...created };
          const plan = s.plans.find((p) => p.id === member.planId);
          const payments =
            input.paid > 0
              ? [
                  ...s.payments,
                  {
                    id: uid('pay'),
                    memberId: id,
                    invoice: nextInvoice(s.payments, today()),
                    date: today(),
                    amount: input.paid,
                    method: input.method,
                    planId: plan?.id,
                    note: 'New joining',
                  },
                ]
              : s.payments;
          let leads = s.leads;
          let guestPasses = s.guestPasses;
          let notices = s.notices;
          const lead = input.leadId ? s.leads.find((l) => l.id === input.leadId) : undefined;
          let rewards: Partial<AppState> = {};
          if (lead) leads = leads.map((l) => (l.id === lead.id ? { ...l, stage: 'joined' as const } : l));
          const pass = s.guestPasses.find((g) => g.phone === member.phone && !g.joinedAs);
          const hostId = lead?.hostId ?? pass?.hostId;
          if (hostId) {
            member.referredBy = hostId;
            if (pass) guestPasses = guestPasses.map((g) => (g.id === pass.id ? { ...g, joinedAs: id } : g));
            const rw = rewarder(s, hostId);
            rw.xp(XP.referral, `${firstName(member.name)} joined`, `ref-${id}`);
            rw.chest(`${firstName(member.name)} joined`);
            rw.celebrate({
              kind: 'referral',
              title: `${firstName(member.name)} joined`,
              body: 'Your guest signed up. Thanks for bringing them in, here’s a chest.',
              xp: XP.referral,
              chest: true,
            });
            rewards = rw.commit();
            notices = [notice(hostId, `${firstName(member.name)} joined ${activeBrand().shortName}`, 'Your guest signed up. Your referral reward is on its way.', 'reminder'), ...notices];
          }
          set({ members: [member, ...s.members], payments, leads, guestPasses, notices, ...rewards });
          return id;
        },
        updateMember: (id, patch) => set({ members: get().members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
        removeMember: (id) => {
          const s = get();
          set({
            members: s.members.filter((m) => m.id !== id),
            bookings: s.bookings.filter((b) => b.memberId !== id),
            pauses: s.pauses.filter((p) => p.memberId !== id),
          });
        },
        recordPayment: (memberId, amount, method, note) => {
          const s = get();
          const payment: Payment = {
            id: uid('pay'),
            memberId,
            invoice: nextInvoice(s.payments, today()),
            date: today(),
            amount,
            method,
            note: note || 'Dues cleared',
          };
          set({
            payments: [...s.payments, payment],
            members: s.members.map((m) => (m.id === memberId ? { ...m, dues: Math.max(0, m.dues - amount) } : m)),
            notices: [notice(memberId, 'Payment received', `${money(amount)} by ${method}. Invoice ${payment.invoice}.`, 'payment'), ...s.notices],
          });
          return payment;
        },
        setSlotCapacity: (slotId, capacity) => {
          const s = get();
          const slots = s.slots.map((x) => (x.id === slotId ? { ...x, capacity } : x));
          // Raising capacity moves waitlisted members in, first come first served.
          let bookings = s.bookings;
          const notices: Notice[] = [];
          const t = today();
          const slot = slots.find((x) => x.id === slotId)!;
          const dates = [...new Set(bookings.filter((b) => b.refId === slotId && b.status === 'waitlist' && b.date >= t).map((b) => b.date))];
          for (const date of dates) {
            const st = slotState({ ...s, slots, bookings }, date, slot, 'slot', undefined, { date: t, mins: minutesNow() });
            let free = st.left;
            for (const w of st.waitlist) {
              if (free <= 0) break;
              bookings = bookings.map((b) => (b.id === w.id ? { ...b, status: 'booked' } : b));
              notices.push(notice(w.memberId, 'A spot opened up', `You're now booked for ${fmtDay(date)}, ${fmtTimeRange(slot.start, slot.end)}.`, 'booking'));
              free--;
            }
          }
          set({ slots, bookings, notices: [...notices, ...s.notices] });
        },
        toggleClosure: (date, slotId, reason = 'Closed') => {
          const s = get();
          const existing = s.closures.find((c) => c.date === date && c.slotId === slotId);
          if (existing) {
            set({ closures: s.closures.filter((c) => c !== existing) });
            return;
          }
          const affected = s.bookings.filter(
            (b) => b.kind === 'slot' && b.date === date && (slotId === null || b.refId === slotId) && b.status !== 'cancelled',
          );
          set({
            closures: [...s.closures.filter((c) => !(slotId === null && c.date === date)), { id: uid('cl'), date, slotId, reason }],
            bookings: s.bookings.map((b) => (affected.includes(b) ? { ...b, status: 'cancelled' } : b)),
            notices: [
              ...affected.map((b) => notice(b.memberId, 'Your slot was closed', `The gym closed this slot on ${fmtDay(date)} (${reason}). Pick another time.`, 'booking')),
              ...s.notices,
            ],
          });
        },
        updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
        updatePlan: (id, patch) => set({ plans: get().plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
        addAnnouncement: (a) => {
          const s = get();
          const ann: Announcement = { ...a, id: uid('an'), date: today() };
          set({
            announcements: [ann, ...s.announcements],
            notices: [notice(null, a.title, a.body, 'announcement'), ...s.notices],
          });
        },
        removeAnnouncement: (id) => set({ announcements: get().announcements.filter((a) => a.id !== id) }),
        togglePin: (id) => set({ announcements: get().announcements.map((a) => (a.id === id ? { ...a, pinned: !a.pinned } : a)) }),
        addLead: (l) => set({ leads: [{ ...l, id: uid('ld'), date: today(), stage: 'new' }, ...get().leads] }),
        updateLead: (id, patch) => set({ leads: get().leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }),
        resolveTicket: (id, reply) => {
          const s = get();
          const tk = s.tickets.find((x) => x.id === id);
          if (!tk) return;
          set({
            tickets: s.tickets.map((x) => (x.id === id ? { ...x, status: 'resolved', reply } : x)),
            notices: [notice(tk.memberId, `Reply on your ${tk.category.toLowerCase()} report`, reply, 'reminder'), ...s.notices],
          });
        },
        decideTrainer: (id, scheduled) => {
          const s = get();
          const r = s.ptRequests.find((x) => x.id === id);
          if (!r) return;
          const coach = s.trainers.find((x) => x.id === r.trainerId)?.name ?? 'Your coach';
          set({
            ptRequests: s.ptRequests.map((x) => (x.id === id ? { ...x, status: scheduled ? 'scheduled' : 'declined' } : x)),
            notices: [
              notice(
                r.memberId,
                scheduled ? `${coach} will call you` : 'Personal training request',
                scheduled ? 'Your trial session is being set up. Expect a call today.' : 'The coach is fully booked right now. The desk will suggest someone else.',
                'class',
              ),
              ...s.notices,
            ],
          });
        },

        // ---- gamification ----------------------------------------------------
        redeemPrize: (chestId) => set({ chests: get().chests.map((c) => (c.id === chestId ? { ...c, redeemedAt: nowStamp() } : c)) }),

        logLift: ({ exercise, exerciseId, liftKey, weight, reps }) => {
          const s = get();
          const m = me();
          if (!m) return fail('Sign in first.');
          if (!(weight > 0 && weight <= 500)) return fail('Enter the weight in kg, for example 62.5.');
          if (!(reps >= 1 && reps <= 50)) return fail('Enter how many reps you did.');
          const t = today();
          const pr = isPR(s.lifts, m.id, exercise, weight, reps);
          const prevBest = Math.max(0, ...s.lifts.filter((l) => l.memberId === m.id && l.exercise === exercise).map((l) => e1rm(l.weight, l.reps)));
          const lifts = [...s.lifts, { id: uid('lf'), memberId: m.id, exercise, liftKey, weight, reps, date: t }];
          let workoutLog = s.workoutLog;
          const rw = rewarder(s, m.id);
          if (exerciseId) {
            const done = s.workoutLog[m.id]?.[t] ?? [];
            if (!done.includes(exerciseId)) {
              workoutLog = { ...s.workoutLog, [m.id]: { ...(s.workoutLog[m.id] ?? {}), [t]: [...done, exerciseId] } };
            }
            rw.xp(XP.exercise, 'Exercise done', `ex-${t}-${exerciseId}`);
          }
          if (pr) {
            const est = round1(e1rm(weight, reps));
            rw.xp(XP.pr, `New PR: ${exercise}`);
            rw.chest(`New PR: ${exercise}`);
            rw.celebrate({
              kind: 'pr',
              title: 'New personal record',
              body: `${exercise}, ${weight} kg × ${reps}. Your estimated max is now ${est} kg, up ${round1(est - prevBest)} kg.`,
              xp: XP.pr,
              chest: true,
            });
          }
          if (liftKey) {
            const bw = bodyweightOn(s.progress[m.id], t);
            const before = tierFor(strengthScore(bestLifts(s.lifts, m.id), bw));
            const afterScore = strengthScore(bestLifts(lifts, m.id), bw);
            const after = tierFor(afterScore);
            if (after.index > before.index) {
              rw.celebrate({ kind: 'badge', title: `${after.name} strength`, body: `Your Strength score reached ${afterScore}. That’s ${after.name} for your bodyweight.` });
            }
          }
          const ringClaims = rw.rings({ checkins: s.checkins, workoutLog, mealLog: s.mealLog }, s.ringClaims);
          set({ lifts, workoutLog, ringClaims, ...rw.commit() });
          return { ok: true, pr, message: pr ? undefined : `Logged ${weight} kg × ${reps}.` };
        },

        logAttempt: (challengeId, value) => {
          const s = get();
          const m = me();
          const c = s.challenges.find((x) => x.id === challengeId);
          if (!m || !c) return fail('Challenge not found.');
          const [lo, hi] = c.range;
          if (value < lo * 0.55 || value > hi * 1.6) return fail(`That doesn’t look right for ${c.name}. Check the number and try again.`);
          const t = today();
          const month = t.slice(0, 7);
          const scope = new Set(s.members.filter((x) => x.preferredSlotId === m.preferredSlotId).map((x) => x.id));
          const mine = s.challengeEntries.filter((e) => e.date.startsWith(month));
          const before = leaderboard(c, mine, m.id, scope).find((r) => r.me);
          const entry = { id: uid('ce'), memberId: m.id, challengeId, value, date: t };
          const after = leaderboard(c, [...mine, entry], m.id, scope).find((r) => r.me)!;
          const rw = rewarder(s, m.id);
          rw.xp(XP.attempt, `Tried ${c.name}`);
          const improved = !before || beats(c, value, before.value);
          if (improved && (!before || after.rank < before.rank)) {
            if (after.rank === 1) rw.chest(`Top of ${c.name}`);
            rw.celebrate({
              kind: 'rank',
              title: after.rank === 1 ? 'Local legend' : `${ordinal(after.rank)} in your slot`,
              body:
                after.rank === 1
                  ? `${formatScore(c, value)} puts you top of ${c.name} for your time slot this month.`
                  : `${formatScore(c, value)} moved you ${before ? `up from ${ordinal(before.rank)}` : 'onto the board'} for ${c.name}.`,
              xp: XP.attempt,
              chest: after.rank === 1,
            });
          }
          set({ challengeEntries: [...s.challengeEntries, entry], ...rw.commit() });
          return { ok: true, rank: after.rank, message: improved ? undefined : `Logged. Your best this month is still ${formatScore(c, before!.value)}.` };
        },

        settleLeague: () => {
          const s = get();
          const m = me();
          if (!m) return;
          const week = startOfWeek(today());
          const last = s.leagueSettledWeek[m.id];
          if (last && last >= week) return;
          const tier = s.leagueTier[m.id] ?? 0;
          if (!last) {
            set({ leagueSettledWeek: { ...s.leagueSettledWeek, [m.id]: week } });
            return;
          }
          const prevWeek = addDays(week, -7);
          const rows = leagueStandings({ members: s.members, me: m, xp: s.xp, week: prevWeek, t: addDays(week, -1) });
          const rank = rows.findIndex((r) => r.me) + 1;
          let next = tier;
          const rw = rewarder(s, m.id);
          if (rank <= PROMOTE && tier < LEAGUES.length - 1) {
            next = tier + 1;
            rw.chest(`Promoted to ${LEAGUES[next]} league`);
            rw.celebrate({
              kind: 'league',
              title: `Promoted to ${LEAGUES[next]}`,
              body: `You finished ${ordinal(rank)} of ${LEAGUE_SIZE} last week. New group, new rivals this week.`,
              chest: true,
            });
          } else if (rank > LEAGUE_SIZE - DEMOTE && tier > 0) {
            next = tier - 1;
          }
          set({
            leagueTier: { ...s.leagueTier, [m.id]: next },
            leagueSettledWeek: { ...s.leagueSettledWeek, [m.id]: week },
            ...rw.commit(),
          });
        },
        dismissCelebration: (id) => set({ celebrations: get().celebrations.filter((c) => c.id !== id) }),
        addChallenge: (c) => set({ challenges: [...get().challenges, { ...c, id: uid('c'), active: true }] }),
        toggleChallenge: (id) => set({ challenges: get().challenges.map((c) => (c.id === id ? { ...c, active: !c.active } : c)) }),

        // ---- guest passes ----------------------------------------------------
        createGuestPass: (name, phone) => {
          const s = get();
          const m = me();
          if (!m) return fail('Sign in first.');
          const info = membership(m, s.plans, s.pauses, today());
          if (info.status !== 'active') return fail('Guest passes need an active membership.');
          const bonusLeft = Math.max(0, (m.bonusGuestPasses ?? 0) - (m.bonusUsed ?? 0));
          const digits = phone.replace(/\D/g, '').slice(-10);
          if (name.trim().length < 2) return fail('Add your friend’s name.');
          if (digits.length !== 10) return fail('Add a 10-digit mobile number for your friend.');
          if (s.members.some((x) => (x.phone ?? '').slice(-10) === digits)) return fail('That number already belongs to a member.');
          if (s.guestPasses.some((g) => g.phone === digits)) return fail(`${firstName(name)} has already had a free week here.`);
          const t = today();
          const usedThisMonth = s.guestPasses.filter((g) => g.hostId === m.id && g.createdOn.slice(0, 7) === t.slice(0, 7)).length;
          let members = s.members;
          if (usedThisMonth >= s.settings.guestPassesPerMonth) {
            if (!bonusLeft) {
              return fail(`You’ve used this month’s guest ${s.settings.guestPassesPerMonth === 1 ? 'pass' : 'passes'}. You get a new one on the 1st.`);
            }
            members = members.map((x) => (x.id === m.id ? { ...x, bonusUsed: (x.bonusUsed ?? 0) + 1 } : x));
          }
          let code = '';
          do code = `G${1000 + Math.floor(Math.random() * 9000)}`;
          while (s.guestPasses.some((g) => g.code === code));
          const pass: GuestPass = { id: uid('gp'), hostId: m.id, name: name.trim(), phone: digits, code, createdOn: t, visits: [] };
          const rw = rewarder({ ...s, members }, m.id);
          rw.xp(XP.guest, 'Invited a guest', `guest-${code}`);
          set({
            members,
            guestPasses: [pass, ...s.guestPasses],
            leads: [
              { id: uid('ld'), name: pass.name, phone: digits, source: 'Guest pass', interest: 'Free week', stage: 'trial', date: t, note: `On ${m.name}’s guest pass`, hostId: m.id },
              ...s.leads,
            ],
            ...rw.commit(),
          });
          return { ok: true, pass, message: `Guest pass ready for ${firstName(pass.name)}.` };
        },

        checkInGuest: (code, override) => {
          const s = get();
          const clean = code.trim().toUpperCase().replace(/\s/g, '');
          const pass = s.guestPasses.find((g) => g.code === clean);
          if (!pass) return fail('No guest pass with that code.');
          const host = s.members.find((x) => x.id === pass.hostId);
          const t = today();
          const days = s.settings.guestPassDays;
          if (pass.joinedAs) return { ok: false, message: `${firstName(pass.name)} is a member now. Scan their own pass.`, pass };
          if (pass.activatedOn && t > addDays(pass.activatedOn, days - 1)) {
            return { ok: false, message: `${firstName(pass.name)}’s free week ended on ${fmtDay(addDays(pass.activatedOn, days - 1))}. A good moment to offer a plan.`, pass };
          }
          if (!pass.activatedOn && t > addDays(pass.createdOn, 30)) return { ok: false, message: 'This pass was never used and has expired.', pass };
          if (s.settings.guestWithHost && !override) {
            const hostIn = s.checkins.some((c) => c.memberId === pass.hostId && stampToDate(c.at) === t);
            if (!hostIn) {
              return {
                ok: false,
                needsHost: true,
                pass,
                message: `Guests come in with their host. ${host ? firstName(host.name) : 'The host'} hasn’t checked in today.`,
              };
            }
          }
          if (pass.visits.includes(t)) return { ok: true, pass, message: `${firstName(pass.name)} is already checked in today.` };
          const activatedOn = pass.activatedOn ?? t;
          const updated: GuestPass = { ...pass, activatedOn, visits: [...pass.visits, t] };
          const day = Math.min(days, diffDays(activatedOn, t) + 1);
          let patch: Partial<AppState> = { guestPasses: s.guestPasses.map((g) => (g.id === pass.id ? updated : g)) };
          if (host) {
            const rw = rewarder(s, host.id);
            rw.xp(XP.guestVisit, `${firstName(pass.name)} came in on your pass`, `gv-${pass.code}`);
            patch = {
              ...patch,
              ...rw.commit(),
              notices: [notice(host.id, `${firstName(pass.name)} checked in`, `Day ${day} of ${days} on your guest pass.`, 'reminder'), ...s.notices],
            };
          }
          set(patch);
          return { ok: true, pass: updated, message: `${updated.name}, day ${day} of ${days}${host ? `, guest of ${host.name}` : ''}.` };
        },

        // ---- nutrition and recovery --------------------------------------------
        toggleMeal: (date, mealId) => {
          const s = get();
          const m = me();
          if (!m) return;
          const log = s.mealLog[m.id] ?? {};
          const done = log[date] ?? [];
          const ticking = !done.includes(mealId);
          const mealLog = { ...s.mealLog, [m.id]: { ...log, [date]: ticking ? [...done, mealId] : done.filter((x) => x !== mealId) } };
          const rw = rewarder(s, m.id);
          if (ticking) rw.xp(XP.meal, 'Meal logged', `meal-${date}-${mealId}`);
          const ringClaims = ticking ? rw.rings({ checkins: s.checkins, workoutLog: s.workoutLog, mealLog }, s.ringClaims) : s.ringClaims;
          set({ mealLog, ringClaims, ...rw.commit() });
        },
        setWater: (date, glasses) => {
          const s = get();
          const m = me();
          if (!m) return;
          set({ water: { ...s.water, [m.id]: { ...(s.water[m.id] ?? {}), [date]: Math.max(0, Math.min(20, glasses)) } } });
        },
        toggleSupplement: (date, itemId) => {
          const s = get();
          const m = me();
          if (!m) return;
          const log = s.supplementLog[m.id] ?? {};
          const done = log[date] ?? [];
          set({
            supplementLog: {
              ...s.supplementLog,
              [m.id]: { ...log, [date]: done.includes(itemId) ? done.filter((x) => x !== itemId) : [...done, itemId] },
            },
          });
        },
        addSupplement: (item, memberId) => {
          const s = get();
          const id = memberId ?? s.session?.memberId;
          if (!id) return;
          const entry: SupplementItem = { ...item, id: uid('su'), addedBy: memberId ? 'coach' : 'member' };
          set({ supplements: { ...s.supplements, [id]: [...(s.supplements[id] ?? []), entry] } });
        },
        removeSupplement: (itemId, memberId) => {
          const s = get();
          const id = memberId ?? s.session?.memberId;
          if (!id) return;
          set({ supplements: { ...s.supplements, [id]: (s.supplements[id] ?? []).filter((x) => x.id !== itemId) } });
        },
        assignDiet: (memberId, templateId) => {
          const s = get();
          const tpl = DIET_TEMPLATES.find((x) => x.id === templateId);
          const m = s.members.find((x) => x.id === memberId);
          if (!tpl || !m) return;
          const { id: _id, label: _label, ...plan } = tpl;
          set({
            dietPlans: { ...s.dietPlans, [memberId]: { ...plan, coachId: m.trainerId ?? '', updatedOn: today() } },
            notices: [notice(memberId, 'New diet plan', `${plan.title}. Open Diet to see your meals for the day.`, 'reminder'), ...s.notices],
          });
        },
        completeMind: (sessionId, minutes, title) => {
          const s = get();
          const m = me();
          if (!m) return;
          const t = today();
          const rw = rewarder(s, m.id);
          const paid = rw.xp(XP.mind, 'Breathing session', `mind-${t}-${sessionId}`);
          const total = s.mindLog.filter((x) => x.memberId === m.id).reduce((sum, x) => sum + x.minutes, 0) + minutes;
          rw.celebrate({
            kind: 'mind',
            title: 'Session complete',
            body: `${title}, ${minutes} min. ${total} minutes of breathing practice so far.`,
            xp: paid ? XP.mind : undefined,
          });
          set({ mindLog: [...s.mindLog, { id: uid('md'), memberId: m.id, sessionId, minutes, at: nowStamp() }], ...rw.commit() });
        },

        // ---- the gym's own setup ------------------------------------------------
        addSlot: ({ start, end, capacity, days }) => {
          const s = get();
          if (!(start < end)) return fail('The slot has to end after it starts.');
          if (!(capacity >= 1)) return fail('A slot needs room for at least one person.');
          if (days.length === 0) return fail('Pick at least one day.');
          if (s.slots.some((x) => x.start === start && x.end === end && x.days.some((d) => days.includes(d)))) {
            return fail('You already have a slot at that time.');
          }
          set({ slots: [...s.slots, { id: uid('sl'), start, end, capacity, days: [...days].sort() }] });
          return ok('Slot added.');
        },
        removeSlot: (id) => {
          const s = get();
          const live = s.bookings.filter((b) => b.kind === 'slot' && b.refId === id && b.status !== 'cancelled' && b.date >= today()).length;
          if (live) return fail(`${live} booking${live === 1 ? '' : 's'} still use this slot. Close it on those days or ask members to cancel first.`);
          set({ slots: s.slots.filter((x) => x.id !== id) });
          return ok('Slot removed.');
        },
        addClass: (c) => set({ classes: [...get().classes, { ...c, id: uid('cl') }] }),
        removeClass: (id) => {
          const s = get();
          const live = s.bookings.filter((b) => b.kind === 'class' && b.refId === id && b.status !== 'cancelled' && b.date >= today()).length;
          if (live) return fail(`${live} booking${live === 1 ? '' : 's'} still use this class. Ask members to cancel first.`);
          set({ classes: s.classes.filter((x) => x.id !== id) });
          return ok('Class removed.');
        },
        addTrainer: (t) => set({ trainers: [...get().trainers, { ...t, id: uid('tr') }] }),
        removeTrainer: (id) => set({ trainers: get().trainers.filter((x) => x.id !== id) }),
        addPlan: (p) => set({ plans: [...get().plans, { ...p, id: uid('pl'), active: true }] }),
        assignWorkout: (memberId, templateId) => {
          const s = get();
          const tpl = WORKOUT_TEMPLATES.find((x) => x.id === templateId);
          const m = s.members.find((x) => x.id === memberId);
          if (!tpl || !m) return;
          const { id: _id, label: _label, ...plan } = tpl;
          set({
            workouts: { ...s.workouts, [memberId]: { ...plan, trainerId: m.trainerId ?? '', updatedOn: today() } },
            notices: [notice(memberId, 'New workout plan', `${plan.title}. Open Workout to see today’s session.`, 'reminder'), ...s.notices],
          });
        },

        // ---- app -------------------------------------------------------------
        setPrefs: (patch) => set({ prefs: { ...get().prefs, ...patch } }),
        setBrandOverride: (o) => set({ brandOverride: o }),
      };
    },
    {
      name: 'gym-app',
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _h, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        setActiveOverride(state?.brandOverride ?? null);
        useApp.setState({ hydrated: true });
      },
      // Earlier versions held demo data. A new version starts clean and the sync fills it in.
      migrate: () => ({ ...emptyData() }) as unknown as AppState,
    },
  ),
);

// Keep the plain-function view of the gym (opening hours, currency, pass codes) in step with the store.
useApp.subscribe((s, prev) => {
  if (s.brandOverride !== prev.brandOverride) setActiveOverride(s.brandOverride);
});

// ---- Selectors that read one piece of state (safe with zustand's equality) ----

export function useMe() {
  const id = useApp((s) => s.session?.memberId);
  return useApp((s) => s.members.find((m) => m.id === id));
}

export function usePlans() {
  return useApp((s) => s.plans);
}

export function stampDate(stamp: string) {
  return stampToDate(stamp);
}
