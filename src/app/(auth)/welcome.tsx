import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo, PlateRings } from '@/components/Brand';
import { Button, Card, CodeInput, Input, Text } from '@/components/ui';
import { api, tokenStore } from '@/lib/api';
import { brandFromGym } from '@/lib/gymBrand';
import { useApp } from '@/store';
import { gutter, makeStyles, useTheme } from '@/theme';

/** The first screen: members sign in with their number and gym code; owners register or sign in below. */
export default function Welcome() {
  const { c, brand, alpha } = useTheme();
  const s = useStyles();
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
    <View style={[s.root, { backgroundColor: c.primary }]}>
      <StatusBar style={c.onPrimary === '#FFFFFF' ? 'light' : 'dark'} />
      <PlateRings size={460} color={alpha(c.onPrimary, 0.09)} style={{ right: -190, top: 40 }} />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <Logo size={48} inverted />

            <View style={s.hero}>
              <Text variant="hero" color={c.onPrimary} style={s.word} numberOfLines={2} adjustsFontSizeToFit>
                {brand.name}
              </Text>
              <Text variant="body" color={alpha(c.onPrimary, 0.86)}>
                Sign in with your mobile number and the code your gym gave you.
              </Text>
            </View>

            <Card style={s.card}>
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
                <Text variant="small" tone="soft" align="center">
                  No code yet, or you work at the gym? Use the gym code
                </Text>
              </Pressable>
            </Card>

            <View style={s.owner}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/owner', params: { mode: 'create' } })}
                style={({ pressed }) => [s.secondary, { borderColor: alpha(c.onPrimary, 0.4) }, pressed && { opacity: 0.7 }]}>
                <Text variant="bodyStrong" color={c.onPrimary}>
                  Register your gym
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/owner', params: { mode: 'signin' } })} style={({ pressed }) => [s.link, pressed && { opacity: 0.6 }]}>
                <Text variant="small" color={alpha(c.onPrimary, 0.85)} align="center">
                  Gym owner? Sign in with your email
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, overflow: 'hidden' },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 16, gap: 22 },
  hero: { flexGrow: 1, justifyContent: 'flex-end', gap: 10, minHeight: 140 },
  word: { fontSize: 64, lineHeight: 62, letterSpacing: -1.2 },
  card: { gap: 16, padding: 18, borderRadius: t.radius.xl },
  link: { paddingVertical: 6 },
  owner: { gap: 6 },
  secondary: {
    height: 54,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
