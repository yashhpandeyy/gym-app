import { LinearGradient } from 'expo-linear-gradient';
import { DeviceMotion } from 'expo-sensors';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fmtDate } from '@/lib/date';
import type { MembershipInfo } from '@/lib/domain';
import type { Member } from '@/store/types';
import { gutter, makeStyles, useTheme } from '@/theme';

import { Logo, PlateRings } from './Brand';
import { Sheen } from './fun/Effects';
import { QRPass } from './QRPass';
import { Pill, Text } from './ui';

const RAD = 57.2958;
const clamp = (n: number, lim: number) => Math.max(-lim, Math.min(lim, n));

/**
 * Tilt in degrees that follows the phone's gyroscope, like a card you hold in your hand.
 * Without a motion sensor (web, some emulators) the card sways gently by itself instead.
 */
function useTilt() {
  const reduced = useReducedMotion();
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    let sub: { remove: () => void } | undefined;

    const sway = () => {
      const ease = Easing.inOut(Easing.sin);
      rx.set(withRepeat(withSequence(withTiming(5, { duration: 2800, easing: ease }), withTiming(-5, { duration: 2800, easing: ease })), -1));
      ry.set(withRepeat(withSequence(withTiming(-8, { duration: 3600, easing: ease }), withTiming(8, { duration: 3600, easing: ease })), -1));
    };

    if (Platform.OS === 'web') {
      sway();
    } else {
      DeviceMotion.isAvailableAsync()
        .then((ok) => {
          if (cancelled) return;
          if (!ok) {
            sway();
            return;
          }
          DeviceMotion.setUpdateInterval(33);
          // The resting angle drifts toward wherever you hold the phone, so the card settles flat.
          let base: { b: number; g: number } | null = null;
          sub = DeviceMotion.addListener(({ rotation }) => {
            if (!rotation) return;
            const { beta, gamma } = rotation;
            if (!base) base = { b: beta, g: gamma };
            base.b += (beta - base.b) * 0.015;
            base.g += (gamma - base.g) * 0.015;
            ry.set(withSpring(clamp(-(gamma - base.g) * RAD * 0.9, 18), { damping: 14, stiffness: 120, mass: 0.6 }));
            rx.set(withSpring(clamp((beta - base.b) * RAD * 0.9, 18), { damping: 14, stiffness: 120, mass: 0.6 }));
          });
        })
        .catch(() => sway());
    }

    return () => {
      cancelled = true;
      sub?.remove();
      cancelAnimation(rx);
      cancelAnimation(ry);
    };
  }, [reduced, rx, ry]);

  return { rx, ry };
}

/**
 * The member's pass as a physical card: it tilts with the phone, catches the light as it moves,
 * and carries the rotating check-in QR.
 */
export function PassCard({
  member,
  info,
  disabled,
  checkedIn,
}: {
  member: Member;
  info: MembershipInfo;
  disabled?: boolean;
  checkedIn?: boolean;
}) {
  const { c, brand, alpha } = useTheme();
  const s = useStyles();
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - gutter * 2, 360);
  const { rx, ry } = useTilt();

  const look = { active: c.primary, upcoming: c.primary, paused: c.ice.solid, expired: c.ink }[info.status];
  const fg = info.status === 'active' || info.status === 'upcoming' ? c.onPrimary : info.status === 'paused' ? '#FFFFFF' : c.surface;

  const card = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }],
  }));
  const glare = useAnimatedStyle(() => ({
    opacity: 0.18 + Math.min(0.3, Math.abs(ry.value) / 40),
    transform: [{ translateX: ry.value * 9 }, { translateY: rx.value * 5 }, { rotate: '22deg' }],
  }));
  const shadow = useAnimatedStyle(() => ({
    transform: [{ translateX: -ry.value * 1.2 }, { translateY: 14 + rx.value * 0.8 }],
  }));

  return (
    <View style={{ width: cardW, alignSelf: 'center' }}>
      <Animated.View pointerEvents="none" style={[s.shadow, { backgroundColor: look }, shadow]} />
      <Animated.View style={[s.card, { backgroundColor: look }, card]}>
        <PlateRings size={260} color={alpha(fg, 0.1)} style={{ right: -90, top: -80 }} />
        <LinearGradient
          colors={[alpha('#FFFFFF', 0.16), alpha('#FFFFFF', 0), alpha('#000000', 0.14)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View pointerEvents="none" style={[s.glare, glare]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {!disabled ? <Sheen every={7000} delay={1500} opacity={0.2} /> : null}

        <View style={s.top}>
          <Logo size={28} inverted />
          <Text variant="smallStrong" color={fg} numberOfLines={1} style={{ flex: 1 }}>
            {brand.name}
          </Text>
          <Text variant="micro" color={alpha(fg, 0.8)}>
            MEMBER
          </Text>
        </View>

        <View style={[s.panel, { backgroundColor: c.surface }]}>
          <QRPass member={member} size={Math.min(200, cardW - 120)} disabled={disabled} />
        </View>

        <View style={s.who}>
          <Text variant="h2" color={fg} numberOfLines={1}>
            {member.name}
          </Text>
          <Text variant="small" color={alpha(fg, 0.85)} numberOfLines={1}>
            {member.code}, {info.plan?.name ?? 'Member'}, valid until {fmtDate(info.end)}
          </Text>
          {checkedIn ? <Pill label="Checked in today" tone="success" dot style={{ alignSelf: 'flex-start', marginTop: 8 }} /> : null}
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  shadow: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 10,
    bottom: 0,
    borderRadius: t.radius.xl,
    opacity: t.scheme === 'dark' ? 0 : 0.35,
  },
  card: {
    borderRadius: 28,
    padding: 18,
    gap: 16,
    overflow: 'hidden',
  },
  glare: { position: 'absolute', top: -80, bottom: -80, left: '30%', width: 90 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panel: { borderRadius: 22, paddingVertical: 14, alignItems: 'center' },
  who: { gap: 2 },
}));
