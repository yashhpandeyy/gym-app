import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Empty, Input, Screen, Sheet, Text, toast } from '@/components/ui';
import { WEEKDAYS_SHORT, fmtTime } from '@/lib/date';
import { confirm } from '@/lib/native';
import { useApp, type Intensity } from '@/store';
import { makeStyles } from '@/theme';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** The group classes on the timetable: add them, set the size, remove the ones that stop. */
export default function Classes() {
  const s = useStyles();
  const classes = useApp((st) => st.classes);
  const trainers = useApp((st) => st.trainers);
  const addClass = useApp((st) => st.addClass);
  const removeClass = useApp((st) => st.removeClass);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [coachId, setCoachId] = useState('');
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [start, setStart] = useState('18:00');
  const [minutes, setMinutes] = useState('60');
  const [capacity, setCapacity] = useState('20');
  const [intensity, setIntensity] = useState<Intensity>('Moderate');
  const [about, setAbout] = useState('');

  const ok = name.trim().length >= 2 && HHMM.test(start) && Number(minutes) >= 10 && Number(capacity) >= 1 && days.length > 0;

  const save = () => {
    addClass({ name: name.trim(), coachId, days: [...days].sort(), start, minutes: Number(minutes), capacity: Number(capacity), intensity, about: about.trim() });
    toast.success(`${name.trim()} added.`);
    setAdding(false);
    setName('');
    setAbout('');
  };

  return (
    <Screen header="stack" title="Classes" subtitle="Timetabled sessions members can book.">
      {classes.length === 0 ? (
        <Empty icon="people-outline" title="No classes yet" body="Add yoga, Zumba or any session with a fixed time. Members book a place." action="Add a class" onAction={() => setAdding(true)} />
      ) : (
        <View style={{ gap: 10 }}>
          {classes.map((c) => (
            <Card key={c.id} style={{ gap: 6 }}>
              <View style={s.row}>
                <Text variant="h3" style={{ flex: 1 }}>
                  {c.name}
                </Text>
                <Button
                  title="Remove"
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    confirm({
                      title: `Remove ${c.name}?`,
                      confirmText: 'Remove',
                      destructive: true,
                      onConfirm: () => {
                        const r = removeClass(c.id);
                        if (r.ok) toast.success(r.message ?? 'Removed.');
                        else toast.error(r.message);
                      },
                    })
                  }
                />
              </View>
              <Text variant="small" tone="soft">
                {c.days.map((d) => WEEKDAYS_SHORT[d]).join(', ')} at {fmtTime(c.start)}, {c.minutes} min, {c.capacity} places, {c.intensity}
              </Text>
              {c.coachId ? (
                <Text variant="caption" tone="faint">
                  With {trainers.find((t) => t.id === c.coachId)?.name ?? 'a coach'}
                </Text>
              ) : null}
            </Card>
          ))}
          <Button title="Add a class" icon="add" variant="outline" full onPress={() => setAdding(true)} />
        </View>
      )}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a class" footer={<Button title="Add class" full disabled={!ok} onPress={save} />}>
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Morning yoga" autoCapitalize="words" />
        <View style={s.chips}>
          {WEEK_ORDER.map((d) => (
            <Chip key={d} label={WEEKDAYS_SHORT[d]} selected={days.includes(d)} onPress={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))} />
          ))}
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Input label="Starts" value={start} onChangeText={setStart} placeholder="18:00" maxLength={5} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Minutes" value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Places" value={capacity} onChangeText={(v) => setCapacity(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
          </View>
        </View>
        <View style={s.chips}>
          {(['Easy', 'Moderate', 'Hard'] as Intensity[]).map((i) => (
            <Chip key={i} label={i} selected={intensity === i} onPress={() => setIntensity(i)} />
          ))}
        </View>
        {trainers.length ? (
          <View style={{ gap: 8 }}>
            <Text variant="smallStrong" tone="soft">
              Coach
            </Text>
            <View style={s.chips}>
              <Chip label="Nobody in particular" selected={coachId === ''} onPress={() => setCoachId('')} />
              {trainers.map((t) => (
                <Chip key={t.id} label={t.name} selected={coachId === t.id} onPress={() => setCoachId(t.id)} />
              ))}
            </View>
          </View>
        ) : null}
        <Input label="About" value={about} onChangeText={setAbout} multiline placeholder="What members can expect" />
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
