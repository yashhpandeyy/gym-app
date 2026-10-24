/**
 * What a brand-new gym starts with. No people, no prices, no timetable: the owner fills those in.
 * Rules (booking window, pause limits, guest passes) start at sensible values the owner can change.
 */
export const DEFAULT_SETTINGS = {
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

/** Plan shapes with the price left at zero and the plan switched off until the owner prices it. */
export const DEFAULT_PLANS = [
  { id: 'plan-monthly', name: 'Monthly', months: 1, price: 0, pauseDays: 5, perks: [], active: false },
  { id: 'plan-quarterly', name: 'Quarterly', months: 3, price: 0, pauseDays: 15, perks: [], active: false },
  { id: 'plan-half', name: 'Half-yearly', months: 6, price: 0, pauseDays: 30, perks: [], active: false },
  { id: 'plan-annual', name: 'Annual', months: 12, price: 0, pauseDays: 60, perks: [], active: false },
];
