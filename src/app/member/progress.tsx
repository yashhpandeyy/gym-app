import { useState } from 'react';
import { View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { Button, Card, Empty, Fact, Group, Input, Row, Screen, SectionHeader, Sheet, Text, toast } from '@/components/ui';
import { fmtDate, fmtDay, today } from '@/lib/date';
import { confirm } from '@/lib/native';
import { useApp, useMe } from '@/store';
import { makeStyles } from '@/theme';

function delta(n: number, unit: string) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(1)} ${unit}`;
}

export default function Progress() {
  const s = useStyles();
  const me = useMe();
  const progress = useApp((st) => st.progress);
  const addProgress = useApp((st) => st.addProgress);
  const deleteProgress = useApp((st) => st.deleteProgress);
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [fat, setFat] = useState('');
  const [waist, setWaist] = useState('');
  if (!me) return null;

  const entries = progress[me.id] ?? [];
  const first = entries[0];
  const last = entries[entries.length - 1];
  const recent = entries.slice(-12);

  const save = () => {
    const w = parseFloat(weight.replace(',', '.'));
    if (!w || w < 25 || w > 300) {
      toast.error('Enter your weight in kg, for example 72.5.');
      return;
    }
    const bf = parseFloat(fat.replace(',', '.'));
    const wa = parseFloat(waist.replace(',', '.'));
    addProgress({ date: today(), weight: w, bodyFat: bf || undefined, waist: wa || undefined });
    setOpen(false);
    setWeight('');
    setFat('');
    setWaist('');
    toast.success('Logged. Keep going.');
  };

  return (
    <Screen
      header="stack"
      title="Progress"
      footer={<Button title="Log today’s numbers" icon="add" full onPress={() => setOpen(true)} />}>
      {last && first ? (
        <>
          <Card style={{ gap: 14 }}>
            <View style={s.top}>
              <View>
                <Text variant="small" tone="soft">
                  Weight on {fmtDay(last.date)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text variant="display">{last.weight.toFixed(1)}</Text>
                  <Text variant="h3" tone="soft">
                    kg
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text variant="label" tone={last.weight <= first.weight ? 'success' : 'warning'}>
                  {delta(last.weight - first.weight, 'kg')}
                </Text>
                <Text variant="caption" tone="soft">
                  since {fmtDay(first.date)}
                </Text>
              </View>
            </View>
            <LineChart values={recent.map((e) => e.weight)} goal={me.goalWeight} />
            {me.goalWeight ? (
              <Text variant="caption" tone="soft">
                Dashed line is your goal of {me.goalWeight} kg.{' '}
                {last.weight > me.goalWeight ? `${(last.weight - me.goalWeight).toFixed(1)} kg to go.` : 'You’ve reached it.'}
              </Text>
            ) : null}
          </Card>

          <Card style={s.facts}>
            <Fact
              label="Body fat"
              value={last.bodyFat ? `${last.bodyFat.toFixed(1)}%` : '–'}
            />
            <Fact
              label="Change"
              value={last.bodyFat && first.bodyFat ? delta(last.bodyFat - first.bodyFat, '%') : '–'}
              tone={last.bodyFat && first.bodyFat && last.bodyFat < first.bodyFat ? 'success' : 'ink'}
            />
            <Fact label="Waist" value={last.waist ? `${last.waist.toFixed(1)} cm` : '–'} />
            <Fact
              label="Change"
              value={last.waist && first.waist ? delta(last.waist - first.waist, 'cm') : '–'}
              tone={last.waist && first.waist && last.waist < first.waist ? 'success' : 'ink'}
            />
          </Card>

          <SectionHeader title="History" hint="Tap an entry to remove it." />
          <Group inset={16}>
            {[...entries].reverse().map((e) => (
              <Row
                key={e.id}
                title={`${e.weight.toFixed(1)} kg`}
                subtitle={[e.bodyFat ? `${e.bodyFat}% body fat` : null, e.waist ? `${e.waist} cm waist` : null].filter(Boolean).join(', ') || undefined}
                value={fmtDate(e.date)}
                chevron={false}
                onPress={() =>
                  confirm({
                    title: 'Remove this entry?',
                    message: `${e.weight} kg on ${fmtDate(e.date)}`,
                    confirmText: 'Remove',
                    destructive: true,
                    onConfirm: () => deleteProgress(e.id),
                  })
                }
              />
            ))}
          </Group>
        </>
      ) : (
        <Empty icon="trending-down-outline" title="Start tracking" body="Log your weight once a week, same time of day, and you’ll see the trend here." />
      )}

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Log today"
        subtitle="Weigh in the morning before breakfast for the most consistent numbers."
        footer={<Button title="Save" full onPress={save} />}>
        <Input label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="72.5" autoFocus />
        <Input label="Body fat % (optional)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="From the scanner at the desk" />
        <Input label="Waist in cm (optional)" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" placeholder="Measure at the belly button" />
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  facts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
}));
