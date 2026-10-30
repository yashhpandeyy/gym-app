import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Glow } from '@/components/fun/Effects';
import { Avatar, Card, Chip, Empty, Icon, Screen, Segmented, Text } from '@/components/ui';
import { LIFT_KEYS, LIFT_LABEL } from '@/lib/game';
import { useNow } from '@/lib/hooks';
import { buildBoard, challengeGroup, displayName, ordinal, type BoardId, type Scope } from '@/lib/spotlight';
import { useSpotlightInput } from '@/lib/useSpotlight';
import { useApp, type Challenge } from '@/store';
import { gutter, makeStyles, useTheme } from '@/theme';

type Category = 'strength' | 'cardio' | 'endurance' | 'consistency';

const MEDAL = ['#F2B705', '#A7B1C2', '#C9773B'];

function categoryOf(id: BoardId, challenges: Challenge[]): Category {
  if (id.startsWith('lift:') || id === 'improved') return 'strength';
  if (id === 'consistency') return 'consistency';
  const c = challenges.find((x) => `challenge:${x.id}` === id);
  return c ? challengeGroup(c) : 'cardio';
}

export default function Leaderboards() {
  const { c } = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ board?: BoardId; scope?: Scope }>();
  const now = useNow(60_000);
  const input = useSpotlightInput(now.date);
  const challenges = useApp((st) => st.challenges);
  const members = useApp((st) => st.members);
  const [board, setBoard] = useState<BoardId>(params.board ?? 'lift:bench');
  const [scope, setScope] = useState<Scope>(params.scope ?? 'gym');
  const [category, setCategory] = useState<Category>(() => categoryOf(params.board ?? 'lift:bench', challenges));
  if (!input) return null;

  const options: { id: BoardId; label: string }[] =
    category === 'strength'
      ? [...LIFT_KEYS.map((k) => ({ id: `lift:${k}` as BoardId, label: LIFT_LABEL[k] })), { id: 'improved' as BoardId, label: 'Most improved' }]
      : category === 'consistency'
        ? [{ id: 'consistency', label: 'Visits this month' }]
        : challenges.filter((x) => x.active && challengeGroup(x) === category).map((x) => ({ id: `challenge:${x.id}` as BoardId, label: x.name }));
  const active = options.some((o) => o.id === board) ? board : options[0]?.id;
  const b = active ? buildBoard(input, active, scope) : undefined;
  const me = input.me;
  const who = me.gender === 'female' ? 'Women' : me.gender === 'male' ? 'Men' : 'Everyone';
  const top = b?.rows.slice(0, 10) ?? [];

  const pick = (cat: Category) => {
    setCategory(cat);
    const first =
      cat === 'strength' ? 'lift:bench' : cat === 'consistency' ? 'consistency' : challenges.find((x) => x.active && challengeGroup(x) === cat)?.id;
    if (first) setBoard((cat === 'cardio' || cat === 'endurance' ? `challenge:${first}` : first) as BoardId);
  };

  return (
    <Screen header="stack" title="Leaderboards">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chips}>
        {(
          [
            ['strength', 'Strength', 'barbell-outline'],
            ['cardio', 'Cardio', 'heart-outline'],
            ['endurance', 'Endurance', 'timer-outline'],
            ['consistency', 'Consistency', 'calendar-outline'],
          ] as const
        ).map(([key, label, icon]) => (
          <Chip key={key} label={label} icon={icon} selected={category === key} onPress={() => pick(key)} />
        ))}
      </ScrollView>
      {options.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={[s.chips, { paddingTop: 0 }]}>
          {options.map((o) => (
            <Chip key={o.id} label={o.label} selected={active === o.id} onPress={() => setBoard(o.id)} />
          ))}
        </ScrollView>
      ) : null}
      <Segmented<Scope>
        value={scope}
        onChange={setScope}
        options={[
          { value: 'gym', label: 'Whole gym' },
          { value: 'slot', label: 'My slot' },
        ]}
      />

      {b ? (
        <>
          <Card style={s.hero}>
            {b.mine && b.mine.rank <= 3 ? <Glow color={MEDAL[b.mine.rank - 1]} size={260} style={{ right: -80, top: -90 }} /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption" tone="soft">
                {who}. {b.measure}
              </Text>
              <Text variant="h2">{b.title}</Text>
              {b.mine ? (
                <Text variant="label" tone={b.mine.rank <= 3 ? 'success' : 'primary'}>
                  You’re {ordinal(b.mine.rank)} of {b.rows.length}, {b.mine.display}
                </Text>
              ) : (
                <Text variant="small" tone="soft">
                  {active?.startsWith('lift:') ? 'Log this lift in your workout plan to get ranked.' : 'Have a go to get on this board.'}
                </Text>
              )}
              {b.nextUp ? (
                <Text variant="small" tone="soft" style={{ marginTop: 4 }}>
                  {b.nextUp}
                </Text>
              ) : b.mine?.rank === 1 ? (
                <Text variant="small" tone="success" style={{ marginTop: 4 }}>
                  You’re on top. Keep it that way.
                </Text>
              ) : null}
            </View>
            {b.mine ? (
              <View style={[s.bigRank, { backgroundColor: b.mine.rank <= 3 ? MEDAL[b.mine.rank - 1] : c.primarySoft }]}>
                <Text variant="display" color={b.mine.rank <= 3 ? '#FFFFFF' : c.primaryInk}>
                  {b.mine.rank}
                </Text>
              </View>
            ) : null}
          </Card>

          {top.length ? (
            <Card padded={false} style={{ paddingVertical: 6, marginTop: 12 }}>
              {top.map((r, i) => (
                <Animated.View
                  key={`${active}-${scope}-${r.memberId}`}
                  entering={FadeInDown.delay(i * 40).springify().damping(16)}
                  layout={LinearTransition}
                  style={[s.row, r.me && { backgroundColor: c.primarySoft }]}>
                  <View style={[s.rank, r.rank <= 3 && { backgroundColor: MEDAL[r.rank - 1] }]}>
                    {r.rank <= 3 ? (
                      <Text variant="label" color="#FFFFFF">
                        {r.rank}
                      </Text>
                    ) : (
                      <Text variant="label" tone="soft">
                        {r.rank}
                      </Text>
                    )}
                  </View>
                  <Avatar name={displayName(members, r.memberId)} size={32} />
                  <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                    {r.me ? 'You' : displayName(members, r.memberId)}
                  </Text>
                  <Text variant="h3" tone={r.me ? 'primary' : 'ink'}>
                    {r.display}
                  </Text>
                </Animated.View>
              ))}
              {b.mine && b.mine.rank > 10 ? (
                <>
                  <View style={s.gap}>
                    <Icon name="ellipsis-horizontal" size={18} tone="faint" />
                  </View>
                  <View style={[s.row, { backgroundColor: c.primarySoft }]}>
                    <View style={s.rank}>
                      <Text variant="label" tone="soft">
                        {b.mine.rank}
                      </Text>
                    </View>
                    <Avatar name={me.name} size={32} />
                    <Text variant="label" style={{ flex: 1 }}>
                      You
                    </Text>
                    <Text variant="h3" tone="primary">
                      {b.mine.display}
                    </Text>
                  </View>
                </>
              ) : null}
            </Card>
          ) : (
            <Empty icon="podium-outline" title="Nobody on this board yet" body="Results show up as members log them." />
          )}
          <Text variant="caption" tone="faint" style={{ marginTop: 12 }}>
            You’re compared with {who.toLowerCase()} {scope === 'slot' ? 'who train in your time slot' : 'across the gym'}. Lifts are divided by bodyweight so
            everyone competes fairly. Names show as first name and initial.
          </Text>
        </>
      ) : (
        <Empty icon="podium-outline" title="No boards here yet" body="The gym hasn’t set up stations in this category." />
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  chipScroll: { marginHorizontal: -gutter, flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: gutter, gap: 8, paddingVertical: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, overflow: 'hidden' },
  bigRank: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, marginHorizontal: 6, borderRadius: 12 },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gap: { alignItems: 'center', paddingVertical: 2 },
}));
