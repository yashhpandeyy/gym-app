import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { fmtDay, toISO } from './date';

/**
 * Over-the-air updates. `npm run update` publishes new JavaScript; installed apps download it in the
 * background and run it the next time they open, without a new install. Off on the web (the dashboard
 * updates on every deploy), in development and in Expo Go.
 */
export const updatesOn = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;

/**
 * Whether a newer version has downloaded and is waiting to run. There's no banner for it: the
 * sign-in buttons say "Updated" and the app moves to it as someone signs in, and anyone already
 * signed in gets it the next time they open the app.
 */
export const useUpdateReady = create<{ ready: boolean }>(() => ({ ready: false }));

const CHECK_EVERY = 15 * 60_000;
// The app already checks once while it starts, so the first foreground check waits a full interval.
let lastCheck = Date.now();
let checking: Promise<'ready' | 'latest' | 'failed'> | null = null;

/** Looks for a newer update and downloads it. It runs the next time the app opens, or straight away after a restart. */
export function checkForUpdate(force = false): Promise<'ready' | 'latest' | 'failed'> {
  if (!updatesOn) return Promise.resolve('latest');
  if (checking) return checking;
  if (!force && Date.now() - lastCheck < CHECK_EVERY) return Promise.resolve('latest');
  lastCheck = Date.now();
  checking = (async () => {
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) return 'latest' as const;
      await Updates.fetchUpdateAsync();
      return 'ready' as const;
    } catch {
      return 'failed' as const;
    } finally {
      checking = null;
    }
  })();
  return checking;
}

/** Checks again whenever the app comes back to the foreground, at most every 15 minutes. */
export function useUpdateChecks() {
  useEffect(() => {
    if (!updatesOn) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdate();
    });
    return () => sub.remove();
  }, []);
}

/** Updates published with `npm run update -- --urgent` restart the app as soon as they arrive. */
export function isUrgent(manifest: unknown): boolean {
  const m = manifest as { extra?: { expoClient?: { extra?: { urgentUpdate?: boolean } } } } | undefined;
  return m?.extra?.expoClient?.extra?.urgentUpdate === true;
}

export function restartIntoUpdate() {
  void Updates.reloadAsync().catch(() => {});
}

/** "Version 1.0.0", plus the date of the update it's running when that isn't the one it was installed with. */
export function versionLabel(): string {
  const version = `Version ${Constants.expoConfig?.version ?? '1.0.0'}`;
  if (!updatesOn || Updates.isEmbeddedLaunch || !Updates.createdAt) return version;
  return `${version}, updated ${fmtDay(toISO(Updates.createdAt))}`;
}
