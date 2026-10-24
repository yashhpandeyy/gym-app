import type { Prize, PrizeKind } from '../../shared/rules';

import type { BrandOverride } from '@/config/brand';
import type { ISODate } from '@/lib/date';

export type Role = 'member' | 'manager' | 'admin';

/** `remote` marks a sign-in to a real gym on the server, as opposed to the offline demo data. */
export type Session = { role: Role; memberId?: string; staffName?: string; remote?: boolean };

export type GymLink = { gymCode: string; gymName: string; name: string; status: 'pending' | 'active' };

export type Plan = {
  id: string;
  name: string;
  months: number;
  price: number;
  /** Days a member may pause during one term of this plan. */
  pauseDays: number;
  perks: string[];
  popular?: boolean;
  active: boolean;
};

export type Gender = 'female' | 'male' | 'other';

export type Member = {
  id: string;
  code: string;
  name: string;
  phone: string;
  gender: Gender;
  joinedOn: ISODate;
  planId: string;
  /** Start of the current term. */
  startDate: ISODate;
  /** End of the current term before any pause days are added. */
  endDate: ISODate;
  /** Pause days available in the current term (unused days carry over on renewal). */
  pauseAllowance: number;
  dues: number;
  preferredSlotId?: string;
  trainerId?: string;
  goalWeight?: number;
  notes?: string;
  weeklyGoal: number;
  referredBy?: string;
  /** Extra guest passes won from chests, on top of the monthly allowance. */
  bonusGuestPasses?: number;
  /** How many of those the member has already handed out. Only the gym can change `bonusGuestPasses`. */
  bonusUsed?: number;
};

export type PauseStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type Pause = {
  id: string;
  memberId: string;
  start: ISODate;
  end: ISODate;
  reason: string;
  note?: string;
  status: PauseStatus;
  createdAt: string;
  decidedAt?: string;
  decisionNote?: string;
};

export type Slot = {
  id: string;
  start: string;
  end: string;
  capacity: number;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
};

export type Closure = { id: string; date: ISODate; slotId: string | null; reason: string };

export type Intensity = 'Easy' | 'Moderate' | 'Hard';

export type GymClass = {
  id: string;
  name: string;
  coachId: string;
  days: number[];
  start: string;
  minutes: number;
  capacity: number;
  intensity: Intensity;
  about: string;
};

export type BookingKind = 'slot' | 'class';
export type BookingStatus = 'booked' | 'waitlist' | 'cancelled';

export type Booking = {
  id: string;
  memberId: string;
  kind: BookingKind;
  refId: string;
  date: ISODate;
  status: BookingStatus;
  createdAt: string;
};

export type CheckIn = { id: string; memberId: string; at: string; method: 'qr' | 'desk' };

export type PayMethod = 'UPI' | 'Card' | 'Cash';

export type Payment = {
  id: string;
  memberId: string;
  invoice: string;
  date: ISODate;
  amount: number;
  method: PayMethod;
  planId?: string;
  note?: string;
};

export type AnnouncementKind = 'notice' | 'holiday' | 'event' | 'offer';

export type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: AnnouncementKind;
  date: ISODate;
  pinned: boolean;
};

export type Trainer = {
  id: string;
  name: string;
  focus: string;
  years: number;
  rating: number;
  price: number;
  bio: string;
  certifications: string[];
};

export type PTRequest = {
  id: string;
  memberId: string;
  trainerId: string;
  preferredTime: string;
  goal: string;
  status: 'pending' | 'scheduled' | 'declined';
  createdAt: string;
};

export type ProgressEntry = { id: string; date: ISODate; weight: number; bodyFat?: number; waist?: number };

/** liftKey ties an exercise to the Strength score (the big four barbell lifts). */
export type LiftKey = 'squat' | 'bench' | 'deadlift' | 'ohp';
export type Exercise = { id: string; name: string; sets: string; note?: string; liftKey?: LiftKey; loggable?: boolean };
export type WorkoutDay = { id: string; name: string; focus: string; exercises: Exercise[] };
export type WorkoutPlan = {
  trainerId: string;
  title: string;
  updatedOn: ISODate;
  days: WorkoutDay[];
};

export type LeadStage = 'new' | 'trial' | 'joined' | 'lost';
export type Lead = {
  id: string;
  /** Set when the lead came from a member's guest pass. */
  hostId?: string;
  name: string;
  phone: string;
  source: string;
  interest: string;
  stage: LeadStage;
  date: ISODate;
  note?: string;
};

export type TicketCategory = 'Equipment' | 'Cleanliness' | 'Staff' | 'Billing' | 'Suggestion' | 'Other';
export type Ticket = {
  id: string;
  memberId: string;
  category: TicketCategory;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  reply?: string;
};

export type NoticeKind = 'booking' | 'pause' | 'payment' | 'announcement' | 'reminder' | 'class';
export type Notice = {
  id: string;
  memberId: string | null;
  title: string;
  body: string;
  kind: NoticeKind;
  at: string;
  read: boolean;
};

// ---- Gamification -----------------------------------------------------------

