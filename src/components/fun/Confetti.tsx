import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { rng } from '@/lib/format';
import { useTheme } from '@/theme';

type Piece = { vx: number; vy: number; spin: number; size: number; color: string; round: boolean; delay: number };

function Particle({ p, originX, originY, height }: { p: Piece; originX: number; originY: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: 1900, easing: Easing.out(Easing.quad) }));
  }, [p.delay, t]);
  const style = useAnimatedStyle(() => {
    // Launch upward and outward, then gravity takes over.
    const x = originX + p.vx * t.value;
    const y = originY + p.vy * t.value + height * 0.9 * t.value * t.value;
    return {
      opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${p.spin * t.value}deg` }, { scaleX: 0.6 + 0.4 * Math.cos(t.value * 12) }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        { width: p.size, height: p.round ? p.size : p.size * 0.45, borderRadius: p.round ? p.size / 2 : 1.5, backgroundColor: p.color },
        style,
      ]}
    />
  );
}

/** A one-shot burst of confetti from a point. Renders nothing when the OS asks for reduced motion. */
export function Confetti({ count = 46, seed = 'confetti', origin }: { count?: number; seed?: string; origin?: { x?: number; y?: number } }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  if (reduced) return null;
  const colors = [c.primary, c.success.solid, c.warning.solid, c.danger.solid, c.ice.solid, '#FFFFFF'];
  const r = rng(seed);
  const pieces: Piece[] = Array.from({ length: count }, () => ({
    vx: (r() - 0.5) * width * 1.1,
    vy: -height * (0.35 + r() * 0.35),
    spin: (r() - 0.5) * 1080,
    size: 7 + r() * 7,
    color: colors[Math.floor(r() * colors.length)],
    round: r() < 0.3,
    delay: Math.floor(r() * 140),
  }));
  const ox = origin?.x ?? width / 2;
  const oy = origin?.y ?? height * 0.42;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Particle key={i} p={p} originX={ox} originY={oy} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0 },
});
