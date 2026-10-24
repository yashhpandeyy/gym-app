import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Input, Screen, SectionHeader, Text, toast } from '@/components/ui';
import { fmtTimeRange } from '@/lib/date';
import { useApp, useMe, type Gender } from '@/store';

export default function EditProfile() {
  const me = useMe();
  const slots = useApp((s) => s.slots);
  const updateMe = useApp((s) => s.updateMe);
  const [name, setName] = useState(me?.name ?? '');
  const [gender, setGender] = useState<Gender>(me?.gender ?? 'other');
  const [goal, setGoal] = useState(me?.goalWeight ? String(me.goalWeight) : '');
  const [slotId, setSlotId] = useState(me?.preferredSlotId);
  if (!me) return null;

  const weekdaySlots = slots.filter((s) => s.days.includes(1));
  const valid = name.trim().length >= 2;

  const save = () => {
    updateMe({
      name: name.trim(),
      gender,
      goalWeight: parseFloat(goal) || undefined,
      preferredSlotId: slotId,
    });
    toast.success('Details saved.');
    router.back();
  };

  return (
    <Screen header="modal" title="Your details" footer={<Button title="Save details" full disabled={!valid} onPress={save} />}>
      <View style={{ gap: 16 }}>
        <Input label="Full name" value={name} onChangeText={setName} autoComplete="name" />
        <Input label="Phone number" prefix="+91" value={me.phone} editable={false} hint="This is how you sign in. To change it, ask the front desk." />
        <Input label="Goal weight in kg (optional)" value={goal} onChangeText={setGoal} keyboardType="decimal-pad" placeholder="75" />
      </View>

      <SectionHeader title="Gender" hint="Helps the gym plan locker rooms and classes." />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['female', 'male', 'other'] as Gender[]).map((g) => (
          <Chip key={g} label={g === 'other' ? 'Prefer not to say' : g[0].toUpperCase() + g.slice(1)} selected={gender === g} onPress={() => setGender(g)} />
        ))}
      </View>

      <SectionHeader title="Usual training time" hint="We’ll suggest this slot first when you book." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {weekdaySlots.map((s) => (
          <Chip key={s.id} label={fmtTimeRange(s.start, s.end)} selected={slotId === s.id} onPress={() => setSlotId(s.id)} />
        ))}
      </View>
      <Text variant="caption" tone="faint" style={{ marginTop: 16 }}>
        Member ID {me.code}. To change your plan, go to Membership.
      </Text>
    </Screen>
  );
}
