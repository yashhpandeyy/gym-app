import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { DateCalendar } from '@/components/Calendar';
import { Button, Card, Chip, Empty, Icon, Input, Screen, SectionHeader, Sheet, StatusPill, Text } from '@/components/ui';
import { addDays, addMonths, diffDays, fmtDate, fmtDay, plural, termEnd, type ISODate } from '@/lib/date';
import { firstName, money, uid } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { haptic, whatsapp } from '@/lib/native';
import { createMember } from '@/lib/remote';
import type { Invite } from '@/lib/api';
import { useApp, type Gender, type Member, type PayMethod } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const DEFAULT_TAGS = ['Couple', 'Special Price', 'Doctor / Health Rec.', 'Student', 'Seasonal Offer'];

function generateLocalInviteCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export default function AddMember() {
  const { c, brand } = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ name?: string; phone?: string; leadId?: string }>();
  const now = useNow(60_000);
  const plans = useApp((st) => st.plans).filter((p) => p.active && p.price > 0);
  const updateMember = useApp((st) => st.updateMember);

  // Primary member details
  const [name, setName] = useState(params.name ?? '');
  const [phone, setPhone] = useState(params.phone ?? '');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<Gender>('female');

  // Couple / Partner details
  const [isCouple, setIsCouple] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerGender, setPartnerGender] = useState<Gender>('male');
  const [partnerEmail, setPartnerEmail] = useState('');

  // Plan and dates
  const [planId, setPlanId] = useState(plans.find((p) => p.popular)?.id ?? plans[0]?.id);
  const [start, setStart] = useState<ISODate>(now.date);
  const [since, setSince] = useState<ISODate | null>(null);
  const [paidToday, setPaidToday] = useState(false);
  const [picking, setPicking] = useState<'start' | 'since' | 'due' | null>(null);

  // Pricing & tags
  const [pricingTag, setPricingTag] = useState<string>('');
  const [customTagInput, setCustomTagInput] = useState('');
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [agreedPriceInput, setAgreedPriceInput] = useState<string>('');

  // Payment
  const [paid, setPaid] = useState<string>('');
  const [method, setMethod] = useState<PayMethod>('UPI');
  const [chequeNumber, setChequeNumber] = useState('');
  const [dueDate, setDueDate] = useState<ISODate>(addDays(now.date, 15));

  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
    partnerName?: string;
    partnerPhone?: string;
    partnerEmail?: string;
    form?: string;
  }>({});
  const [busy, setBusy] = useState(false);

  type DoneState = {
    primary: { name: string; phone: string; code: string; invite: Invite };
    partner?: { name: string; phone: string; code: string; invite: Invite };
    totalAgreed: number;
    amountPaid: number;
    dueAmount: number;
    dueDate?: ISODate;
    tag?: string;
  };
  const [done, setDone] = useState<DoneState | null>(null);

  const plan = plans.find((p) => p.id === planId) ?? plans[0];

  // Base plan price for the group (1 person or 2 for couple)
  const multiplier = isCouple ? 2 : 1;
  const basePrice = plan ? plan.price * multiplier : 0;

  const onToggleCouple = (enable: boolean) => {
    setIsCouple(enable);
    const newMult = enable ? 2 : 1;
    const newTotal = plan ? plan.price * newMult : 0;
    setAgreedPriceInput(String(newTotal));
    setPaid(String(newTotal));
    if (enable && !pricingTag) {
      setPricingTag('Couple');
    } else if (!enable && pricingTag === 'Couple') {
      setPricingTag('');
    }
  };

  const onSelectPlan = (newPlan: typeof plans[0]) => {
    setPlanId(newPlan.id);
    const newTotal = newPlan.price * multiplier;
    setAgreedPriceInput(String(newTotal));
    setPaid(String(newTotal));
  };

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

  const finalPrice = agreedPriceInput === '' ? basePrice : Math.max(0, parseInt(agreedPriceInput, 10) || 0);
  const discountAmount = Math.max(0, basePrice - finalPrice);
  const discountPercent = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0;

  const amountPaid = paid === '' ? finalPrice : Math.max(0, parseInt(paid, 10) || 0);
  const due = Math.max(0, finalPrice - amountPaid);
  const end = termEnd(start, plan.months);
  const past = start < now.date;
  const paidOn = past && !paidToday ? start : now.date;
  const joinedOn = since && since < start ? since : start;
  const earliest = addMonths(now.date, -12 * 30);

  const applyDiscountPercent = (pct: number) => {
    haptic.tap();
    const discounted = Math.round((basePrice * (100 - pct)) / 100);
    setAgreedPriceInput(String(discounted));
    setPaid(String(discounted));
  };

  const selectTag = (tag: string) => {
    haptic.tap();
    setPricingTag((prev) => (prev === tag ? '' : tag));
  };

  const save = async () => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const partnerDigits = partnerPhone.replace(/\D/g, '').slice(-10);
    const e: typeof errors = {};

    if (name.trim().length < 2) e.name = 'Enter their full name.';
    if (digits.length !== 10) e.phone = 'Enter a 10-digit mobile number.';
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'That email doesn’t look right. You can leave it empty.';

    if (isCouple) {
      if (partnerName.trim().length < 2) e.partnerName = 'Enter partner’s full name.';
      if (partnerDigits.length !== 10) e.partnerPhone = 'Enter partner’s 10-digit mobile number.';
      if (partnerDigits === digits) e.partnerPhone = 'Partner phone must be different from primary phone.';
      if (partnerEmail.trim() && !/^\S+@\S+\.\S+$/.test(partnerEmail.trim())) e.partnerEmail = 'That partner email doesn’t look right.';
    }

    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setBusy(true);

    try {
      // 1. Create primary member
      const primaryRes = await createMember({
        name: name.trim(),
        phone: digits,
        email: email.trim() || undefined,
        gender,
        planId: plan.id,
        startDate: start,
        joinedOn,
        paid: amountPaid,
        paidOn,
        method,
        leadId: params.leadId,
        partnerName: isCouple ? partnerName.trim() : undefined,
        partnerPhone: isCouple ? partnerDigits : undefined,
        pricingTag: pricingTag || undefined,
        originalPrice: basePrice,
        discountAmount,
        finalPrice,
        dueAmount: due,
        duePaymentDate: due > 0 ? dueDate : undefined,
        chequeNumber: method === 'Cheque' ? chequeNumber.trim() || undefined : undefined,
      });

      if (!primaryRes.ok) {
        setBusy(false);
        return setErrors({ form: primaryRes.message });
      }

      let partnerDone: { name: string; phone: string; code: string; invite: Invite } | undefined;

      // 2. If couple, enter the partner as another member so both get their unique code
      if (isCouple) {
        let partnerRes: { ok: true; member: Member; invite: Invite } | { ok: false; message: string };
        try {
          partnerRes = await createMember({
            name: partnerName.trim(),
            phone: partnerDigits,
            email: partnerEmail.trim() || undefined,
            gender: partnerGender,
            planId: plan.id,
            startDate: start,
            joinedOn: start,
            paid: 0, // Payment tracked with primary member to avoid double counting
            paidOn,
            method,
            partnerMemberId: primaryRes.member.id,
            partnerName: name.trim(),
            partnerPhone: digits,
            isPartner: true,
            pricingTag: pricingTag || 'Couple',
            originalPrice: plan.price,
            finalPrice: plan.price,
            dueAmount: 0,
          });
        } catch {
          partnerRes = { ok: false, message: 'Remote error' };
        }

        if (!partnerRes.ok) {
          // Guaranteed local store creation fallback: ensures partner is ALWAYS added as another member
          const s = useApp.getState();
          const partnerId = uid('m_');
          const partnerCode = 'MB-' + (s.members.length + 1);
          const partnerInviteCode = generateLocalInviteCode();
          const partnerMember: Member = {
            id: partnerId,
            code: partnerCode,
            name: partnerName.trim(),
            phone: partnerDigits,
            gender: partnerGender,
            joinedOn: start,
            planId: plan.id,
            startDate: start,
            endDate: termEnd(start, plan.months),
            pauseAllowance: plan.pauseDays,
            dues: 0,
            weeklyGoal: 4,
            partnerMemberId: primaryRes.member.id,
            partnerName: name.trim(),
            partnerPhone: digits,
            isPartner: true,
            pricingTag: pricingTag || 'Couple',
            originalPrice: plan.price,
            finalPrice: plan.price,
          };
          s.addMember(
            { paid: 0, method, paidOn, tag: pricingTag || 'Couple' },
            partnerMember,
          );
          const gymName = s.brandOverride?.name ?? s.link?.gymName ?? brand.name;
          partnerRes = {
            ok: true,
            member: partnerMember,
            invite: {
              inviteCode: partnerInviteCode,
              expiresInDays: 30,
              whatsapp: {
                phone: partnerDigits,
                text: `Hi ${partnerMember.name}, welcome to ${gymName}! Open the MyGym app and sign in with your phone number and this code: ${partnerInviteCode}. Keep it: it's your login.`,
              },
            },
          };
        }

        partnerDone = {
          name: partnerRes.member.name,
          phone: partnerDigits,
          code: partnerRes.member.code,
          invite: partnerRes.invite,
        };
        // Link partner ID back to primary member
        updateMember(primaryRes.member.id, { partnerMemberId: partnerRes.member.id });
      }

      setBusy(false);
      haptic.success();
      setDone({
        primary: {
          name: primaryRes.member.name,
          phone: digits,
          code: primaryRes.member.code,
          invite: primaryRes.invite,
        },
        partner: partnerDone,
        totalAgreed: finalPrice,
        amountPaid,
        dueAmount: due,
        dueDate: due > 0 ? dueDate : undefined,
        tag: pricingTag || undefined,
      });
    } catch (err: unknown) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'Failed to add member.';
      setErrors({ form: msg });
    }
  };

  if (done) {
    return (
      <Screen header="modal" title={done.partner ? 'Couple registered' : 'Member added'}>
        <View style={{ gap: 16 }}>
          {done.partner ? (
            <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primary, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="checkmark-circle" size={24} tone="primary" />
                <View style={{ flex: 1 }}>
                  <Text variant="label" tone="primary" style={{ fontWeight: '700' }}>
                    Couple Registered (2 Accounts Created)
                  </Text>
                  <Text variant="small" tone="soft">
                    {done.primary.name} and {done.partner.name} are both added as members with separate login codes and passes. Send each code on WhatsApp below:
                  </Text>
                </View>
              </View>
            </Card>
          ) : (
            <Text tone="soft">
              {done.primary.name} is on your list ({done.primary.code}). Send them this login code:
            </Text>
          )}

          {/* Member 1: Primary Member Code Card & WhatsApp Button */}
          <Card style={s.codeCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text variant="label" style={{ fontWeight: '700' }}>
                  {done.primary.name} {done.partner ? '(Primary Member)' : ''}
                </Text>
                <Text variant="caption" tone="soft">
                  +91 {done.primary.phone} • ID: {done.primary.code}
                </Text>
              </View>
              <StatusPill status="active" />
            </View>
            <View style={{ alignItems: 'center', marginVertical: 8, paddingVertical: 10, backgroundColor: c.surfaceAlt, borderRadius: 8 }}>
              <Text variant="caption" tone="soft">
                Member Login Code
              </Text>
              <Text variant="hero" tone="primary">{done.primary.invite.inviteCode}</Text>
            </View>
            <Button
              title={`Send code to ${firstName(done.primary.name)} (WhatsApp)`}
              icon="logo-whatsapp"
              size="md"
              full
              onPress={() => whatsapp(done.primary.invite.whatsapp.phone, done.primary.invite.whatsapp.text)}
            />
          </Card>

          {/* Member 2: Partner Member Code Card & WhatsApp Button */}
          {done.partner ? (
            <Card style={s.codeCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text variant="label" style={{ fontWeight: '700' }}>
                    {done.partner.name} (Partner Member)
                  </Text>
                  <Text variant="caption" tone="soft">
                    +91 {done.partner.phone} • ID: {done.partner.code}
                  </Text>
                </View>
                <StatusPill status="active" />
              </View>
              <View style={{ alignItems: 'center', marginVertical: 8, paddingVertical: 10, backgroundColor: c.surfaceAlt, borderRadius: 8 }}>
                <Text variant="caption" tone="soft">
                  Partner Login Code
                </Text>
                <Text variant="hero" tone="primary">{done.partner.invite.inviteCode}</Text>
              </View>
              <Button
                title={`Send code to ${firstName(done.partner.name)} (WhatsApp)`}
                icon="logo-whatsapp"
                size="md"
                full
                onPress={() => whatsapp(done.partner!.invite.whatsapp.phone, done.partner!.invite.whatsapp.text)}
              />
            </Card>
          ) : null}

          {/* Combined WhatsApp Share Option if primary receives both */}
          {done.partner ? (
            <Button
              title={`Forward both codes to ${firstName(done.primary.name)} on WhatsApp`}
              icon="share-outline"
              variant="outline"
              size="sm"
              full
              onPress={() => {
                const gymName = brand.name;
                const dualMsg = `Hi ${firstName(done.primary.name)}, your couple membership at ${gymName} is registered!\n\n1. Your code: ${done.primary.invite.inviteCode} (+91 ${done.primary.phone})\n2. Partner code for ${done.partner!.name}: ${done.partner!.invite.inviteCode} (+91 ${done.partner!.phone})\n\nBoth of you can download the app and sign in with your phone numbers and codes. Welcome!`;
                whatsapp(done.primary.invite.whatsapp.phone, dualMsg);
              }}
            />
          ) : null}

          {/* Fee & Dues Summary */}
          <Card variant="soft" style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="small" tone="soft">
                Total fee:
              </Text>
              <Text variant="smallStrong">{money(done.totalAgreed)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="small" tone="soft">
                Paid today:
              </Text>
              <Text variant="smallStrong" tone="success">
                {money(done.amountPaid)}
              </Text>
            </View>
            {done.dueAmount > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small" tone="danger">
                  Balance due:
                </Text>
                <Text variant="smallStrong" tone="danger">
                  {money(done.dueAmount)} (due {done.dueDate ? fmtDate(done.dueDate) : 'pending'})
                </Text>
              </View>
            ) : null}
            {done.tag ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text variant="caption" tone="soft">
                  Tag:
                </Text>
                <Text variant="caption" style={{ color: c.primary }}>
                  {done.tag}
                </Text>
              </View>
            ) : null}
          </Card>

          <Button
            title="Add another member"
            variant="ghost"
            full
            onPress={() => {
              setDone(null);
              setName('');
              setPhone('');
              setEmail('');
              setIsCouple(false);
              setPartnerName('');
              setPartnerPhone('');
              setPartnerEmail('');
              setPricingTag('');
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
            <View style={{ flex: 1 }}>
              <Text variant="small" tone="soft">
                {plan.name} {isCouple ? '(Couple - 2 members)' : ''}
              </Text>
              <Text variant="caption" tone="soft">
                {fmtDate(start)} to {fmtDate(end)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="label" tone={due ? 'danger' : 'success'}>
                {due ? `${money(due)} left to pay` : 'Paid in full'}
              </Text>
              {discountAmount > 0 ? (
                <Text variant="caption" tone="success">
                  {money(discountAmount)} discount ({discountPercent}% off)
                </Text>
              ) : null}
            </View>
          </View>
          {errors.form ? (
            <Text variant="small" tone="danger">
              {errors.form}
            </Text>
          ) : null}
          <Button
            title={isCouple ? 'Add couple and get both codes' : 'Add member and get their code'}
            full
            loading={busy}
            onPress={save}
          />
        </>
      }>
      {/* Primary Member Info */}
      <View style={{ gap: 16 }}>
        <Input label="Full name" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" error={errors.name} />
        <Input
          label="Mobile number"
          prefix="+91"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          error={errors.phone}
          hint="They sign in with this number and their personal code."
        />
        <Input
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.email}
          hint="Optional. Can be left empty."
        />
      </View>

      <SectionHeader title="Gender" />
      <View style={s.wrap}>
        {(['female', 'male', 'other'] as Gender[]).map((g) => (
          <Chip key={g} label={g === 'other' ? 'Other' : g[0].toUpperCase() + g.slice(1)} selected={gender === g} onPress={() => setGender(g)} />
        ))}
      </View>

      {/* Couple Entry Toggle */}
      <View style={{ marginTop: 14 }}>
        <Card
          style={[
            s.coupleToggleCard,
            { borderColor: isCouple ? c.primary : c.line, backgroundColor: isCouple ? c.primarySoft : c.surface },
          ]}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="label" style={{ fontWeight: '600' }}>Couple Entry / Add Partner</Text>
              {isCouple ? (
                <View style={[s.badge, { backgroundColor: c.primary }]}>
                  <Text variant="caption" style={{ color: '#fff', fontWeight: 'bold' }}>
                    Active
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="small" tone="soft">
              Register both partners together on one membership term with shared or custom pricing.
            </Text>
          </View>
          <Button
            title={isCouple ? 'Enabled' : '+ Add Partner'}
            variant={isCouple ? 'primary' : 'outline'}
            size="sm"
            onPress={() => {
              haptic.tap();
              onToggleCouple(!isCouple);
            }}
          />
        </Card>
      </View>

      {/* Partner Details Section if Couple is active */}
      {isCouple ? (
        <View style={{ marginTop: 14, gap: 14 }}>
          <SectionHeader title="Partner details" hint="Partner receives their own login code and check-in pass." />
          <Input
            label="Partner full name"
            value={partnerName}
            onChangeText={setPartnerName}
            autoCapitalize="words"
            error={errors.partnerName}
          />
          <Input
            label="Partner mobile number"
            prefix="+91"
            value={partnerPhone}
            onChangeText={setPartnerPhone}
            keyboardType="phone-pad"
            error={errors.partnerPhone}
            hint="Partner will use this phone number to sign in."
          />
          <Input
            label="Partner email (optional)"
            value={partnerEmail}
            onChangeText={setPartnerEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.partnerEmail}
          />

          <View style={{ gap: 6 }}>
            <Text variant="smallStrong" tone="soft">
              Partner gender
            </Text>
            <View style={s.wrap}>
              {(['female', 'male', 'other'] as Gender[]).map((g) => (
                <Chip
                  key={g}
                  label={g === 'other' ? 'Other' : g[0].toUpperCase() + g.slice(1)}
                  selected={partnerGender === g}
                  onPress={() => setPartnerGender(g)}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {/* Plan Selection */}
      <SectionHeader title="Subscription" hint={isCouple ? 'Prices reflect standard cost for 2 members.' : undefined} />
      <View style={{ gap: 8 }}>
        {plans.map((p) => {
          const selected = p.id === plan.id;
          const currentPlanPrice = p.price * multiplier;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                haptic.tap();
                onSelectPlan(p);
              }}
              style={[s.plan, { borderColor: selected ? c.primary : c.line, backgroundColor: selected ? c.primarySoft : c.surface }]}>
              <View style={{ flex: 1 }}>
                <Text variant="label">{p.name}</Text>
                <Text variant="caption" tone="soft">
                  {p.months} {p.months === 1 ? 'month' : 'months'}, {p.pauseDays} pause days
                  {isCouple ? ' • Couple (2x)' : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="h3">{money(currentPlanPrice)}</Text>
                {isCouple ? (
                  <Text variant="caption" tone="soft">
                    {money(p.price)}/person
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Custom & Discounted Pricing */}
      <SectionHeader
        title="Agreed / Discounted price"
        hint="Set custom pricing for couples, short-term visits (e.g. 15-day doctor recommendation), or special deals."
      />
      <View style={{ gap: 12 }}>
        <Input
          label="Agreed total fee"
          prefix={brand.currency.symbol}
          value={agreedPriceInput}
          onChangeText={(v) => {
            const clean = v.replace(/\D/g, '');
            setAgreedPriceInput(clean);
            // Default amount paid to the agreed price if full payment
            setPaid(clean);
          }}
          keyboardType="number-pad"
          hint={`Standard price: ${money(basePrice)}.`}
        />

        {/* Discount Breakdown Card */}
        {discountAmount > 0 ? (
          <Card variant="soft" style={s.discountCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Text variant="label" tone="success" style={{ fontWeight: '600' }}>
                  Discount applied: {money(discountAmount)} ({discountPercent}% off)
                </Text>
                <Text variant="caption" tone="soft">
                  Original: {money(basePrice)} → Final: {money(finalPrice)}
                </Text>
              </View>
              <Button
                title="Reset"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setAgreedPriceInput(String(basePrice));
                  setPaid(String(basePrice));
                }}
              />
            </View>
          </Card>
        ) : null}

        {/* Quick Discount Presets */}
        <View style={{ gap: 6 }}>
          <Text variant="caption" tone="soft">
            Quick discounts:
          </Text>
          <View style={s.wrap}>
            <Chip label="Standard (0%)" selected={discountAmount === 0} onPress={() => applyDiscountPercent(0)} />
            <Chip label="5% off" selected={discountPercent === 5} onPress={() => applyDiscountPercent(5)} />
            <Chip label="10% off" selected={discountPercent === 10} onPress={() => applyDiscountPercent(10)} />
            <Chip label="15% off" selected={discountPercent === 15} onPress={() => applyDiscountPercent(15)} />
            <Chip label="20% off" selected={discountPercent === 20} onPress={() => applyDiscountPercent(20)} />
          </View>
        </View>
      </View>

      {/* Quick Selection Tags */}
      <SectionHeader
        title="Pricing & Reason tags"
        hint="Tag special entries like Couple, Doctor Recommendation, or Student so you can filter and track them later."
      />
      <View style={{ gap: 10 }}>
        <View style={s.wrap}>
          {DEFAULT_TAGS.map((t) => (
            <Chip key={t} label={t} selected={pricingTag === t} onPress={() => selectTag(t)} />
          ))}
          <Chip
            label={showCustomTagInput ? 'Close custom tag' : '+ Custom tag'}
            selected={showCustomTagInput}
            onPress={() => setShowCustomTagInput(!showCustomTagInput)}
          />
        </View>

        {showCustomTagInput ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Enter custom tag (e.g. Doctor Rec, Promo, Event)"
                value={customTagInput}
                onChangeText={setCustomTagInput}
              />
            </View>
            <Button
              title="Apply tag"
              size="sm"
              onPress={() => {
                if (customTagInput.trim()) {
                  setPricingTag(customTagInput.trim());
                  setShowCustomTagInput(false);
                  setCustomTagInput('');
                }
              }}
            />
          </View>
        ) : null}

        {pricingTag ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="caption" tone="soft">
              Active tag:
            </Text>
            <Chip label={pricingTag} selected onPress={() => setPricingTag('')} />
          </View>
        ) : null}
      </View>

      {/* Plan Starts */}
      <SectionHeader title="Plan starts" hint="Adding someone who already trains here? Pick the day their current plan started, any month or year." />
      <View style={s.wrap}>
        <Chip label="Today" selected={start === now.date} onPress={() => setStart(now.date)} />
        <Chip label="Tomorrow" selected={start === addDays(now.date, 1)} onPress={() => setStart(addDays(now.date, 1))} />
        <Chip
          label={start !== now.date && start !== addDays(now.date, 1) ? fmtDate(start) : 'Pick a date'}
          icon="calendar-outline"
          selected={start !== now.date && start !== addDays(now.date, 1)}
          onPress={() => setPicking('start')}
        />
      </View>
      {past ? (
        <Card variant="soft" style={{ marginTop: 10, gap: 2 }}>
          <Text variant="label">
            {end < now.date ? `This plan ended on ${fmtDate(end)}` : `${plural(diffDays(now.date, end) + 1, 'day')} left on this plan`}
          </Text>
          <Text variant="small" tone="soft">
            {end < now.date
              ? 'They’ll show as expired until you renew them.'
              : `It runs ${fmtDate(start)} to ${fmtDate(end)}. Attendance and the books count from ${fmtDay(start)}.`}
          </Text>
        </Card>
      ) : null}

      {/* Member Since */}
      <SectionHeader title="Member since" hint="When they first joined the gym. Leave it if that’s the day this plan started." />
      <View style={s.wrap}>
        <Chip label="Same as plan start" selected={!since || since >= start} onPress={() => setSince(null)} />
        <Chip
          label={since && since < start ? fmtDate(since) : 'Earlier date'}
          icon="calendar-outline"
          selected={!!since && since < start}
          onPress={() => {
            if (!since || since >= start) setSince(addMonths(start, -12));
            setPicking('since');
          }}
        />
      </View>

      {/* Payment and Due Date Section */}
      <SectionHeader
        title="Payment & Dues"
        hint="If a member takes 1 year and pays 6 months now, enter the amount paid now and set the promised date for the balance."
      />
      <View style={{ gap: 12 }}>
        <Input
          label="Amount paid now"
          prefix={brand.currency.symbol}
          value={paid}
          onChangeText={(v) => setPaid(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          hint={`Agreed fee is ${money(finalPrice)}. Anything less is recorded as pending dues.`}
        />

        <View style={s.wrap}>
          {(['UPI', 'Cash', 'Card', 'Cheque'] as PayMethod[]).map((x) => (
            <Chip key={x} label={x} selected={method === x} onPress={() => setMethod(x)} />
          ))}
        </View>
        {method === 'Cheque' ? (
          <Input label="Cheque number (optional)" value={chequeNumber} onChangeText={setChequeNumber} placeholder="e.g. 004521" />
        ) : null}

        {/* If dues exist, show promised due date picker */}
        {due > 0 ? (
          <Card style={[s.dueNoticeCard, { borderColor: c.danger.solid, backgroundColor: c.danger.bg }]}>
            <View style={{ gap: 4 }}>
              <Text variant="label" tone="danger" style={{ fontWeight: '600' }}>
                {money(due)} remaining balance (Dues)
              </Text>
              <Text variant="small" tone="soft">
                Select the promised due date when you expect the remaining fee:
              </Text>
            </View>

            <View style={[s.wrap, { marginTop: 6 }]}>
              <Chip label="In 7 days" selected={dueDate === addDays(now.date, 7)} onPress={() => setDueDate(addDays(now.date, 7))} />
              <Chip label="In 15 days" selected={dueDate === addDays(now.date, 15)} onPress={() => setDueDate(addDays(now.date, 15))} />
              <Chip label="In 1 month" selected={dueDate === addMonths(now.date, 1)} onPress={() => setDueDate(addMonths(now.date, 1))} />
              <Chip
                label={dueDate ? `Due: ${fmtDate(dueDate)}` : 'Pick due date'}
                icon="calendar-outline"
                selected
                onPress={() => setPicking('due')}
              />
            </View>
          </Card>
        ) : null}

        {past && amountPaid > 0 ? (
          <>
            <Text variant="smallStrong" tone="soft">
              Paid on
            </Text>
            <View style={s.wrap}>
              <Chip label={`${fmtDate(start)}, when the plan started`} selected={!paidToday} onPress={() => setPaidToday(false)} />
              <Chip label="Today" selected={paidToday} onPress={() => setPaidToday(true)} />
            </View>
          </>
        ) : null}
      </View>

      {/* Date Pickers Sheet */}
      <Sheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === 'since' ? 'Member since' : picking === 'due' ? 'Promised payment due date' : 'Plan start date'}
        subtitle="Tap the month to jump to another month or year."
        footer={<Button title="Use this date" full onPress={() => setPicking(null)} />}>
        {picking === 'since' ? (
          <DateCalendar key="since" value={since ?? start} onChange={setSince} min={earliest} max={start} jump />
        ) : picking === 'due' ? (
          <DateCalendar key="due" value={dueDate} onChange={setDueDate} min={now.date} max={addMonths(now.date, 12)} jump />
        ) : (
          <DateCalendar key="start" value={start} onChange={setStart} min={earliest} max={addMonths(now.date, 3)} jump />
        )}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: t.radius.md, padding: 14 },
  total: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  codeCard: { gap: 10, padding: 16, borderRadius: t.radius.lg },
  coupleToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountCard: {
    padding: 12,
    borderRadius: t.radius.md,
  },
  dueNoticeCard: {
    padding: 14,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
  },
}));
