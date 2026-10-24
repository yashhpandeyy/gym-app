import type { Data, Settings } from '@/store/types';

/** Rules a gym starts with, until its own settings arrive from the server. */
export const DEFAULT_SETTINGS: Settings = {
  bookingWindowDays: 7,
  cancelCutoffMinutes: 60,
  maxBookingsPerDay: 1,
  waitlist: true,
  requireBooking: false,
  minPauseDays: 3,
  pauseNoticeDays: 1,
  autoApprovePause: false,
  reminderDaysBeforeExpiry: 7,
  guestPassDays: 7,
  guestPassesPerMonth: 2,
  guestWithHost: true,
};

/** A gym with nothing in it. Real data arrives from the server after sign-in. */
export function emptyData(): Data {
  return {
    plans: [],
    members: [],
    pauses: [],
    slots: [],
    closures: [],
    classes: [],
    bookings: [],
    checkins: [],
    payments: [],
    announcements: [],
    trainers: [],
    ptRequests: [],
    progress: {},
    workouts: {},
    workoutLog: {},
    leads: [],
    tickets: [],
    notices: [],
    settings: DEFAULT_SETTINGS,
    xp: [],
    chests: [],
    lifts: [],
    challenges: [],
    challengeEntries: [],
    leagueTier: {},
    leagueSettledWeek: {},
    ringClaims: {},
    celebrations: [],
    guestPasses: [],
    dietPlans: {},
    mealLog: {},
    water: {},
    supplements: {},
    supplementLog: {},
    mindLog: [],
  };
}
