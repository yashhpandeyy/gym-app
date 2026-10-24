import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Chip, Empty, Icon, IconButton, Input, Pill, Screen, SectionHeader, Sheet, Text, toast } from '@/components/ui';
import { useNow } from '@/lib/hooks';
import { confirm, haptic } from '@/lib/native';
import { useApp, useMe, type DoseTime, type SupplementItem } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const TIMES: DoseTime[] = ['Morning', 'Before workout', 'After workout', 'With lunch', 'Evening', 'Night'];

export default function Supplements() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const me = useMe();
  const all = useApp((st) => st.supplements);
  const log = useApp((st) => st.supplementLog);
  const toggle = useApp((st) => st.toggleSupplement);
  const add = useApp((st) => st.addSupplement);
  const remove = useApp((st) => st.removeSupplement);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState<DoseTime>('Morning');
  const [kind, setKind] = useState<SupplementItem['kind']>('medicine');
  if (!me) return null;

  const items = all[me.id] ?? [];
  const taken = log[me.id]?.[now.date] ?? [];
  const groups = TIMES.map((t) => ({ time: t, items: items.filter((i) => i.time === t) })).filter((g) => g.items.length);

  const save = () => {
    if (name.trim().length < 2 || dose.trim().length < 1) {
      toast.error('Add the name and how much you take.');
      return;
    }
    add({ name: name.trim(), dose: dose.trim(), time, kind });
    toast.success(`${name.trim()} added.`);
    setAdding(false);
    setName('');
    setDose('');
  };

  return (
    <Screen
      header="stack"
      title="Supplements and medicines"
      right={<IconButton icon="add" label="Add" variant="soft" onPress={() => setAdding(true)} />}>
      <Card style={s.summary}>
        <View style={{ flex: 1 }}>
          <Text variant="h2">
            {taken.filter((id) => items.some((i) => i.id === id)).length} of {items.length}
          </Text>
          <Text variant="small" tone="soft">
            taken today
          </Text>
        </View>
        <Icon name="medkit-outline" size={34} tone="primary" />
      </Card>

      {groups.length ? (
        groups.map((g) => (
          <View key={g.time}>
            <SectionHeader title={g.time} />
            <View style={{ gap: 8 }}>
              {g.items.map((i) => {
                const on = taken.includes(i.id);
                return (
                  <Pressable
                    key={i.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      if (on) haptic.tap();
                      else haptic.success();
                      toggle(now.date, i.id);
                    }}
                    onLongPress={() =>
                      i.addedBy === 'member'
                        ? confirm({ title: `Remove ${i.name}?`, confirmText: 'Remove', destructive: true, onConfirm: () => remove(i.id) })
                        : toast.info('Your coach added this one. Ask them before you stop it.')
                    }>
                    <Card style={[s.item, on && { opacity: 0.7 }]}>
                      <View style={[s.check, on ? { backgroundColor: c.success.solid, borderColor: c.success.solid } : { borderColor: c.lineStrong }]}>
                        {on ? <Icon name="checkmark" size={18} color="#FFFFFF" /> : null}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="label" style={on ? { textDecorationLine: 'line-through' } : undefined}>
                          {i.name}
                        </Text>
                        <Text variant="caption" tone="soft">
                          {i.dose}
                          {i.note ? `. ${i.note}` : ''}
                        </Text>
                      </View>
                      <Pill label={i.kind === 'medicine' ? 'Medicine' : i.addedBy === 'coach' ? 'From coach' : 'Supplement'} tone={i.kind === 'medicine' ? 'ice' : 'neutral'} />
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      ) : (
        <Empty icon="medkit-outline" title="Nothing added yet" body="Add the supplements your coach suggests and any medicines you take, and tick them off each day." action="Add one" onAction={() => setAdding(true)} />
      )}

      <Card variant="inset" style={{ marginTop: 20, gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="lock-closed-outline" size={16} tone="soft" />
          <Text variant="smallStrong" tone="soft">
            Medicines stay private
          </Text>
        </View>
        <Text variant="caption" tone="soft">
          Gym staff see the supplements they suggested, never the medicines you add. The gym doesn’t prescribe medicines, so follow your doctor’s advice.
          Long-press anything you added to remove it.
        </Text>
      </Card>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add to your list" footer={<Button title="Add" full onPress={save} />}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Medicine" selected={kind === 'medicine'} onPress={() => setKind('medicine')} />
          <Chip label="Supplement" selected={kind === 'supplement'} onPress={() => setKind('supplement')} />
        </View>
        <Input label="Name" value={name} onChangeText={setName} placeholder={kind === 'medicine' ? 'As written on your prescription' : 'Multivitamin'} />
        <Input label="How much" value={dose} onChangeText={setDose} placeholder="1 tablet" />
        <Text variant="smallStrong" tone="soft">
          When
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TIMES.map((t) => (
            <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  summary: { flexDirection: 'row', alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
}));
