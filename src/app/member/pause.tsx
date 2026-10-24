import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RangeCalendar } from '@/components/Calendar';
import {
  Button,
  Card,
  Chip,
  Empty,
  Fact,
  Group,
  Icon,
  Input,
  Row,
  Screen,
  SectionHeader,
  Text,
  toast,
  type IconName,
} from '@/components/ui';
import { PAUSE_REASONS } from '@/data/constants';
import { addDays, fmtDate, fmtDay, fmtRange, plural, spanDays, type ISODate } from '@/lib/date';
import { useMyMembership, useNow } from '@/lib/hooks';
import { haptic } from '@/lib/native';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function PauseMembership() {
  const { c, brand } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const { member: me, info } = useMyMembership(now.date);
  const settings = useApp((st) => st.settings);
  const pauses = useApp((st) => st.pauses);
  const bookings = useApp((st) => st.bookings);
  const requestPause = useApp((st) => st.requestPause);

  const [start, setStart] = useState<ISODate | null>(null);
  const [end, setEnd] = useState<ISODate | null>(null);
  const [reason, setReason] = useState(PAUSE_REASONS[0]);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<null | { approved: boolean; start: ISODate; end: ISODate; newEnd: ISODate; dropped: number }>(null);

  if (!me || !info) return null;

  if (done) {
    return (
      <Screen header="modal" title={done.approved ? 'You’re paused' : 'Request sent'} footer={<Button title="Done" full onPress={() => router.back()} />}>
        <View style={s.doneHero}>
          <View style={[s.doneIcon, { backgroundColor: c.ice.bg }]}>
            <Icon name={done.approved ? 'checkmark' : 'paper-plane-outline'} size={34} color={c.ice.fg} />
          </View>
          <Text variant="title" align="center">
            {done.approved ? 'Enjoy the break' : 'Waiting for the gym'}
          </Text>
          <Text tone="soft" align="center" style={{ maxWidth: 320 }}>
            {done.approved
              ? `Your membership is paused ${fmtRange(done.start, done.end)}.`
              : `${brand.shortName} will confirm your pause, usually within a day. You’ll get a notification.`}
          </Text>
        </View>
        <Group inset={16}>
          <Row title="Dates" value={fmtRange(done.start, done.end)} />
          <Row title="Days paused" value={String(spanDays(done.start, done.end))} />
          <Row title={done.approved ? 'New end date' : 'End date once approved'} value={fmtDate(done.newEnd)} valueTone="primary" />
          {done.dropped ? <Row title="Bookings cancelled" value={String(done.dropped)} /> : null}
        </Group>
      </Screen>
    );
  }

  if (info.status === 'expired') {
    return (
      <Screen header="modal" title="Pause membership">
        <Empty
          icon="alert-circle-outline"
          title="Your membership has ended"
          body="Pauses are for active memberships. Renew first, then pause whenever you need to."
          action="Renew membership"
          onAction={() => router.replace('/member/renew')}
        />
      </Screen>
    );
  }

  if (info.pauseLeft < settings.minPauseDays) {
    return (
      <Screen header="modal" title="Pause membership">
        <Empty
          icon="hourglass-outline"
          title="No pause days left"
          body={`You’ve used ${info.pauseUsed} of ${info.pauseAllowance} pause days this term. Renewing adds more, or talk to the desk.`}
          action="See plans"
          onAction={() => router.replace('/member/renew')}
        />
      </Screen>
    );
  }

  const min = addDays(now.date, settings.pauseNoticeDays);
  const max = addDays(info.end, info.pauseLeft);
  const taken = (d: ISODate) =>
    pauses.some((p) => p.memberId === me.id && (p.status === 'approved' || p.status === 'pending') && d >= p.start && d <= p.end);

  const days = start && end ? spanDays(start, end) : 0;
  let problem: string | null = null;
  if (start && end) {
    if (days < settings.minPauseDays) problem = `Pick at least ${plural(settings.minPauseDays, 'day')}.`;
    else if (days > info.pauseLeft) problem = `That’s ${days} days. You have ${info.pauseLeft} left.`;
    else if (start > info.end) problem = 'The pause has to start before your plan ends.';
    else {
      for (let d = start; d <= end; d = addDays(d, 1)) {
        if (taken(d)) {
          problem = 'These dates overlap a pause you already have.';
          break;
        }
      }
    }
  }
  const affected =
    start && end ? bookings.filter((b) => b.memberId === me.id && b.status !== 'cancelled' && b.date >= start && b.date <= end).length : 0;
  const newEnd = start && end ? addDays(info.end, days) : null;
  const approvedNow = settings.autoApprovePause;

  const submit = () => {
    if (!start || !end || problem) return;
    const r = requestPause({ start, end, reason, note: note.trim() || undefined });
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    haptic.success();
    setDone({ approved: approvedNow, start, end, newEnd: newEnd!, dropped: approvedNow ? affected : 0 });
  };

  const footer = (
    <>
      {start && end ? (
        <View style={{ gap: 3 }}>
          <Text variant="h3">
            {fmtRange(start, end)}, {plural(days, 'day')}
          </Text>
          {problem ? (
            <Text variant="small" tone="danger">
              {problem}
            </Text>
          ) : (
            <Text variant="small" tone="soft">
              Your plan will end on {fmtDate(newEnd!)} instead of {fmtDay(info.end)}.
              {affected ? ` ${plural(affected, 'booking')} in these dates will be cancelled.` : ''}
            </Text>
          )}
        </View>
      ) : (
        <Text variant="smallStrong" tone="soft">
          {start ? `From ${fmtDay(start)}. Now tap the last day you’ll be away.` : 'Tap the first day you’ll be away.'}
        </Text>
      )}
      <Button
        title={approvedNow ? 'Pause membership' : 'Send pause request'}
        full
        disabled={!start || !end || !!problem}
        onPress={submit}
      />
    </>
  );

  const how: [IconName, string][] = [
    ['calendar-outline', 'Your end date moves forward by every day you pause.'],
    ['close-circle-outline', 'Bookings inside the pause are cancelled for you.'],
    ['return-down-back-outline', 'Back early? End the pause in the app and unused days come back.'],
  ];

  return (
    <Screen header="modal" title="Pause membership" footer={footer}>
      <Text tone="soft">
        Going out of town or taking time off? Pick the days you’ll be away.
        {approvedNow ? ' Your pause starts as soon as you confirm.' : ` ${brand.shortName} confirms each request, usually within a day.`}
      </Text>

      <Card style={s.facts}>
        <Fact label="Days left" value={String(info.pauseLeft)} />
        <Fact label="Shortest pause" value={plural(settings.minPauseDays, 'day')} />
        <Fact label="Earliest start" value={fmtDay(min)} />
      </Card>

      <SectionHeader title="When are you away?" />
      <Card>
        <RangeCalendar
          start={start}
          end={end}
          min={min}
          max={max}
          maxSpan={info.pauseLeft}
          blocked={taken}
          onChange={(a, b) => {
            setStart(a);
            setEnd(b);
          }}
        />
      </Card>

      <SectionHeader title="What’s the reason?" hint="Only the gym team sees this." />
      <View style={s.chips}>
        {PAUSE_REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <View style={{ marginTop: 14 }}>
        <Input
          placeholder="Anything else the gym should know? (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={200}
        />
      </View>

      <SectionHeader title="How pausing works" />
      <View style={{ gap: 12 }}>
        {how.map(([icon, text]) => (
          <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Icon name={icon} size={20} tone="primary" />
            <Text variant="small" tone="soft" style={{ flex: 1 }}>
              {text}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  facts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  doneHero: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  doneIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
}));
