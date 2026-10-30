import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Logo, PlateRings } from '@/components/Brand';
import { Button, Icon, Input, Text, type IconName } from '@/components/ui';
import { api, tokenStore, type FullGym } from '@/lib/api';
import { brandFromGym } from '@/lib/gymBrand';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type Mode = 'signin' | 'create';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'people-outline', title: 'Members and renewals', body: 'See who is training, who is ending soon and send a reminder in one click.' },
  { icon: 'wallet-outline', title: 'Payments and dues', body: 'Record payments, chase dues and watch the month’s collection.' },
  { icon: 'time-outline', title: 'Slots and check-ins', body: 'Set your timetable, cap the crowd and check people in at the desk.' },
];

/** The website's front door. Gym owners only: members use the mobile app. */
export default function WebWelcome() {
  const { c, alpha } = useTheme();
  const s = useStyles();
  const { width } = useWindowDimensions();
  const split = width >= 900;
  const joinRemote = useApp((st) => st.joinRemote);
  const joinAdmin = useApp((st) => st.joinAdmin);
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'create' ? 'create' : 'signin');
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

  const validEmail = /\S+@\S+\.\S+/.test(email);
  const ready = mode === 'create' ? gymName.trim().length >= 2 && ownerName.trim().length >= 2 && validEmail && password.length >= 8 : validEmail && password.length >= 1;
  const submit = () => {
    if (ready && !busy) void (mode === 'create' ? create() : signIn());
  };
  const switchTo = (m: Mode) => {
    setMode(m);
    setError(undefined);
  };

  return (
    <View style={s.root}>
      {split ? (
        <View style={[s.panel, { backgroundColor: c.primary }]}>
          <PlateRings size={560} color={alpha(c.onPrimary, 0.07)} style={{ right: -220, bottom: -180 }} />
          <View style={s.panelInner}>
            <View style={s.lockup}>
              <Logo size={40} inverted />
            </View>
            <View style={{ gap: 14 }}>
              <Text variant="hero" color={c.onPrimary} style={{ maxWidth: 480 }}>
                Run your gym from one place.
              </Text>
              <Text variant="body" color={alpha(c.onPrimary, 0.85)} style={{ maxWidth: 440, fontSize: 16, lineHeight: 24 }}>
                The owner dashboard for your phone app. Everything your members book, pay and check in with shows up here.
              </Text>
            </View>
            <View style={{ gap: 18 }}>
              {POINTS.map((p) => (
                <View key={p.title} style={s.point}>
                  <View style={[s.pointIcon, { backgroundColor: alpha(c.onPrimary, 0.14) }]}>
                    <Icon name={p.icon} size={20} color={c.onPrimary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" color={c.onPrimary}>
                      {p.title}
                    </Text>
                    <Text variant="small" color={alpha(c.onPrimary, 0.8)}>
                      {p.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.formWrap} keyboardShouldPersistTaps="handled">
        <View style={s.form}>
          {!split ? <Logo size={40} /> : null}
          <View style={{ gap: 6 }}>
            <Text variant="title">{mode === 'signin' ? 'Sign in to your dashboard' : 'Create your gym'}</Text>
            <Text tone="soft">{mode === 'signin' ? 'Use the email and password you set up for your gym.' : 'Your gym goes live straight away. You can add your logo, plans and members after.'}</Text>
          </View>

          <View style={{ gap: 16 }}>
            {mode === 'create' ? (
              <>
                <Input label="Gym name" value={gymName} onChangeText={setGymName} autoCapitalize="words" placeholder="e.g. Fitness King" />
                <Input label="Your name" value={ownerName} onChangeText={setOwnerName} autoCapitalize="words" />
              </>
            ) : null}
            <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="you@gym.com" onSubmitEditing={submit} />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              hint={mode === 'create' ? 'At least 8 characters.' : undefined}
              onSubmitEditing={submit}
            />
            {error ? (
              <View style={[s.error, { backgroundColor: c.danger.bg }]}>
                <Icon name="alert-circle-outline" size={18} color={c.danger.fg} />
                <Text variant="small" color={c.danger.fg} style={{ flex: 1 }}>
                  {error}
                </Text>
              </View>
            ) : null}
            <Button title={mode === 'signin' ? 'Sign in' : 'Create my gym'} full loading={busy} disabled={!ready} onPress={submit} />
          </View>

          <View style={s.switchRow}>
            <Text variant="small" tone="soft">
              {mode === 'signin' ? 'New here?' : 'Already have a gym?'}
            </Text>
            <Pressable accessibilityRole="link" onPress={() => switchTo(mode === 'signin' ? 'create' : 'signin')} style={{ cursor: 'pointer' }}>
              <Text variant="smallStrong" tone="primary">
                {mode === 'signin' ? 'Create your gym' : 'Sign in'}
              </Text>
            </Pressable>
          </View>

          <Text variant="caption" tone="faint">
            Members sign in on the mobile app, not on this site.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, flexDirection: 'row', backgroundColor: t.c.surface },
  panel: { flex: 1, overflow: 'hidden' },
  panelInner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 64, paddingVertical: 48, maxWidth: 720 },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  pointIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  formWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  form: { width: '100%', maxWidth: 400, gap: 26 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
  switchRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
}));
