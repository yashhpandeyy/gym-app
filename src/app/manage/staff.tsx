import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Empty, Input, Screen, Sheet, Text, toast } from '@/components/ui';
import { api } from '@/lib/api';
import { phoneDisplay } from '@/lib/format';
import { confirm } from '@/lib/native';

type Person = { id: string; name: string; phone: string };

/** Front-desk logins. Each person signs in with their own number and PIN, so you can see and end any of them. */
export default function Staff() {
  const [people, setPeople] = useState<Person[]>([]);
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [edit, setEdit] = useState<Person | null>(null);
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await api.staff();
      if (cancelled) return;
      setLoaded(true);
      if (r.ok) setPeople(r.data.staff);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const add = async () => {
    setBusy(true);
    setError(undefined);
    const r = await api.addStaff({ name: name.trim(), phone, pin });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    toast.success(`${name.trim()} can now sign in.`);
    setAdding(false);
    setName('');
    setPhone('');
    setPin('');
    setTick((t) => t + 1);
  };

  const changePin = async (p: Person) => {
    setBusy(true);
    const r = await api.setStaffPin(p.id, newPin);
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    toast.success(`New PIN set. ${p.name} was signed out.`);
    setEdit(null);
    setNewPin('');
  };

  const remove = (p: Person) =>
    confirm({
      title: `Remove ${p.name}?`,
      message: 'They’re signed out straight away and can’t sign in again.',
      confirmText: 'Remove',
      destructive: true,
      onConfirm: async () => {
        const r = await api.removeStaff(p.id);
        if (r.ok) setTick((t) => t + 1);
        else toast.error(r.message);
      },
    });

  return (
    <Screen header="stack" title="Staff logins" subtitle="Front-desk people who check members in and add new ones.">
      {loaded && people.length === 0 ? (
        <Empty icon="key-outline" title="No staff logins yet" body="You can run the desk yourself. Add a login if someone else will check members in." action="Add a login" onAction={() => setAdding(true)} />
      ) : (
        <View style={{ gap: 10 }}>
          {people.map((p) => (
            <Card key={p.id} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={p.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{p.name}</Text>
                  <Text variant="small" tone="soft">
                    {phoneDisplay(p.phone)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="New PIN" size="md" variant="outline" style={{ flex: 1 }} onPress={() => setEdit(p)} />
                <Button title="Remove" size="md" variant="ghost" style={{ flex: 1 }} onPress={() => remove(p)} />
              </View>
            </Card>
          ))}
          {people.length ? <Button title="Add a login" icon="add" variant="outline" full onPress={() => setAdding(true)} /> : null}
        </View>
      )}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a staff login" footer={<Button title="Add login" full loading={busy} disabled={name.trim().length < 2 || phone.length < 10 || pin.length < 4} onPress={add} />}>
        <Input label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input label="Mobile number" prefix="+91" value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" />
        <Input label="PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" secureTextEntry hint="4 to 8 digits. They use it with their number to sign in." />
        {error ? (
          <Text variant="small" tone="danger">
            {error}
          </Text>
        ) : null}
      </Sheet>

      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={`New PIN for ${edit?.name ?? ''}`} footer={<Button title="Set PIN" full loading={busy} disabled={newPin.length < 4} onPress={() => edit && changePin(edit)} />}>
        <Input label="New PIN" value={newPin} onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" secureTextEntry autoFocus hint="They’re signed out and use this from now on." />
      </Sheet>
    </Screen>
  );
}
