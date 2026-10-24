import { router } from 'expo-router';
import { View } from 'react-native';

import { PassCard } from '@/components/PassCard';
import { Button, Empty, Group, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { fmtDay, fmtRelativeDay, fmtTime, fmtTimeRange, stampToDate } from '@/lib/date';
import { sessionRef } from '@/lib/domain';
import { useGym, useMyMembership, useNow } from '@/lib/hooks';
import { makeStyles, useTheme } from '@/theme';

export default function Pass() {
  const { brand } = useTheme();
  const s = useStyles();
  const now = useNow();
  const gym = useGym();
  const { member: me, info } = useMyMembership(now.date);

  if (!me || !info) return null;

  const canEnter = info.status === 'active';
  const todays = gym.bookings
    .filter((b) => b.memberId === me.id && b.date === now.date && b.status === 'booked')
    .map((b) => sessionRef(gym, b.kind, b.refId))
    .filter(Boolean);
  const visits = gym.checkins
    .filter((c) => c.memberId === me.id)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 5);
  const checkedInToday = visits.some((v) => stampToDate(v.at) === now.date);

  return (
    <Screen title="Your pass" subtitle="Hold it up to the scanner at the front desk.">
      <PassCard member={me} info={info} disabled={!canEnter} checkedIn={checkedInToday} />
      {!canEnter ? (
        <View style={s.blocked}>
          <Text variant="h3" align="center">
            {info.status === 'paused'
              ? `Paused until ${fmtDay(info.activePause!.end)}`
              : info.status === 'expired'
                ? 'Membership ended'
                : `Starts ${fmtDay(info.start)}`}
          </Text>
          <Text variant="small" tone="soft" align="center">
            {info.status === 'paused'
              ? 'End your pause to check in today.'
              : info.status === 'expired'
                ? 'Renew to get your pass working again.'
                : 'Your pass works from the first day of your plan.'}
          </Text>
          <Button
            title={info.status === 'expired' ? 'Renew membership' : 'Manage membership'}
            size="md"
            onPress={() => router.push(info.status === 'expired' ? '/member/renew' : '/member/membership')}
            style={{ alignSelf: 'center', marginTop: 4 }}
          />
        </View>
      ) : (
        <Text variant="caption" tone="faint" align="center" style={{ marginTop: 26 }}>
          Tilt your phone, the card moves with you.
        </Text>
      )}

      {todays.length ? (
        <>
          <SectionHeader title="Booked today" />
          <Group>
            {todays.map((r) => (
              <Row
                key={r!.id}
                icon={r!.kind === 'class' ? 'people-outline' : 'barbell-outline'}
                title={r!.title ?? 'Gym floor'}
                subtitle={fmtTimeRange(r!.start, r!.end)}
              />
            ))}
          </Group>
        </>
      ) : null}

      {brand.features.guestPass && canEnter ? (
        <Button
          title="Bringing a friend? Show their guest pass"
          variant="soft"
          icon="ticket-outline"
          full
          style={{ marginTop: 14 }}
          onPress={() => router.push('/member/guest')}
        />
      ) : null}

      <SectionHeader title="Recent visits" action="Attendance" onAction={() => router.push('/member/attendance')} />
      {visits.length ? (
        <Group>
          {visits.map((v) => {
            const d = new Date(v.at);
            return (
              <Row
                key={v.id}
                icon="checkmark-circle-outline"
                iconTone="success"
                title={fmtRelativeDay(stampToDate(v.at), now.date)}
                value={fmtTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)}
              />
            );
          })}
        </Group>
      ) : (
        <Empty icon="footsteps-outline" title="No visits yet" body="Your check-ins will show up here." />
      )}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  blocked: { gap: 6, marginTop: 16, paddingHorizontal: 8 },
}));
