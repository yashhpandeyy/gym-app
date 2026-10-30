import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Input, Screen, Text, toast } from '@/components/ui';
import { api } from '@/lib/api';
import { platform } from '@/config/platform';
import { haptic, share, whatsapp, whatsappShare } from '@/lib/native';
import { openGymAsOwner } from '@/lib/remote';
import { makeStyles } from '@/theme';

/** Letters and digits that can't be mistaken for each other when read out or typed. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomPassword = () => Array.from({ length: 10 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

/** Creates a gym that's live straight away, for an owner who has just agreed and paid. */
export default function AdminCreate() {
  const s = useStyles();
  const [gymName, setGymName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(randomPassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [made, setMade] = useState<{ id: string; code: string } | null>(null);

  const ready = gymName.trim().length >= 2 && ownerName.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && password.length >= 8;

  const create = async () => {
    setBusy(true);
    setError(undefined);
    const r = await api.adminCreateGym({ gymName: gymName.trim(), ownerName: ownerName.trim(), email: email.trim(), password, phone: phone || undefined });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    haptic.success();
    setMade({ id: r.data.id, code: r.data.code });
  };

  const message = made
    ? `Welcome to GYM! Your ${gymName.trim()} app is ready.\n\nGym code for your members: ${made.code}\nYour login: ${email.trim()}\nTemporary password: ${password}\n\nOpen the GYM app, tap “I run a gym” and sign in. You can then add your logo, colours, plans and members.

On a computer, open your dashboard: ${platform.dashboardUrl}`
    : '';

  const setUp = async () => {
    if (!made) return;
    setBusy(true);
    const r = await openGymAsOwner(made.id);
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    // The route guards need a moment to see the new sign-in before they allow the next screen.
    setTimeout(() => router.replace('/live/setup'), 150);
  };

  return (
    <Screen header="modal" title={made ? 'Gym created' : 'Create a gym'}>
      {made ? (
        <View style={{ gap: 16 }}>
          <Text tone="soft">{gymName.trim()} is live. Give the owner these details. They can change the password later.</Text>
          <Card style={s.code}>
            <Text variant="caption" tone="soft">
              Gym code for members
            </Text>
            <Text variant="hero">{made.code}</Text>
          </Card>
          <Card style={{ gap: 6 }}>
            <Text variant="caption" tone="soft">
              Owner login
            </Text>
            <Text variant="label">{email.trim()}</Text>
            <Text variant="label">{password}</Text>
          </Card>
          <Button title="Set it up now on this phone" icon="color-palette-outline" full loading={busy} onPress={setUp} />
          {phone.length >= 10 ? <Button title="Send to the owner on WhatsApp" icon="logo-whatsapp" variant="outline" full onPress={() => whatsapp(phone, message)} /> : null}
          <Button title="Send dashboard link on WhatsApp" icon="logo-whatsapp" variant="outline" full onPress={() => whatsappShare(`Your ${gymName.trim()} dashboard for computer: ${platform.dashboardUrl}
Sign in with ${email.trim()}`)} />
          <Button title="Share the details" icon="share-outline" variant="outline" full onPress={() => share(message)} />
          <Button title="Done" variant="ghost" full onPress={() => router.back()} />
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <Input label="Gym name" value={gymName} onChangeText={setGymName} autoCapitalize="words" autoFocus />
          <Input label="Owner’s name" value={ownerName} onChangeText={setOwnerName} autoCapitalize="words" />
          <Input label="Owner’s email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} hint="They sign in with this." />
          <Input label="Owner’s WhatsApp (optional)" prefix="+91" value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" />
          <Input label="Temporary password" value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} hint="Made for you. Change it if you like." />
          {error ? (
            <Text variant="small" tone="danger">
              {error}
            </Text>
          ) : null}
          <Button title="Create and switch on" full loading={busy} disabled={!ready} onPress={create} />
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  code: { alignItems: 'center', gap: 4, paddingVertical: 20 },
}));
