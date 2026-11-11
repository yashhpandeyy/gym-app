import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { activeBrand } from '@/config/active';

import { GymAlarm, type NativeAlarm } from '../../modules/gym-alarm';
import { addDays, fmtTime, today, toMinutes, weekday, WEEKDAYS_SHORT, type ISODate } from './date';
import { uid } from './format';

/**
 * Members' own alarms: time to leave for the gym, a medicine, a pre-workout meal. They live on this
 * phone only, like medicines, and are never sent to the gym.
 *
 * How they ring depends on what the installed build contains, because every build gets this code
 * over the air:
 * - With the app's own GymAlarm module (Android builds from late November 2026): exactly like the
 *   phone's clock. Full screen over the lock screen, looping on the alarm volume, Stop and Snooze
 *   right there, whether the app is open or not.
 * - With only expo-notifications: a notification with the alarm sound when the app is closed, and
 *   AlarmHost's full-screen alarm while it's open.
 * - With neither: AlarmHost rings them while the app is open, and the screen says to update the app.
 * Native modules are looked up before they're loaded, so no build is ever handed code it can't run.
 */

export type AlarmKind = 'gym' | 'medicine' | 'meal' | 'other';
export type Alarm = {
  id: string;
  label: string;
  kind: AlarmKind;
  /** HH:MM, 24-hour. */
  time: string;
  /** Days it repeats, 0 = Sunday. Empty: rings once, on `date`. */
  days: number[];
  date?: ISODate;
  on: boolean;
};

export const ALARM_KINDS: { key: AlarmKind; label: string; icon: 'barbell-outline' | 'medkit-outline' | 'restaurant-outline' | 'alarm-outline'; body: string }[] = [
  { key: 'gym', label: 'Gym', icon: 'barbell-outline', body: 'Time to head to the gym.' },
  { key: 'medicine', label: 'Medicine', icon: 'medkit-outline', body: 'Time to take your medicine.' },
  { key: 'meal', label: 'Meal', icon: 'restaurant-outline', body: 'Time to eat.' },
  { key: 'other', label: 'Other', icon: 'alarm-outline', body: 'Your alarm.' },
];

const CHANNEL = 'alarms-v1';
const SNOOZE_MIN = 5;

type State = {
  alarms: Alarm[];
  /** `${id}@${date} ${time}` of the last time each alarm rang, so a minute never rings twice. */
  rung: Record<string, string>;
  /** Epoch ms a snoozed alarm rings again. */
  snoozed: Record<string, number>;
  /** The alarm ringing on screen right now. */
  ringing: Alarm | null;
};

export const useAlarms = create<State>()(
  persist(() => ({ alarms: [], rung: {}, snoozed: {}, ringing: null }) as State, {
    name: 'gym.alarms',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: ({ ringing: _r, ...rest }) => rest,
  }),
);

// ---- the native part, when this build has it ---------------------------------------------------

const native = Platform.OS === 'android' ? GymAlarm : null;

/** Whether alarms ring like the phone's clock: full screen, with the app closed, Stop and Snooze on the alarm itself. */
export const nativeAlarms = !!native;

/** Whether this install can ring alarms while the app is closed. */
export const closedAppAlarms = nativeAlarms || (Platform.OS !== 'web' && !!requireOptionalNativeModule('ExpoNotificationScheduler'));

let N: typeof NotificationsModule | null | undefined;
function notifications() {
  if (N === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    N = closedAppAlarms ? (require('expo-notifications') as typeof NotificationsModule) : null;
  }
  return N;
}

