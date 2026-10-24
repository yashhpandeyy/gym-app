import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Card, CodeInput, Input, Screen, Text } from '@/components/ui';
import { api, tokenStore, type PublicGym } from '@/lib/api';
import { brandFromGym } from '@/lib/gymBrand';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type Step = 'code' | 'who' | 'invite' | 'pair' | 'staff';
type Pairing = { id: string; secret: string; qr: string };

export default function Join() {
  const { c } = useTheme();
  const s = useStyles();
  const joinRemote = useApp((st) => st.joinRemote);
  const setBrandOverride = useApp((st) => st.setBrandOverride);

  const [step, setStep] = useState<Step>('code');
  const [gym, setGym] = useState<PublicGym | null>(null);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [secret, setSecret] = useState('');
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const done = useRef(false);

  const fail = (message: string) => {
    setError(message);
    setBusy(false);
  };

  /** Stores the session token and drops the person into their side of the app. */
  const finish = async (token: string, role: 'member' | 'manager', who: string, g: PublicGym, memberId?: string) => {
    if (done.current) return;
    done.current = true;
    await tokenStore.set(token);
    // The gym code only showed branding. Now that they're in, load the gym's full details (hours, address, contact).
    const me = await api.me();
    const full = me.ok ? me.data.gym : { ...g, status: 'active' as const };
    joinRemote(role, { gymCode: g.code, gymName: full.name, name: who, status: 'active' }, brandFromGym(full), memberId);
    router.replace('/');
  };

  const lookUp = async () => {
    setBusy(true);
    setError(undefined);
    const r = await api.gymPublic(code);
    if (!r.ok) return fail(r.status === 404 ? 'We couldn’t find a gym with that code. Check it with the front desk.' : r.message);
    setGym(r.data);
    setBrandOverride(brandFromGym(r.data));
    setStep('who');
    setBusy(false);
  };

  const back = () => {
    setError(undefined);
    if (step === 'code') return router.back();
    if (step === 'who') {
      setBrandOverride(null);
      setGym(null);
      return setStep('code');
    }
    setPairing(null);
    setStep('who');
  };

  const redeem = async () => {
    if (!gym) return;
    setBusy(true);
    setError(undefined);
    const r = await api.redeem(gym.code, phone, invite);
    if (!r.ok) {
      setInvite('');
      return fail(r.message);
    }
    await finish(r.data.token, 'member', r.data.name, gym, r.data.memberId);
  };

  const staffLogin = async () => {
    if (!gym) return;
    setBusy(true);
    setError(undefined);
    const r = await api.login(gym.code, phone, secret);
    if (!r.ok) return fail(r.message);
    if (r.data.gymStatus !== 'active') {
      return fail('This gym is waiting to be activated. You’ll be able to sign in as soon as it is.');
    }
    await finish(r.data.token, 'manager', r.data.name, gym);
  };

  const startPairing = async () => {
    if (!gym) return;
    setBusy(true);
    setError(undefined);
    const r = await api.pair(gym.code, name, phone);
    if (!r.ok) return fail(r.message);
    setPairing({ id: r.data.pairingId, secret: r.data.secret, qr: r.data.qr });
    setBusy(false);
  };

  // While the QR is on screen, ask every few seconds whether the front desk has approved it.
  useEffect(() => {
    if (!pairing || !gym) return;
    const id = setInterval(async () => {
      const r = await api.pairStatus(pairing.id, pairing.secret);
      if (r.ok && r.data.status === 'approved' && r.data.token) {
        await tokenStore.set(r.data.token);
        await finish(r.data.token, 'member', name, gym, r.data.memberId);
      } else if (!r.ok && r.status !== 0) {
        clearInterval(id);
        setPairing(null);
        setError(r.message);
      }
    }, 3000);
    return () => clearInterval(id);
    // finish only reads refs and store actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing, gym]);

  return (
    <Screen header="stack" onBack={back}>
      <View style={{ gap: 22 }}>
        {step === 'code' ? (
          <>
            <View style={{ gap: 8 }}>
              <Text variant="title">Join your gym</Text>
              <Text tone="soft">Enter the gym code from the front desk. The app will change to your gym’s look.</Text>
            </View>
            <Input
              label="Gym code"
              value={code}
              onChangeText={(v) => {
                setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                setError(undefined);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              placeholder="e.g. FK20"
              error={error}
            />
            <Button title="Continue" full loading={busy} disabled={code.length < 4} onPress={lookUp} />
            <Text variant="small" tone="soft">
              The code only shows you the gym. To get in, the gym has to have you on its member list.
            </Text>
          </>
        ) : null}

        {step === 'who' && gym ? (
          <>
            <Card style={[s.gymCard, { backgroundColor: c.primarySoft }]}>
              <Text variant="caption" color={c.primaryInk}>
                You’re joining
              </Text>
              <Text variant="title" color={c.primaryInk}>
                {gym.name}
              </Text>
              {gym.tagline ? (
                <Text variant="small" color={c.primaryInk}>
                  {gym.tagline}
                </Text>
              ) : null}
            </Card>
            <Button title="I have an invite code" full onPress={() => setStep('invite')} />
            <Button title="I don’t have a code yet" variant="outline" full onPress={() => setStep('pair')} />
            <Button title="I work here" variant="ghost" full onPress={() => setStep('staff')} />
          </>
        ) : null}

        {step === 'invite' ? (
          <>
            <View style={{ gap: 8 }}>
              <Text variant="title">Enter your invite</Text>
              <Text tone="soft">Use the number your gym has for you and the 6-digit code they sent on WhatsApp.</Text>
            </View>
            <Input label="Mobile number" prefix="+91" keyboardType="number-pad" value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} maxLength={10} autoFocus />
            <View style={{ gap: 7 }}>
              <Text variant="smallStrong" tone="soft">
                Invite code
              </Text>
              <CodeInput length={6} value={invite} onChange={(v) => (setInvite(v), setError(undefined))} />
            </View>
            {error ? (
              <Text variant="small" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button title="Join" full loading={busy} disabled={phone.length < 10 || invite.length < 6} onPress={redeem} />
          </>
        ) : null}

        {step === 'pair' ? (
          pairing ? (
            <>
              <View style={{ gap: 8 }}>
                <Text variant="title">Show this at the desk</Text>
                <Text tone="soft">Hold the code up to the front desk. They’ll match you to your membership and this screen will open on its own.</Text>
              </View>
              <Card style={s.qr}>
                <View style={s.qrBox}>
                  <QRCode value={pairing.qr} size={210} color="#10141C" backgroundColor="#FFFFFF" ecl="M" />
                </View>
                <Text variant="small" tone="soft" align="center">
                  Waiting for the front desk. This code works for 15 minutes.
                </Text>
              </Card>
              {error ? (
                <Text variant="small" tone="danger">
                  {error}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <View style={{ gap: 8 }}>
                <Text variant="title">Join at the desk</Text>
                <Text tone="soft">Tell us who you are, then show the code to the front desk so they can confirm your membership.</Text>
              </View>
              <Input label="Your name" value={name} onChangeText={setName} autoCapitalize="words" autoFocus />
              <Input label="Mobile number" prefix="+91" keyboardType="number-pad" value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} maxLength={10} />
              {error ? (
                <Text variant="small" tone="danger">
                  {error}
                </Text>
              ) : null}
              <Button title="Get my code" full loading={busy} disabled={name.trim().length < 2 || phone.length < 10} onPress={startPairing} />
            </>
          )
        ) : null}

        {step === 'staff' ? (
          <>
            <View style={{ gap: 8 }}>
              <Text variant="title">Staff and owner login</Text>
              <Text tone="soft">Sign in with your mobile number and your password, or your PIN if you’re front desk.</Text>
            </View>
            <Input label="Mobile number" prefix="+91" keyboardType="number-pad" value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} maxLength={10} autoFocus />
            <Input label="Password or PIN" value={secret} onChangeText={setSecret} secureTextEntry autoCapitalize="none" autoCorrect={false} />
            {error ? (
              <Text variant="small" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button title="Sign in" full loading={busy} disabled={phone.length < 10 || secret.length < 4} onPress={staffLogin} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  gymCard: { gap: 4, padding: 18, borderRadius: t.radius.xl },
  qr: { alignItems: 'center', gap: 14, paddingVertical: 20 },
  qrBox: { padding: 14, backgroundColor: '#FFFFFF', borderRadius: 20 },
}));
