import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Chip, Icon, Input, Pill, Screen, Sheet, Text, toast } from '@/components/ui';
import { money } from '@/lib/format';
import { useApp, useMe, type Trainer } from '@/store';
import { makeStyles } from '@/theme';

const TIMES = ['Early mornings', 'Late mornings', 'Weekday evenings', 'Weekends'];

export default function Trainers() {
  const s = useStyles();
  const me = useMe();
  const trainers = useApp((st) => st.trainers);
  const requests = useApp((st) => st.ptRequests);
  const requestTrainer = useApp((st) => st.requestTrainer);
  const [pick, setPick] = useState<Trainer | null>(null);
  const [time, setTime] = useState(TIMES[2]);
  const [goal, setGoal] = useState('');
  if (!me) return null;

  const statusFor = (id: string) => requests.find((r) => r.memberId === me.id && r.trainerId === id && r.status !== 'declined');

  const send = () => {
    if (!pick) return;
    if (goal.trim().length < 4) {
      toast.error('Tell the coach what you want to work on.');
      return;
    }
    if (toast.result(requestTrainer(pick.id, time, goal.trim()))) {
      setPick(null);
      setGoal('');
    }
  };

  return (
    <Screen header="stack" title="Coaches" subtitle="One-to-one sessions with the people who coach here. Ask for a trial first.">
      <View style={{ gap: 12 }}>
        {trainers.map((t) => {
          const req = statusFor(t.id);
          return (
            <Card key={t.id} style={{ gap: 12 }}>
              <View style={s.head}>
                <Avatar name={t.name} size={54} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h3">{t.name}</Text>
                  <Text variant="small" tone="soft">
                    {t.focus}, {t.years} years coaching
                  </Text>
                </View>
                {t.rating > 0 ? (
                  <View style={s.rating}>
                    <Icon name="star" size={13} tone="warning" />
                    <Text variant="smallStrong">{t.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
              <Text variant="small" tone="soft">
                {t.bio}
              </Text>
              <View style={s.certs}>
                {t.certifications.map((cert) => (
                  <Pill key={cert} label={cert} />
                ))}
              </View>
              <View style={s.foot}>
                <Text variant="label">{money(t.price)} a session</Text>
                {req ? (
                  <Pill
                    label={req.status === 'scheduled' ? 'Trial being set up' : 'Request sent'}
                    tone={req.status === 'scheduled' ? 'success' : 'warning'}
                    dot
                  />
                ) : (
                  <Button title="Request a session" size="sm" onPress={() => setPick(t)} />
                )}
              </View>
            </Card>
          );
        })}
      </View>

      <Sheet
        visible={!!pick}
        onClose={() => setPick(null)}
        title={`Train with ${pick?.name.split(' ')[0] ?? ''}`}
        subtitle="The coach calls you to set up a trial session."
        footer={<Button title="Send request" full onPress={send} />}>
        <Text variant="smallStrong" tone="soft">
          When suits you?
        </Text>
        <View style={s.certs}>
          {TIMES.map((t) => (
            <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
          ))}
        </View>
        <Input label="What do you want to work on?" placeholder="Lose 5 kg, first pull-up, fix my squat…" value={goal} onChangeText={setGoal} multiline maxLength={160} />
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 26,
    borderRadius: 13,
    backgroundColor: t.c.surfaceAlt,
  },
  certs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
}));
