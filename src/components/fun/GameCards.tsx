import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Avatar, Card, Icon, Text } from '@/components/ui';
import type { Ring } from '@/lib/game';
import { PROMOTE } from '@/lib/game';
import type { GameState } from '@/lib/useGame';
import type { Member, RingKey } from '@/store/types';
import { makeStyles, useTheme, type Palette } from '@/theme';

import { ChestArt } from './Chest';
import { Glow } from './Effects';
import { ActivityRings, Bouncy, CountUp, Wiggle, XPBar } from './Motion';

export function ringColor(c: Palette, key: RingKey) {
  return key === 'show' ? c.primary : key === 'train' ? c.success.solid : c.warning.solid;
}

export function RingsCard({ rings, compact }: { rings: Ring[]; compact?: boolean }) {
  const { c } = useTheme();
  const s = useStyles();
  const closed = rings.filter((r) => r.value >= r.target).length;
  return (
    <Card style={[s.rings, { overflow: 'hidden' }]}>
      {closed ? <Glow color={closed === 3 ? c.warning.solid : c.success.solid} size={compact ? 200 : 240} active style={{ left: compact ? -42 : -50, top: compact ? -42 : -50 }} /> : null}
      <ActivityRings size={compact ? 116 : 142} stroke={compact ? 12 : 15} rings={rings.map((r) => ({ value: r.value, target: r.target, color: ringColor(c, r.key) }))} />
      <View style={{ flex: 1, gap: compact ? 8 : 12 }}>
        {rings.map((r) => {
          const done = r.value >= r.target;
          return (
            <View key={r.key} style={{ gap: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[s.dot, { backgroundColor: ringColor(c, r.key) }]} />
                <Text variant="label">{r.label}</Text>
                {done ? <Icon name="checkmark-circle" size={16} color={c.success.solid} /> : null}
              </View>
              <Text variant="caption" tone="soft">
                {Math.min(r.value, r.target)}/{r.target} {r.unit}
              </Text>
            </View>
          );
        })}
        {!compact ? (
          <Text variant="caption" tone={closed === 3 ? 'success' : 'faint'}>
            {closed === 3 ? 'All closed this week. Bonus chest earned.' : 'Close all three by Sunday for a bonus chest.'}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

export function LevelCard({ game }: { game: GameState }) {
  const { c } = useTheme();
  const s = useStyles();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={[s.levelBadge, { backgroundColor: c.warning.solid, borderColor: c.warning.bg }]}>
          <Text variant="h2" color="#FFFFFF">
            {game.level.level}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3">Level {game.level.level}</Text>
          <Text variant="small" tone="soft">
            {game.level.next - game.total} XP to level {game.level.level + 1}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <CountUp value={game.total} variant="h3" format={(n) => n.toLocaleString('en-IN')} />
          <Text variant="caption" tone="soft">
            total XP
          </Text>
        </View>
      </View>
      <XPBar progress={game.level.progress} />
      <Text variant="caption" tone="faint">
        XP comes from training, not from opening the app: check-ins, exercises, personal records and station attempts.
      </Text>
    </Card>
  );
}

export function ChestTeaser({ count }: { count: number }) {
  const { c } = useTheme();
  const s = useStyles();
  if (!count) return null;
  return (
    <Bouncy onPress={() => router.push('/member/rewards')} accessibilityLabel={`${count} chests to open`} style={[s.teaser, { backgroundColor: c.warning.bg }]}>
      <Wiggle>
        <ChestArt size={58} />
      </Wiggle>
      <View style={{ flex: 1 }}>
        <Text variant="h3" color={c.warning.fg}>
          {count === 1 ? 'A chest to open' : `${count} chests to open`}
        </Text>
        <Text variant="small" color={c.warning.fg} style={{ opacity: 0.85 }}>
          Could be a little XP, a 250 XP jackpot or a free shake.
        </Text>
      </View>
      <Icon name="chevron-forward" size={20} color={c.warning.fg} />
    </Bouncy>
  );
}

export function LeagueCard({ game, members, limit }: { game: GameState; members: Member[]; limit?: number }) {
  const { c } = useTheme();
  const s = useStyles();
  const { league } = game;
  const nameOf = (id: string) => {
    const m = members.find((x) => x.id === id);
    if (!m) return 'Member';
    const [first, last] = m.name.split(' ');
    return `${first} ${last ? `${last[0]}.` : ''}`;
  };
  const rows = limit ? league.standings.slice(0, limit) : league.standings;
  const n = league.standings.length;
  const message =
    n < 3
      ? 'Leagues come alive as more members train in your slot. Bring a friend with a guest pass.'
      : league.rank <= PROMOTE
      ? `You’re in the promotion zone. Stay top ${PROMOTE} to move up to the next league.`
      : `${league.gap} XP to pass ${nameOf(league.above!.id).trim()}. A workout is worth about 45 XP.`;

  return (
    <Card padded={false}>
      <View style={s.leagueHead}>
        <View style={[s.leagueIcon, { backgroundColor: c.warning.bg }]}>
          <Icon name="podium" size={20} color={c.warning.solid} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{league.name} league</Text>
          <Text variant="caption" tone="soft">
            {n} {n === 1 ? 'person' : 'people'} in your group, {league.daysLeft === 1 ? 'ends tonight' : `${league.daysLeft} days left`}
          </Text>
        </View>
        <Text variant="h2">{league.rank}</Text>
        <Text variant="caption" tone="soft">
          {' '}
          of {n}
        </Text>
      </View>
      <Text variant="small" tone={league.rank <= PROMOTE ? 'success' : 'ink'} style={s.leagueMsg}>
        {message}
      </Text>
      {rows.map((r, i) => (
        <Animated.View
          key={r.id}
          entering={FadeInDown.delay(i * 45).springify().damping(16)}
          style={[
            s.leagueRow,
            i < PROMOTE && { backgroundColor: c.success.bg },
            r.me && { backgroundColor: c.primarySoft, borderColor: c.primary },
          ]}>
          <Text variant="label" style={s.rank} tone={i < PROMOTE ? 'success' : 'soft'}>
            {i + 1}
          </Text>
          <Avatar name={nameOf(r.id)} size={30} />
          <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
            {r.me ? 'You' : nameOf(r.id)}
          </Text>
          <Text variant="smallStrong" tone={r.me ? 'primary' : 'soft'}>
            {r.xp} XP
          </Text>
        </Animated.View>
      ))}
      <View style={{ height: 8 }} />
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  rings: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  levelBadge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  teaser: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: t.radius.lg, padding: 14 },
  leagueHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  leagueIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  leagueMsg: { paddingHorizontal: 16, paddingBottom: 10 },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginTop: 2,
  },
  rank: { width: 18, textAlign: 'center' },
}));
