import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DateStrip } from '@/components/DateStrip';
import { SessionRow } from '@/components/SessionRow';
import { Button, Card, Empty, Icon, Screen, Segmented, Text, toast } from '@/components/ui';
import { addDays, fmtDay, fmtRelativeInline, fmtTimeRange, toMinutes, type ISODate } from '@/lib/date';
import { canTrainOn, classEnd, classesOn, periodOf, slotsOn, slotState } from '@/lib/domain';
import { useGym, useMyMembership, useNow } from '@/lib/hooks';
import { confirm } from '@/lib/native';
import { useApp, type Booking } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type Tab = 'gym' | 'classes';

export default function Book() {
  const { brand, c } = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ tab?: string; date?: string }>();
  const now = useNow();
  const gym = useGym();
  const { member: me, info } = useMyMembership(now.date);
  const settings = useApp((st) => st.settings);
  const trainers = useApp((st) => st.trainers);
  const book = useApp((st) => st.book);
  const joinWaitlist = useApp((st) => st.joinWaitlist);
  const cancelBooking = useApp((st) => st.cancelBooking);

  const days = Array.from({ length: settings.bookingWindowDays }, (_, i) => addDays(now.date, i));
  const [tab, setTab] = useState<Tab>(params.tab === 'classes' ? 'classes' : 'gym');
  const [date, setDate] = useState<ISODate>(() => {
    if (params.date && days.includes(params.date)) return params.date;
    // Late in the evening today's slots are all over, so start on the next day with something bookable.
    const open = days.find((d) => slotsOn(gym.slots, d).some((x) => d !== now.date || toMinutes(x.start) > now.mins));
    return open ?? now.date;
  });

  // Follow deep links (e.g. "Change time" from Home) when the params change.
  const [lastParams, setLastParams] = useState(params);
  if (params.date !== lastParams.date || params.tab !== lastParams.tab) {
    setLastParams(params);
    if (params.date && days.includes(params.date)) setDate(params.date);
    if (params.tab) setTab(params.tab === 'classes' ? 'classes' : 'gym');
  }

  if (!me || !info) return null;

  const blocked = canTrainOn(me, gym.plans, gym.pauses, date);
  const myBookings = gym.bookings.filter((b) => b.memberId === me.id && b.status === 'booked');
  const marked = new Set(myBookings.map((b) => b.date));
  const daySlotBooking = myBookings.find((b) => b.kind === 'slot' && b.date === date);

  const doBook = (kind: 'slot' | 'class', refId: string, label: string) => {
    if (kind === 'slot' && daySlotBooking && daySlotBooking.refId !== refId) {
      const current = gym.slots.find((x) => x.id === daySlotBooking.refId);
      confirm({
        title: 'Switch your slot?',
        message: `You're booked for ${current ? fmtTimeRange(current.start, current.end) : 'another slot'} on ${fmtDay(date)}. Move to ${label}?`,
        confirmText: 'Switch',
        onConfirm: () => toast.result(book(date, kind, refId, { replace: daySlotBooking.id })),
      });
      return;
    }
    toast.result(book(date, kind, refId));
  };

  const doCancel = (b: Booking, label: string) => {
    confirm({
      title: b.status === 'waitlist' ? 'Leave the waitlist?' : 'Cancel this booking?',
      message: b.status === 'waitlist' ? undefined : `${label} on ${fmtDay(b.date)}. Your spot goes to the next person.`,
      confirmText: b.status === 'waitlist' ? 'Leave' : 'Cancel booking',
      cancelText: 'Keep it',
      destructive: true,
      onConfirm: () => toast.result(cancelBooking(b.id)),
    });
  };

  const slots = slotsOn(gym.slots, date);
  const classes = classesOn(gym.classes, date);
  const periods = (['Morning', 'Afternoon', 'Evening'] as const)
    .map((p) => ({ period: p, items: slots.filter((x) => periodOf(x.start) === p) }))
    .filter((g) => g.items.length);

  return (
    <Screen
      title="Book"
      subtitle={`See how full each slot is before you go. Cancel up to ${settings.cancelCutoffMinutes} minutes before.`}>
      {brand.features.classes ? (
        <View style={{ marginBottom: 14 }}>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'gym', label: 'Gym floor' },
              { value: 'classes', label: 'Group classes' },
            ]}
          />
        </View>
      ) : null}

      <DateStrip days={days} value={date} onChange={setDate} marked={marked} />

      {blocked ? (
        <Card variant="soft" style={s.banner}>
          <Icon name={info.status === 'expired' ? 'alert-circle-outline' : 'snow-outline'} size={22} tone="primary" />
          <View style={{ flex: 1, gap: 8 }}>
            <Text variant="label">{blocked}</Text>
            {info.status === 'expired' || blocked.includes('ends') ? (
              <Button title="Renew membership" size="sm" onPress={() => router.push('/member/renew')} />
            ) : (
              <Button title="Manage pause" size="sm" variant="outline" onPress={() => router.push('/member/membership')} />
            )}
          </View>
        </Card>
      ) : null}

      {tab === 'gym' ? (
        periods.length ? (
          periods.map((g) => (
            <View key={g.period} style={{ marginTop: 22 }}>
              <Text variant="h3" style={{ marginBottom: 10 }}>
                {g.period}
              </Text>
              <View style={{ gap: 10 }}>
                {g.items.map((slot) => {
                  const st = slotState(gym, date, slot, 'slot', me.id, now);
                  const label = fmtTimeRange(slot.start, slot.end);
                  return (
                    <SessionRow
                      key={slot.id}
                      start={slot.start}
                      end={slot.end}
                      state={st}
                      blocked={!!blocked}
                      waitlistEnabled={settings.waitlist}
                      bookLabel={daySlotBooking && !st.mine ? 'Switch here' : 'Book'}
                      onBook={() => doBook('slot', slot.id, label)}
                      onWaitlist={() => toast.result(joinWaitlist(date, 'slot', slot.id))}
                      onCancel={() => {
                        const b = st.mine ?? st.myWait;
                        if (b) doCancel(b, label);
                      }}
                    />
                  );
                })}
              </View>
            </View>
          ))
        ) : (
          <Empty icon="moon-outline" title="Closed on this day" body="There are no gym slots on this day. Pick another date above." />
        )
      ) : classes.length ? (
        <View style={{ gap: 10, marginTop: 22 }}>
          {classes.map((cl) => {
            const end = classEnd(cl);
            const st = slotState(gym, date, { id: cl.id, start: cl.start, end, capacity: cl.capacity }, 'class', me.id, now);
            const coach = trainers.find((x) => x.id === cl.coachId);
            return (
              <SessionRow
                key={cl.id}
                title={cl.name}
                meta={`With ${coach?.name.split(' ')[0] ?? 'a coach'}, ${cl.minutes} min, ${cl.intensity.toLowerCase()}`}
                start={cl.start}
                end={end}
                state={st}
                blocked={!!blocked}
                waitlistEnabled={settings.waitlist}
                onBook={() => doBook('class', cl.id, cl.name)}
                onWaitlist={() => toast.result(joinWaitlist(date, 'class', cl.id))}
                onCancel={() => {
                  const b = st.mine ?? st.myWait;
                  if (b) doCancel(b, cl.name);
                }}
              />
            );
          })}
          <Text variant="caption" tone="faint" style={{ marginTop: 4 }}>
            Classes don’t count towards your daily gym slot.
          </Text>
        </View>
      ) : (
        <Empty
          icon="people-outline"
          title={`No classes ${fmtRelativeInline(date, now.date)}`}
          body="Try another day, or book a gym slot instead."
          action="See gym slots"
          onAction={() => setTab('gym')}
        />
      )}

      <View style={[s.legend, { borderColor: c.line }]}>
        <LegendDot color={c.success.solid} label="Plenty of room" />
        <LegendDot color={c.warning.solid} label="Filling up" />
        <LegendDot color={c.danger.solid} label="Full" />
      </View>
    </Screen>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text variant="caption" tone="soft">
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  banner: { flexDirection: 'row', gap: 12, marginTop: 16, alignItems: 'flex-start' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 24, paddingTop: 16, borderTopWidth: 1 },
}));
