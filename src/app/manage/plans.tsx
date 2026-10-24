import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Group, Icon, Input, Row, Screen, Sheet, Stepper, Text, toast, ToggleRow } from '@/components/ui';
import { money } from '@/lib/format';
import { useApp, type Plan } from '@/store';
import { useTheme } from '@/theme';

export default function Plans() {
  const plans = useApp((s) => s.plans);
  const members = useApp((s) => s.members);
  const addPlan = useApp((s) => s.addPlan);
  const { brand } = useTheme();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [months, setMonths] = useState('1');
  const [price, setPrice] = useState('');
  const ok = name.trim().length >= 2 && Number(months) >= 1 && Number(price) >= 100;

  return (
    <Screen header="stack" title="Plans and prices" subtitle="Changes show in the members’ app straight away. Existing memberships keep the price they paid.">
      <View style={{ gap: 14 }}>
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} memberCount={members.filter((m) => m.planId === p.id).length} />
        ))}
        <Button title="Add another plan" icon="add" variant="outline" full onPress={() => setAdding(true)} />
      </View>

      <Sheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Add a plan"
        footer={
          <Button
            title="Add plan"
            full
            disabled={!ok}
            onPress={() => {
              addPlan({ name: name.trim(), months: Number(months), price: Number(price), pauseDays: Math.round(Number(months) * 5), perks: [] });
              toast.success(`${name.trim()} added.`);
              setAdding(false);
              setName('');
              setPrice('');
              setMonths('1');
            }}
          />
        }>
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Student monthly" autoCapitalize="words" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Months" value={months} onChangeText={(v) => setMonths(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Price" prefix={brand.currency.symbol} value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

function PlanCard({ plan, memberCount }: { plan: Plan; memberCount: number }) {
  const { brand } = useTheme();
  const updatePlan = useApp((s) => s.updatePlan);
  const [price, setPrice] = useState(plan.price ? String(plan.price) : '');

  const commitPrice = () => {
    const v = parseInt(price, 10);
    if (!v || v < 100) {
      setPrice(plan.price ? String(plan.price) : '');
      toast.error('Enter a price of at least 100.');
      return;
    }
    if (v !== plan.price) {
      // A plan that has never had a price is switched on the moment it gets one.
      updatePlan(plan.id, { price: v, ...(plan.price === 0 && !plan.active ? { active: true } : {}) });
      toast.success(`${plan.name} is now ${money(v)}${plan.price === 0 && !plan.active ? ' and on sale' : ''}.`);
    }
  };

  return (
    <Card padded={false} style={{ opacity: plan.active ? 1 : 0.7 }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text variant="h3">{plan.name}</Text>
            <Text variant="small" tone="soft">
              {plan.months} {plan.months === 1 ? 'month' : 'months'}, {memberCount} members on it
            </Text>
          </View>
          <Text variant="caption" tone="soft">
            {money(Math.round(plan.price / plan.months))} a month
          </Text>
        </View>
        <Input label="Price" prefix={brand.currency.symbol} value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, ''))} onBlur={commitPrice} onSubmitEditing={commitPrice} keyboardType="number-pad" />
        <View style={{ gap: 6 }}>
          {plan.perks.map((perk) => (
            <View key={perk} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name="checkmark" size={15} tone="success" />
              <Text variant="small">{perk}</Text>
            </View>
          ))}
        </View>
      </View>
      <Group style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }} inset={16}>
        <Row
          title="Pause days per term"
          chevron={false}
          right={<Stepper value={plan.pauseDays} min={0} max={90} step={5} label="pause days" onChange={(v) => updatePlan(plan.id, { pauseDays: v })} />}
        />
        <ToggleRow title="Mark as most picked" value={!!plan.popular} onChange={(v) => updatePlan(plan.id, { popular: v })} />
        <ToggleRow title="Show in the app" subtitle="Members already on a hidden plan keep it" value={plan.active} onChange={(v) => updatePlan(plan.id, { active: v })} />
      </Group>
    </Card>
  );
}
