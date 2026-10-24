import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { haptic } from '@/lib/native';
import { duration, spring } from '@/theme/motion';

/**
 * A band of light that sweeps across its parent every few seconds, like light catching a
 * metal plate. Put it inside a container with overflow hidden.
 */
export function Sheen({ every = 4200, delay = 600, opacity = 0.32 }: { every?: number; delay?: number; opacity?: number }) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(-1);
  useEffect(() => {
    if (reduced || !w) return;
    x.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: duration.sweep, easing: Easing.inOut(Easing.quad) }), withDelay(every, withTiming(-1, { duration: 0 }))), -1),
    );
  }, [reduced, w, every, delay, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * w * 1.2 }, { rotate: '18deg' }] }));
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.sheen, style]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', `rgba(255,255,255,${opacity})`, 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** A soft radial glow that breathes behind something that just got finished. */
export function Glow({ color, size = 220, active = true, style }: { color: string; size?: number; active?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      p.value = withTiming(0, { duration: duration.base });
      return;
    }
    p.value = reduced
      ? withTiming(0.8)
      : withRepeat(withSequence(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), withTiming(0.55, { duration: 1300, easing: Easing.inOut(Easing.sin) })), -1);
  }, [active, reduced, p]);
  const animated = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.85 + p.value * 0.2 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style, animated]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <Stop offset="60%" stopColor={color} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#glow)" />
      </Svg>
    </Animated.View>
  );
}

/**
 * A card that tilts toward your finger in 3D while pressed, then springs back.
 * Makes cards feel like physical objects without moving them around the screen.
 */
export function TiltCard({
  children,
  onPress,
  style,
  accessibilityLabel,
  max = 9,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  max?: number;
}) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ w: 1, h: 1 });
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const s = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ perspective: 700 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }, { scale: s.value }],
  }));
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 })}
      onPressIn={(e) => {
        s.set(withSpring(0.97, spring.snappy));
        if (reduced) return;
        const { locationX, locationY } = e.nativeEvent;
        ry.set(withSpring(((locationX / size.w) - 0.5) * max, spring.snappy));
        rx.set(withSpring(-((locationY / size.h) - 0.5) * max, spring.snappy));
      }}
      onPressOut={() => {
        s.set(withSpring(1, spring.gentle));
        rx.set(withSpring(0, spring.gentle));
        ry.set(withSpring(0, spring.gentle));
      }}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}>
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Slowly turns its child, for decorative plates and rays. */
export function Spin({ children, seconds = 60, style }: { children: ReactNode; seconds?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (!reduced) r.value = withRepeat(withTiming(360, { duration: seconds * 1000, easing: Easing.linear }), -1);
  }, [reduced, seconds, r]);
  const animated = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  sheen: { position: 'absolute', top: -60, bottom: -60, left: '-40%', width: '45%' },
});
