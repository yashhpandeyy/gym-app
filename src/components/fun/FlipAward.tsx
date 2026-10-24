import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Icon, Text, type IconName } from '@/components/ui';
import type { Badge } from '@/lib/game';
import { haptic } from '@/lib/native';
import { useTheme } from '@/theme';

import { Sheen } from './Effects';

/**
 * An award you can turn over. The front shows the medal (gold once earned, a progress ring
 * while still locked); the back says how to get it.
 */
export function FlipAward({ badge, width = 104, height = 136 }: { badge: Badge; width?: number; height?: number }) {
  const { c, mix, alpha } = useTheme();
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const flip = useSharedValue(0);

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
  }));

  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    haptic.flip();
    flip.set(reduced ? withTiming(next ? 1 : 0, { duration: 0 }) : withSpring(next ? 1 : 0, { damping: 13, stiffness: 120, mass: 0.9 }));
  };

  const { earned, have, need } = badge;
  const pct = Math.min(1, have / need);
  const ring = 62;
  const stroke = 5;
  const r = (ring - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const gold: [string, string] = ['#FFE07A', '#F2A93B'];
  const back2: [string, string] = [c.primary, c.primaryDeep];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${badge.name}, ${earned ? 'earned' : `${have} of ${need}`}. Tap to ${flipped ? 'close' : 'see how'}`}
      onPress={toggle}
      style={{ width, height }}>
      <Animated.View style={[styles.face, { borderRadius: 20 }, front]}>
        <LinearGradient
          colors={earned ? gold : [c.surface, c.surfaceAlt]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, !earned && { borderWidth: 1.5, borderColor: c.line, borderRadius: 20 }]}
        />
        {earned ? <Sheen every={4800} delay={400} opacity={0.5} /> : null}
        <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
          {!earned ? (
            <Svg width={ring} height={ring} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={ring / 2} cy={ring / 2} r={r} stroke={c.line} strokeWidth={stroke} fill="none" />
              <Circle
                cx={ring / 2}
                cy={ring / 2}
                r={r}
                stroke={c.primary}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circ} ${circ}`}
                strokeDashoffset={circ * (1 - pct)}
              />
            </Svg>
          ) : null}
          <View style={[styles.inner, { backgroundColor: earned ? '#FFF4CC' : c.surfaceAlt }]}>
            <Icon name={(earned ? badge.icon : `${badge.icon}-outline`) as IconName} size={24} color={earned ? '#8A5A00' : c.inkFaint} />
          </View>
        </View>
        <Text variant="caption" align="center" numberOfLines={2} color={earned ? '#3A2600' : c.inkSoft} style={styles.name}>
          {badge.name}
        </Text>
        <Text variant="micro" align="center" color={earned ? 'rgba(58,38,0,0.7)' : c.inkFaint}>
          {earned ? 'Earned' : `${have}/${need}`}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.face, styles.backFace, { borderRadius: 20 }, back]}>
        <LinearGradient colors={back2} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.backIcon, { backgroundColor: alpha(c.onPrimary, 0.18) }]}>
          <Icon name={earned ? 'checkmark' : 'lock-closed'} size={16} color={c.onPrimary} />
        </View>
        <Text variant="caption" align="center" color={c.onPrimary} numberOfLines={6} style={{ marginTop: 6 }}>
          {badge.how}
        </Text>
        {!earned ? (
          <Text variant="micro" align="center" color={mix(c.onPrimary, c.primary, 0.2)} style={{ marginTop: 6 }}>
            {have} of {need} so far
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 4,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  backFace: { justifyContent: 'center' },
  inner: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 4 },
  backIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
