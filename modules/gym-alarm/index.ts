import { requireOptionalNativeModule } from 'expo';

/** One alarm as the native side takes it. `days` are 0 = Sunday; with no days it rings once, on `date`. */
export type NativeAlarm = { id: string; hour: number; minute: number; days: number[]; date: string | null; label: string; body: string };

type GymAlarmModule = {
  prepare(): void;
  setAlarms(alarms: NativeAlarm[], color: string | null): void;
  ringNow(label: string, body: string): void;
  stop(): void;
  isRinging(): boolean;
  canScheduleExact(): boolean;
  openExactSettings(): void;
  canFullScreen(): boolean;
  openFullScreenSettings(): void;
  notificationsEnabled(): boolean;
  openNotificationSettings(): void;
};

/**
 * Android alarms that ring like the phone's clock: full screen over the lock screen, looping on the
 * alarm volume, with Stop and Snooze. Null on iOS, the web, and builds made before it existed, which
 * still receive updates, so callers must check before use.
 */
export const GymAlarm = requireOptionalNativeModule<GymAlarmModule>('GymAlarm');
