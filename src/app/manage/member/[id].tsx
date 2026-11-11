import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { DateCalendar, RangeCalendar } from '@/components/Calendar';
import { CoachPanel } from '@/components/CoachPanel';
import { DateStrip } from '@/components/DateStrip';
import { scoreColor } from '@/components/fitness/TestSummary';
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
  Stepper,
  Text,
  toast,
  type IconName,
} from '@/components/ui';
import { PAUSE_REASONS } from '@/data/constants';
import { addDays, addMonths, diffDays, fmtDate, fmtDay, fmtRange, fmtRelativeDay, fmtTimeRange, plural, spanDays, termEnd, type ISODate } from '@/lib/date';
import { awayAfterDays, awayMembers, awayMessageFor, awayTemplate, membership, pauseLength, sessionRef, slotsOn, slotState, testBand, testHistory, visitDates } from '@/lib/domain';
import { firstName, money, phoneDisplay } from '@/lib/format';
import { useGym, useNow } from '@/lib/hooks';
import { api, type Invite } from '@/lib/api';
import { call, confirm, share, whatsapp } from '@/lib/native';
import { useApp, type PayMethod } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type SheetKind = 'renew' | 'payment' | 'pause' | 'dates' | 'away' | 'book' | 'dueDate' | null;
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
  const book = useApp((st) => st.book);
  const testResults = useApp((st) => st.testResults);
  const gym = useGym();

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
  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState<ISODate>(m?.startDate ?? '');
  const [endDate, setEndDate] = useState<ISODate>(m?.endDate ?? '');
  const [joinedOn, setJoinedOn] = useState<ISODate>(m?.joinedOn ?? '');
  const [dateField, setDateField] = useState<'start' | 'end' | 'joined'>('start');
  const [bookDate, setBookDate] = useState<ISODate>(now.date);
  const [promisedDate, setPromisedDate] = useState<ISODate>(m?.duePaymentDate ?? addDays(now.date, 7));
  const [partialDueDate, setPartialDueDate] = useState<ISODate | undefined>(m?.duePaymentDate);

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
  const away = awayMembers({ members: [m], plans, pauses, checkins }, now.date, awayAfterDays(settings))[0];
  const tests = testHistory(testResults, m.id);
  const lastTest = tests[tests.length - 1];
  const nudgedDaysAgo = m.nudgedOn ? diffDays(m.nudgedOn, now.date) : null;
  const bookDays = Array.from({ length: settings.bookingWindowDays }, (_, i) => addDays(now.date, i));

  const open = (k: SheetKind) => {
    if (k === 'renew') {
      setPlanId(m.planId);
      setAmount(String(plans.find((p) => p.id === m.planId)?.price ?? ''));
    }
    if (k === 'payment') setAmount(m.dues ? String(m.dues) : '');
    if (k === 'pause') setRange([null, null]);
    if (k === 'dates') {
      setStartDate(m.startDate);
      setEndDate(m.endDate);
      setJoinedOn(m.joinedOn);
      setDateField('start');
    }
    if (k === 'away') setMessage(awayMessageFor(awayTemplate(settings), m, away?.days ?? awayAfterDays(settings), brand.name));
    if (k === 'book') setBookDate(now.date);
    if (k === 'dueDate') setPromisedDate(m.duePaymentDate ?? addDays(now.date, 7));
    if (k === 'payment') {
      setAmount(m.dues ? String(m.dues) : '');
      setPartialDueDate(m.duePaymentDate);
    }
    setSheet(k);
  };

  const sendAway = () => {
    if (message.trim().length < 5) return toast.error('Write a short message first.');
    whatsapp(m.phone, message.trim());
    updateMember(m.id, { nudgedOn: now.date });
    setSheet(null);
  };

  const saveDates = () => {
    if (endDate < startDate) return toast.error('The plan has to end after it starts.');
    updateMember(m.id, { startDate, endDate, joinedOn: joinedOn > startDate ? startDate : joinedOn });
    setSheet(null);
    toast.success(`Dates saved. ${fmtDate(startDate)} to ${fmtDate(endDate)}.`);
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
    const remaining = Math.max(0, m.dues - amt);
    const p = recordPayment(m.id, amt, method, undefined, remaining > 0 ? partialDueDate : undefined);
    setSheet(null);
    toast.success(`${money(amt)} recorded. Invoice ${p.invoice}.${remaining > 0 ? ` Remaining dues: ${money(remaining)}.` : ''}`);
  };

  const saveDueDate = () => {
    updateMember(m.id, { duePaymentDate: promisedDate });
    setSheet(null);
    toast.success(`Promised payment date set to ${fmtDate(promisedDate)}.`);
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

      {away ? (
        <Card style={[s.dues, { backgroundColor: c.warning.bg }]}>
          <View style={{ flex: 1 }}>
            <Text variant="h3" tone="warning">
              {away.lastVisit ? `Not in for ${plural(away.days, 'day')}` : `No visit in ${plural(away.days, 'day')}`}
            </Text>
            <Text variant="small" tone="soft">
              {away.lastVisit ? `Last came ${fmtDay(away.lastVisit)}. ` : ''}
              {nudgedDaysAgo === null ? 'Check they’re okay.' : nudgedDaysAgo === 0 ? 'You messaged them today.' : `You messaged them ${plural(nudgedDaysAgo, 'day')} ago.`}
            </Text>
          </View>
          <Button title={nudgedDaysAgo === 0 ? 'Again' : 'Message'} size="sm" icon="logo-whatsapp" onPress={() => open('away')} />
        </Card>
      ) : null}

      {m.partnerName || m.isPartner ? (
        <Card style={{ gap: 10, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="people-outline" size={20} tone="primary" />
              <Text variant="h3">Couple Membership</Text>
            </View>
            <StatusPill status="active" />
          </View>
          <View style={{ gap: 4 }}>
            <Text variant="body">
              {m.isPartner ? 'Primary Member:' : 'Partner:'}{' '}
              <Text variant="label">{m.partnerName || 'Linked partner'}</Text>
            </Text>
            {m.partnerPhone ? (
              <Text variant="small" tone="soft">
                Phone: {phoneDisplay(m.partnerPhone)}
              </Text>
            ) : null}
            {m.isPartner ? (
              <Text variant="caption" tone="faint">
                Account linked to primary couple membership.
              </Text>
            ) : null}
          </View>
          {m.partnerMemberId ? (
            <Button
              title="View partner profile"
              size="sm"
              variant="outline"
              icon="person-outline"
              onPress={() => router.push(`/manage/member/${m.partnerMemberId}`)}
            />
          ) : null}
        </Card>
      ) : null}

      {m.pricingTag || m.discountAmount ? (
        <Card style={{ gap: 10, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="pricetag-outline" size={18} tone="primary" />
              <Text variant="h3">Special Pricing Details</Text>
            </View>
            {m.pricingTag ? (
              <Chip label={m.pricingTag} selected />
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            {m.originalPrice ? (
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="soft">Original Plan</Text>
                <Text variant="body" style={{ textDecorationLine: m.discountAmount ? 'line-through' : 'none' }}>
                  {money(m.originalPrice)}
                </Text>
              </View>
            ) : null}
            {m.discountAmount ? (
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="soft">Discount Given</Text>
                <Text variant="body" tone="success" style={{ fontWeight: '700' }}>
                  -{money(m.discountAmount)}
                </Text>
              </View>
            ) : null}
            {m.finalPrice ? (
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="soft">Agreed Fee</Text>
                <Text variant="h3" tone="primary">
                  {money(m.finalPrice)}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {m.dues > 0 ? (
        <Card style={[s.dues, { backgroundColor: c.danger.bg }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="h3" tone="danger">
              {money(m.dues)} due
            </Text>
            {m.duePaymentDate ? (
              <Text
                variant="small"
                tone={m.duePaymentDate < now.date ? 'danger' : m.duePaymentDate === now.date ? 'warning' : 'soft'}
                style={{ fontWeight: m.duePaymentDate <= now.date ? '700' : '400' }}>
                {m.duePaymentDate < now.date
                  ? `🚨 Overdue by ${diffDays(m.duePaymentDate, now.date)}d (Promised: ${fmtDate(m.duePaymentDate)})`
                  : m.duePaymentDate === now.date
                  ? `⚠️ Promised today (${fmtDate(m.duePaymentDate)})`
                  : `📅 Promised by ${fmtDate(m.duePaymentDate)} (${diffDays(now.date, m.duePaymentDate)}d left)`}
              </Text>
            ) : (
              <Text variant="small" tone="soft">
                No promised date scheduled.
              </Text>
            )}
            <Pressable onPress={() => open('dueDate')}>
              <Text variant="caption" tone="primary" style={{ textDecorationLine: 'underline', marginTop: 2 }}>
                {m.duePaymentDate ? 'Change promised due date' : 'Set promised due date'}
              </Text>
            </Pressable>
          </View>
          <View style={{ gap: 6 }}>
            <Button
              title="Remind"
              size="sm"
              variant="soft"
              icon="logo-whatsapp"
              onPress={() => {
                const dateNote = m.duePaymentDate ? ` (agreed date: ${fmtDate(m.duePaymentDate)})` : '';
                whatsapp(
                  m.phone,
                  `Hi ${firstName(m.name)}, a friendly reminder from ${brand.name}: your membership balance of ${money(m.dues)}${dateNote} is pending. Please pay at the front desk or via UPI. Thank you!`,
                );
              }}
            />
            <Button title="Collect" size="sm" onPress={() => open('payment')} />
          </View>
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
        <Button title="Change dates" size="sm" variant="ghost" icon="calendar-outline" onPress={() => open('dates')} />
        <Text variant="caption" tone="faint">
          Member since {fmtDate(m.joinedOn)}
        </Text>
      </Card>
      <Group inset={16} style={{ marginTop: 10 }}>
        <Row
          title="Pause days this term"
          subtitle={`Their plan gives ${plural(info.plan?.pauseDays ?? 0, 'day')}. ${info.pauseLeft} left.`}
          chevron={false}
          right={<Stepper value={m.pauseAllowance} min={0} max={180} label="pause days this term" format={(v) => `${v}d`} onChange={(v) => updateMember(m.id, { pauseAllowance: v })} />}
        />
        {brand.features.guestPass ? (
          <Row
            title="Extra guest passes"
            subtitle={`On top of ${settings.guestPassesPerMonth} a month. ${m.bonusUsed ?? 0} used.`}
            chevron={false}
            right={<Stepper value={m.bonusGuestPasses ?? 0} min={m.bonusUsed ?? 0} max={50} label="extra guest passes" onChange={(v) => updateMember(m.id, { bonusGuestPasses: v })} />}
          />
        ) : null}
      </Group>

      <SectionHeader title="App access" />
      <Card style={{ gap: 10 }}>
        <Text variant="small" tone="soft">
          They sign in with their number and a member code. If {firstName(m.name)} lost it, send a fresh one. The old one stops working.
        </Text>
        <Button
          title="Send a new member code"
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

      <SectionHeader title="Booked" action="Book a slot" onAction={() => open('book')} />
      {upcoming.length ? (
        <>
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
      ) : (
        <Text variant="small" tone="soft">
          Nothing booked. Tap Book a slot to book {firstName(m.name)} in.
        </Text>
      )}

      {brand.features.fitnessTest !== false ? (
        <>
          <SectionHeader title="Strength test" />
          <Card style={{ gap: 10 }}>
            {lastTest ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text variant="display" color={scoreColor(c, lastTest.score)}>
                  {lastTest.score}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{testBand(lastTest.score).label}</Text>
                  <Text variant="caption" tone="soft">
                    {fmtDate(lastTest.date)}
                    {tests.length > 1 ? `, ${lastTest.score - tests[tests.length - 2].score >= 0 ? 'up' : 'down'} ${Math.abs(lastTest.score - tests[tests.length - 2].score)} from ${tests[tests.length - 2].score}` : ''}
                  </Text>
                </View>
              </View>
            ) : (
              <Text variant="small" tone="soft">
                Not tested yet. Run the test with {firstName(m.name)} for a starting score to beat.
              </Text>
            )}
            {lastTest ? (
              <Text variant="caption" tone="soft">
                {lastTest.lines.map((l) => `${l.name} ${l.score}`).join(', ')}
              </Text>
            ) : null}
            <Button title={lastTest ? 'Test again' : 'Run the test'} size="md" variant="soft" icon="stopwatch-outline" onPress={() => router.push(`/manage/test-run?memberId=${m.id}`)} />
          </Card>
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
        title="New member code"
        subtitle={`For ${m.name}. It’s their login until you send a new one.`}
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
            Member code
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
        {m.dues > (parseInt(amount, 10) || 0) && (parseInt(amount, 10) || 0) > 0 ? (
          <View style={{ marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: brand.colors.primary, gap: 6, backgroundColor: c.surface }}>
            <Text variant="label" tone="warning">
              Remaining: {money(m.dues - (parseInt(amount, 10) || 0))}
            </Text>
            <Text variant="caption" tone="soft">
              Promised date for remaining balance:
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {[
                { label: '+7d', date: addDays(now.date, 7) },
                { label: '+15d', date: addDays(now.date, 15) },
                { label: '+30d', date: addDays(now.date, 30) },
              ].map((opt) => (
                <Chip
                  key={opt.label}
                  label={`${opt.label} (${fmtDay(opt.date)})`}
                  selected={partialDueDate === opt.date}
                  onPress={() => setPartialDueDate(opt.date)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </Sheet>

      <Sheet
        visible={sheet === 'dueDate'}
        onClose={() => setSheet(null)}
        title="Promised due date"
        subtitle={`Schedule when ${firstName(m.name)} promised to pay remaining ${money(m.dues)}.`}
        footer={<Button title={`Save date (${fmtDate(promisedDate)})`} full onPress={saveDueDate} />}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            { label: '+7 days', date: addDays(now.date, 7) },
            { label: '+15 days', date: addDays(now.date, 15) },
            { label: '+1 month', date: addDays(now.date, 30) },
          ].map((opt) => (
            <Chip
              key={opt.label}
              label={`${opt.label} (${fmtDay(opt.date)})`}
              selected={promisedDate === opt.date}
              onPress={() => setPromisedDate(opt.date)}
            />
          ))}
        </View>
        <DateCalendar
          value={promisedDate}
          onChange={setPromisedDate}
          min={now.date}
          max={addMonths(now.date, 12)}
          jump
        />
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

      <Sheet
        visible={sheet === 'away'}
        onClose={() => setSheet(null)}
        title={`Message ${firstName(m.name)}`}
        subtitle="Opens WhatsApp with this message. Change anything before you send."
        footer={<Button title="Send on WhatsApp" icon="logo-whatsapp" full onPress={sendAway} />}>
        <Input value={message} onChangeText={setMessage} multiline />
        <Text variant="caption" tone="soft">
          Change the standard message in Booking and pause rules.
        </Text>
      </Sheet>

      <Sheet
        visible={sheet === 'dates'}
        onClose={() => setSheet(null)}
        title="Change dates"
        subtitle="For members who joined before you started using the app, or a date entered wrong. Tap the month to jump to another year."
        footer={<Button title="Save dates" full onPress={saveDates} />}>
        <View style={s.wrap}>
          <Chip label={`Plan starts ${fmtDate(startDate)}`} selected={dateField === 'start'} onPress={() => setDateField('start')} />
          <Chip label={`Ends ${fmtDate(endDate)}`} selected={dateField === 'end'} onPress={() => setDateField('end')} />
          <Chip label={`Member since ${fmtDate(joinedOn)}`} selected={dateField === 'joined'} onPress={() => setDateField('joined')} />
        </View>
        {dateField === 'start' ? (
          <DateCalendar
            key="start"
            value={startDate}
            onChange={(d) => {
              setStartDate(d);
              // Keep the plan's length: moving the start moves the end with it.
              setEndDate(termEnd(d, info.plan?.months ?? 1));
              if (joinedOn > d) setJoinedOn(d);
            }}
            min={addMonths(now.date, -12 * 30)}
            max={addMonths(now.date, 3)}
            jump
          />
        ) : dateField === 'end' ? (
          <DateCalendar key="end" value={endDate} onChange={setEndDate} min={startDate} max={addMonths(startDate, 12 * 5)} jump />
        ) : (
          <DateCalendar key="joined" value={joinedOn} onChange={setJoinedOn} min={addMonths(now.date, -12 * 30)} max={startDate} jump />
        )}
        <Text variant="caption" tone="soft">
          Moving the start keeps the plan’s length ({plural(info.plan?.months ?? 1, 'month')}). Pick the end separately for a different length.
        </Text>
      </Sheet>

      <Sheet visible={sheet === 'book'} onClose={() => setSheet(null)} title={`Book ${firstName(m.name)} in`} subtitle="Pick a day, then a slot. They see it in their app.">
        <DateStrip days={bookDays} value={bookDate} onChange={setBookDate} />
        <View style={{ gap: 8 }}>
          {slotsOn(gym.slots, bookDate).length === 0 ? (
            <Text variant="small" tone="soft">
              No slots run that day.
            </Text>
          ) : (
            slotsOn(gym.slots, bookDate).map((slot) => {
              const st = slotState(gym, bookDate, slot, 'slot', m.id, { date: now.date, mins: now.mins });
              return (
                <Row
                  key={slot.id}
                  title={fmtTimeRange(slot.start, slot.end)}
                  subtitle={st.closure ? `Closed: ${st.closure.reason}` : st.over ? 'Finished' : st.mine ? `${firstName(m.name)} is booked` : `${st.count} of ${st.capacity} booked${st.started ? ', under way' : ''}`}
                  chevron={false}
                  action={
                    st.closure || st.over || st.mine ? undefined : (
                      <Button
                        title={st.left > 0 ? 'Book' : 'Full'}
                        size="sm"
                        disabled={st.left <= 0}
                        onPress={() => {
                          if (toast.result(book(bookDate, 'slot', slot.id, { memberId: m.id }))) setSheet(null);
                        }}
                      />
                    )
                  }
                />
              );
            })
          )}
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
