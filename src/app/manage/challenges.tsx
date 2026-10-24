import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Chip, Input, Screen, SectionHeader, Sheet, Text, toast, ToggleRow, Group } from '@/components/ui';
import { formatScore, leaderboard, parseScore } from '@/lib/game';
import { useNow } from '@/lib/hooks';
import { useApp, type ChallengeUnit } from '@/store';

export default function Challenges() {
  const now = useNow(60_000);
  const challenges = useApp((s) => s.challenges);
  const entries = useApp((s) => s.challengeEntries);
  const members = useApp((s) => s.members);
  const add = useApp((s) => s.addChallenge);
  const toggle = useApp((s) => s.toggleChallenge);
  const addAnnouncement = useApp((s) => s.addAnnouncement);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [station, setStation] = useState('');
  const [how, setHow] = useState('');
  const [unit, setUnit] = useState<ChallengeUnit>('time');
  const [better, setBetter] = useState<'lower' | 'higher'>('lower');
  const [lo, setLo] = useState('');
  const [hi, setHi] = useState('');

  const month = now.date.slice(0, 7);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Member';

  const save = () => {
    const a = parseScore({ unit }, lo);
    const b = parseScore({ unit }, hi);
    if (name.trim().length < 3 || !a || !b) {
      toast.error('Add a name and the range of results you expect.');
      return;
    }
    add({ name: name.trim(), station: station.trim() || 'Gym floor', how: how.trim() || 'Ask a coach to watch your attempt.', unit, better, range: [Math.min(a, b), Math.max(a, b)] });
    toast.success('Challenge added. Members see it in the Club tab.');
    setAdding(false);
    setName('');
    setStation('');
    setHow('');
    setLo('');
    setHi('');
  };

  return (
    <Screen
      header="stack"
      title="Station challenges"
      footer={<Button title="New challenge" icon="add" full onPress={() => setAdding(true)} />}>
      <Text tone="soft">
        Monthly leaderboards for a machine or a move. Members compete with people in their own time slot, so the top spot always feels reachable.
      </Text>
      <View style={{ gap: 12, marginTop: 16 }}>
        {challenges.map((c) => {
          const all = entries.filter((e) => e.date.startsWith(month));
          const board = leaderboard(c, all, '');
          const top = board.slice(0, 3);
          return (
            <Card key={c.id} padded={false} style={{ opacity: c.active ? 1 : 0.6 }}>
              <View style={{ padding: 16, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text variant="h3">{c.name}</Text>
                  <Text variant="caption" tone="soft">
                    {board.length} on the board
                  </Text>
                </View>
                <Text variant="caption" tone="soft">
                  {c.station}. {c.how}
                </Text>
                {top.map((r) => (
                  <View key={r.memberId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text variant="label" tone={r.rank === 1 ? 'warning' : 'soft'} style={{ width: 16 }}>
                      {r.rank}
                    </Text>
                    <Avatar name={nameOf(r.memberId)} size={26} />
                    <Text variant="small" style={{ flex: 1 }}>
                      {nameOf(r.memberId)}
                    </Text>
                    <Text variant="smallStrong">{formatScore(c, r.value)}</Text>
                  </View>
                ))}
                {top.length ? (
                  <Button
                    title="Announce the leaders"
                    size="sm"
                    variant="soft"
                    icon="megaphone-outline"
                    onPress={() => {
                      addAnnouncement({
                        title: `${c.name}: this month’s leaders`,
                        body: top.map((r) => `${r.rank}. ${nameOf(r.memberId)}, ${formatScore(c, r.value)}`).join('\n') + '\nThink you can beat them? Log your attempt in the Club tab.',
                        kind: 'event',
                        pinned: false,
                      });
                      toast.success('Posted to the notice board.');
                    }}
                  />
                ) : null}
              </View>
              <Group style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }} inset={16}>
                <ToggleRow title="Live in the app" value={c.active} onChange={() => toggle(c.id)} />
              </Group>
            </Card>
          );
        })}
      </View>

      <SectionHeader title="Ideas" hint="Stations that work well: rower 2 km, ski erg 500 m, wall sit, dead hang, farmer’s carry, burpees in 3 minutes." />

      <Sheet visible={adding} onClose={() => setAdding(false)} title="New challenge" footer={<Button title="Add challenge" full onPress={save} />}>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Ski erg 500 m" />
        <Input label="Station" value={station} onChangeText={setStation} placeholder="Ski erg, by the turf" />
        <Input label="Rules" value={how} onChangeText={setHow} placeholder="Damper on 6, start from standing" multiline />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Time" selected={unit === 'time'} onPress={() => setUnit('time')} />
          <Chip label="Reps" selected={unit === 'reps'} onPress={() => setUnit('reps')} />
          <Chip label="Lower wins" selected={better === 'lower'} onPress={() => setBetter('lower')} />
          <Chip label="Higher wins" selected={better === 'higher'} onPress={() => setBetter('higher')} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Best expected" value={lo} onChangeText={setLo} placeholder={unit === 'time' ? '1:40' : '60'} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Slowest expected" value={hi} onChangeText={setHi} placeholder={unit === 'time' ? '3:00' : '10'} />
          </View>
        </View>
        <Text variant="caption" tone="soft">
          The range is used to catch typos when members log results.
        </Text>
      </Sheet>
    </Screen>
  );
}