let ready: Promise<void> | null = null;
/** One-time setup: the alarm channel with its sound, and keeping the system banner quiet while the app shows its own alarm. */
function setup() {
  // Android 13 only asks about notifications once the app has a notification channel.
  native?.prepare();
  const n = notifications();
  if (!n) return Promise.resolve();
  ready ??= (async () => {
    n.setNotificationHandler({
      handleNotification: async (note) => {
        // Only while the app is on screen does it ring alarms itself. In the background, even with the app still
        // running, the notification has to make the noise.
        const quiet = typeof note.request.content.data?.alarmId === 'string' && AppState.currentState === 'active';
        return { shouldShowBanner: !quiet, shouldShowList: true, shouldPlaySound: !quiet, shouldSetBadge: false };
      },
    });
    if (Platform.OS === 'android' && !native) {
      await n.setNotificationChannelAsync(CHANNEL, {
        name: 'Alarms',
        description: 'Alarms you set in the app',
        importance: n.AndroidImportance.MAX,
        sound: 'alarm.wav',
        vibrationPattern: [0, 700, 300, 700, 300, 700],
        enableVibrate: true,
        lockscreenVisibility: n.AndroidNotificationVisibility.PUBLIC,
        audioAttributes: { usage: n.AndroidAudioUsage.ALARM, contentType: n.AndroidAudioContentType.SONIFICATION },
      });
    }
  })().catch(() => {});
  return ready;
}

export type AlarmPermission = 'granted' | 'denied' | 'ask' | 'unavailable';

/** Whether alarms may ring while the app is closed. */
export async function alarmPermission(): Promise<AlarmPermission> {
  const n = notifications();
  if (!n && native) return native.notificationsEnabled() ? 'granted' : 'denied';
  if (!n) return 'unavailable';
  await setup();
  const p = await n.getPermissionsAsync().catch(() => null);
  if (!p) return 'unavailable';
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'ask' : 'denied';
}

export async function askAlarmPermission(): Promise<AlarmPermission> {
  const n = notifications();
  if (!n && native) {
    native.openNotificationSettings();
    return native.notificationsEnabled() ? 'granted' : 'denied';
  }
  if (!n) return 'unavailable';
  await setup();
  const p = await n.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }).catch(() => null);
  if (!p) return 'unavailable';
  return p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'denied';
}

/** Android 12 and later make apps ask before ringing on the exact minute; without it the phone may ring a few minutes late. */
export async function exactAlarmsAllowed(): Promise<boolean> {
  if (native) return native.canScheduleExact();
  const n = notifications();
  if (!n || Platform.OS !== 'android') return true;
  const p = await n.getExactAlarmPermissionsAsync().catch(() => null);
  return !p || p.granted;
}

export async function askExactAlarms(): Promise<boolean> {
  if (native) {
    // Opens the phone's settings. The alarms are set again when the person comes back (see AlarmHost).
    native.openExactSettings();
    return native.canScheduleExact();
  }
  const n = notifications();
  if (!n || Platform.OS !== 'android') return true;
  const p = await n.requestExactAlarmPermissionsAsync().catch(() => null);
  if (p?.granted) await rescheduleAll();
  return !!p?.granted;
}

/** Android 14 and later let people stop apps showing full-screen alarms. Clock-style alarms need it. */
export function fullScreenAllowed(): boolean {
  return native ? native.canFullScreen() : true;
}

export function askFullScreen() {
  native?.openFullScreenSettings();
}

/** Rings the real alarm now, full screen, so a member can see and hear what it does. */
export function tryAlarm(label: string, body: string) {
  native?.ringNow(label, body);
}

const bodyOf = (a: Alarm) => ALARM_KINDS.find((k) => k.key === a.kind)?.body ?? 'Your alarm.';

/** The next time a one-off alarm at `time` rings: today if that's still ahead, otherwise tomorrow. */
export function nextDateFor(time: string, now = new Date()): ISODate {
  const t = today();
  return toMinutes(time) > now.getHours() * 60 + now.getMinutes() ? t : addDays(t, 1);
}

/** The saved alarms load from storage a moment after start. Scheduling before that would wipe them. */
function loaded(): Promise<void> {
  if (useAlarms.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = useAlarms.persist.onFinishHydration(() => {
      off();
      resolve();
    });
  });
}

let scheduling: Promise<void> = Promise.resolve();
/**
 * Cancels every alarm notification this app scheduled and schedules the switched-on alarms again.
 * Simple and always right, and there are only ever a handful. Calls queue up so two edits in a row can't interleave.
 */
