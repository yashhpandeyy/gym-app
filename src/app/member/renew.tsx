import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Icon, Pill, Screen, SectionHeader, Text, toast } from '@/components/ui';
import { addDays, fmtDate, termEnd } from '@/lib/date';
import { money } from '@/lib/format';
import { useMyMembership, useNow } from '@/lib/hooks';
import { haptic } from '@/lib/native';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

/**
 * Members pick the plan they want and the front desk renews them, because only the gym can take
 * the payment and change the membership. The request lands with the desk straight away.
 */
export default function Renew() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const { member: me, info } = useMyMembership(now.date);
  const plans = useApp((st) => st.plans);
  const addTicket = useApp((st) => st.addTicket);
  const [planId, setPlanId] = useState(me?.planId ?? plans[0]?.id);
  const [sent, setSent] = useState(false);

  if (!me || !info) return null;
  const active = plans.filter((p) => p.active && p.price > 0);
  const plan = active.find((p) => p.id === planId) ?? active[0];
  const extending = info.status !== 'expired';
  const startsOn = extending ? addDays(info.end, 1) : now.date;

  if (!plan) {
    return (
      <Screen header="modal" title="Renew membership" footer={<Button title="Done" full onPress={() => router.back()} />}>
        <Text tone="soft">The gym hasn’t listed its plans yet. Ask the front desk to renew you.</Text>
      </Screen>
    );
  }

  const newEnd = termEnd(startsOn, plan.months);

  const send = () => {
    const r = addTicket('Billing', `Renewal request: ${plan.name} for ${money(plan.price)}. Starts ${fmtDate(startsOn)}.`);
    if (!r.ok) return toast.error(r.message);
    haptic.success();
    setSent(true);
  };

  if (sent) {
    return (
      <Screen header="modal" title="Request sent" footer={<Button title="Done" full onPress={() => router.back()} />}>
        <View style={s.doneHero}>
          <View style={[s.doneIcon, { backgroundColor: c.success.bg }]}>
            <Icon name="checkmark" size={36} color={c.success.fg} />
          </View>
          <Text variant="display" align="center">
            {plan.name}
          </Text>
          <Text tone="soft" align="center">
            The front desk has your request. Pay them {money(plan.price)} and your plan is renewed on the spot, valid until {fmtDate(newEnd)}.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header="modal"
      title={extending ? 'Renew or change plan' : 'Renew membership'}
      footer={
        <>
          <View style={s.total}>
            <View style={{ flex: 1 }}>
              <Text variant="small" tone="soft">
                Valid until {fmtDate(newEnd)}
              </Text>
              <Text variant="h2">{money(plan.price)}</Text>
            </View>
          </View>
          <Button title="Ask the desk to renew me" full onPress={send} />
        </>
      }>
      <Text tone="soft">
        {extending
          ? `Your new plan starts the day after your current one ends, on ${fmtDate(startsOn)}. Unused pause days carry over.`
          : 'Your new plan starts today.'}
      </Text>

      <SectionHeader title="Choose a plan" />
      <View style={{ gap: 10 }}>
        {active.map((p) => {
          const selected = p.id === plan.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                haptic.tap();
                setPlanId(p.id);
              }}
              style={[s.plan, { borderColor: selected ? c.primary : c.line, backgroundColor: selected ? c.primarySoft : c.surface }]}>
              <View style={s.planTop}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="h3">{p.name}</Text>
                    {p.popular ? <Pill label="Most picked" tone="primary" solid /> : null}
                    {p.id === me.planId ? <Pill label="Current" tone="neutral" /> : null}
                  </View>
                  <Text variant="small" tone="soft">
                    {money(Math.round(p.price / p.months))} a month, {p.pauseDays} pause days
                  </Text>
                </View>
                <Text variant="h2">{money(p.price)}</Text>
              </View>
              {selected && p.perks.length ? (
                <View style={{ gap: 6, marginTop: 10 }}>
                  {p.perks.map((perk) => (
                    <View key={perk} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Icon name="checkmark" size={15} tone="success" />
                      <Text variant="small">{perk}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" tone="soft" style={{ marginTop: 10 }}>
        You pay at the front desk, by UPI, card or cash. They renew you as soon as they have your request.
      </Text>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  plan: { borderWidth: 1.5, borderRadius: t.radius.lg, padding: 14 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  total: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneHero: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  doneIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
}));
