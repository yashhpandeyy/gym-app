import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo, PlateRings } from '@/components/Brand';
import { Button, CodeInput, Input, Text } from '@/components/ui';
import { api, tokenStore } from '@/lib/api';
import { brandFromGym } from '@/lib/gymBrand';
import { useApp } from '@/store';
import { gutter, makeStyles, useTheme } from '@/theme';

/** The first screen: members sign in with their number and gym code; owners register or sign in below. */
export default function Welcome() {
  const { c, brand, alpha } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const joinRemote = useApp((st) => st.joinRemote);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const signIn = async () => {
    setBusy(true);
    setError(undefined);
    const r = await api.memberLogin(phone, code);
    if (!r.ok) {
      setBusy(false);
      setCode('');
      return setError(r.message);
    }
    await tokenStore.set(r.data.token);
    const g = r.data.gym;
    joinRemote('member', { gymCode: g.code, gymName: g.name, name: r.data.name, status: 'active' }, brandFromGym(g), r.data.memberId);
    router.replace('/');
  };

  return (
    <View style={s.root}>
      <StatusBar style={c.onPrimary === '#FFFFFF' ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 16 }} keyboardShouldPersistTaps="handled">
          <View style={[s.plate, { backgroundColor: c.primary, paddingTop: insets.top + 16 }]}>
            <PlateRings size={360} color={alpha(c.onPrimary, 0.12)} style={{ right: -130, top: -70 }} />
            <Logo size={48} inverted />
            <View style={s.hero}>
              <Text variant="hero" color={c.onPrimary} numberOfLines={2} adjustsFontSizeToFit>
                {brand.name}
              </Text>
              <Text variant="body" color={alpha(c.onPrimary, 0.9)}>
                Sign in with your mobile number and the code your gym gave you.
              </Text>
            </View>
          </View>

          <View style={s.form}>
            <Input label="Mobile number" prefix="+91" keyboardType="number-pad" value={phone} onChangeText={(v) => (setPhone(v.replace(/\D/g, '').slice(0, 10)), setError(undefined))} maxLength={10} />
            <View style={{ gap: 7 }}>
              <Text variant="smallStrong" tone="soft">
                Member code
              </Text>
              <CodeInput length={6} value={code} onChange={(v) => (setCode(v), setError(undefined))} />
            </View>
            {error ? (
              <Text variant="small" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button title="Sign in" full loading={busy} disabled={phone.length < 10 || code.length < 6} onPress={signIn} />
            <Pressable accessibilityRole="button" onPress={() => router.push('/join')} style={({ pressed }) => [s.link, pressed && { opacity: 0.6 }]}>
              <Text variant="small" tone="primary" align="center">
                No code yet, or you work at the gym? Use the gym code
              </Text>
            </Pressable>
          </View>

          <View style={s.owner}>
            <Button title="Register your gym" variant="outline" full onPress={() => router.push({ pathname: '/owner', params: { mode: 'create' } })} />
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/owner', params: { mode: 'signin' } })} style={({ pressed }) => [s.link, pressed && { opacity: 0.6 }]}>
              <Text variant="small" tone="soft" align="center">
                Gym owner? Sign in with your email
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.c.bg },
  plate: {
    paddingHorizontal: gutter,
    paddingBottom: 26,
    gap: 40,
    overflow: 'hidden',
    borderBottomLeftRadius: t.radius.xl,
    borderBottomRightRadius: t.radius.xl,
    borderCurve: 'continuous',
  },
  hero: { gap: 8 },
  form: { paddingHorizontal: gutter, paddingTop: 24, gap: 16 },
  link: { paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  owner: { paddingHorizontal: gutter, paddingTop: 12, marginTop: 'auto', gap: 2 },
}));
