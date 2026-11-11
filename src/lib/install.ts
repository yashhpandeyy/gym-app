import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Installing the website as an app on a phone's home screen. Android browsers offer a real install
 * prompt, which public/index.html catches early; iPhones have none, so people are shown where
 * Share > Add to Home Screen is. Nothing here runs outside the web build.
 */

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type InstallWindow = Window & { __installPrompt?: PromptEvent | null };

/** installed: already running from the home screen. prompt: Android can install with one tap. ios / manual: show the steps. none: not a phone browser. */
export type InstallMode = 'installed' | 'prompt' | 'ios' | 'manual' | 'none';

const web = Platform.OS === 'web' && typeof window !== 'undefined';

const isIOS = () => web && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** A phone (or small tablet) browser, as opposed to a computer. */
export function isPhoneBrowser() {
  if (!web) return false;
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return isIOS() || (touch && Math.min(window.screen.width, window.screen.height) < 820);
}

export function isInstalled() {
  if (!web) return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function currentMode(): InstallMode {
  if (!web) return 'none';
  if (isInstalled()) return 'installed';
  if (!isPhoneBrowser()) return 'none';
  if ((window as InstallWindow).__installPrompt) return 'prompt';
  return isIOS() ? 'ios' : 'manual';
}

export function useInstall() {
  const [mode, setMode] = useState<InstallMode>(currentMode);
  useEffect(() => {
    if (!web) return;
    const refresh = () => setMode(currentMode());
    window.addEventListener('installready', refresh);
    window.addEventListener('appinstalled', refresh);
    return () => {
      window.removeEventListener('installready', refresh);
      window.removeEventListener('appinstalled', refresh);
    };
  }, []);

  /** Shows Android's install prompt. Returns false where there isn't one, so the caller shows the steps instead. */
  const install = async () => {
    const w = window as InstallWindow;
    const e = w.__installPrompt;
    if (!e) return false;
    await e.prompt();
    const choice = await e.userChoice;
    // The prompt can only be used once.
    w.__installPrompt = null;
    setMode(choice.outcome === 'accepted' ? 'installed' : currentMode());
    return true;
  };

  return { mode, install };
}

const DISMISS_KEY = 'gym.install.later';
const LATER_MS = 3 * 86_400_000;

/** "Not now" hides the install banner for three days. */
export const installSnoozed = () => web && Date.now() - Number(window.localStorage.getItem(DISMISS_KEY) ?? 0) < LATER_MS;
export const snoozeInstall = () => web && window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
