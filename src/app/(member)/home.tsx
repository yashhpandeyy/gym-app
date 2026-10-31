import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';

import { Logo } from '@/components/Brand';
import { FlipAward } from '@/components/fun/FlipAward';
import { ChestTeaser, RingsCard } from '@/components/fun/GameCards';
import { Bouncy } from '@/components/fun/Motion';
import { StrengthSpotlight } from '@/components/fun/StrengthSpotlight';
import { HourBars } from '@/components/Charts';
import { MembershipCard, useMembershipLook } from '@/components/MembershipCard';
import { CrowdMeter, SpotMeter } from '@/components/Meters';
import {
  Button,
  Card,
  Divider,
  Icon,
  IconButton,
  Pill,
  Ring,
  Screen,
  SectionHeader,
  Text,
  toast,
  type IconName,
} from '@/components/ui';
import { clockParts, fmtDay, fmtLongDay, fmtRelativeDay, fmtTime, greeting, toMinutes } from '@/lib/date';
import {
  crowdNow,
  hourlyLoad,
  hoursOn,
  isPausedOn,
  memberBookings,
  nextOpening,
  sessionRef,
  slotState,
  startsIn,
  visitStats,
} from '@/lib/domain';
import { firstName } from '@/lib/format';
import { useGym, useMyMembership, useNow } from '@/lib/hooks';
import { useGame } from '@/lib/useGame';
import { useSpotlight } from '@/lib/useSpotlight';
import { confirm } from '@/lib/native';
import { useApp, type AnnouncementKind } from '@/store';
import { gutter, makeStyles, useTheme } from '@/theme';

const KIND: Record<AnnouncementKind, { label: string; tone: 'warning' | 'primary' | 'success' | 'neutral' }> = {
  holiday: { label: 'Hours', tone: 'warning' },
  event: { label: 'Event', tone: 'primary' },
  offer: { label: 'Offer', tone: 'success' },
  notice: { label: 'Notice', tone: 'neutral' },
};

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

