import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { RangeCalendar } from '@/components/Calendar';
import { CoachPanel } from '@/components/CoachPanel';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Empty,
  Group,
  Icon,
  Input,
  ProgressBar,
  Row,
  Screen,
  SectionHeader,
  Sheet,
  StatusPill,
  Text,
  toast,
  type IconName,
} from '@/components/ui';
import { PAUSE_REASONS } from '@/data/constants';
import { addDays, fmtDate, fmtDay, fmtRange, fmtRelativeDay, fmtTimeRange, plural, spanDays, termEnd, type ISODate } from '@/lib/date';
import { membership, pauseLength, sessionRef, visitDates } from '@/lib/domain';
import { firstName, money, phoneDisplay } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { api, type Invite } from '@/lib/api';
import { call, confirm, share, whatsapp } from '@/lib/native';
import { useApp, type PayMethod } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type SheetKind = 'renew' | 'payment' | 'pause' | null;
const METHODS: PayMethod[] = ['UPI', 'Cash', 'Card'];

export default function MemberDetail() {
  const { c, brand } = useTheme();
  const s = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const now = useNow(60_000);
  const members = useApp((st) => st.members);
  const plans = useApp((st) => st.plans);
  const pauses = useApp((st) => st.pauses);
  const payments = useApp((st) => st.payments);
  const checkins = useApp((st) => st.checkins);
  const bookings = useApp((st) => st.bookings);
  const slots = useApp((st) => st.slots);
  const classes = useApp((st) => st.classes);
  const settings = useApp((st) => st.settings);
  const renew = useApp((st) => st.renew);
  const recordPayment = useApp((st) => st.recordPayment);
  const checkIn = useApp((st) => st.checkIn);
  const requestPause = useApp((st) => st.requestPause);
  const decidePause = useApp((st) => st.decidePause);
  const updateMember = useApp((st) => st.updateMember);
  const removeMember = useApp((st) => st.removeMember);

  const m = members.find((x) => x.id === id);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [inviting, setInviting] = useState(false);
  const [planId, setPlanId] = useState(m?.planId ?? '');
  const [method, setMethod] = useState<PayMethod>('UPI');
  const [amount, setAmount] = useState('');
  const [range, setRange] = useState<[ISODate | null, ISODate | null]>([null, null]);
  const [reason, setReason] = useState(PAUSE_REASONS[0]);
  const [notes, setNotes] = useState(m?.notes ?? '');

  if (!m) {
    return (
      <Screen header="stack" title="Member">
        <Empty icon="person-outline" title="Member not found" body="They may have been removed." action="Back to members" onAction={() => router.back()} />
      </Screen>
    );
  }

  const info = membership(m, plans, pauses, now.date);
  const from = addDays(now.date, -29);
  const visits = new Set(visitDates(checkins, m.id));
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(from, i));
  const visitCount = last30.filter((d) => visits.has(d)).length;
  const myPayments = payments.filter((p) => p.memberId === m.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const myPauses = pauses.filter((p) => p.memberId === m.id).sort((a, b) => (a.start < b.start ? 1 : -1));
  const upcoming = bookings
    .filter((b) => b.memberId === m.id && b.status === 'booked' && b.date >= now.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const selectedPlan = plans.find((p) => p.id === planId) ?? plans[0];

  const open = (k: SheetKind) => {
    if (k === 'renew') {
      setPlanId(m.planId);
      setAmount(String(plans.find((p) => p.id === m.planId)?.price ?? ''));
    }
    if (k === 'payment') setAmount(m.dues ? String(m.dues) : '');
    if (k === 'pause') setRange([null, null]);
    setSheet(k);
  };

  const doRenew = () => {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return toast.error('Enter the amount you collected.');
    const p = renew(m.id, selectedPlan.id, method, amt);
    setSheet(null);
    toast.success(`Renewed. Invoice ${p.invoice}.`);
  };

  const doPayment = () => {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return toast.error('Enter the amount you collected.');
    const p = recordPayment(m.id, amt, method);
    setSheet(null);
    toast.success(`${money(amt)} recorded. Invoice ${p.invoice}.`);
  };

  const doPause = () => {
    const [a, b] = range;
    if (!a || !b) return toast.error('Pick the first and last day of the pause.');
    if (toast.result(requestPause({ start: a, end: b, reason, memberId: m.id, byManager: true }))) setSheet(null);
  };

  const actions: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'call-outline', label: 'Call', onPress: () => call(m.phone) },
    { icon: 'logo-whatsapp', label: 'WhatsApp', onPress: () => whatsapp(m.phone, `Hi ${firstName(m.name)}, this is ${brand.shortName}. `) },
    { icon: 'enter-outline', label: 'Check in', onPress: () => toast.result(checkIn(m.id, 'desk')) },
    { icon: 'cash-outline', label: 'Payment', onPress: () => open('payment') },
  ];

  return (
    <Screen header="stack" title="Member">
      <View style={s.hero}>
        <Avatar name={m.name} size={64} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="h2">{m.name}</Text>
          <Text variant="small" tone="soft">
            {m.code}, {phoneDisplay(m.phone)}
          </Text>
          <StatusPill status={info.expiringSoon ? 'expiring' : info.status} />
        </View>
      </View>

      <View style={s.actions}>
        {actions.map((a) => (
          <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress} style={({ pressed }) => [s.action, pressed && { opacity: 0.7 }]}>
            <View style={s.actionIcon}>
              <Icon name={a.icon} size={22} tone="primary" />
            </View>
            <Text variant="caption" tone="soft">
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {m.dues > 0 ? (
        <Card style={[s.dues, { backgroundColor: c.danger.bg }]}>
          <View style={{ flex: 1 }}>
            <Text variant="h3" tone="danger">
              {money(m.dues)} due
            </Text>
            <Text variant="small" tone="soft">
              Collect it at the desk or send a reminder.
            </Text>
          </View>
          <Button title="Record" size="sm" onPress={() => open('payment')} />
        </Card>
      ) : null}

      <SectionHeader title="Membership" />
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text variant="h3">{info.plan?.name ?? 'Plan'}</Text>
            <Text variant="small" tone="soft">
              {fmtDate(info.start)} to {fmtDate(info.end)}
            </Text>
          </View>
          <Text variant="h2" tone={info.status === 'expired' ? 'danger' : 'ink'}>
            {info.status === 'expired' ? 'Ended' : `${info.daysLeft}d`}
          </Text>
        </View>
        <ProgressBar value={info.progress} color={info.status === 'paused' ? c.ice.solid : c.primary} />
        <Text variant="caption" tone="soft">
          {info.extendedBy ? `End date includes ${plural(info.extendedBy, 'pause day')}. ` : ''}
          {plural(info.pauseLeft, 'pause day')} left of {info.pauseAllowance}.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Renew" size="md" onPress={() => open('renew')} style={{ flex: 1 }} />
          <Button title="Pause" size="md" variant="outline" disabled={info.status === 'expired'} onPress={() => open('pause')} style={{ flex: 1 }} />
        </View>
      </Card>

      <SectionHeader title="App access" />
      <Card style={{ gap: 10 }}>
        <Text variant="small" tone="soft">
          They open the app with a one-time code. If {firstName(m.name)} lost it or got a new phone, send a fresh one. The old one stops working.
        </Text>
        <Button
          title="Send a new invite code"
          icon="logo-whatsapp"
          size="md"
          variant="outline"
          loading={inviting}
          onPress={async () => {
            setInviting(true);
            const r = await api.reinvite(m.id);
            setInviting(false);
            if (!r.ok) return toast.error(r.message);
            setInvite(r.data);
          }}
        />
      </Card>

      <SectionHeader title="Last 30 days" hint={`${plural(visitCount, 'visit')}, goal ${m.weeklyGoal} a week`} />
      <Card style={s.dots}>
        {last30.map((d) => (
          <View
            key={d}
            accessibilityLabel={`${d} ${visits.has(d) ? 'visited' : 'no visit'}`}
            style={[s.dot, { backgroundColor: visits.has(d) ? c.primary : c.line }]}
          />
        ))}
      </Card>

      {upcoming.length ? (
        <>
          <SectionHeader title="Booked" />
          <Group inset={16}>
            {upcoming.map((b) => {
              const ref = sessionRef({ slots, classes }, b.kind, b.refId);
              return (
                <Row
                  key={b.id}
                  title={ref?.title ?? 'Gym floor'}
                  subtitle={fmtRelativeDay(b.date, now.date)}
                  value={ref ? fmtTimeRange(ref.start, ref.end) : ''}
                />
              );
            })}
          </Group>
        </>
      ) : null}

      {myPauses.length ? (
        <>
          <SectionHeader title="Pauses" />
          <View style={{ gap: 8 }}>
            {myPauses.map((p) => (
              <Card key={p.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="label">
                    {fmtRange(p.start, p.end)}, {plural(pauseLength(p), 'day')}
                  </Text>
                  <StatusPill status={p.status} />
                </View>
                <Text variant="small" tone="soft">
                  {p.reason}
                  {p.note ? `. ${p.note}` : ''}
                </Text>
                {p.status === 'pending' ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button title="Approve" size="sm" onPress={() => decidePause(p.id, true)} />
                    <Button title="Decline" size="sm" variant="outline" onPress={() => decidePause(p.id, false, 'Please talk to the front desk about these dates.')} />
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Payments" hint={`${money(myPayments.reduce((sum, p) => sum + p.amount, 0))} in total`} />
      {myPayments.length ? (
        <Group inset={16}>
          {myPayments.slice(0, 6).map((p) => (
            <Row key={p.id} title={money(p.amount)} subtitle={`${fmtDate(p.date)}, ${p.method}${p.note ? `, ${p.note}` : ''}`} value={p.invoice} valueTone="faint" />
          ))}
        </Group>
      ) : (
        <Text variant="small" tone="soft">
          No payments recorded.
        </Text>
      )}

      <CoachPanel member={m} />

      <SectionHeader title="Notes" hint="Only staff see these." />
      <Input
        placeholder="Injuries, preferences, anything the team should know"
        value={notes}
        onChangeText={setNotes}
        onBlur={() => notes !== (m.notes ?? '') && updateMember(m.id, { notes })}
        multiline
      />

      <Button
        title="Remove member"
        variant="danger"
        full
        style={{ marginTop: 28 }}
        onPress={() =>
          confirm({
            title: `Remove ${m.name}?`,
            message: 'Their bookings and pauses are deleted. Payment records stay for your accounts.',
            confirmText: 'Remove',
            destructive: true,
            onConfirm: () => {
              removeMember(m.id);
              router.back();
              toast.success(`${m.name} removed.`);
            },
          })
        }
      />

      <Sheet
        visible={!!invite}
        onClose={() => setInvite(null)}
        title="New invite code"
        subtitle={`For ${m.name}. It works once and for ${invite?.expiresInDays ?? 7} days.`}
        footer={
          invite ? (
            <>
              <Button title="Send on WhatsApp" icon="logo-whatsapp" full onPress={() => whatsapp(invite.whatsapp.phone, invite.whatsapp.text)} />
              <Button title="Share another way" variant="ghost" full onPress={() => share(invite.whatsapp.text)} />
            </>
          ) : undefined
        }>
        <Card style={{ alignItems: 'center', gap: 4, paddingVertical: 20 }}>
          <Text variant="caption" tone="soft">
            Invite code
          </Text>
          <Text variant="hero">{invite?.inviteCode}</Text>
        </Card>
      </Sheet>

      <Sheet
        visible={sheet === 'renew'}
        onClose={() => setSheet(null)}
        title="Renew membership"
        subtitle={
          info.status === 'expired'
            ? 'Starts today.'
            : `Starts after the current plan, on ${fmtDay(addDays(info.end, 1))}. Valid until ${fmtDate(termEnd(addDays(info.end, 1), selectedPlan.months))}.`
        }
        footer={<Button title={`Collect ${money(parseInt(amount, 10) || 0)}`} full onPress={doRenew} />}>
        <View style={s.wrap}>
          {plans
            .filter((p) => p.active)
            .map((p) => (
              <Chip
                key={p.id}
                label={`${p.name}, ${money(p.price)}`}
                selected={planId === p.id}
                onPress={() => {
                  setPlanId(p.id);
                  setAmount(String(p.price));
                }}
              />
            ))}
        </View>
        <Input label="Amount collected" prefix={brand.currency.symbol} value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} keyboardType="number-pad" hint="Lower it for a discount or a part payment." />
        <View style={s.wrap}>
          {METHODS.map((x) => (
            <Chip key={x} label={x} selected={method === x} onPress={() => setMethod(x)} />
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={sheet === 'payment'}
        onClose={() => setSheet(null)}
        title="Record a payment"
        subtitle={m.dues ? `${money(m.dues)} is due.` : 'Log money collected at the desk.'}
        footer={<Button title="Save payment" full onPress={doPayment} />}>
        <Input label="Amount" prefix={brand.currency.symbol} value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} keyboardType="number-pad" autoFocus />
        <View style={s.wrap}>
          {METHODS.map((x) => (
            <Chip key={x} label={x} selected={method === x} onPress={() => setMethod(x)} />
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={sheet === 'pause'}
        onClose={() => setSheet(null)}
        title={`Pause ${firstName(m.name)}`}
        subtitle={`${plural(info.pauseLeft, 'pause day')} left. Approved straight away.`}
        footer={
          <Button
            title={range[0] && range[1] ? `Pause ${plural(spanDays(range[0], range[1]), 'day')}` : 'Pick dates'}
            full
            disabled={!range[0] || !range[1]}
            onPress={doPause}
          />
        }>
        <RangeCalendar
          start={range[0]}
          end={range[1]}
          min={now.date}
          max={addDays(info.end, info.pauseLeft)}
          maxSpan={Math.max(settings.minPauseDays, info.pauseLeft)}
          onChange={(a, b) => setRange([a, b])}
        />
        <View style={s.wrap}>
          {PAUSE_REASONS.map((r) => (
            <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { alignItems: 'center', gap: 6, width: '24%' },
  actionIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: t.c.surface, alignItems: 'center', justifyContent: 'center' },
  dues: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 18, height: 18, borderRadius: 5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
