import { router } from 'expo-router';
import { View } from 'react-native';

import {
  Avatar,
  Card,
  Fact,
  Group,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  Text,
  ToggleRow,
} from '@/components/ui';
import { fmtMonthYear } from '@/lib/date';
import { isPausedOn, visitStats } from '@/lib/domain';
import { useMyMembership, useNow } from '@/lib/hooks';
import { confirm } from '@/lib/native';
import { signOut } from '@/lib/remote';
import { useApp, type Prefs } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function Profile() {
  const { brand } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const { member: me, info } = useMyMembership(now.date);
  const checkins = useApp((st) => st.checkins);
  const pauses = useApp((st) => st.pauses);
  const prefs = useApp((st) => st.prefs);
  const setPrefs = useApp((st) => st.setPrefs);

  if (!me || !info) return null;
  const stats = visitStats(checkins, me.id, me.weeklyGoal, now.date, (d) => isPausedOn(me.id, d, pauses));

  return (
    <Screen title="You">
      <View style={s.hero}>
        <Avatar name={me.name} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h2">{me.name}</Text>
          <Text variant="small" tone="soft">
            {me.code}, member since {fmtMonthYear(me.joinedOn)}
          </Text>
        </View>
      </View>

      <Card style={s.stats}>
        <Fact label="All visits" value={String(stats.total)} />
        <Fact label="This month" value={String(stats.thisMonth)} />
        <Fact label="Week streak" value={String(stats.streak)} />
        <Fact label="Per week" value={stats.avgPerWeek.toFixed(1)} />
      </Card>

      <Group style={{ marginTop: 14 }}>
        <Row icon="card-outline" title="Membership" subtitle="Plan, pause, renew and payments" onPress={() => router.push('/member/membership')} />
        {brand.features.gamification ? (
          <Row icon="gift-outline" title="Rewards" subtitle="Chests, prizes and your XP" onPress={() => router.push('/member/rewards')} />
        ) : null}
      </Group>

      <SectionHeader title="Training" />
      <Group>
        {brand.features.progress ? (
          <Row icon="trending-down-outline" title="Progress" subtitle="Weight, body fat and waist" onPress={() => router.push('/member/progress')} />
        ) : null}
        <Row icon="calendar-number-outline" title="Attendance" subtitle="Every visit and your weekly goal" onPress={() => router.push('/member/attendance')} />
        {brand.features.workouts ? (
          <Row icon="list-outline" title="Workout plan" subtitle="From your coach" onPress={() => router.push('/member/workout')} />
        ) : null}
        {brand.features.gamification ? (
          <Row icon="barbell-outline" title="Strength score" subtitle="Your lifts against your bodyweight" onPress={() => router.push('/member/strength')} />
        ) : null}
      </Group>

      {brand.features.nutrition || brand.features.mind ? (
        <>
          <SectionHeader title="Food and recovery" />
          <Group>
            {brand.features.nutrition ? (
              <Row icon="restaurant-outline" title="Diet plan" subtitle="Meals, protein and water for today" onPress={() => router.push('/member/diet')} />
            ) : null}
            {brand.features.nutrition ? (
              <Row icon="medkit-outline" title="Supplements and medicines" subtitle="Your daily checklist" onPress={() => router.push('/member/supplements')} />
            ) : null}
            {brand.features.mind ? (
              <Row icon="leaf-outline" title="Breathe" subtitle="Guided breathing for focus, recovery and sleep" onPress={() => router.push('/member/mind')} />
            ) : null}
          </Group>
        </>
      ) : null}

      <SectionHeader title="Gym" />
      <Group>
        {brand.features.trainers ? (
          <Row icon="barbell-outline" title="Coaches" subtitle="Book personal training" onPress={() => router.push('/member/trainers')} />
        ) : null}
        <Row icon="location-outline" title="Timings and address" onPress={() => router.push('/member/gym')} />
        {brand.features.guestPass ? (
          <Row icon="ticket-outline" title="Guest pass" subtitle="Bring a friend free for a week" onPress={() => router.push('/member/guest')} />
        ) : null}
        {brand.features.referrals ? (
          <Row icon="share-social-outline" title="Refer a friend" subtitle="You both get extra days" onPress={() => router.push('/member/refer')} />
        ) : null}
        <Row icon="chatbubbles-outline" title="Help and feedback" subtitle="Call, WhatsApp or report a problem" onPress={() => router.push('/member/support')} />
      </Group>

      <SectionHeader title="Settings" />
      <Group>
        <Row icon="person-outline" title="Your details" onPress={() => router.push('/member/edit-profile')} />
        <ToggleRow
          icon="notifications-outline"
          title="Booking reminders"
          subtitle="An hour before each slot"
          value={prefs.notifyBookings}
          onChange={(v) => setPrefs({ notifyBookings: v })}
        />
        <ToggleRow
          icon="alarm-outline"
          title="Renewal reminders"
          subtitle="A week before your plan ends"
          value={prefs.notifyExpiry}
          onChange={(v) => setPrefs({ notifyExpiry: v })}
        />
        <ToggleRow
          icon="pricetag-outline"
          title="Offers and events"
          value={prefs.notifyOffers}
          onChange={(v) => setPrefs({ notifyOffers: v })}
        />
        <ToggleRow
          icon="volume-high-outline"
          title="Sounds"
          subtitle="Taps, wins and rewards"
          value={prefs.sound !== false}
          onChange={(v) => setPrefs({ sound: v })}
        />
      </Group>
      <View style={{ marginTop: 16, gap: 8 }}>
        <Text variant="smallStrong" tone="soft">
          Appearance
        </Text>
        <Segmented<Prefs['scheme']>
          value={prefs.scheme}
          onChange={(v) => setPrefs({ scheme: v })}
          options={[
            { value: 'system', label: 'Match phone' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </View>


      <Group style={{ marginTop: 28 }}>
        <Row
          icon="log-out-outline"
          iconTone="danger"
          title="Log out"
          titleTone="danger"
          chevron={false}
          onPress={() =>
            confirm({
              title: 'Log out?',
              confirmText: 'Log out',
              destructive: true,
              onConfirm: () => {
                signOut();
                router.replace('/');
              },
            })
          }
        />
      </Group>
      <Text variant="caption" tone="faint" align="center" style={{ marginTop: 18 }}>
        {brand.name} app, version 1.0
      </Text>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
}));