/** key makes an award idempotent (ticking the same exercise twice in a day pays once). */
export type XpEvent = { id: string; memberId: string; amount: number; reason: string; at: string; key?: string };

export type { Prize, PrizeKind };

export type Chest = {
  id: string;
  memberId: string;
  reason: string;
  earnedAt: string;
  openedAt?: string;
  prize?: Prize;
  /** For prizes the desk hands over (a shake, merch). */
  redeemedAt?: string;
};

/** One logged set. e1RM is derived, not stored. */
export type LiftEntry = { id: string; memberId: string; exercise: string; liftKey?: LiftKey; weight: number; reps: number; date: ISODate };

export type ChallengeUnit = 'time' | 'reps';
export type Challenge = {
  id: string;
  name: string;
  station: string;
  unit: ChallengeUnit;
  better: 'lower' | 'higher';
  how: string;
  /** Plausible bounds, used to generate the demo field and to sanity-check entries. */
  range: [number, number];
  active: boolean;
  /** Which strength a station tests. Inferred from the unit when missing. */
  category?: 'cardio' | 'endurance';
};
export type ChallengeEntry = { id: string; memberId: string; challengeId: string; value: number; date: ISODate };

export type CelebrationKind = 'checkin' | 'pr' | 'ring' | 'allRings' | 'level' | 'league' | 'rank' | 'guest' | 'mind' | 'badge' | 'referral';
export type Celebration = {
  id: string;
  memberId: string;
  kind: CelebrationKind;
  title: string;
  body: string;
  xp?: number;
  chest?: boolean;
};

export type RingKey = 'show' | 'train' | 'fuel';

// ---- Guest passes -------------------------------------------------------------

export type GuestPass = {
  id: string;
  hostId: string;
  name: string;
  phone: string;
  code: string;
  createdOn: ISODate;
  /** The 7 days start on the guest's first visit. */
  activatedOn?: ISODate;
  visits: ISODate[];
  joinedAs?: string;
};

// ---- Nutrition, supplements, mind ----------------------------------------------

export type Meal = { id: string; time: string; name: string; items: string[]; kcal: number; protein: number; swap?: string };
export type DietPlan = {
  coachId: string;
  title: string;
  goal: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  waterGlasses: number;
  updatedOn: ISODate;
  meals: Meal[];
  notes?: string;
};

export type DoseTime = 'Morning' | 'Before workout' | 'After workout' | 'With lunch' | 'Evening' | 'Night';
export type SupplementItem = {
  id: string;
  name: string;
  dose: string;
  time: DoseTime;
  kind: 'supplement' | 'medicine';
  addedBy: 'coach' | 'member';
  note?: string;
};

export type MindSession = { id: string; memberId: string; sessionId: string; minutes: number; at: string };

export type Settings = {
  bookingWindowDays: number;
  cancelCutoffMinutes: number;
  maxBookingsPerDay: number;
  waitlist: boolean;
  requireBooking: boolean;
  minPauseDays: number;
  pauseNoticeDays: number;
  autoApprovePause: boolean;
  reminderDaysBeforeExpiry: number;
  guestPassDays: number;
  guestPassesPerMonth: number;
  guestWithHost: boolean;
};

export type Prefs = {
  scheme: 'system' | 'light' | 'dark';
  notifyBookings: boolean;
  notifyOffers: boolean;
  notifyExpiry: boolean;
  /** Sound effects. Missing on older saves, which count as on. */
  sound?: boolean;
  /** Gym-wide notices this person has opened. Read state for a shared notice can't live on the notice itself. */
  readBroadcast?: string[];
};

export type Data = {
  plans: Plan[];
  members: Member[];
  pauses: Pause[];
  slots: Slot[];
  closures: Closure[];
  classes: GymClass[];
  bookings: Booking[];
  checkins: CheckIn[];
  payments: Payment[];
  announcements: Announcement[];
  trainers: Trainer[];
  ptRequests: PTRequest[];
  progress: Record<string, ProgressEntry[]>;
  workouts: Record<string, WorkoutPlan>;
  workoutLog: Record<string, Record<ISODate, string[]>>;
  leads: Lead[];
  tickets: Ticket[];
  notices: Notice[];
  settings: Settings;
  // gamification
  xp: XpEvent[];
  chests: Chest[];
  lifts: LiftEntry[];
  challenges: Challenge[];
  challengeEntries: ChallengeEntry[];
  leagueTier: Record<string, number>;
  leagueSettledWeek: Record<string, ISODate>;
  ringClaims: Record<string, Record<ISODate, (RingKey | 'all')[]>>;
  celebrations: Celebration[];
  // guests
  guestPasses: GuestPass[];
  // nutrition and recovery
  dietPlans: Record<string, DietPlan>;
  mealLog: Record<string, Record<ISODate, string[]>>;
  water: Record<string, Record<ISODate, number>>;
  supplements: Record<string, SupplementItem[]>;
  supplementLog: Record<string, Record<ISODate, string[]>>;
  mindLog: MindSession[];
};

export type Result = { ok: true; message?: string } | { ok: false; message: string };

export type { BrandOverride };
