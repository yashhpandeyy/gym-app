import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Icon, Input, ProgressBar, Text, toast } from '@/components/ui';
import { today } from '@/lib/date';
import { fmtTestTarget, fmtTestValue, parseDuration, scoreTest, testHistory, testItems, testPrescription, testTarget, testValue } from '@/lib/domain';
import { useScreenAwake } from '@/lib/keepAwake';
import { haptic } from '@/lib/native';
import { useApp, type TestItem, type TestResult } from '@/store';
import { makeStyles, useTheme } from '@/theme';

import { Countdown, Stopwatch } from './Timer';
import { ScoreHero, ScoreLines } from './TestSummary';

type Step = { kind: 'weigh' } | { kind: 'list' } | { kind: 'item'; id: string } | { kind: 'result'; result: TestResult; previous?: TestResult };

const UNIT: Record<TestItem['measure'], string> = { reps: 'reps', kg: 'kg', cm: 'cm', time: 'min:sec' };

const toNumber = (item: TestItem, raw: string) => {
  if (!raw.trim()) return 0;
  if (item.measure === 'time') return parseDuration(raw) ?? 0;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Walks a member through the gym's strength and endurance test: their weight, then each exercise
 * with its timer and sets, then the score. Used by members on their own phone and by staff
 * testing a member at the gym (`by` is the staff member's name).
 */
export function TestRunner({ memberId, by, onClose }: { memberId: string; by?: string; onClose: () => void }) {
  // The screen stays on through timed sets.
  useScreenAwake('strength-test');
  const { c } = useTheme();
  const s = useStyles();
  const settings = useApp((st) => st.settings);
  const progress = useApp((st) => st.progress);
  const results = useApp((st) => st.testResults);
  const saveTestResult = useApp((st) => st.saveTestResult);
  const items = testItems(settings).filter((i) => i.active);
  const needsWeight = items.some((i) => i.measure === 'kg' && i.perBodyweight);
  const lastWeight = (progress[memberId] ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : 1)).pop()?.weight;

  const [step, setStep] = useState<Step>({ kind: 'weigh' });
  const [weight, setWeight] = useState(lastWeight ? String(lastWeight) : '');
  const [sets, setSets] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<Record<string, 'done' | 'skipped'>>({});
  const [restDone, setRestDone] = useState<Record<string, number>>({});
  const bw = Number(weight.replace(',', '.')) || undefined;

  const finished = items.filter((i) => status[i.id]).length;
  const allDone = items.length > 0 && finished === items.length;

  const finish = () => {
    const numbers: Record<string, number[]> = {};
    for (const i of items) if (status[i.id] === 'done') numbers[i.id] = (sets[i.id] ?? []).map((v) => toNumber(i, v));
    const { lines, score } = scoreTest(items, numbers, bw);
    if (!lines.length) return toast.error('Finish at least one exercise to get a score.');
    const previous = testHistory(results, memberId).pop();
    const result = saveTestResult({
      memberId,
      date: today(),
      score,
      bodyweight: bw,
      lines,
      skipped: items.filter((i) => status[i.id] !== 'done').map((i) => i.name),
      ...(by ? { by } : {}),
    });
    haptic.reward();
    setStep({ kind: 'result', result, previous });
  };

  if (!items.length) {
    return (
      <Card style={{ gap: 8 }}>
        <Text variant="h3">No exercises in the test</Text>
        <Text variant="small" tone="soft">
          The gym has switched every exercise off. Ask at the desk.
        </Text>
        <Button title="Back" variant="outline" onPress={onClose} />
      </Card>
    );
  }

  // ---- 1. Weight -------------------------------------------------------------------------------
  if (step.kind === 'weigh') {
    return (
      <View style={{ gap: 16 }}>
        <Text tone="soft">
          {items.length} exercises, about {Math.max(10, Math.round(items.reduce((sum, i) => sum + i.sets * ((i.seconds ?? 45) + (i.rest ?? 0)), 0) / 60) + (items.some((i) => i.measure === 'time') ? 15 : 0))} minutes. Warm up for five minutes before you start.
        </Text>
        <Input
          label={needsWeight ? 'Bodyweight today' : 'Bodyweight today (optional)'}
          prefix="kg"
          value={weight}
          onChangeText={(v) => setWeight(v.replace(/[^\d.,]/g, '').slice(0, 5))}
          keyboardType="decimal-pad"
          hint={needsWeight ? 'Weight targets are set against bodyweight, so a lighter person needs less to score full marks.' : 'Kept with the result so you can compare later.'}
        />
        <Card variant="soft" style={{ gap: 10 }}>
          {items.map((i, n) => (
            <View key={i.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Text variant="label" tone="primary" style={{ width: 18 }}>
                {n + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="label">{i.name}</Text>
                <Text variant="caption" tone="soft">
                  {testPrescription(i)}
                </Text>
              </View>
            </View>
          ))}
        </Card>
        <Button
          title="Start the test"
          icon="play"
          full
          disabled={needsWeight && !(bw && bw >= 25 && bw <= 300)}
          onPress={() => {
            haptic.tap();
            setStep({ kind: 'list' });
          }}
        />
      </View>
    );
  }

  // ---- 4. Score --------------------------------------------------------------------------------
  if (step.kind === 'result') {
    return (
      <View style={{ gap: 14 }}>
        <ScoreHero result={step.result} previous={step.previous} animate />
        <ScoreLines result={step.result} previous={step.previous} />
        <Text variant="small" tone="soft" align="center">
          Saved. Take the test again in four to six weeks and watch the score climb.
        </Text>
        <Button title="Done" full onPress={onClose} />
      </View>
    );
  }

  // ---- 3. One exercise ----------------------------------------------------------------------------
  if (step.kind === 'item') {
    const item = items.find((i) => i.id === step.id)!;
    const raw = sets[item.id] ?? Array.from({ length: item.sets }, () => '');
    const values = raw.map((v) => toNumber(item, v));
    const current = values.findIndex((v) => v <= 0);
    const target = testTarget(item, bw);
    const value = testValue(item, values);
    const setValue = (i: number, v: string) => setSets((cur) => ({ ...cur, [item.id]: raw.map((x, k) => (k === i ? v : x)) }));
    const resting = current > 0 && !!item.rest && (restDone[item.id] ?? 0) < current;
    const attempts = item.measure === 'cm' || item.measure === 'time';
    const setName = (i: number) => (item.sets === 1 ? (attempts ? 'Your result' : 'Your set') : `${attempts ? 'Attempt' : 'Set'} ${i + 1}`);

    return (
      <View style={{ gap: 16 }}>
        <View style={{ gap: 4 }}>
          <Text variant="title">{item.name}</Text>
          <Text variant="label" tone="primary">
            {testPrescription(item)}
          </Text>
          {item.how ? (
            <Text variant="small" tone="soft">
              {item.how}
            </Text>
          ) : null}
          <Text variant="caption" tone="soft">
            Full marks: {item.measure === 'kg' && item.perBodyweight ? `${fmtTestValue('kg', target)} (${fmtTestTarget(item)})` : fmtTestTarget(item)}
            {item.measure === 'reps' && item.sets > 1 ? ', all sets added up' : item.sets > 1 ? ', best one counts' : ''}
          </Text>
        </View>

        {current >= 0 ? (
          <Card style={{ paddingVertical: 20 }}>
            {resting ? (
              <Countdown
                key={`rest-${current}`}
                seconds={item.rest!}
                label={`Rest before ${setName(current).toLowerCase()}`}
                tone="rest"
                autoStart
                onDone={() => setRestDone((cur) => ({ ...cur, [item.id]: current }))}
                onSkip={() => setRestDone((cur) => ({ ...cur, [item.id]: current }))}
              />
            ) : item.seconds ? (
              <Countdown key={`work-${current}`} seconds={item.seconds} label={setName(current)} />
            ) : item.measure === 'time' ? (
              <Stopwatch key={`watch-${current}`} onUse={(sec) => setValue(current, fmtTestValue('time', sec))} />
            ) : (
              <Text variant="small" tone="soft" align="center">
                {item.reps ? `Do ${item.reps} reps, then` : 'When you’re done,'} enter {item.measure === 'kg' ? 'the weight you used' : item.measure === 'cm' ? 'how far you reached' : 'how many you did'} below.
              </Text>
            )}
          </Card>
        ) : (
          <Card variant="soft" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="checkmark-circle" size={22} color={c.success.solid} />
            <Text variant="label" style={{ flex: 1 }}>
              All {item.sets === 1 ? 'done' : `${item.sets} ${attempts ? 'attempts' : 'sets'} done`}. {fmtTestValue(item.measure, value)}.
            </Text>
          </Card>
        )}

        <View style={{ gap: 10 }}>
          {raw.map((v, i) => (
            <View key={i} style={s.setRow}>
              <Text variant="label" tone={i === current ? 'primary' : 'soft'} style={{ width: 92 }}>
                {setName(i)}
              </Text>
              <View style={{ flex: 1 }}>
                <Input
                  value={v}
                  onChangeText={(x) => setValue(i, item.measure === 'time' ? x.replace(/[^\d:.]/g, '').slice(0, 6) : x.replace(/[^\d.,]/g, '').slice(0, 6))}
                  keyboardType={item.measure === 'time' ? 'numbers-and-punctuation' : item.measure === 'reps' ? 'number-pad' : 'decimal-pad'}
                  placeholder={item.measure === 'time' ? '14:30' : item.reps && item.measure === 'kg' ? `kg for ${item.reps} reps` : UNIT[item.measure]}
                  error={v.trim() && toNumber(item, v) <= 0 ? (item.measure === 'time' ? 'Use minutes:seconds, like 14:30' : 'Enter a number') : undefined}
                />
              </View>
              <Text variant="small" tone="soft" style={{ width: 52 }}>
                {UNIT[item.measure]}
              </Text>
            </View>
          ))}
        </View>

        <Button
          title={value > 0 ? `Done, ${fmtTestValue(item.measure, value)}` : 'Enter a result first'}
          full
          disabled={!(value > 0)}
          onPress={() => {
            haptic.success();
            setStatus((cur) => ({ ...cur, [item.id]: 'done' }));
            setStep({ kind: 'list' });
          }}
        />
        <Button
          title="Skip this exercise"
          variant="ghost"
          full
          onPress={() => {
            setStatus((cur) => ({ ...cur, [item.id]: 'skipped' }));
            setStep({ kind: 'list' });
          }}
        />
        <Button title="Back to the list" variant="ghost" full onPress={() => setStep({ kind: 'list' })} />
      </View>
    );
  }

  // ---- 2. The checklist ---------------------------------------------------------------------------
  const next = items.find((i) => !status[i.id]);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 8 }}>
        <Text variant="label">
          {finished} of {items.length} done
        </Text>
        <ProgressBar value={finished / items.length} />
      </View>
      {items.map((i) => {
        const st = status[i.id];
        const vals = (sets[i.id] ?? []).map((v) => toNumber(i, v));
        return (
          <Pressable
            key={i.id}
            accessibilityRole="button"
            accessibilityState={{ checked: st === 'done' }}
            onPress={() => {
              haptic.tap();
              setStep({ kind: 'item', id: i.id });
            }}
            style={({ pressed }) => [s.check, { borderColor: st === 'done' ? c.success.solid : c.line, opacity: pressed ? 0.7 : 1 }]}>
            <View style={[s.box, st === 'done' ? { backgroundColor: c.success.solid, borderColor: c.success.solid } : st === 'skipped' ? { borderColor: c.inkFaint } : { borderColor: c.lineStrong }]}>
              {st === 'done' ? <Icon name="checkmark" size={16} color="#FFFFFF" /> : st === 'skipped' ? <Icon name="remove" size={16} tone="faint" /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" style={st === 'skipped' ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>
                {i.name}
              </Text>
              <Text variant="caption" tone="soft">
                {st === 'done' ? fmtTestValue(i.measure, testValue(i, vals)) : st === 'skipped' ? 'Skipped. Tap to do it after all' : testPrescription(i)}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} tone="faint" />
          </Pressable>
        );
      })}
      {allDone ? (
        <Button title="See my score" icon="trophy-outline" full onPress={finish} />
      ) : next ? (
        <Button title={finished ? `Next: ${next.name}` : `Begin with ${next.name}`} icon="arrow-forward" full onPress={() => setStep({ kind: 'item', id: next.id })} />
      ) : null}
      {finished > 0 && !allDone ? <Button title="Finish now and score what’s done" variant="ghost" full onPress={finish} /> : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: t.radius.md, borderWidth: 1.5, backgroundColor: t.c.surface },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
}));