export function rescheduleAll(): Promise<void> {
  scheduling = scheduling.then(async () => {
    await loaded();
    const n = notifications();
    await setup();
    // Alarm notifications from an older build of the app would ring a second time, so they always go.
    if (n) {
      const existing = await n.getAllScheduledNotificationsAsync().catch(() => []);
      await Promise.all(existing.filter((r) => typeof r.content.data?.alarmId === 'string').map((r) => n.cancelScheduledNotificationAsync(r.identifier).catch(() => {})));
    }
    if (native) {
      retirePastAlarms();
      const list: NativeAlarm[] = useAlarms
        .getState()
        .alarms.filter((a) => a.on)
        .map((a) => {
          const [hour, minute] = a.time.split(':').map(Number);
          return { id: a.id, hour, minute, days: [...a.days], date: a.days.length ? null : (a.date ?? nextDateFor(a.time)), label: a.label, body: bodyOf(a) };
        });
      try {
        native.setAlarms(list, activeBrand().colors.primary);
      } catch {
        // A broken alarm list must never take the app down; the next change tries again.
      }
      return;
    }
    if (!n) return;
    const p = await n.getPermissionsAsync().catch(() => null);
    if (!p?.granted) return;
    const { alarms, snoozed } = useAlarms.getState();
    const now = Date.now();
    for (const a of alarms) {
      if (!a.on) continue;
      const [hour, minute] = a.time.split(':').map(Number);
      const content = { title: a.label, body: bodyOf(a), sound: 'alarm.wav', priority: n.AndroidNotificationPriority.MAX, data: { alarmId: a.id } };
      const base = { channelId: CHANNEL, delivery: 'alarmClock' as const };
      const triggers: NotificationsModule.SchedulableNotificationTriggerInput[] = [];
      if (!a.days.length) {
        const at = new Date(`${a.date ?? nextDateFor(a.time)}T${a.time}:00`);
        if (at.getTime() > now) triggers.push({ ...base, type: n.SchedulableTriggerInputTypes.DATE, date: at });
      } else if (a.days.length === 7) {
        triggers.push({ ...base, type: n.SchedulableTriggerInputTypes.DAILY, hour, minute });
      } else {
        for (const d of a.days) triggers.push({ ...base, type: n.SchedulableTriggerInputTypes.WEEKLY, weekday: d + 1, hour, minute });
      }
      const snooze = snoozed[a.id];
      if (snooze && snooze > now) triggers.push({ ...base, type: n.SchedulableTriggerInputTypes.DATE, date: new Date(snooze) });
      for (const trigger of triggers) await n.scheduleNotificationAsync({ content, trigger }).catch(() => {});
    }
  }).catch(() => {
    // One failed round must not stop the next one from running.
  });
  return scheduling;
}

/** Calls back when an alarm's notification arrives while the app is open, so the screen can ring it. */
export function listenForAlarms(onAlarm: (id: string) => void) {
  const n = notifications();
  if (!n) return () => {};
  void setup();
  const sub = n.addNotificationReceivedListener((note) => {
    const id = note.request.content.data?.alarmId;
    if (typeof id === 'string') onAlarm(id);
  });
  return () => sub.remove();
}

// ---- actions ---------------------------------------------------------------------------------------

export function saveAlarm(input: Omit<Alarm, 'id' | 'on' | 'date'> & { id?: string }) {
  const id = input.id ?? uid('al');
  const alarm: Alarm = { ...input, id, on: true, date: input.days.length ? undefined : nextDateFor(input.time) };
  const s = useAlarms.getState();
  const alarms = s.alarms.some((a) => a.id === id) ? s.alarms.map((a) => (a.id === id ? alarm : a)) : [...s.alarms, alarm];
  useAlarms.setState({ alarms: alarms.sort((a, b) => (a.time < b.time ? -1 : 1)) });
  void rescheduleAll();
  return alarm;
}

export function toggleAlarm(id: string, on: boolean) {
  const s = useAlarms.getState();
  useAlarms.setState({
    alarms: s.alarms.map((a) => (a.id === id ? { ...a, on, date: a.days.length ? undefined : on ? nextDateFor(a.time) : a.date } : a)),
    snoozed: Object.fromEntries(Object.entries(s.snoozed).filter(([k]) => k !== id || on)),
  });
  void rescheduleAll();
}

