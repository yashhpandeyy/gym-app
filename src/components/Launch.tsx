import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useSync } from '@/lib/sync';
import { useTheme } from '@/theme';

import { Logo } from './Brand';

const MIN_SHOW_MS = 650;
const FADE_MS = 380;

/** The gym's mark on the brand colour, breathing gently. Same look as the native splash, so the hand-off is invisible. */
export function LaunchMark({ size = 72 }: { size?: number }) {
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [breathe]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.8 + breathe.value * 0.2,
    transform: [{ scale: 0.96 + breathe.value * 0.06 }],
  }));
  return (
    <Animated.View style={style}>
      <Logo size={size} inverted />
    </Animated.View>
  );
}

/**
 * Holds a calm branded screen over the app while it picks the right side, loads the gym and
 * lays out, then fades away in one move so nothing is seen jumping or swapping underneath.
 */
export function Launch() {
  const { c } = useTheme();
  const syncing = useSync((x) => x.status === 'loading');
  const [minDone, setMinDone] = useState(false);
  const [gone, setGone] = useState(false);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_SHOW_MS);
    return () => clearTimeout(t);
  }, []);

  const ready = minDone && !syncing;
  useEffect(() => {
    if (!ready) return;
    opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setGone(true), FADE_MS + 40);
    return () => clearTimeout(t);
  }, [ready, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, { backgroundColor: c.primary, zIndex: 100 }, style]}>
      <View style={styles.center}>
        <LaunchMark />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
