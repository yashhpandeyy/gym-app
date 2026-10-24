import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Empty, Input, Screen, Sheet, Text, toast } from '@/components/ui';
import { money } from '@/lib/format';
import { confirm } from '@/lib/native';
import { useApp } from '@/store';
import { useTheme } from '@/theme';

/** The coaches members can train with and request sessions from. */
export default function Trainers() {
  const { brand } = useTheme();
  const trainers = useApp((st) => st.trainers);
  const addTrainer = useApp((st) => st.addTrainer);
  const removeTrainer = useApp((st) => st.removeTrainer);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [years, setYears] = useState('');
  const [price, setPrice] = useState('');
  const [bio, setBio] = useState('');
  const [certs, setCerts] = useState('');

  const ok = name.trim().length >= 2 && focus.trim().length >= 2;

  const save = () => {
    addTrainer({
      name: name.trim(),
      focus: focus.trim(),
      years: Number(years) || 0,
      rating: 0,
      price: Number(price) || 0,
      bio: bio.trim(),
      certifications: certs.split(',').map((c) => c.trim()).filter(Boolean),
    });
    toast.success(`${name.trim()} added.`);
    setAdding(false);
    setName('');
    setFocus('');
    setYears('');
    setPrice('');
    setBio('');
    setCerts('');
  };

  return (
    <Screen header="stack" title="Coaches" subtitle="Members can request a session with any of them.">
      {trainers.length === 0 ? (
        <Empty icon="barbell-outline" title="No coaches yet" body="Add the people who train your members. Members see them and can ask for a session." action="Add a coach" onAction={() => setAdding(true)} />
      ) : (
        <View style={{ gap: 10 }}>
          {trainers.map((t) => (
            <Card key={t.id} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={t.name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{t.name}</Text>
                  <Text variant="small" tone="soft">
                    {t.focus}
                    {t.price ? `, ${money(t.price)} a session` : ''}
                  </Text>
                </View>
                <Button
                  title="Remove"
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    confirm({
                      title: `Remove ${t.name}?`,
                      message: 'Members who were assigned to them keep their plans.',
                      confirmText: 'Remove',
                      destructive: true,
                      onConfirm: () => removeTrainer(t.id),
                    })
                  }
                />
              </View>
            </Card>
          ))}
          <Button title="Add a coach" icon="add" variant="outline" full onPress={() => setAdding(true)} />
        </View>
      )}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a coach" footer={<Button title="Add coach" full disabled={!ok} onPress={save} />}>
        <Input label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input label="Speciality" value={focus} onChangeText={setFocus} placeholder="e.g. Strength and fat loss" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Years coaching" value={years} onChangeText={(v) => setYears(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Price per session" prefix={brand.currency.symbol} value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" />
          </View>
        </View>
        <Input label="Certifications" value={certs} onChangeText={setCerts} placeholder="ACE, NASM" hint="Separate with commas." />
        <Input label="About" value={bio} onChangeText={setBio} multiline placeholder="A line or two members will read" />
      </Sheet>
    </Screen>
  );
}
