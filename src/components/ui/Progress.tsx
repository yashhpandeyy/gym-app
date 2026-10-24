import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

export function ProgressBar({
  value,
  color,
  track,
  height = 6,
  style,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  const reduced = useReducedMotion();
  const fill = useSharedValue(reduced ? pct : 0);
  useEffect(() => {
    fill.set(reduced ? pct : withDelay(120, withSpring(pct, { damping: 16, stiffness: 90, mass: 0.8 })));
  }, [pct, reduced, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, fill.value)) * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[{ height, borderRadius: height / 2, backgroundColor: track ?? c.line, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color ?? c.primary }, fillStyle]} />
    </View>
  );
}

export function Ring({
  size = 64,
  stroke = 7,
  value,
  color,
  track,
  children,
}: {
  size?: number;
  stroke?: number;
  value: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - pct)}
        />
      </Svg>
      {children}
    </View>
  );
}