export default function Home() {
  const { brand, c, scheme, alpha } = useTheme();
  const s = useStyles();
  const now = useNow();
  const gym = useGym();
  const { member: me, info } = useMyMembership(now.date);
  const game = useGame(now.date);
  const highlights = useSpotlight(now.date);
  const announcements = useApp((st) => st.announcements);
  const prefs = useApp((st) => st.prefs);
  const notices = useApp((st) => st.notices);
  const endPauseEarly = useApp((st) => st.endPauseEarly);
  const look = useMembershipLook(info?.status ?? 'active');

  // The plate runs under the status bar, so the clock and battery follow its colour while Home is showing.
  const plateIcons = look.fg === '#FFFFFF' || look.fg === c.railInk ? 'light' : 'dark';
  const pageIcons = scheme === 'dark' ? 'light' : 'dark';
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(plateIcons);
      return () => setStatusBarStyle(pageIcons);
    }, [plateIcons, pageIcons]),
  );

  if (!me || !info) return null;

  const hours = hoursOn(now.date);
  const openLine = brand.hours.length === 0
    ? ''
    : !hours
    ? 'Closed today'
    : now.mins < toMinutes(hours.open)
      ? `Opens at ${fmtTime(hours.open)}`
      : now.mins < toMinutes(hours.close)
        ? `Open until ${fmtTime(hours.close)}`
        : 'Closed for the day';

  const next = memberBookings(gym.bookings, me.id, now.date)
    .filter((b) => b.status === 'booked')
    .map((b) => ({ b, ref: sessionRef(gym, b.kind, b.refId) }))
    .filter((x) => x.ref && !(x.b.date === now.date && toMinutes(x.ref.end) <= now.mins))
    .sort((a, b) => (a.b.date === b.b.date ? (a.ref!.start < b.ref!.start ? -1 : 1) : a.b.date < b.b.date ? -1 : 1))[0];
  const nextState = next?.ref ? slotState(gym, next.b.date, next.ref, next.b.kind, me.id, now) : undefined;

  const crowd = crowdNow(gym, now.date, now.mins);
  const load = hourlyLoad(gym, now.date);
  const stats = visitStats(gym.checkins, me.id, me.weeklyGoal, now.date, (d) => isPausedOn(me.id, d, gym.pauses));
  const unread = notices.filter((n) => (n.memberId === me.id && !n.read) || (n.memberId === null && !(prefs.readBroadcast ?? []).includes(n.id))).length;
  const board = [...announcements]
    .sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.date < b.date ? 1 : -1))
    .slice(0, 3);

  const onCardAction = () => {
    if (info.status === 'paused' && info.activePause) {
      confirm({
        title: 'End your pause today?',
        message: 'You can train from today. Unused pause days go back to your balance.',
        confirmText: 'End pause',
        onConfirm: () => toast.result(endPauseEarly(info.activePause!.id)),
      });
    } else router.push('/member/renew');
  };

  const quick: { icon: IconName; label: string; href: Parameters<typeof router.push>[0]; show: boolean }[] = [
    { icon: 'ticket-outline', label: 'Guest pass', href: '/member/guest', show: brand.features.guestPass && info.status === 'active' },
    { icon: 'restaurant-outline', label: 'Diet', href: '/member/diet', show: brand.features.nutrition },
    { icon: 'leaf-outline', label: 'Breathe', href: '/member/mind', show: brand.features.mind },
    { icon: 'airplane-outline', label: 'Pause', href: '/member/pause', show: info.status !== 'expired' },
    { icon: 'list-outline', label: 'My plan', href: '/member/workout', show: brand.features.workouts },
    { icon: 'barbell-outline', label: 'Coaches', href: '/member/trainers', show: brand.features.trainers },
  ];

  const awards = game && brand.features.gamification ? [...game.badges].sort((x, y) => Number(y.earned) - Number(x.earned) || y.have / y.need - x.have / x.need).slice(0, 8) : [];
  const shortcuts = quick.filter((q) => q.show).slice(0, 4);

  return (
    <Screen
      header="none"
      bleedColor={look.bg}
      bleed={
        <MembershipCard
          info={info}
          onPress={() => router.push('/member/membership')}
          onAction={onCardAction}
          head={
            <View style={s.head}>
              <Logo size={36} inverted />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="label" color={look.fg} numberOfLines={1}>
                  {greeting()}, {firstName(me.name)}
                </Text>
                <Text variant="caption" color={alpha(look.fg, 0.86)} numberOfLines={1}>
                  {fmtLongDay(now.date)}{openLine ? `. ${openLine}.` : '.'}
                </Text>
              </View>
              <IconButton
                icon="notifications-outline"
                label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                variant="onPrimary"
                badge={unread > 0}
                iconColor={look.fg}
                onPress={() => router.push('/member/notifications')}
              />
            </View>
          }
        />
      }>
      <SectionHeader
        title="Your next session"
        action={next ? 'Book another' : undefined}
        onAction={() => router.push('/book')}
        style={s.firstSection}
      />
      {next?.ref && nextState ? (
        <Card style={{ gap: 12 }}>
          <View style={s.rowBetween}>
            <Text variant="smallStrong" tone="soft">
              {fmtRelativeDay(next.b.date, now.date)}, {startsIn(nextState.minutesToStart).toLowerCase()}
            </Text>
            <Pill label={next.ref.title ?? 'Gym floor'} tone="primary" />
          </View>
          <View style={s.timeRow}>
            <Text variant="display">
              {clockParts(next.ref.start).clock}–{clockParts(next.ref.end).clock}
            </Text>
            <Text variant="h3" tone="soft">
              {clockParts(next.ref.end).suffix}
            </Text>
          </View>
          <SpotMeter count={nextState.count} capacity={nextState.capacity} level={nextState.level} mine />
          <Text variant="caption" tone="soft">
            {nextState.count} of {nextState.capacity} going. The tall tick is you.
          </Text>
          <View style={s.buttons}>
            {next.b.date === now.date ? (
              <Button title="Show pass" icon="qr-code-outline" size="md" onPress={() => router.push('/pass')} />
            ) : null}
            <Button
              title="Change time"
              variant="outline"
              size="md"
              onPress={() => router.push({ pathname: '/book', params: { date: next.b.date, tab: next.b.kind === 'class' ? 'classes' : 'gym' } })}
            />
          </View>
        </Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <Text variant="h3">Nothing booked yet</Text>
          <Text variant="small" tone="soft">
            {info.status === 'active'
              ? 'Pick a slot to hold your spot on the floor. You can see how full each one is before you book.'
              : info.status === 'paused'
                ? `You’re paused until ${fmtDay(info.activePause!.end)}. Book for the day you’re back.`
                : 'Renew your membership to start booking again.'}
          </Text>
          {info.status !== 'expired' ? (
            <Button title="Book a slot" size="md" full onPress={() => router.push('/book')} style={{ marginTop: 4 }} />
          ) : null}
        </Card>
      )}

      {shortcuts.length ? (
        <View style={s.quick}>
          {shortcuts.map((q) => (
            <Bouncy key={q.label} onPress={() => router.push(q.href)} style={s.quickItem} accessibilityLabel={q.label}>
              <Icon name={q.icon} size={22} tone="primary" />
              <Text variant="caption" tone="soft" numberOfLines={1}>
                {q.label}
              </Text>
            </Bouncy>
          ))}
        </View>
      ) : null}

      {game && brand.features.gamification ? (
        <>
          <SectionHeader title="This week" action="Club" onAction={() => router.push('/club')} />
          <Bouncy onPress={() => router.push('/club')} accessibilityLabel="Open the Club">
            <RingsCard rings={game.rings} compact />
          </Bouncy>
          <Bouncy onPress={() => router.push('/club')} style={[s.league, { backgroundColor: c.surface }]} accessibilityLabel="Your league">
            <Icon name="podium" size={20} color={c.warning.solid} />
            <Text variant="small" style={{ flex: 1 }}>
              <Text variant="smallStrong">
                {ordinal(game.league.rank)} of {game.league.standings.length} in {game.league.name} league.{' '}
              </Text>
              {game.league.rank <= 3 ? 'You’re in the promotion zone.' : `${game.league.gap} XP to move up a place.`}
            </Text>
            <Icon name="chevron-forward" size={18} tone="faint" />
          </Bouncy>
          {game.chests.length ? (
            <View style={{ marginTop: 10 }}>
              <ChestTeaser count={game.chests.length} />
            </View>
          ) : null}
        </>
      ) : (
        <>
          <SectionHeader title="This week" action="Attendance" onAction={() => router.push('/member/attendance')} />
          <Card style={s.week}>
            <Ring value={stats.thisWeek / me.weeklyGoal} size={72} stroke={8}>
              <Text variant="h3">
                {stats.thisWeek}/{me.weeklyGoal}
              </Text>
            </Ring>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label">
                {stats.thisWeek >= me.weeklyGoal
                  ? 'Weekly goal done'
                  : `${me.weeklyGoal - stats.thisWeek} more ${me.weeklyGoal - stats.thisWeek === 1 ? 'visit' : 'visits'} to hit your goal`}
              </Text>
              <Text variant="small" tone="soft">
                {stats.streak > 0
                  ? `${stats.streak}-week streak. ${stats.thisMonth} visits so far this month.`
                  : `${stats.thisMonth} visits so far this month. Hit your goal to start a streak.`}
              </Text>
            </View>
          </Card>
        </>
      )}

      <SectionHeader title="How busy it is" />
      <Card style={{ gap: 16 }}>
        <CrowdMeter ratio={crowd.ratio} level={crowd.level} inside={crowd.inside} closedNote={nextOpening(now.date, now.mins)} />
        {load.length ? (
          <>
            <Divider />
            <View style={{ gap: 10 }}>
              <Text variant="smallStrong" tone="soft">
                Usually on {fmtLongDay(now.date).split(',')[0]}s
              </Text>
              <HourBars data={load} nowHour={now.hour} />
            </View>
          </>
        ) : null}
      </Card>

      {brand.features.gamification && highlights.length ? (
        <>
          <SectionHeader
            title={highlights[0].kind === 'best' ? 'Your personal bests' : 'What you’re best at'}
            action="Leaderboards"
            onAction={() => router.push('/member/leaderboards')}
          />
          <StrengthSpotlight highlights={highlights} />
        </>
      ) : null}

      {awards.length ? (
        <>
          <SectionHeader title="Your awards" action="All awards" onAction={() => router.push('/club')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.awardScroll} contentContainerStyle={s.awardRow}>
            {awards.map((b) => (
              <FlipAward key={b.id} badge={b} width={112} height={144} />
            ))}
          </ScrollView>
        </>
      ) : null}

      {board.length ? (
        <>
          <SectionHeader title="Notice board" action="All updates" onAction={() => router.push('/member/notifications')} />
          <View style={{ gap: 10 }}>
            {board.map((a) => (
              <Card key={a.id} style={{ gap: 6 }}>
                <View style={s.rowBetween}>
                  <Pill label={KIND[a.kind].label} tone={KIND[a.kind].tone} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {a.pinned ? <Icon name="pin" size={14} tone="faint" /> : null}
                    <Text variant="caption" tone="faint">
                      {fmtRelativeDay(a.date, now.date)}
                    </Text>
                  </View>
                </View>
                <Text variant="label">{a.title}</Text>
                <Text variant="small" tone="soft">
                  {a.body}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  firstSection: { marginTop: 8 },
  awardScroll: { marginHorizontal: -gutter, flexGrow: 0, flexShrink: 0 },
  awardRow: { paddingHorizontal: gutter, gap: 10, paddingVertical: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  week: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  quick: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderCurve: 'continuous', paddingVertical: 14, paddingHorizontal: 6 },
  quickItem: { flex: 1, alignItems: 'center', gap: 6, minHeight: 44 },
  league: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: t.radius.lg, borderCurve: 'continuous', padding: 14, marginTop: 10 },
}));
