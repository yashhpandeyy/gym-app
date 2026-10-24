import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { LogSetSheet } from '@/components/fun/LogSetSheet';
import { Button, Card, Empty, Icon, ProgressBar, Screen, Segmented, Text } from '@/components/ui';
import { fmtDay } from '@/lib/date';
import { useNow } from '@/lib/hooks';
import { gymWhatsApp, haptic } from '@/lib/native';
import { lastSet } from '@/lib/game';
import { useApp, useMe, type Exercise } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function Workout() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const me = useMe();
  const workouts = useApp((st) => st.workouts);
  const log = useApp((st) => st.workoutLog);
  const trainers = useApp((st) => st.trainers);
  const toggle = useApp((st) => st.toggleExercise);
  const lifts = useApp((st) => st.lifts);
  const [logging, setLogging] = useState<Exercise | null>(null);
  const plan = me ? workouts[me.id] : undefined;
  const [dayId, setDayId] = useState(plan?.days[0]?.id ?? '');
  if (!me) return null;

  if (!plan) {
    return (
      <Screen header="stack" title="Workout plan">
        <Empty
          icon="list-outline"
          title="No plan yet"
          body="Ask a coach for a programme built around your goal. It shows up here when it’s ready."
          action="Find a coach"
          onAction={() => router.push('/member/trainers')}
        />
      </Screen>
    );
  }

  const coach = trainers.find((t) => t.id === plan.trainerId);
  const day = plan.days.find((d) => d.id === dayId) ?? plan.days[0];
  const done = log[me.id]?.[now.date] ?? [];
  const doneHere = day.exercises.filter((e) => done.includes(e.id)).length;

  return (
    <Screen header="stack" title="Workout plan">
      <Text variant="h2">{plan.title}</Text>
      <Text tone="soft" style={{ marginTop: 2, marginBottom: 16 }}>
        From {coach?.name ?? 'your coach'}, updated {fmtDay(plan.updatedOn)}
      </Text>

      <Segmented value={day.id} onChange={setDayId} options={plan.days.map((d) => ({ value: d.id, label: d.name }))} />

      <Card style={{ marginTop: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="label">{day.focus}</Text>
          <Text variant="smallStrong" tone="soft">
            {doneHere}/{day.exercises.length} done today
          </Text>
        </View>
        <ProgressBar value={doneHere / day.exercises.length} color={c.success.solid} />
      </Card>

      <View style={{ gap: 8, marginTop: 12 }}>
        {day.exercises.map((e, i) => {
          const checked = done.includes(e.id);
          return (
            <Pressable
              key={e.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => {
                haptic.tap();
                toggle(now.date, e.id);
              }}
              style={({ pressed }) => [s.ex, pressed && { opacity: 0.8 }]}>
              <View style={[s.check, checked ? { backgroundColor: c.success.solid, borderColor: c.success.solid } : { borderColor: c.lineStrong }]}>
                {checked ? <Icon name="checkmark" size={16} color="#FFFFFF" /> : <Text variant="caption" tone="faint">{i + 1}</Text>}
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="label" style={checked ? { textDecorationLine: 'line-through', opacity: 0.55 } : undefined}>
                  {e.name}
                </Text>
                {e.note ? (
                  <Text variant="caption" tone="soft">
                    {e.note}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text variant="h3" tone={checked ? 'faint' : 'ink'}>
                  {e.sets}
                </Text>
                {e.loggable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Log a set of ${e.name}`}
                    hitSlop={8}
                    onPress={() => setLogging(e)}
                    style={[s.logBtn, { backgroundColor: c.primarySoft }]}>
                    <Text variant="micro" tone="primary">
                      {lastSet(lifts, me.id, e.name) ? `Last ${lastSet(lifts, me.id, e.name)!.weight} kg` : 'Log set'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text variant="caption" tone="faint" style={{ marginTop: 14 }}>
        Log the weight on your main lifts. Beat your best and it counts as a personal record.
      </Text>

      {logging ? (
        <LogSetSheet key={logging.id} visible onClose={() => setLogging(null)} exercise={logging.name} exerciseId={logging.id} liftKey={logging.liftKey} />
      ) : null}

      <Button
        title={`Ask ${coach?.name.split(' ')[0] ?? 'your coach'} a question`}
        icon="logo-whatsapp"
        variant="soft"
        full
        style={{ marginTop: 20 }}
        onPress={() => gymWhatsApp(`Hi, this is ${me.name} (${me.code}). A question for ${coach?.name ?? 'my coach'} about my ${day.name} day: `)}
      />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  ex: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: t.c.surface,
    borderRadius: t.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  check: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  logBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
}));
