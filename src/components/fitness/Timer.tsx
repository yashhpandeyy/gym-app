import { useEffect, useRef, useState } from 'react';
import { Platform, Vibration, View } from 'react-native';

import { Button, Ring, Text } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { useTheme } from '@/theme';

/** Bell and a long buzz, loud enough to hear across the gym floor. Rings even with app sounds switched off. */
export function ringBell() {
  playSound('bell', { force: true });
  if (Platform.OS !== 'web') Vibration.vibrate([0, 450, 180, 450, 180, 700]);
}

const clock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Counts down from `seconds` and rings when it reaches zero. A three-second "get ready" runs first
 * for work sets, so the person can get into position. Timing comes from the clock, not from
 * counting ticks, so it stays right if the phone stutters or the screen goes off.
 */
export function Countdown({
  seconds,
  label,
  tone = 'work',
  autoStart,
  onDone,
  onSkip,
}: {
  seconds: number;
  label: string;
  tone?: 'work' | 'rest';
  autoStart?: boolean;
  onDone?: () => void;
  onSkip?: () => void;
}) {
  const { c } = useTheme();
  const total = seconds * 1000;
  // A rest timer that starts by itself is running from its first render.
  const [mountedAt] = useState(() => Date.now());
  const [phase, setPhase] = useState<'idle' | 'ready' | 'running' | 'paused' | 'done'>(autoStart ? 'running' : 'idle');
  const [left, setLeft] = useState(total);
  const [readyLeft, setReadyLeft] = useState(3);
  const endsAt = useRef(autoStart ? mountedAt + total : 0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  const start = (skipReady = tone === 'rest') => {
    if (skipReady) {
      endsAt.current = Date.now() + left;
      setPhase('running');
    } else {
      setReadyLeft(3);
      endsAt.current = Date.now() + 3000;
      setPhase('ready');
    }
  };

  useEffect(() => {
    if (phase !== 'ready' && phase !== 'running') return;
    const id = setInterval(() => {
      const rem = endsAt.current - Date.now();
      if (phase === 'ready') {
        const n = Math.ceil(rem / 1000);
        if (n !== readyLeft && n > 0) {
          setReadyLeft(n);
          playSound('pop', { force: true });
        }
        if (rem <= 0) {
          playSound('warn', { force: true });
          endsAt.current = Date.now() + total;
          setLeft(total);
          setPhase('running');
        }
        return;
      }
      if (rem <= 0) {
        setLeft(0);
        setPhase('done');
        ringBell();
        done.current?.();
      } else setLeft(rem);
    }, 100);
    return () => clearInterval(id);
  }, [phase, readyLeft, total]);

  const color = tone === 'rest' ? c.ice.solid : phase === 'done' ? c.success.solid : c.primary;
  const big = phase === 'ready' ? String(readyLeft) : clock(left);
  const caption = phase === 'ready' ? 'Get ready' : phase === 'done' ? (tone === 'rest' ? 'Rest over' : 'Time!') : label;

  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <Ring size={190} stroke={14} value={phase === 'ready' ? 1 : left / total} color={color}>
        <Text variant="display" accessibilityRole="timer" accessibilityLiveRegion="polite">
          {big}
        </Text>
        <Text variant="smallStrong" tone="soft">
          {caption}
        </Text>
      </Ring>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {phase === 'idle' ? <Button title={tone === 'rest' ? 'Start rest' : 'Start'} icon="play" onPress={() => start()} /> : null}
        {phase === 'running' ? (
          <Button
            title="Pause"
            icon="pause"
            variant="outline"
            onPress={() => {
              setLeft(endsAt.current - Date.now());
              setPhase('paused');
            }}
          />
        ) : null}
        {phase === 'paused' ? <Button title="Resume" icon="play" onPress={() => start(true)} /> : null}
        {phase === 'paused' || phase === 'done' ? (
          <Button
            title="Reset"
            icon="refresh"
            variant="ghost"
            onPress={() => {
              setLeft(total);
              setPhase('idle');
            }}
          />
        ) : null}
        {onSkip && phase !== 'done' ? <Button title={tone === 'rest' ? 'Skip rest' : 'Skip timer'} variant="ghost" onPress={onSkip} /> : null}
      </View>
    </View>
  );
}

/** Counts up. "Use this time" hands the seconds back, for timed efforts like a walk or a plank. */
export function Stopwatch({ onUse }: { onUse: (seconds: number) => void }) {
  const { c } = useTheme();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const before = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(before.current + Date.now() - startedAt.current), 200);
    return () => clearInterval(id);
  }, [running]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <Ring size={190} stroke={14} value={(elapsed % 60_000) / 60_000} color={running ? c.primary : c.lineStrong}>
        <Text variant="display" accessibilityRole="timer">
          {fmt(elapsed)}
        </Text>
        <Text variant="smallStrong" tone="soft">
          {running ? 'Going' : elapsed ? 'Stopped' : 'Stopwatch'}
        </Text>
      </Ring>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {!running ? (
          <Button
            title={elapsed ? 'Resume' : 'Start'}
            icon="play"
            onPress={() => {
              startedAt.current = Date.now();
              before.current = elapsed;
              setRunning(true);
              playSound('warn', { force: true });
            }}
          />
        ) : (
          <Button
            title="Stop"
            icon="stop"
            onPress={() => {
              const total = before.current + Date.now() - startedAt.current;
              setElapsed(total);
              setRunning(false);
              ringBell();
            }}
          />
        )}
        {!running && elapsed >= 1000 ? (
          <>
            <Button title="Use this time" icon="checkmark" variant="soft" onPress={() => onUse(Math.round(elapsed / 1000))} />
            <Button
              title="Reset"
              variant="ghost"
              onPress={() => {
                setElapsed(0);
                before.current = 0;
              }}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}
