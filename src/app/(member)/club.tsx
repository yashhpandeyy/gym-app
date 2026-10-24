import { router } from 'expo-router';
import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { FlipAward } from '@/components/fun/FlipAward';
import { ChestTeaser, LeagueCard, LevelCard, RingsCard } from '@/components/fun/GameCards';
import { Bouncy } from '@/components/fun/Motion';
import { Card, Icon, Pill, Screen, SectionHeader, Text } from '@/components/ui';
import { formatScore } from '@/lib/game';
import { useNow } from '@/lib/hooks';
import { useGame } from '@/lib/useGame';
import { useApp } from '@/store';
import { gutter, makeStyles, useTheme } from '@/theme';

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

export default function Club() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const { width } = useWindowDimensions();
  const BADGE_W = Math.floor((Math.min(width, 560) - gutter * 2 - 20) / 3);
  const game = useGame(now.date);
  const members = useApp((st) => st.members);
  const settleLeague = useApp((st) => st.settleLeague);

  // Weekly league results are settled the first time the member opens the Club in a new week.
  useEffect(() => {
    settleLeague();
  }, [settleLeague, now.date]);

  if (!game) return null;
  const { strength } = game;

  return (
    <Screen title="Club" subtitle="Compete with your slot, close your rings and get stronger.">
      <LevelCard game={game} />
      {game.chests.length ? (
        <View style={{ marginTop: 12 }}>
          <ChestTeaser count={game.chests.length} />
        </View>
      ) : null}

      <SectionHeader title="This week’s rings" hint="Close them all by Sunday." />
      <RingsCard rings={game.rings} />

      <SectionHeader title="Your league" hint="A new group every Monday, people from your own time slot first." />
      <LeagueCard game={game} members={members} />

      <SectionHeader
        title="Station leaderboards"
        hint="Monthly. Beat the people who train when you do."
        action="All boards"
        onAction={() => router.push('/member/leaderboards')}
      />
      <View style={{ gap: 10 }}>
        {game.boards.map(({ challenge, slot, mine }) => {
          const leader = slot[0];
          return (
            <Bouncy key={challenge.id} onPress={() => router.push({ pathname: '/member/challenge/[id]', params: { id: challenge.id } })} accessibilityLabel={challenge.name}>
              <Card style={s.board}>
                <View style={[s.boardIcon, { backgroundColor: mine?.rank === 1 ? c.warning.solid : c.primarySoft }]}>
                  <Icon name={mine?.rank === 1 ? 'medal' : 'stopwatch-outline'} size={22} color={mine?.rank === 1 ? '#FFFFFF' : c.primaryInk} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{challenge.name}</Text>
                  <Text variant="caption" tone="soft">
                    {mine
                      ? `You: ${formatScore(challenge, mine.value)}, ${ordinal(mine.rank)} of ${slot.length} in your slot`
                      : `${slot.length} people in your slot have a time. Leader ${leader ? formatScore(challenge, leader.value) : '–'}`}
                  </Text>
                </View>
                {mine ? <Pill label={ordinal(mine.rank)} tone={mine.rank <= 3 ? 'success' : 'neutral'} /> : <Pill label="Try it" tone="primary" />}
              </Card>
            </Bouncy>
          );
        })}
      </View>

      <SectionHeader title="Strength score" action="Details" onAction={() => router.push('/member/strength')} />
      <Bouncy onPress={() => router.push('/member/strength')} accessibilityLabel={`Strength score ${strength.score}`}>
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View>
              <Text variant="display">{strength.score}</Text>
              <Text variant="label" tone="primary">
                {strength.tier.name}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="label" tone="success">
                +{strength.score - strength.history[0].score} in 10 weeks
              </Text>
              {strength.tier.next ? (
                <Text variant="caption" tone="soft">
                  {strength.tier.toNext} to {strength.tier.next.name}
                </Text>
              ) : null}
            </View>
          </View>
          <LineChart values={strength.history.map((h) => h.score)} height={70} />
          <Text variant="caption" tone="faint">
            Your squat, bench, deadlift and overhead press against your bodyweight. It only goes up when you get stronger.
          </Text>
        </Card>
      </Bouncy>

      <SectionHeader title="Badges" hint={`${game.badges.filter((b) => b.earned).length} of ${game.badges.length} earned`} />
      <Text variant="caption" tone="soft" style={{ marginBottom: 10 }}>
        Tap an award to flip it and see how to earn it.
      </Text>
      <View style={s.badges}>
        {game.badges.map((b) => (
          <FlipAward key={b.id} badge={b} width={BADGE_W} />
        ))}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  board: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
}));
