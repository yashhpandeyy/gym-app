import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, IconButton, Input, Screen, SectionHeader, Sheet, Stepper, Text, toast, ToggleRow } from '@/components/ui';
import { DEFAULT_TEST } from '@/data/constants';
import { fmtSeconds, fmtTestTarget, fmtTestValue, parseDuration, testItems, testPrescription } from '@/lib/domain';
import { uid } from '@/lib/format';
import { confirm } from '@/lib/native';
import { useApp, type TestItem, type TestMeasure } from '@/store';
import { useTheme } from '@/theme';

const MEASURES: { key: TestMeasure; label: string; hint: string }[] = [
  { key: 'reps', label: 'Reps', hint: 'Counts reps. With several sets, they add up.' },
  { key: 'kg', label: 'Weight (kg)', hint: 'The weight lifted. The heaviest set counts.' },
  { key: 'cm', label: 'Distance (cm)', hint: 'Like sit and reach. The best attempt counts.' },
  { key: 'time', label: 'Time', hint: 'A stopwatch. Fastest counts, or longest for holds like a plank.' },
];
const CLOCK = [0, 30, 45, 60, 90, 120];
const REST = [0, 15, 30, 60, 90, 120, 180];

type Draft = { item: TestItem; reps: string; seconds: string; target: string };

const blank = (): TestItem => ({ id: uid('tx'), name: '', measure: 'reps', sets: 1, target: 20, better: 'higher', active: true });
const toDraft = (item: TestItem): Draft => ({
  item,
  reps: item.reps ? String(item.reps) : '',
  seconds: item.seconds ? String(item.seconds) : '',
  target: item.measure === 'time' ? fmtTestValue('time', item.target) : String(item.target),
});

