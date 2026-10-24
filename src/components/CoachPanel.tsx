import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Group, IconButton, Input, Row, SectionHeader, Sheet, Text, toast } from '@/components/ui';
import { DIET_TEMPLATES } from '@/data/diet';
import { WORKOUT_TEMPLATES } from '@/data/workouts';
import { fmtDay } from '@/lib/date';
import { bestLifts, bodyweightOn, levelFor, strengthScore, tierFor, xpTotal } from '@/lib/game';
import { confirm } from '@/lib/native';
import { useApp, type DoseTime, type Member } from '@/store';
import { useTheme } from '@/theme';

const TIMES: DoseTime[] = ['Morning', 'Before workout', 'After workout', 'With lunch', 'Evening', 'Night'];

/** What a coach manages for one member: their diet plan, suggested supplements and a read on progress. */
export function CoachPanel({ member }: { member: Member }) {
  const { brand } = useTheme();
  const plans = useApp((s) => s.dietPlans);
  const workouts = useApp((s) => s.workouts);
  const assignWorkout = useApp((s) => s.assignWorkout);
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const supplements = useApp((s) => s.supplements);
  const xp = useApp((s) => s.xp);
  const lifts = useApp((s) => s.lifts);
  const progress = useApp((s) => s.progress);
  const assignDiet = useApp((s) => s.assignDiet);
  const addSupplement = useApp((s) => s.addSupplement);
  const removeSupplement = useApp((s) => s.removeSupplement);
  const [dietOpen, setDietOpen] = useState(false);
  const [suppOpen, setSuppOpen] = useState(false);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState<DoseTime>('After workout');

  const plan = plans[member.id];
  const workout = workouts[member.id];
  // Staff only ever see supplements. Medicines a member adds stay private to them.
  const suggested = (supplements[member.id] ?? []).filter((i) => i.kind === 'supplement');
  const total = xpTotal(xp, member.id);
  const score = strengthScore(bestLifts(lifts, member.id), bodyweightOn(progress[member.id], '9999-12-31'));

  return (
    <>
      {brand.features.gamification ? (
        <>
          <SectionHeader title="Progress" />
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text variant="caption" tone="soft">
                Level
              </Text>
              <Text variant="h3">{levelFor(total).level}</Text>
            </View>
            <View>
              <Text variant="caption" tone="soft">
                XP
              </Text>
              <Text variant="h3">{total}</Text>
            </View>
            <View>
              <Text variant="caption" tone="soft">
                Strength score
              </Text>
              <Text variant="h3">{score ? `${score}, ${tierFor(score).name}` : 'No lifts logged'}</Text>
            </View>
          </Card>
        </>
      ) : null}

      {brand.features.workouts ? (
        <>
          <SectionHeader title="Workout plan" />
          <Group inset={16}>
            <Row
              title={workout ? workout.title : 'No workout plan'}
              subtitle={workout ? `Updated ${fmtDay(workout.updatedOn)}, ${workout.days.length} sessions` : 'Assign one from a template'}
              value={workout ? 'Change' : 'Assign'}
              valueTone="primary"
              onPress={() => setWorkoutOpen(true)}
            />
          </Group>
        </>
      ) : null}

      {brand.features.nutrition ? (
        <>
          <SectionHeader title="Diet and supplements" hint="Medicines the member adds are private and never shown here." />
          <Group inset={16}>
            <Row
              title={plan ? plan.title : 'No diet plan'}
              subtitle={plan ? `Updated ${fmtDay(plan.updatedOn)}, ${plan.protein} g protein a day` : 'Assign one from a template'}
              value={plan ? 'Change' : 'Assign'}
              valueTone="primary"
              onPress={() => setDietOpen(true)}
            />
            {suggested.map((i) => (
              <Row
                key={i.id}
                title={i.name}
                subtitle={`${i.dose}, ${i.time.toLowerCase()}`}
                chevron={false}
                right={
                  <IconButton
                    icon="trash-outline"
                    label={`Remove ${i.name}`}
                    size={34}
                    variant="plain"
                    onPress={() =>
                      confirm({
                        title: `Remove ${i.name}?`,
                        confirmText: 'Remove',
                        destructive: true,
                        onConfirm: () => removeSupplement(i.id, member.id),
                      })
                    }
                  />
                }
              />
            ))}
            <Row icon="add" title="Suggest a supplement" onPress={() => setSuppOpen(true)} chevron={false} />
          </Group>
        </>
      ) : null}

      <Sheet visible={workoutOpen} onClose={() => setWorkoutOpen(false)} title="Workout plan" subtitle="Pick a starting point. The member sees it straight away and gets a notification.">
        {WORKOUT_TEMPLATES.map((t) => (
          <Card key={t.id} variant={workout?.title === t.title ? 'soft' : 'inset'} style={{ gap: 6 }}>
            <Text variant="h3">{t.label}</Text>
            <Text variant="small" tone="soft">
              {t.title}, {t.days.length} sessions: {t.days.map((d) => d.name).join(', ')}.
            </Text>
            <Button
              title={workout?.title === t.title ? 'Assigned' : 'Assign this plan'}
              size="sm"
              disabled={workout?.title === t.title}
              onPress={() => {
                assignWorkout(member.id, t.id);
                toast.success(`${t.title} assigned.`);
                setWorkoutOpen(false);
              }}
            />
          </Card>
        ))}
      </Sheet>

      <Sheet visible={dietOpen} onClose={() => setDietOpen(false)} title="Diet plan" subtitle="Pick a starting point. The member sees it straight away and gets a notification.">
        {DIET_TEMPLATES.map((t) => (
          <Card key={t.id} variant={plan?.title === t.title ? 'soft' : 'inset'} style={{ gap: 6 }}>
            <Text variant="h3">{t.label}</Text>
            <Text variant="small" tone="soft">
              {t.title}. {t.goal}
            </Text>
            <Button
              title={plan?.title === t.title ? 'Assigned' : 'Assign this plan'}
              size="sm"
              disabled={plan?.title === t.title}
              onPress={() => {
                assignDiet(member.id, t.id);
                toast.success(`${t.title} assigned.`);
                setDietOpen(false);
              }}
            />
          </Card>
        ))}
      </Sheet>

      <Sheet
        visible={suppOpen}
        onClose={() => setSuppOpen(false)}
        title="Suggest a supplement"
        footer={
          <Button
            title="Add to their list"
            full
            onPress={() => {
              if (name.trim().length < 2 || !dose.trim()) {
                toast.error('Add the name and the dose.');
                return;
              }
              addSupplement({ name: name.trim(), dose: dose.trim(), time, kind: 'supplement' }, member.id);
              toast.success(`${name.trim()} added for ${member.name.split(' ')[0]}.`);
              setSuppOpen(false);
              setName('');
              setDose('');
            }}
          />
        }>
        <Input label="Supplement" value={name} onChangeText={setName} placeholder="Whey protein" />
        <Input label="Dose" value={dose} onChangeText={setDose} placeholder="1 scoop (30 g)" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TIMES.map((t) => (
            <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
          ))}
        </View>
        <Text variant="caption" tone="soft">
          Suggest supplements only. Medicines should come from the member’s doctor.
        </Text>
      </Sheet>
    </>
  );
}
