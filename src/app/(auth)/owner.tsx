import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Input, Screen, Segmented, Text } from '@/components/ui';
import { api, tokenStore, type FullGym } from '@/lib/api';
import { brandFromGym } from '@/lib/gymBrand';
import { useApp } from '@/store';

type Mode = 'create' | 'signin';

/** For gym owners: create your gym in the app, or come back to it with your email. */
export default function Owner() {
  const joinRemote = useApp((st) => st.joinRemote);
  const joinAdmin = useApp((st) => st.joinAdmin);
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'signin' ? 'signin' : 'create');
  const [gymName, setGymName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const enter = async (token: string, name: string, g: FullGym) => {
    await tokenStore.set(token);
    joinRemote('manager', { gymCode: g.code, gymName: g.name, name, status: g.status === 'active' ? 'active' : 'pending' }, brandFromGym(g));
    router.replace('/');
  };

  const create = async () => {
    setBusy(true);
    setError(undefined);
    const r = await api.ownerSignup({ gymName: gymName.trim(), ownerName: ownerName.trim(), email: email.trim(), password });
    if (!r.ok) {
      setBusy(false);
      return setError(r.message);
    }
    await tokenStore.set(r.data.token);
    const me = await api.me();
    setBusy(false);
    if (!me.ok) return setError(me.message);
    await enter(r.data.token, ownerName.trim(), me.data.gym);
  };

  const signIn = async () => {
    setBusy(true);
    setError(undefined);
    const r = await api.ownerLogin(email.trim(), password);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    if (r.data.role === 'admin') {
      await tokenStore.set(r.data.token);
      joinAdmin(r.data.name);
      router.replace('/');
      return;
    }
    if (r.data.gym.status === 'suspended') return setError('This gym’s access is paused. Contact us to switch it back on.');
    await enter(r.data.token, r.data.name, r.data.gym);
  };

  const ready = mode === 'create' ? gymName.trim().length >= 2 && ownerName.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && password.length >= 8 : /\S+@\S+\.\S+/.test(email) && password.length >= 8;

  return (
    <Screen header="stack">
      <View style={{ gap: 20 }}>
        <View style={{ gap: 8 }}>
          <Text variant="title">{mode === 'create' ? 'Create your gym app' : 'Welcome back'}</Text>
          <Text tone="soft">
            {mode === 'create'
              ? 'Set up your name, logo, colours and features. You get a gym code that turns this app into yours for every member.'
              : 'Sign in with the email you used to create your gym.'}
          </Text>
        </View>
        <Segmented<Mode>
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(undefined);
          }}
          options={[
            { value: 'create', label: 'Create a gym' },
            { value: 'signin', label: 'Sign in' },
          ]}
        />
        {mode === 'create' ? (
          <>
            <Input label="Gym name" value={gymName} onChangeText={setGymName} autoCapitalize="words" placeholder="e.g. Fitness King" />
            <Input label="Your name" value={ownerName} onChangeText={setOwnerName} autoCapitalize="words" />
          </>
        ) : null}
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" hint="At least 8 characters." />
        {error ? (
          <Text variant="small" tone="danger">
            {error}
          </Text>
        ) : null}
        <Button title={mode === 'create' ? 'Create my gym' : 'Sign in'} full loading={busy} disabled={!ready} onPress={mode === 'create' ? create : signIn} />
        {mode === 'create' ? (
          <Text variant="small" tone="soft">
            Your gym goes live straight away. Add members from the app and each one gets a code to sign in with.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
