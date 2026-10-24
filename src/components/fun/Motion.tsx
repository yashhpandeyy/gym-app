import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Text, type TextProps } from '@/components/ui';
import { haptic } from '@/lib/native';
import { useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Counts from the previous value to the new one. Numbers that change should be seen changing. */
export function CountUp({
  value,
  from: start,
  duration = 700,
  format = (n: number) => String(n),
  ...rest
}: { value: number; from?: number; duration?: number; format?: (n: number) => string } & TextProps) {
  const [shown, setShown] = useState(start ?? value);
  const from = useRef(start ?? value);
  useEffect(() => {
    const start = Date.now();
    const a = from.current;
    let frame = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <Text {...rest}>{format(shown)}</Text>;
}

/** Springs down a little when pressed, like a physical button. */
export function Bouncy({
  children,
  onPress,
  style,
  accessibilityLabel,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPressIn={() => scale.set(withSpring(0.93, { damping: 15, stiffness: 400 }))}
      onPressOut={() => scale.set(withSpring(1, { damping: 10, stiffness: 300 }))}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}>
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Gentle rocking to say "tap me". Stops for people who prefer reduced motion. */
export function Wiggle({ children, active = true, style }: { children: ReactNode; active?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (!active || reduced) {
      r.value = withTiming(0);
      return;
    }
    r.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 90 }),
        withTiming(7, { duration: 90 }),
        withTiming(-5, { duration: 90 }),
        withTiming(5, { duration: 90 }),
        withTiming(0, { duration: 90 }),
        withDelay(1500, withTiming(0, { duration: 1 })),
      ),
      -1,
    );
  }, [active, reduced, r]);
  const animated = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Pops in with a springy overshoot. */
export function PopIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(0.4);
  const o = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 160 }));
    o.value = withDelay(delay, withTiming(1, { duration: 160 }));
  }, [delay, s, o]);
  const animated = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

export function XPBar({ progress, height = 12, color }: { progress: number; height?: number; color?: string }) {
  const { c } = useTheme();
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, progress)), { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: c.line, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color ?? c.warning.solid }, fill]}>
        <View style={{ position: 'absolute', top: 2, left: 6, right: 6, height: Math.max(2, height / 4), borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      </Animated.View>
    </View>
  );
}

export type RingSpec = { value: number; target: number; color: string };

/** Concentric activity rings that sweep closed on mount and whenever progress changes. */
export function ActivityRings({ rings, size = 150, stroke = 15, gap = 4 }: { rings: RingSpec[]; size?: number; stroke?: number; gap?: number }) {
  const { alpha } = useTheme();
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {rings.map((ring, i) => {
          const r = size / 2 - stroke / 2 - i * (stroke + gap);
          return <Circle key={`t${i}`} cx={size / 2} cy={size / 2} r={r} stroke={alpha(ring.color, 0.18)} strokeWidth={stroke} fill="none" />;
        })}
        {rings.map((ring, i) => (
          <RingArc key={`a${i}`} index={i} size={size} stroke={stroke} gap={gap} ring={ring} />
        ))}
      </Svg>
    </View>
  );
}

function RingArc({ index, size, stroke, gap, ring }: { index: number; size: number; stroke: number; gap: number; ring: RingSpec }) {
  const r = size / 2 - stroke / 2 - index * (stroke + gap);
  const circ = 2 * Math.PI * r;
  const pct = ring.target > 0 ? Math.min(1, ring.value / ring.target) : 0;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(120 * index, withTiming(pct, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [pct, index, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.value) }));
  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={r}
      stroke={ring.color}
      strokeWidth={stroke}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={`${circ} ${circ}`}
      animatedProps={props}
    />
  );
}
