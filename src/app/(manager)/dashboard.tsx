import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { BrandLockup } from '@/components/Brand';
import { BarChart } from '@/components/Charts';
import { CrowdMeter, SpotMeter } from '@/components/Meters';
import {
  Avatar,
  Button,
  Card,
  Divider,
  Fact,
  Group,
  IconButton,
  Row,
  Screen,
  SectionHeader,
  Text,
} from '@/components/ui';
import { addDays, fmtClockRange, fmtDate, fmtLongDay, fmtRelativeInline, fmtTime, MONTHS_LONG, parts, toMinutes, WEEKDAYS_LONG, weekday } from '@/lib/date';
import { checkinsOn, crowdNow, hoursOn, membership, nextOpening, revenueByMonth, slotsOn, slotState } from '@/lib/domain';
import { firstName, money } from '@/lib/format';
import { useGym, useNow } from '@/lib/hooks';
import { whatsapp } from '@/lib/native';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function Dashboard() {
  const { brand } = useTheme();
  const s = useStyles();
  const now = useNow();
  const gym = useGym();
  const payments = useApp((st) => st.payments);
  const tickets = useApp((st) => st.tickets);
  const leads = useApp((st) => st.leads);
  const ptRequests = useApp((st) => st.ptRequests);
  const chests = useApp((st) => st.chests);
  const guestPasses = useApp((st) => st.guestPasses);
  const guestDays = useApp((st) => st.settings.guestPassDays);

  const infos = useMemo(
    () => gym.members.map((m) => ({ m, info: membership(m, gym.plans, gym.pauses, now.date) })),
    [gym.members, gym.plans, gym.pauses, now.date],
  );

  const active = infos.filter((x) => x.info.status === 'active').length;
  const paused = infos.filter((x) => x.info.status === 'paused').length;
  const ending = infos
    .filter((x) => x.info.status === 'active' && x.info.daysLeft <= 7)
    .sort((a, b) => a.info.daysLeft - b.info.daysLeft);
  const owing = gym.members.filter((m) => m.dues > 0);
  const duesTotal = owing.reduce((sum, m) => sum + m.dues, 0);
  const pendingPauses = gym.pauses.filter((p) => p.status === 'pending').length;
  const openTickets = tickets.filter((t) => t.status === 'open').length;
  const newLeads = leads.filter((l) => l.stage === 'new').length;
  const pendingCoach = ptRequests.filter((r) => r.status === 'pending').length;
  const prizesToHand = chests.filter((x) => x.prize && (x.prize.kind === 'shake' || x.prize.kind === 'merch') && !x.redeemedAt).length;
  const guestsOnWeek = guestPasses.filter((g) => !g.joinedAs && g.activatedOn && now.date <= addDays(g.activatedOn, guestDays - 1)).length;
  const joinedThisMonth = gym.members.filter((m) => m.joinedOn.slice(0, 7) === now.date.slice(0, 7)).length;

  const inToday = checkinsOn(gym, now.date, now.mins);
  const sameTimeLastWeek = checkinsOn(gym, addDays(now.date, -7), now.mins);
  const diff = inToday - sameTimeLastWeek;
  const crowd = crowdNow(gym, now.date, now.mins);
  const revenue = revenueByMonth(payments, now.date, 6);
  const thisMonth = revenue[revenue.length - 1];
  const lastMonth = revenue[revenue.length - 2];
  const hours = hoursOn(now.date);
  const todaysSlots = slotsOn(gym.slots, now.date).map((slot) => ({ slot, st: slotState(gym, now.date, slot, 'slot', undefined, now) }));
  const bookedToday = todaysSlots.reduce((sum, x) => sum + x.st.count, 0);

  const attention = [
    { show: pendingPauses > 0, icon: 'airplane-outline' as const, title: 'Pause requests', subtitle: 'Members waiting for a yes or no', value: String(pendingPauses), go: () => router.push('/manage/requests') },
    { show: ending.length > 0, icon: 'hourglass-outline' as const, title: 'Ending this week', subtitle: 'Send a renewal reminder', value: String(ending.length), go: () => router.push({ pathname: '/members', params: { filter: 'ending' } }) },
    { show: owing.length > 0, icon: 'wallet-outline' as const, title: 'Unpaid dues', subtitle: `${owing.length} members owe money`, value: money(duesTotal), go: () => router.push({ pathname: '/manage/payments', params: { tab: 'dues' } }) },
    { show: openTickets > 0, icon: 'construct-outline' as const, title: 'Open complaints', subtitle: 'Equipment, cleanliness and more', value: String(openTickets), go: () => router.push('/manage/tickets') },
    { show: pendingCoach > 0, icon: 'barbell-outline' as const, title: 'Coaching requests', subtitle: 'Members asking for a trainer', value: String(pendingCoach), go: () => router.push({ pathname: '/manage/requests', params: { tab: 'coach' } }) },
    { show: guestsOnWeek > 0, icon: 'ticket-outline' as const, title: 'Guests on a free week', subtitle: 'Follow up before their week ends', value: String(guestsOnWeek), go: () => router.push('/manage/guests') },
    { show: prizesToHand > 0, icon: 'gift-outline' as const, title: 'Prizes to hand out', subtitle: 'Won from chests, collected at the desk', value: String(prizesToHand), go: () => router.push('/manage/prizes') },
    { show: newLeads > 0, icon: 'person-add-outline' as const, title: 'New enquiries', subtitle: 'Walk-ins and Instagram leads to call', value: String(newLeads), go: () => router.push('/manage/leads') },
  ].filter((a) => a.show);

  const remind = (name: string, phone: string, plan: string, end: string) =>
    whatsapp(
      phone,
      `Hi ${firstName(name)}, your ${plan} membership at ${brand.name} ends on ${fmtDate(end)}. Renew in the app or at the desk to keep training without a break.`,
    );

  return (
    <Screen
      left={<BrandLockup size={32} />}
      right={<IconButton icon="settings-outline" label="Rules and settings" onPress={() => router.push('/manage/settings')} />}>
      <View style={s.head}>
        <Text variant="title">Today</Text>
        <Text tone="soft">
          {fmtLongDay(now.date)}.
          {brand.hours.length === 0 ? '' : ` ${hours ? (now.mins < toMinutes(hours.close) ? `Open until ${fmtTime(hours.close)}.` : 'Closed for the day.') : 'Closed today.'}`}
        </Text>
      </View>

      <Card style={{ gap: 16 }}>
        <CrowdMeter ratio={crowd.ratio} level={crowd.level} inside={crowd.inside} closedNote={nextOpening(now.date, now.mins)} />
        <Divider />
        <View style={s.facts}>
          <Fact label="Checked in" value={String(inToday)} />
          <Fact
            label={`vs last ${WEEKDAYS_LONG[weekday(now.date)].slice(0, 3)}`}
            value={`${diff >= 0 ? '+' : '−'}${Math.abs(diff)}`}
            tone={diff >= 0 ? 'success' : 'danger'}
          />
          <Fact label="Booked today" value={String(bookedToday)} />
        </View>
      </Card>

      <SectionHeader title="Needs you" />
      {attention.length ? (
        <Group>
          {attention.map((a) => (
            <Row key={a.title} icon={a.icon} title={a.title} subtitle={a.subtitle} value={a.value} valueTone="ink" onPress={a.go} />
          ))}
        </Group>
      ) : (
        <Card>
          <Text variant="label">All clear</Text>
          <Text variant="small" tone="soft">
            No requests, complaints or dues waiting. Nice.
          </Text>
        </Card>
      )}

      <SectionHeader title="Today’s slots" action="Manage slots" onAction={() => router.push('/slots')} />
      <Card style={{ gap: 14 }}>
        {todaysSlots.length ? (
          todaysSlots.map(({ slot, st }) => (
            <View key={slot.id} style={[s.slotRow, st.over && { opacity: 0.45 }]}>
              <Text variant="smallStrong" style={s.slotTime} numberOfLines={1}>
                {fmtClockRange(slot.start, slot.end)}
              </Text>
              <View style={{ flex: 1 }}>
                {st.closure ? (
                  <Text variant="caption" tone="faint">
                    Closed, {st.closure.reason.toLowerCase()}
                  </Text>
                ) : (
                  <SpotMeter count={st.count} capacity={st.capacity} level={st.level} height={7} />
                )}
              </View>
              <Text variant="smallStrong" tone="soft" style={s.slotCount}>
                {st.count}/{st.capacity}
              </Text>
            </View>
          ))
        ) : (
          <Text variant="small" tone="soft">
            No slots today.
          </Text>
        )}
      </Card>

      <SectionHeader title="Money" action="Payments" onAction={() => router.push('/manage/payments')} />
      <Card style={{ gap: 16 }}>
        <View>
          <Text variant="small" tone="soft">
            Collected in {MONTHS_LONG[parts(now.date).m]}
          </Text>
          <Text variant="display">{money(thisMonth.total)}</Text>
          <Text variant="small" tone={thisMonth.total >= lastMonth.total ? 'success' : 'soft'}>
            {thisMonth.total >= lastMonth.total
              ? `Already ${money(thisMonth.total - lastMonth.total)} more than ${lastMonth.label}`
              : `${money(lastMonth.total - thisMonth.total)} behind ${lastMonth.label} so far`}
          </Text>
        </View>
        <BarChart
          data={revenue.map((r, i) => ({ label: r.label, value: r.total, highlight: i === revenue.length - 1 }))}
          format={(v) => money(v, { compact: true })}
        />
      </Card>

      <Card style={[s.facts, { marginTop: 12 }]}>
        <Fact label="Active members" value={String(active)} />
        <Fact label="Paused" value={String(paused)} tone="ice" />
        <Fact label="Joined this month" value={String(joinedThisMonth)} />
      </Card>

      {ending.length ? (
        <>
          <SectionHeader title="Ending soon" action="See all" onAction={() => router.push({ pathname: '/members', params: { filter: 'ending' } })} />
          <Group>
            {ending.slice(0, 5).map(({ m, info }) => (
              <Row
                key={m.id}
                leading={<Avatar name={m.name} size={36} />}
                title={m.name}
                subtitle={`${info.plan?.name ?? 'Plan'} ends ${fmtRelativeInline(info.end, now.date)}`}
                chevron={false}
                onPress={() => router.push(`/manage/member/${m.id}`)}
                action={
                  <Button
                    title="Remind"
                    icon="logo-whatsapp"
                    size="sm"
                    variant="soft"
                    onPress={() => remind(m.name, m.phone, info.plan?.name ?? '', info.end)}
                  />
                }
              />
            ))}
          </Group>
        </>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  head: { marginTop: 4, marginBottom: 20, gap: 4 },
  facts: { flexDirection: 'row', justifyContent: 'space-between' },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotTime: { width: 118 },
  slotCount: { width: 44, textAlign: 'right' },
}));
