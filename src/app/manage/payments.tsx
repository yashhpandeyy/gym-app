import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Chip, Empty, Fact, Group, Input, Row, Screen, Segmented, Sheet, Text, toast } from '@/components/ui';
import { addDays, diffDays, fmtDate, fmtDay, MONTHS_LONG, monthKey, parts, type ISODate } from '@/lib/date';
import { membership } from '@/lib/domain';
import { firstName, money } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { whatsapp } from '@/lib/native';
import { useApp, type Member, type PayMethod } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type Tab = 'received' | 'dues' | 'ending';

export default function Payments() {
  const { brand } = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const now = useNow(60_000);
  const payments = useApp((st) => st.payments);
  const members = useApp((st) => st.members);
  const plans = useApp((st) => st.plans);
  const pauses = useApp((st) => st.pauses);
  const recordPayment = useApp((st) => st.recordPayment);
  const [tab, setTab] = useState<Tab>(params.tab === 'dues' ? 'dues' : params.tab === 'ending' ? 'ending' : 'received');
  const [collect, setCollect] = useState<Member | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethod>('UPI');
  const [chequeNumber, setChequeNumber] = useState('');
  const [customDueDate, setCustomDueDate] = useState<ISODate | undefined>(undefined);

  const month = monthKey(now.date);
  const thisMonth = payments.filter((p) => monthKey(p.date) === month);
  const total = thisMonth.reduce((sum, p) => sum + p.amount, 0);
  const byMethod = (['UPI', 'Cash', 'Card', 'Cheque'] as PayMethod[]).map((m) => ({
    m,
    sum: thisMonth.filter((p) => p.method === m).reduce((x, p) => x + p.amount, 0),
  }));

  const owing = members.filter((m) => m.dues > 0).sort((a, b) => b.dues - a.dues);
  const recent = [...payments].sort((a, b) => (a.date === b.date ? (a.invoice < b.invoice ? 1 : -1) : a.date < b.date ? 1 : -1)).slice(0, 40);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Former member';

  // Members whose subscriptions are ending soon (within 14 days) or recently expired
  const endingMembers = members
    .map((m) => ({ m, info: membership(m, plans, pauses, now.date) }))
    .filter(({ info }) => (info.status === 'active' && info.daysLeft <= 14) || (info.status === 'expired' && info.expiredDaysAgo <= 14))
    .sort((a, b) => a.info.daysLeft - b.info.daysLeft);

  const save = () => {
    if (!collect) return;
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return toast.error('Enter the amount you collected.');
    const remainingDues = Math.max(0, collect.dues - amt);
    const p = recordPayment(
      collect.id,
      amt,
      method,
      remainingDues === 0 ? 'Dues cleared' : `Partial payment (${money(remainingDues)} remaining)`,
      remainingDues > 0 ? (customDueDate ?? collect.duePaymentDate) : undefined,
      method === 'Cheque' ? chequeNumber.trim() || undefined : undefined,
    );
    toast.success(`${money(amt)} from ${firstName(collect.name)}. Invoice ${p.invoice}.${remainingDues > 0 ? ` ${money(remainingDues)} remaining.` : ''}${method === 'Cheque' ? ' Cheque pending clearance.' : ''}`);
    setCollect(null);
    setCustomDueDate(undefined);
    setChequeNumber('');
  };

  const openCollect = (m: Member) => {
    setAmount(String(m.dues));
    setMethod('UPI');
    setCustomDueDate(m.duePaymentDate);
    setCollect(m);
  };

  const parsedAmount = parseInt(amount, 10) || 0;
  const remainingDues = collect ? Math.max(0, collect.dues - parsedAmount) : 0;

  return (
    <Screen header="stack" title="Fee Collection & Dues">
      <Card style={{ gap: 14 }}>
        <View>
          <Text variant="small" tone="soft">
            Collected in {MONTHS_LONG[parts(now.date).m]}
          </Text>
          <Text variant="display">{money(total)}</Text>
          <Text variant="small" tone="soft">
            {thisMonth.length} payments
          </Text>
        </View>
        <View style={s.facts}>
          {byMethod.map((x) => (
            <Fact key={x.m} label={x.m} value={money(x.sum, { compact: true })} />
          ))}
          <Fact label="Dues" value={money(owing.reduce((sum, m) => sum + m.dues, 0), { compact: true })} tone="danger" />
          <Fact label="Ending" value={String(endingMembers.length)} tone="warning" />
        </View>
      </Card>

      <View style={{ marginTop: 16, marginBottom: 14 }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'received', label: 'Received' },
            { value: 'dues', label: 'Dues', count: owing.length },
            { value: 'ending', label: 'Ending Soon', count: endingMembers.length },
          ]}
        />
      </View>

      {tab === 'received' ? (
        recent.length ? (
          <Group inset={16}>
            {recent.map((p) => (
              <Row
                key={p.id}
                title={nameOf(p.memberId)}
                subtitle={`${fmtDate(p.date)}, ${p.method}${p.chequeStatus === 'pending' ? ' ⏳' : p.chequeStatus === 'cleared' ? ' ✅' : p.chequeStatus === 'bounced' ? ' ❌' : ''}${p.tag ? ` • [${p.tag}]` : ''}${p.note ? ` • ${p.note}` : ''}`}
                value={money(p.amount)}
                valueTone="ink"
                onPress={() => router.push(`/manage/member/${p.memberId}`)}
                chevron={false}
              />
            ))}
          </Group>
        ) : (
          <Empty icon="cash-outline" title="No payments recorded" body="Payments logged here appear in this tab." />
        )
      ) : tab === 'dues' ? (
        owing.length ? (
          <Group>
            {owing.map((m) => {
              const isOverdue = m.duePaymentDate ? m.duePaymentDate < now.date : false;
              const isDueToday = m.duePaymentDate === now.date;
              const daysLeft = m.duePaymentDate ? diffDays(now.date, m.duePaymentDate) : null;
              const overdueDays = m.duePaymentDate && isOverdue ? diffDays(m.duePaymentDate, now.date) : 0;

              let dueStatus = 'No due date set';
              if (isDueToday) dueStatus = '⚠️ Promised TODAY';
              else if (isOverdue) dueStatus = `🚨 Overdue by ${overdueDays}d (Was due ${fmtDate(m.duePaymentDate!)})`;
              else if (daysLeft !== null) dueStatus = `📅 Due in ${daysLeft}d (${fmtDate(m.duePaymentDate!)})`;

              return (
                <Row
                  key={m.id}
                  leading={<Avatar name={m.name} size={36} />}
                  title={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text variant="label">{m.name}</Text>
                      {m.partnerName || m.isPartner ? (
                        <View style={s.miniTag}>
                          <Text variant="caption" tone="primary" style={{ fontSize: 11, fontWeight: '600' }}>
                            👫 Couple
                          </Text>
                        </View>
                      ) : null}
                      {m.pricingTag ? (
                        <View style={s.miniTag}>
                          <Text variant="caption" tone="ink" style={{ fontSize: 11, fontWeight: '600' }}>
                            {m.pricingTag}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  }
                  subtitle={
                    <View style={{ gap: 2, marginTop: 2 }}>
                      <Text variant="small" tone="danger" style={{ fontWeight: '600' }}>
                        {money(m.dues)} pending
                      </Text>
                      <Text variant="caption" tone={isOverdue ? 'danger' : isDueToday ? 'warning' : 'soft'}>
                        {dueStatus}
                      </Text>
                    </View>
                  }
                  chevron={false}
                  onPress={() => router.push(`/manage/member/${m.id}`)}
                  action={
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Button
                        title="Remind"
                        size="sm"
                        variant="soft"
                        icon="logo-whatsapp"
                        onPress={() => {
                          const dateNote = m.duePaymentDate
                            ? isOverdue
                              ? ` which was scheduled for payment on ${fmtDate(m.duePaymentDate)}`
                              : ` scheduled for ${fmtDate(m.duePaymentDate)}`
                            : '';
                          whatsapp(
                            m.phone,
                            `Hi ${firstName(m.name)}, a friendly reminder from ${brand.name}: your membership fee balance of ${money(m.dues)}${dateNote} is pending. Please pay at the gym desk or via UPI. Thank you!`,
                          );
                        }}
                      />
                      <Button
                        title="Collect"
                        size="sm"
                        onPress={() => openCollect(m)}
                      />
                    </View>
                  }
                />
              );
            })}
          </Group>
        ) : (
          <Empty icon="checkmark-done-outline" title="No dues" body="Everyone is paid up." />
        )
      ) : endingMembers.length ? (
        <Group>
          {endingMembers.map(({ m, info }) => {
            const isExpired = info.status === 'expired';
            return (
              <Row
                key={m.id}
                leading={<Avatar name={m.name} size={36} />}
                title={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text variant="label">{m.name}</Text>
                    {m.partnerName || m.isPartner ? (
                      <View style={s.miniTag}>
                        <Text variant="caption" tone="primary" style={{ fontSize: 11, fontWeight: '600' }}>
                          👫 Couple
                        </Text>
                      </View>
                    ) : null}
                  </View>
                }
                subtitle={`${info.plan?.name ?? 'Plan'} • ${
                  isExpired
                    ? `Expired ${info.expiredDaysAgo === 0 ? 'today' : `${info.expiredDaysAgo}d ago`}`
                    : info.daysLeft === 0
                    ? 'Expires today'
                    : `${info.daysLeft} days remaining (${fmtDate(info.end)})`
                }`}
                chevron={false}
                onPress={() => router.push(`/manage/member/${m.id}`)}
                action={
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Button
                      title="Remind"
                      size="sm"
                      variant="soft"
                      icon="logo-whatsapp"
                      onPress={() => {
                        const expiryNote = isExpired
                          ? `expired on ${fmtDate(info.end)}`
                          : `is ending on ${fmtDate(info.end)} (${info.daysLeft} days left)`;
                        whatsapp(
                          m.phone,
                          `Hi ${firstName(m.name)}, your ${info.plan?.name ?? 'gym'} membership at ${brand.name} ${expiryNote}. Renew your membership today to keep training without interruption!`,
                        );
                      }}
                    />
                    <Button
                      title="Renew"
                      size="sm"
                      onPress={() => router.push(`/manage/member/${m.id}`)}
                    />
                  </View>
                }
              />
            );
          })}
        </Group>
      ) : (
        <Empty icon="hourglass-outline" title="No expiring subscriptions" body="No memberships are ending in the next 14 days." />
      )}

      <Sheet
        visible={!!collect}
        onClose={() => {
          setCollect(null);
          setCustomDueDate(undefined);
        }}
        title={`Collect from ${collect ? firstName(collect.name) : ''}`}
        subtitle={collect ? `${money(collect.dues)} total pending` : undefined}
        footer={<Button title={parsedAmount ? `Save ${money(parsedAmount)} payment` : 'Save payment'} full onPress={save} />}>
        <Input
          label="Amount collected now"
          prefix={brand.currency.symbol}
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          autoFocus
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['UPI', 'Cash', 'Card', 'Cheque'] as PayMethod[]).map((x) => (
            <Chip key={x} label={x} selected={method === x} onPress={() => setMethod(x)} />
          ))}
          {method === 'Cheque' ? (
            <Input label="Cheque number (optional)" value={chequeNumber} onChangeText={setChequeNumber} placeholder="e.g. 004521" />
          ) : null}
        </View>

        {remainingDues > 0 ? (
          <View style={[s.remainingBox, { borderColor: brand.colors.primary }]}>
            <Text variant="label" tone="warning">
              Remaining Balance: {money(remainingDues)}
            </Text>
            <Text variant="caption" tone="soft">
              Promised date for remaining {money(remainingDues)}:
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {[
                { label: '+7 days', date: addDays(now.date, 7) },
                { label: '+15 days', date: addDays(now.date, 15) },
                { label: '+1 month', date: addDays(now.date, 30) },
              ].map((opt) => (
                <Chip
                  key={opt.label}
                  label={`${opt.label} (${fmtDay(opt.date)})`}
                  selected={customDueDate === opt.date}
                  onPress={() => setCustomDueDate(opt.date)}
                />
              ))}
            </View>
            {customDueDate ? (
              <Text variant="caption" tone="primary" style={{ marginTop: 4 }}>
                Next payment scheduled on: {fmtDate(customDueDate)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  facts: { flexDirection: 'row', justifyContent: 'space-between' },
  miniTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: t.c.surface,
  },
  remainingBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    backgroundColor: t.c.surface,
  },
}));
