import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { DateCalendar } from '@/components/Calendar';
import { Button, Card, Chip, Empty, Input, Screen, SectionHeader, Sheet, Text } from '@/components/ui';
import { addDays, addMonths, fmtDate, termEnd, type ISODate } from '@/lib/date';
import { money } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { haptic, share, whatsapp } from '@/lib/native';
import { createMember } from '@/lib/remote';
import type { Invite } from '@/lib/api';
import { useApp, type Gender, type PayMethod } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function AddMember() {
  const { c, brand } = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ name?: string; phone?: string; leadId?: string }>();
  const now = useNow(60_000);
  const plans = useApp((st) => st.plans).filter((p) => p.active && p.price > 0);

  const [name, setName] = useState(params.name ?? '');
  const [phone, setPhone] = useState(params.phone ?? '');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [planId, setPlanId] = useState(plans.find((p) => p.popular)?.id ?? plans[0]?.id);
  const [start, setStart] = useState<ISODate>(now.date);
  const [picking, setPicking] = useState(false);
  const [paid, setPaid] = useState(String(plans.find((p) => p.id === planId)?.price ?? ''));
  const [method, setMethod] = useState<PayMethod>('UPI');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; phone: string; code: string; invite: Invite } | null>(null);

  const plan = plans.find((p) => p.id === planId) ?? plans[0];

  if (!plan) {
    return (
      <Screen header="modal" title="Add member">
        <Empty
          icon="pricetag-outline"
          title="Set a plan price first"
          body="Members join on a plan. Switch on at least one plan and give it a price."
          action="Set plan prices"
          onAction={() => router.replace('/manage/plans')}
        />
      </Screen>
    );
  }

  const amount = parseInt(paid, 10) || 0;
  const due = Math.max(0, plan.price - amount);

  const save = async () => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = 'Enter their full name.';
    if (digits.length !== 10) e.phone = 'Enter a 10-digit mobile number.';
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'That email doesn’t look right. You can leave it empty.';
    setErrors(e);
    if (e.name || e.phone || e.email) return;
    setBusy(true);
    const r = await createMember({ name, phone: digits, email, gender, planId: plan.id, startDate: start, paid: amount, method, leadId: params.leadId });
    setBusy(false);
    if (!r.ok) return setErrors({ form: r.message });
    haptic.success();
    setDone({ name: r.member.name, phone: digits, code: r.member.code, invite: r.invite });
  };

  if (done) {
    return (
      <Screen header="modal" title="Member added">
        <View style={{ gap: 16 }}>
          <Text tone="soft">
            {done.name} is on your list ({done.code}). Send them this invite so they can open the app. It works for {done.invite.expiresInDays} days and only once.
          </Text>
          <Card style={s.code}>
            <Text variant="caption" tone="soft">
              Invite code
            </Text>
            <Text variant="hero">{done.invite.inviteCode}</Text>
          </Card>
          <Button title="Send on WhatsApp" icon="logo-whatsapp" full onPress={() => whatsapp(done.invite.whatsapp.phone, done.invite.whatsapp.text)} />
          <Button title="Share another way" icon="share-outline" variant="outline" full onPress={() => share(done.invite.whatsapp.text)} />
          <Button
            title="Add another member"
            variant="ghost"
            full
            onPress={() => {
              setDone(null);
              setName('');
              setPhone('');
              setEmail('');
            }}
          />
          <Button title="Done" variant="soft" full onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header="modal"
      title="Add member"
      footer={
        <>
          <View style={s.total}>
            <Text variant="small" tone="soft" style={{ flex: 1 }}>
              {plan.name} until {fmtDate(termEnd(start, plan.months))}
            </Text>
            <Text variant="label" tone={due ? 'danger' : 'success'}>
              {due ? `${money(due)} left to pay` : 'Paid in full'}
            </Text>
          </View>
          {errors.form ? (
            <Text variant="small" tone="danger">
              {errors.form}
            </Text>
          ) : null}
          <Button title="Add member and get invite" full loading={busy} onPress={save} />
        </>
      }>
      <View style={{ gap: 16 }}>
        <Input label="Full name" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" error={errors.name} />
        <Input label="Mobile number" prefix="+91" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={errors.phone} hint="We send the invite to this number on WhatsApp." />
        <Input label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={errors.email} hint="Many members don’t have one. That’s fine." />
      </View>

      <SectionHeader title="Gender" />
      <View style={s.wrap}>
        {(['female', 'male', 'other'] as Gender[]).map((g) => (
          <Chip key={g} label={g === 'other' ? 'Other' : g[0].toUpperCase() + g.slice(1)} selected={gender === g} onPress={() => setGender(g)} />
        ))}
      </View>

      <SectionHeader title="Subscription" />
      <View style={{ gap: 8 }}>
        {plans.map((p) => {
          const selected = p.id === plan.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                haptic.tap();
                setPlanId(p.id);
                setPaid(String(p.price));
              }}
              style={[s.plan, { borderColor: selected ? c.primary : c.line, backgroundColor: selected ? c.primarySoft : c.surface }]}>
              <View style={{ flex: 1 }}>
                <Text variant="label">{p.name}</Text>
                <Text variant="caption" tone="soft">
                  {p.months} {p.months === 1 ? 'month' : 'months'}, {p.pauseDays} pause days
                </Text>
              </View>
              <Text variant="h3">{money(p.price)}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Starts" />
      <View style={s.wrap}>
        <Chip label="Today" selected={start === now.date} onPress={() => setStart(now.date)} />
        <Chip label="Tomorrow" selected={start === addDays(now.date, 1)} onPress={() => setStart(addDays(now.date, 1))} />
        <Chip
          label={start !== now.date && start !== addDays(now.date, 1) ? fmtDate(start) : 'Pick a date'}
          icon="calendar-outline"
          selected={start !== now.date && start !== addDays(now.date, 1)}
          onPress={() => setPicking(true)}
        />
      </View>

      <SectionHeader title="Payment" />
      <View style={{ gap: 12 }}>
        <Input
          label="Amount paid now"
          prefix={brand.currency.symbol}
          value={paid}
          onChangeText={(v) => setPaid(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          hint="Anything less than the plan price is saved as dues."
        />
        <View style={s.wrap}>
          {(['UPI', 'Cash', 'Card'] as PayMethod[]).map((x) => (
            <Chip key={x} label={x} selected={method === x} onPress={() => setMethod(x)} />
          ))}
        </View>
      </View>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Start date" footer={<Button title="Use this date" full onPress={() => setPicking(false)} />}>
        <DateCalendar value={start} onChange={setStart} min={addDays(now.date, -30)} max={addMonths(now.date, 2)} />
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: t.radius.md, padding: 14 },
  total: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  code: { alignItems: 'center', gap: 4, paddingVertical: 20 },
}));
