import { router } from 'expo-router';
import { View } from 'react-native';

import { MembershipCard } from '@/components/MembershipCard';
import {
  Button,
  Card,
  Group,
  Icon,
  ProgressBar,
  Row,
  Screen,
  SectionHeader,
  StatusPill,
  Text,
  toast,
} from '@/components/ui';
import { fmtDate, fmtRange, plural } from '@/lib/date';
import { pauseLength } from '@/lib/domain';
import { money } from '@/lib/format';
import { useMyMembership, useNow } from '@/lib/hooks';
import { confirm } from '@/lib/native';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function Membership() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const { member: me, info } = useMyMembership(now.date);
  const payments = useApp((st) => st.payments);
  const pauses = useApp((st) => st.pauses);
  const settings = useApp((st) => st.settings);
  const cancelPause = useApp((st) => st.cancelPause);
  const endPauseEarly = useApp((st) => st.endPauseEarly);

  if (!me || !info) return null;

  const myPayments = payments.filter((p) => p.memberId === me.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const history = pauses
    .filter((p) => p.memberId === me.id)
    .sort((a, b) => (a.start < b.start ? 1 : -1));
  const canPause = info.status !== 'expired' && info.pauseLeft >= settings.minPauseDays;

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

  const pending = info.pendingPause;
  const upcoming = info.upcomingPause;

  return (
    <Screen header="stack" title="Membership">
      <MembershipCard info={info} inset onAction={onCardAction} />

      {pending ? (
        <Card variant="soft" style={s.notice}>
          <Icon name="hourglass-outline" size={22} tone="primary" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="label">Pause request waiting for the gym</Text>
            <Text variant="small" tone="soft">
              {fmtRange(pending.start, pending.end)}, {plural(pauseLength(pending), 'day')}. You’ll get a notification when it’s approved.
            </Text>
            <Button
              title="Withdraw request"
              variant="outline"
              size="sm"
              style={{ marginTop: 6 }}
              onPress={() =>
                confirm({
                  title: 'Withdraw this pause request?',
                  confirmText: 'Withdraw',
                  destructive: true,
                  onConfirm: () => toast.result(cancelPause(pending.id)),
                })
              }
            />
          </View>
        </Card>
      ) : null}

      {upcoming ? (
        <Card variant="soft" style={s.notice}>
          <Icon name="airplane-outline" size={22} tone="primary" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="label">Pause coming up</Text>
            <Text variant="small" tone="soft">
              {fmtRange(upcoming.start, upcoming.end)}. Your end date already includes these {pauseLength(upcoming)} days.
            </Text>
            <Button
              title="Cancel pause"
              variant="outline"
              size="sm"
              style={{ marginTop: 6 }}
              onPress={() =>
                confirm({
                  title: 'Cancel this pause?',
                  message: 'Your end date moves back and the days return to your balance.',
                  confirmText: 'Cancel pause',
                  cancelText: 'Keep it',
                  destructive: true,
                  onConfirm: () => toast.result(cancelPause(upcoming.id)),
                })
              }
            />
          </View>
        </Card>
      ) : null}

      <SectionHeader
        title="Pause your membership"
        hint="Away for a while? Pause it and your end date moves forward by the same number of days."
      />
      <Card style={{ gap: 14 }}>
        <View style={s.balance}>
          <Text variant="display">{info.pauseLeft}</Text>
          <Text variant="small" tone="soft" style={{ flex: 1, marginBottom: 8 }}>
            of {info.pauseAllowance} pause days left this term
          </Text>
        </View>
        <ProgressBar value={info.pauseAllowance ? info.pauseLeft / info.pauseAllowance : 0} color={c.ice.solid} />
        <Text variant="caption" tone="soft">
          Pauses need at least {plural(settings.minPauseDays, 'day')}
          {settings.pauseNoticeDays ? ` and ${settings.pauseNoticeDays === 1 ? '1 day’s' : `${settings.pauseNoticeDays} days’`} notice` : ''}.
          {settings.autoApprovePause ? ' They’re confirmed straight away.' : ' The gym confirms each request.'}
        </Text>
        <Button
          title="Pause membership"
          icon="airplane-outline"
          variant="ink"
          full
          disabled={!canPause}
          onPress={() => router.push('/member/pause')}
        />
        {!canPause && info.status !== 'expired' ? (
          <Text variant="caption" tone="warning">
            You don’t have enough pause days left this term. Renewing adds more.
          </Text>
        ) : null}
      </Card>

      <SectionHeader title="Your plan" action="Change plan" onAction={() => router.push('/member/renew')} />
      <Group inset={16}>
        <Row title={info.plan?.name ?? 'Plan'} subtitle={`${info.plan?.months ?? 0}-month membership`} value={money(info.plan?.price ?? 0)} />
        <Row title="Started" value={fmtDate(info.start)} />
        <Row
          title="Ends"
          subtitle={info.extendedBy ? `Includes ${plural(info.extendedBy, 'day')} added by pauses` : undefined}
          value={fmtDate(info.end)}
        />
        <Row title="Member ID" value={me.code} />
      </Group>
      {info.plan?.perks.length ? (
        <Card variant="inset" style={{ marginTop: 10, gap: 8 }}>
          {info.plan.perks.map((p) => (
            <View key={p} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icon name="checkmark" size={16} tone="success" />
              <Text variant="small">{p}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <SectionHeader title="Payments" action="See all" onAction={() => router.push('/member/payments')} />
      <Group inset={16}>
        {myPayments.slice(0, 3).map((p) => (
          <Row
            key={p.id}
            title={money(p.amount)}
            subtitle={`${fmtDate(p.date)}, ${p.method}`}
            value={p.invoice}
            valueTone="faint"
            onPress={() => router.push('/member/payments')}
          />
        ))}
      </Group>

      {history.length ? (
        <>
          <SectionHeader title="Pause history" />
          <Group inset={16}>
            {history.map((p) => (
              <Row
                key={p.id}
                title={fmtRange(p.start, p.end)}
                subtitle={`${plural(pauseLength(p), 'day')}, ${p.reason.toLowerCase()}${p.decisionNote ? `. ${p.decisionNote}` : ''}`}
                right={<StatusPill status={p.status === 'approved' && p.end < now.date ? 'approved' : p.status} />}
              />
            ))}
          </Group>
        </>
      ) : null}

      <Text variant="caption" tone="faint" align="center" style={{ marginTop: 24 }}>
        Questions about your plan? Ask at the desk or message the gym from Help.
      </Text>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  notice: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'flex-start' },
  balance: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
}));