/** The owner sets up the gym's strength and endurance test: which exercises, how many sets, the timers and what earns full marks. */
export default function FitnessTestSetup() {
  const { c } = useTheme();
  const settings = useApp((st) => st.settings);
  const updateSettings = useApp((st) => st.updateSettings);
  const items = testItems(settings);
  const custom = Array.isArray(settings.strengthTest);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string>();

  const save = (next: TestItem[]) => updateSettings({ strengthTest: next });
  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + dir, 0, x);
    save(next);
  };

  const edit = (patch: Partial<TestItem>) => setDraft((d) => (d ? { ...d, item: { ...d.item, ...patch } } : d));
  const submit = () => {
    if (!draft) return;
    const it = draft.item;
    const target = it.measure === 'time' ? parseDuration(draft.target) : Number(draft.target.replace(',', '.'));
    const seconds = draft.seconds.trim() ? Number(draft.seconds) : 0;
    const reps = draft.reps.trim() ? Number(draft.reps) : 0;
    if (it.name.trim().length < 2) return setError('Give the exercise a name.');
    if (!target || target <= 0) return setError(it.measure === 'time' ? 'Enter the full-marks time as minutes:seconds, like 14:00.' : 'Enter the result that earns full marks.');
    if (seconds && (seconds < 5 || seconds > 3600)) return setError('The timer can run from 5 seconds to an hour.');
    const clean: TestItem = {
      ...it,
      name: it.name.trim().slice(0, 60),
      how: it.how?.trim() ? it.how.trim().slice(0, 400) : undefined,
      target,
      seconds: seconds || undefined,
      reps: reps || undefined,
      rest: it.sets > 1 && it.rest ? it.rest : undefined,
      perBodyweight: it.measure === 'kg' ? !!it.perBodyweight : undefined,
      better: it.measure === 'time' ? it.better : 'higher',
    };
    save(items.some((x) => x.id === clean.id) ? items.map((x) => (x.id === clean.id ? clean : x)) : [...items, clean]);
    toast.success(`${clean.name} saved.`);
    setDraft(null);
  };

  const d = draft?.item;
  return (
    <Screen header="stack" title="Strength test" subtitle="Members take this test in the app, or you test them at the desk. Every number here is yours to set.">
      <View style={{ gap: 10, marginTop: 8 }}>
        {items.map((i, n) => (
          <Card key={i.id} style={{ gap: 8, opacity: i.active ? 1 : 0.55 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h3">{i.name}</Text>
                <Text variant="small" tone="soft">
                  {testPrescription(i)}
                </Text>
                <Text variant="caption" tone="soft">
                  Full marks: {fmtTestTarget(i)}
                  {i.active ? '' : '. Switched off'}
                </Text>
              </View>
              <IconButton icon="arrow-up" label={`Move ${i.name} up`} size={34} onPress={() => n > 0 && move(n, -1)} />
              <IconButton icon="arrow-down" label={`Move ${i.name} down`} size={34} onPress={() => n < items.length - 1 && move(n, 1)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                title="Edit"
                size="sm"
                variant="soft"
                icon="create-outline"
                onPress={() => {
                  setError(undefined);
                  setDraft(toDraft(i));
                }}
              />
              <Button title={i.active ? 'Switch off' : 'Switch on'} size="sm" variant="outline" onPress={() => save(items.map((x) => (x.id === i.id ? { ...x, active: !x.active } : x)))} />
            </View>
          </Card>
        ))}
      </View>
      <Button
        title="Add an exercise"
        icon="add"
        variant="outline"
        full
        style={{ marginTop: 14 }}
        onPress={() => {
          setError(undefined);
          setDraft(toDraft(blank()));
        }}
      />

      <SectionHeader title="How the score works" />
      <Text variant="small" tone="soft">
        Each exercise scores out of 100: the share of its full-marks result the member reached. The test score is the average. Weight targets can be a multiple of
        bodyweight, so a 50 kg member and a 90 kg member are judged fairly. Members see every score they’ve had, so they can watch it rise.
      </Text>
      {custom ? (
        <Button
          title="Go back to the standard test"
          variant="ghost"
          full
          style={{ marginTop: 14 }}
          onPress={() =>
            confirm({
              title: 'Go back to the standard test?',
              message: `Push-ups, bench press, leg press, sit and reach and a 1 mile walk, with the usual numbers. Your changes are replaced. Past results stay.`,
              confirmText: 'Use the standard test',
              onConfirm: () => {
                updateSettings({ strengthTest: undefined });
                toast.success('Back to the standard test.');
              },
            })
          }
        />
      ) : null}

      <Sheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title={d && items.some((x) => x.id === d.id) ? `Edit ${d.name || 'exercise'}` : 'Add an exercise'}
        footer={
          <>
            {error ? (
              <Text variant="small" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button title="Save" full onPress={submit} />
            {d && items.some((x) => x.id === d.id) ? (
              <Button
                title="Remove from the test"
                variant="ghost"
                full
                onPress={() =>
                  confirm({
                    title: `Remove ${d.name}?`,
                    message: 'Past results keep it. New tests won’t include it.',
                    confirmText: 'Remove',
                    destructive: true,
                    onConfirm: () => {
                      save(items.filter((x) => x.id !== d.id));
                      setDraft(null);
                    },
                  })
                }
              />
            ) : null}
          </>
        }>
        {draft && d ? (
          <View style={{ gap: 14 }}>
            <Input label="Name" value={d.name} onChangeText={(v) => edit({ name: v })} placeholder="Plank hold" maxLength={60} />
            <Input label="How to do it (optional)" value={d.how ?? ''} onChangeText={(v) => edit({ how: v })} multiline placeholder="What good form looks like, and how to count." />

            <View style={{ gap: 8 }}>
              <Text variant="smallStrong" tone="soft">
                What it measures
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MEASURES.map((m) => (
                  <Chip
                    key={m.key}
                    label={m.label}
                    selected={d.measure === m.key}
                    onPress={() => {
                      edit({ measure: m.key, better: m.key === 'time' ? 'lower' : 'higher', perBodyweight: m.key === 'kg' ? d.perBodyweight : undefined });
                      setDraft((cur) => (cur ? { ...cur, target: '' } : cur));
                    }}
                  />
                ))}
              </View>
              <Text variant="caption" tone="soft">
                {MEASURES.find((m) => m.key === d.measure)?.hint}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text variant="label">{d.measure === 'cm' || d.measure === 'time' ? 'Attempts' : 'Sets'}</Text>
              </View>
              <Stepper value={d.sets} min={1} max={10} label="sets" onChange={(v) => edit({ sets: v })} />
            </View>

            {d.measure === 'reps' || d.measure === 'kg' ? (
              <Input
                label="Reps in each set (optional)"
                value={draft.reps}
                onChangeText={(v) => setDraft({ ...draft, reps: v.replace(/\D/g, '').slice(0, 3) })}
                keyboardType="number-pad"
                placeholder={d.measure === 'kg' ? '8' : 'As many as they can'}
                hint={d.measure === 'kg' ? 'They lift for this many reps and note the weight.' : 'Leave empty for as many as they can.'}
              />
            ) : null}

            <View style={{ gap: 8 }}>
              <Text variant="smallStrong" tone="soft">
                Timer for each {d.measure === 'cm' || d.measure === 'time' ? 'attempt' : 'set'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CLOCK.map((sec) => (
                  <Chip key={sec} label={sec ? fmtSeconds(sec) : 'No timer'} selected={(Number(draft.seconds) || 0) === sec} onPress={() => setDraft({ ...draft, seconds: sec ? String(sec) : '' })} />
                ))}
              </View>
              <Input
                value={draft.seconds}
                onChangeText={(v) => setDraft({ ...draft, seconds: v.replace(/\D/g, '').slice(0, 4) })}
                keyboardType="number-pad"
                placeholder="Or type seconds"
                hint={d.measure === 'time' ? 'Timed exercises use a stopwatch. Add a timer only to cap how long it can run.' : 'The timer rings when time is up, like 60 seconds of push-ups.'}
              />
            </View>

            {d.sets > 1 ? (
              <View style={{ gap: 8 }}>
                <Text variant="smallStrong" tone="soft">
                  Rest between sets
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {REST.map((sec) => (
                    <Chip key={sec} label={sec ? fmtSeconds(sec) : 'No rest timer'} selected={(d.rest ?? 0) === sec} onPress={() => edit({ rest: sec || undefined })} />
                  ))}
                </View>
              </View>
            ) : null}

            {d.measure === 'time' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Faster is better" selected={d.better === 'lower'} onPress={() => edit({ better: 'lower' })} />
                <Chip label="Longer is better" selected={d.better === 'higher'} onPress={() => edit({ better: 'higher' })} />
              </View>
            ) : null}

            {d.measure === 'kg' ? (
              <ToggleRow
                title="Target as a multiple of bodyweight"
                subtitle="Fairer for lighter and heavier members. 1 means their own bodyweight."
                value={!!d.perBodyweight}
                onChange={(v) => edit({ perBodyweight: v })}
              />
            ) : null}

            <Input
              label={
                d.measure === 'time'
                  ? d.better === 'lower'
                    ? 'Full marks at or under (min:sec)'
                    : 'Full marks at or over (min:sec)'
                  : d.measure === 'kg' && d.perBodyweight
                    ? 'Full marks at (× bodyweight)'
                    : `Full marks at (${d.measure === 'reps' ? (d.sets > 1 ? 'reps, all sets added up' : 'reps') : d.measure})`
              }
              value={draft.target}
              onChangeText={(v) => setDraft({ ...draft, target: v.replace(d.measure === 'time' ? /[^\d:.]/g : /[^\d.,]/g, '').slice(0, 7) })}
              keyboardType={d.measure === 'time' ? 'numbers-and-punctuation' : 'decimal-pad'}
              placeholder={d.measure === 'time' ? '14:00' : d.measure === 'kg' && d.perBodyweight ? '0.75' : '40'}
              hint="Reaching this scores 100 for the exercise. Half of it scores 50."
            />
            <Text variant="caption" tone="soft" style={{ color: c.inkFaint }}>
              Standard test numbers: {DEFAULT_TEST.map((x) => `${x.name} ${fmtTestTarget(x)}`).join('; ')}.
            </Text>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
