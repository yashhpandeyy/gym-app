import { useState } from 'react';
import { View } from 'react-native';

import { Button, Pill, Sheet, Stepper, Text, toast } from '@/components/ui';
import { e1rm, isPR, lastSet, round1 } from '@/lib/game';
import { useApp, useMe, type LiftKey } from '@/store';

import { PopIn } from './Motion';

/** Log weight × reps. Shows the estimated max as you adjust, and flags a PR before you save. */
export function LogSetSheet({
  visible,
  onClose,
  exercise,
  exerciseId,
  liftKey,
}: {
  visible: boolean;
  onClose: () => void;
  exercise: string;
  exerciseId?: string;
  liftKey?: LiftKey;
}) {
  const me = useMe();
  const lifts = useApp((s) => s.lifts);
  const logLift = useApp((s) => s.logLift);
  const last = me ? lastSet(lifts, me.id, exercise) : undefined;
  const [weight, setWeight] = useState(last?.weight ?? 20);
  const [reps, setReps] = useState(last?.reps ?? 8);
  if (!me) return null;

  const mine = lifts.filter((l) => l.memberId === me.id && l.exercise === exercise);
  const best = mine.length ? Math.max(...mine.map((l) => e1rm(l.weight, l.reps))) : 0;
  const est = round1(e1rm(weight, reps));
  const pr = isPR(lifts, me.id, exercise, weight, reps);

  const save = () => {
    const r = logLift({ exercise, exerciseId, liftKey, weight, reps });
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    if (r.message) toast.success(r.message);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={exercise}
      subtitle={last ? `Last time ${last.weight} kg × ${last.reps}. Best estimated max ${round1(best)} kg.` : 'First time logging this lift.'}
      footer={<Button title={pr ? 'Save new PR' : 'Save set'} full variant={pr ? 'success' : 'primary'} onPress={save} />}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text variant="smallStrong" tone="soft">
            Weight (kg)
          </Text>
          <Stepper value={weight} onChange={setWeight} min={0} max={400} step={2.5} label="weight" format={(v) => (v % 1 ? v.toFixed(1) : String(v))} />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Text variant="smallStrong" tone="soft">
            Reps
          </Text>
          <Stepper value={reps} onChange={setReps} min={1} max={30} label="reps" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <View>
          <Text variant="caption" tone="soft">
            Estimated one-rep max
          </Text>
          <Text variant="h2">{est} kg</Text>
        </View>
        {pr ? (
          <PopIn key={`${weight}-${reps}`}>
            <Pill label={`New PR, +${round1(est - best)} kg`} tone="success" solid icon="trophy" style={{ height: 30, paddingHorizontal: 12 }} />
          </PopIn>
        ) : null}
      </View>
    </Sheet>
  );
}
