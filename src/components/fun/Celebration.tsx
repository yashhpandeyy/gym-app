import { router } from 'expo-router';
import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Button, Icon, Text, type IconName } from '@/components/ui';
import { haptic } from '@/lib/native';
import { useApp, type Celebration, type CelebrationKind } from '@/store';
import { useTheme, type Palette } from '@/theme';

import { ChestArt } from './Chest';
import { Confetti } from './SkiaConfetti';
import { CountUp, PopIn } from './Motion';

const ICON: Record<CelebrationKind, IconName> = {
  checkin: 'flash',
  pr: 'trophy',
  ring: 'aperture',
  allRings: 'aperture',
  level: 'star',
  league: 'podium',
  rank: 'medal',
  guest: 'people',
  mind: 'leaf',
  badge: 'barbell',
  referral: 'gift',
};

function tint(c: Palette, kind: CelebrationKind) {
  if (kind === 'pr' || kind === 'level' || kind === 'league' || kind === 'rank' || kind === 'badge') return c.warning.solid;
  if (kind === 'ring' || kind === 'allRings') return c.success.solid;
  if (kind === 'mind') return c.ice.solid;
  return c.primary;
}

/** Shows queued celebrations for the signed-in member, one at a time. */
export function CelebrationHost() {
  const session = useApp((s) => s.session);
  const celebrations = useApp((s) => s.celebrations);
  const dismiss = useApp((s) => s.dismissCelebration);
  const current = session?.role === 'member' ? celebrations.find((c) => c.memberId === session.memberId) : undefined;
  if (!current) return null;
  return (
    <CelebrationModal
      key={current.id}
      cel={current}
      onClose={() => dismiss(current.id)}
      onChest={() => {
        dismiss(current.id);
        router.push('/member/rewards');
      }}
    />
  );
}

function Rays({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (!reduced) spin.value = withRepeat(withTiming(360, { duration: 14000, easing: Easing.linear }), -1);
  }, [reduced, spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.rays, style]}>
      {Array.from({ length: 12 }).map((_, i) => (
        <View key={i} style={[styles.ray, { backgroundColor: color, transform: [{ rotate: `${i * 30}deg` }, { translateY: -78 }] }]} />
      ))}
    </Animated.View>
  );
}

function CelebrationModal({ cel, onClose, onChest }: { cel: Celebration; onClose: () => void; onChest: () => void }) {
  const { c, alpha } = useTheme();
  const color = tint(c, cel.kind);
  useEffect(() => {
    if (cel.kind === 'checkin' || cel.kind === 'mind' || cel.kind === 'guest') haptic.success();
    else haptic.reward();
  }, [cel.kind]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: alpha(c.bg, 0.96) }]}>
        <Confetti seed={cel.id} />
        <View style={styles.center}>
          <View style={styles.medalWrap}>
            <Rays color={alpha(color, 0.22)} />
            <PopIn>
              {cel.chest ? (
                <ChestArt size={128} />
              ) : (
                <View style={[styles.medal, { backgroundColor: color, borderColor: alpha(color, 0.35) }]}>
                  <Icon name={ICON[cel.kind]} size={58} color="#FFFFFF" />
                </View>
              )}
            </PopIn>
          </View>
          <PopIn delay={120}>
            <Text variant="display" align="center" style={styles.title}>
              {cel.title}
            </Text>
          </PopIn>
          <PopIn delay={200}>
            <Text tone="soft" align="center" style={styles.body}>
              {cel.body}
            </Text>
          </PopIn>
          {cel.xp ? (
            <PopIn delay={300} style={[styles.xp, { backgroundColor: c.warning.bg }]}>
              <Icon name="flash" size={18} color={c.warning.solid} />
              <CountUp value={cel.xp} duration={900} format={(n) => `+${n} XP`} variant="h3" color={c.warning.fg} />
            </PopIn>
          ) : null}
        </View>
        <View style={styles.actions}>
          {cel.chest ? (
            <>
              <Button title="Open your chest" full onPress={onChest} />
              <Button title="Later" variant="ghost" full onPress={onClose} />
            </>
          ) : (
            <Button title="Continue" full onPress={onClose} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  medalWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  rays: { position: 'absolute', width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 14, height: 60, borderRadius: 7 },
  medal: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', borderWidth: 8 },
  title: { maxWidth: 340 },
  body: { maxWidth: 320 },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginTop: 4 },
  actions: { gap: 6 },
});
