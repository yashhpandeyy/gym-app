import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { XPBar } from '@/components/fun/Motion';
import { Button, Empty, Screen, Text } from '@/components/ui';
import { MIND_PROGRAMS } from '@/data/mind';
import { haptic } from '@/lib/native';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const SIZE = 260;

export default function Breathe() {
  const { c, alpha } = useTheme();
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const program = MIND_PROGRAMS.find((p) => p.id === id);
  const completeMind = useApp((st) => st.completeMind);
  const reduced = useReducedMotion();
  const [state, setState] = useState<'ready' | 'running' | 'paused'>('ready');
  const [elapsed, setElapsed] = useState(0);
  const scale = useSharedValue(0.55);

  const total = (program?.minutes ?? 1) * 60_000;
  const cycle = (program?.pattern ?? []).reduce((sum, p) => sum + p.seconds, 0) * 1000 || 1;
  const inCycle = elapsed % cycle;
  const cycleIndex = Math.floor(elapsed / cycle);
  let acc = 0;
  let phaseIndex = 0;
  for (let i = 0; i < (program?.pattern.length ?? 0); i++) {
    if (inCycle < acc + program!.pattern[i].seconds * 1000) {
      phaseIndex = i;
      break;
    }
    acc += program!.pattern[i].seconds * 1000;
  }
  const phase = program?.pattern[phaseIndex];
  const phaseLeftMs = phase ? acc + phase.seconds * 1000 - inCycle : 0;
  const phaseKey = `${cycleIndex}-${phaseIndex}`;

  // Clock. Finishing happens inside the timer so the session ends exactly once.
  const elapsedRef = useRef(0);
  useEffect(() => {
    if (state !== 'running' || !program) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const n = Date.now();
      elapsedRef.current = Math.min(total, elapsedRef.current + (n - last));
      last = n;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= total) {
        clearInterval(timer);
        setState('paused');
        completeMind(program.id, program.minutes, program.title);
        router.back();
      }
    }, 100);
    return () => clearInterval(timer);
  }, [state, total, program, completeMind]);

  // Breathe the circle in time with each phase, with a soft tap so it works with eyes closed.
  useEffect(() => {
    if (state !== 'running' || !phase) return;
    haptic.tap();
    scale.value = withTiming(phase.scale, { duration: reduced ? 0 : phaseLeftMs, easing: Easing.inOut(Easing.sin) });
    // phaseLeftMs is read only when the phase starts or resumes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey, state]);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + scale.value * 0.55 }], opacity: 0.25 + (scale.value - 0.55) }));

  if (!program) {
    return (
      <Screen header="modal" title="Breathe">
        <Empty icon="leaf-outline" title="Session not found" />
      </Screen>
    );
  }

  const end = () => {
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes >= 1) completeMind(program.id, minutes, program.title);
    router.back();
  };

  const left = Math.ceil((total - elapsed) / 1000);
  return (
    <Screen header="modal" title={program.title} scroll={false}>
      <View style={s.stage}>
        <Text variant="small" tone="soft" align="center" style={{ maxWidth: 320 }}>
          {state === 'ready' ? program.about : program.cues[cycleIndex % program.cues.length]}
        </Text>
        <View style={s.circleWrap}>
          <Animated.View style={[s.circle, { backgroundColor: alpha(c.ice.solid, 0.18) }, halo]} />
          <Animated.View style={[s.circle, { backgroundColor: c.ice.solid }, circle]} />
          <View style={s.label} pointerEvents="none">
            <Text variant="h2" color="#FFFFFF" align="center">
              {state === 'ready' ? 'Ready' : phase?.label}
            </Text>
            {state !== 'ready' ? (
              <Text variant="display" color="#FFFFFF" align="center">
                {Math.ceil(phaseLeftMs / 1000)}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ alignSelf: 'stretch', gap: 6 }}>
          <XPBar progress={elapsed / total} color={c.ice.solid} height={8} />
          <Text variant="caption" tone="soft" align="center">
            {state === 'ready' ? `${program.minutes} minutes` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`}
          </Text>
        </View>
      </View>
      <View style={s.actions}>
        {state === 'running' ? (
          <Button title="Pause" variant="outline" full onPress={() => setState('paused')} />
        ) : (
          <Button title={state === 'ready' ? 'Start' : 'Resume'} full onPress={() => setState('running')} />
        )}
        {state !== 'ready' ? <Button title="End session" variant="ghost" full onPress={end} /> : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  circleWrap: { width: SIZE * 1.3, height: SIZE * 1.3, alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  label: { alignItems: 'center', gap: 2 },
  actions: { gap: 6, paddingBottom: 24 },
}));