export function removeAlarm(id: string) {
  const s = useAlarms.getState();
  useAlarms.setState({ alarms: s.alarms.filter((a) => a.id !== id), snoozed: Object.fromEntries(Object.entries(s.snoozed).filter(([k]) => k !== id)) });
  void rescheduleAll();
}

/** One-off alarms that rang while the app was closed switch themselves off, as they do on the phone's clock. */
export function retirePastAlarms(now = new Date()) {
  const s = useAlarms.getState();
  const stamp = `${today()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const done = s.alarms.filter((a) => a.on && !a.days.length && a.date && `${a.date} ${a.time}` < stamp);
  if (done.length) useAlarms.setState({ alarms: s.alarms.map((a) => (done.includes(a) ? { ...a, on: false } : a)) });
}

/** Signing out takes the alarms with it, like medicines, so the next person on this phone doesn't inherit them. */
export function clearAlarms() {
  useAlarms.setState({ alarms: [], rung: {}, snoozed: {}, ringing: null });
  void rescheduleAll();
}

// ---- ringing ------------------------------------------------------------------------------------------

const keyFor = (a: Alarm, date: ISODate, time: string) => `${date} ${time}`;

/** Alarms due this minute (or a snooze that's up) that haven't rung yet. */
export function dueAlarms(now = new Date()): Alarm[] {
  const { alarms, rung, snoozed } = useAlarms.getState();
  const date = today();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return alarms.filter((a) => {
    if (!a.on) return false;
    const snooze = snoozed[a.id];
    if (snooze && now.getTime() >= snooze && now.getTime() - snooze < 60_000) return rung[a.id] !== `snooze ${snooze}`;
    if (a.time !== hhmm) return false;
    if (a.days.length ? !a.days.includes(weekday(date)) : a.date !== date) return false;
    return rung[a.id] !== keyFor(a, date, hhmm);
  });
}

/** Puts an alarm on screen and remembers it rang this minute. */
export function ring(a: Alarm, now = new Date()) {
  const s = useAlarms.getState();
  const snooze = s.snoozed[a.id];
  const bySnooze = !!snooze && now.getTime() >= snooze;
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  useAlarms.setState({
    ringing: a,
    rung: { ...s.rung, [a.id]: bySnooze ? `snooze ${snooze}` : keyFor(a, today(), hhmm) },
    snoozed: bySnooze ? Object.fromEntries(Object.entries(s.snoozed).filter(([k]) => k !== a.id)) : s.snoozed,
  });
}

/** Stops the alarm on screen. A one-off alarm switches itself off once it has rung. */
export function stopRinging() {
  const s = useAlarms.getState();
  const a = s.ringing;
  useAlarms.setState({ ringing: null, alarms: a && !a.days.length ? s.alarms.map((x) => (x.id === a.id ? { ...x, on: false } : x)) : s.alarms });
  if (a && !a.days.length) void rescheduleAll();
}

export function snoozeRinging() {
  const s = useAlarms.getState();
  const a = s.ringing;
  if (!a) return;
  useAlarms.setState({ ringing: null, snoozed: { ...s.snoozed, [a.id]: Date.now() + SNOOZE_MIN * 60_000 } });
  void rescheduleAll();
}

export { SNOOZE_MIN };

/** "Every day", "Mon to Fri", "Mon, Wed, Fri", "Once, today" */
export function repeatLabel(a: Pick<Alarm, 'days' | 'date'>) {
  const d = [...a.days].sort();
  if (!d.length) return a.date === today() ? 'Once, today' : a.date === addDays(today(), 1) ? 'Once, tomorrow' : 'Once';
  if (d.length === 7) return 'Every day';
  if (d.join() === '1,2,3,4,5') return 'Mon to Fri';
  if (d.join() === '1,2,3,4,5,6') return 'Mon to Sat';
  if (d.join() === '0,6') return 'Weekends';
  return d.map((x) => WEEKDAYS_SHORT[x]).join(', ');
}

export { fmtTime as fmtAlarmTime };
