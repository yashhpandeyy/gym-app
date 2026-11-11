import { requireOptionalNativeModule } from 'expo';
import type * as KeepAwakeModule from 'expo-keep-awake';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Keeps the screen on while a screen is open, such as the strength test with its timers.
 *
 * Builds made before November 2026 don't contain expo-keep-awake's native part, and they still
 * receive over-the-air updates. Importing the library there would crash the app as it starts, so
 * it's loaded only when the phone has it. Without it the screen simply dims as usual.
 */
const available = Platform.OS === 'web' || !!requireOptionalNativeModule('ExpoKeepAwake');

let mod: typeof KeepAwakeModule | null | undefined;
function keepAwake() {
  if (mod === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = available ? (require('expo-keep-awake') as typeof KeepAwakeModule) : null;
  }
  return mod;
}

export function useScreenAwake(tag: string) {
  useEffect(() => {
    const k = keepAwake();
    if (!k) return;
    k.activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      k.deactivateKeepAwake(tag).catch(() => {});
    };
  }, [tag]);
}
