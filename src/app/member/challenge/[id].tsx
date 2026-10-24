import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Avatar, Button, Card, Empty, Icon, Input, Screen, Segmented, Sheet, Text, toast } from '@/components/ui';
import { diffDays, fmtDay } from '@/lib/date';
import { formatScore, parseScore } from '@/lib/game';
import { useNow } from '@/lib/hooks';
import { useGame } from '@/lib/useGame';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type Scope = 'slot' | 'gym';

export default function ChallengeDetail() {
  const { c } = useTheme();
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const now = useNow(60_000);
  const game = useGame(now.date);
  const members = useApp((st) => st.members);
  const slots = useApp((st) => st.slots);
  const logAttempt = useApp((st) => st.logAttempt);
  const [scope, setScope] = useState<Scope>('slot');
  const [logging, setLogging] = useState(false);
  const [value, setValue] = useState('');
  if (!game) return null;
  const board = game.boards.find((b) => b.challenge.id === id);
  if (!board) {
    return (
      <Screen header="stack" title="Challenge">
        <Empty icon="stopwatch-outline" title="This challenge has ended" body="Check the Club tab for this month’s stations." />
      </Screen>
    );
  }
  const { challenge } = board;
  const rows = scope === 'slot' ? board.slot : board.gym;
  const mine = rows.find((r) => r.me);
  const slot = slots.find((x) => x.id === game.me.preferredSlotId);
  const monthEnd = (() => {
    const [y, m] = now.date.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${now.date.slice(0, 7)}-${String(last).padStart(2, '0')}`;
  })();
  const daysLeft = diffDays(now.date, monthEnd) + 1;
  const nameOf = (mid: string) => {
    const m = members.find((x) => x.id === mid);
    if (!m) return 'Member';
    const [first, last] = m.name.split(' ');
    return `${first} ${last ? `${last[0]}.` : ''}`.trim();
  };
  const visible = rows.slice(0, 10);
  const target = mine && mine.rank > 1 ? rows[mine.rank - 2] : undefined;

  const submit = () => {
    const v = parseScore(challenge, value);
    if (v === null) {
      toast.error(challenge.unit === 'time' ? 'Enter a time like 1:52, or seconds like 112.' : 'Enter the number of reps.');
      return;
    }
    const r = logAttempt(challenge.id, v);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    if (r.message) toast.info(r.message);
    setLogging(false);
    setValue('');
  };

  return (
    <Screen header="stack" title={challenge.name} footer={<Button title="Log an attempt" icon="stopwatch-outline" full onPress={() => setLogging(true)} />}>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="soft">
              {challenge.station}, ends {daysLeft === 1 ? 'tonight' : `in ${daysLeft} days`}
            </Text>
            <Text variant="small" style={{ marginTop: 4 }}>
              {challenge.how}
            </Text>
          </View>
          <Icon name="stopwatch" size={28} tone="primary" />
        </View>
        <View style={s.me}>
          <View>
            <Text variant="caption" tone="soft">
              Your best this month
            </Text>
            <Text variant="h2">{mine ? formatScore(challenge, mine.value) : '–'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="caption" tone="soft">
              {scope === 'slot' ? 'In your slot' : 'Whole gym'}
            </Text>
            <Text variant="h2">{mine ? `${mine.rank} of ${rows.length}` : `${rows.length} on the board`}</Text>
          </View>
        </View>
        {target ? (
          <Text variant="small" tone="primary">
            Beat {formatScore(challenge, target.value)} to pass {nameOf(target.memberId)}.
          </Text>
        ) : mine?.rank === 1 ? (
          <Text variant="small" tone="success">
            You hold the top spot. Others in your slot will be coming for it.
          </Text>
        ) : null}
      </Card>

      <View style={{ marginTop: 16, marginBottom: 12 }}>
        <Segmented<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'slot', label: slot ? `My slot (${slot.start})` : 'My slot' },
            { value: 'gym', label: 'Whole gym' },
          ]}
        />
      </View>

      {visible.length ? (
        <Card padded={false} style={{ paddingVertical: 6 }}>
          {visible.map((r, i) => (
            <Animated.View
              key={`${scope}-${r.memberId}`}
              entering={FadeInDown.delay(i * 40)}
              layout={LinearTransition}
              style={[s.row, r.me && { backgroundColor: c.primarySoft }]}>
              <View style={[s.rank, r.rank === 1 && { backgroundColor: c.warning.solid }]}>
                {r.rank === 1 ? <Icon name="medal" size={16} color="#FFFFFF" /> : <Text variant="label" tone="soft">{r.rank}</Text>}
              </View>
              <Avatar name={nameOf(r.memberId)} size={32} />
              <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                {r.me ? 'You' : nameOf(r.memberId)}
              </Text>
              <Text variant="h3" tone={r.me ? 'primary' : 'ink'}>
                {formatScore(challenge, r.value)}
              </Text>
            </Animated.View>
          ))}
          {mine && mine.rank > 10 ? (
            <View style={[s.row, { backgroundColor: c.primarySoft }]}>
              <View style={s.rank}>
                <Text variant="label" tone="soft">
                  {mine.rank}
                </Text>
              </View>
              <Avatar name={game.me.name} size={32} />
              <Text variant="label" style={{ flex: 1 }}>
                You
              </Text>
              <Text variant="h3" tone="primary">
                {formatScore(challenge, mine.value)}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : (
        <Empty icon="stopwatch-outline" title="Nobody yet" body="Be the first on the board this month." />
      )}
      <Text variant="caption" tone="faint" style={{ marginTop: 12 }}>
        Boards reset on the 1st. The top spot in each slot earns a chest and the Local legend badge. Coaches can check any time that looks too good.
      </Text>

      <Sheet
        visible={logging}
        onClose={() => setLogging(false)}
        title={challenge.name}
        subtitle={challenge.how}
        footer={<Button title="Save attempt" full onPress={submit} />}>
        <Input
          label={challenge.unit === 'time' ? 'Your time (minutes:seconds)' : 'Reps'}
          placeholder={challenge.unit === 'time' ? '1:52' : '35'}
          value={value}
          onChangeText={setValue}
          keyboardType="numbers-and-punctuation"
          autoFocus
          hint={mine ? `Your best this month: ${formatScore(challenge, mine.value)}` : `Saved for ${fmtDay(now.date)}`}
        />
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  me: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, marginHorizontal: 6, borderRadius: 12 },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
}));
