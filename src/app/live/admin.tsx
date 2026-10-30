import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { platform } from '@/config/platform';
import { Button, Card, Empty, IconButton, Input, Pill, Screen, Sheet, Text, toast } from '@/components/ui';
import { api, type AdminGym, type GymStatus } from '@/lib/api';
import { fmtDate } from '@/lib/date';
import { whatsappShare } from '@/lib/native';
import { openGymAsOwner, signOut } from '@/lib/remote';
import { useApp } from '@/store';
import { makeStyles } from '@/theme';

const TONE: Record<GymStatus, 'success' | 'warning' | 'danger'> = { active: 'success', pending: 'warning', suspended: 'danger' };
const LABEL: Record<GymStatus, string> = { active: 'Live', pending: 'Waiting', suspended: 'Paused' };

/** The platform admin's home: every gym on the platform, and the tools to create and look after them. */
export default function Admin() {
  const s = useStyles();
  const name = useApp((st) => st.session?.staffName);
  const [gyms, setGyms] = useState<AdminGym[]>([]);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<AdminGym | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await api.adminGyms();
      if (cancelled) return;
      setLoaded(true);
      if (r.ok) {
        setGyms(r.data.gyms);
        setError(undefined);
      } else setError(r.message);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = () => setTick((t) => t + 1);

  const setStatus = async (g: AdminGym, status: GymStatus) => {
    setBusy(true);
    const r = await api.adminSetStatus(g.id, status);
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    toast.success(status === 'active' ? `${g.name} is live.` : status === 'suspended' ? `${g.name} is paused.` : `${g.name} is waiting.`);
    setSelected(null);
    reload();
  };

  const open = async (g: AdminGym) => {
    setBusy(true);
    const r = await openGymAsOwner(g.id);
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    setSelected(null);
    // The route guards need a moment to see the new sign-in before they allow the next screen.
    setTimeout(() => router.replace('/live/setup'), 150);
  };

  const reset = async (g: AdminGym) => {
    if (password.length < 8) return toast.error('Use at least 8 characters.');
    setBusy(true);
    const r = await api.adminResetPassword(g.id, password);
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    toast.success('New password set. The owner was signed out everywhere.');
    setPassword('');
  };

  return (
    <Screen
      title="Your gyms"
      subtitle={name ? `Signed in as ${name}` : undefined}
      right={<IconButton icon="log-out-outline" label="Sign out" onPress={signOut} />}
      onRefresh={reload}
      refreshing={false}>
      <Button title="Create a gym on the spot" icon="add-circle-outline" full onPress={() => router.push('/live/admin-create')} />

      {error ? (
        <Card style={{ gap: 8, marginTop: 14 }}>
          <Text tone="soft">{error}</Text>
          <Button title="Try again" size="md" onPress={reload} />
        </Card>
      ) : null}

      <View style={{ gap: 10, marginTop: 16 }}>
        {loaded && gyms.length === 0 && !error ? (
          <Empty icon="business-outline" title="No gyms yet" body="Create the first one when an owner says yes." />
        ) : null}
        {gyms.map((g) => (
          <Card key={g.id} style={s.gym}>
            <View style={s.top}>
              <View style={{ flex: 1 }}>
                <Text variant="h3" numberOfLines={1}>
                  {g.name}
                </Text>
                <Text variant="small" tone="soft" numberOfLines={1}>
                  {g.owner_name ?? 'Owner'}, {g.owner_email ?? 'no email'}
                </Text>
              </View>
              <Pill label={LABEL[g.status]} tone={TONE[g.status]} dot />
            </View>
            <View style={s.top}>
              <Text variant="smallStrong">Code {g.code}</Text>
              <Text variant="small" tone="soft">
                {g.members} {g.members === 1 ? 'member' : 'members'}, since {fmtDate(g.created_at.slice(0, 10))}
              </Text>
            </View>
            <Button title="Manage" size="md" variant="outline" onPress={() => setSelected(g)} />
          </Card>
        ))}
      </View>

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''} subtitle={selected ? `Code ${selected.code}, ${selected.owner_email ?? ''}` : undefined}>
        {selected ? (
          <View style={{ gap: 12 }}>
            <Button title="Send dashboard link on WhatsApp" icon="logo-whatsapp" variant="outline" onPress={() => whatsappShare(`${selected.name} dashboard for computer: ${platform.dashboardUrl}
Sign in with ${selected.owner_email ?? 'your owner email'}`)} full />
            <Button title="Open it as the owner" icon="color-palette-outline" loading={busy} onPress={() => open(selected)} full />
            {selected.status !== 'active' ? (
              <Button title="Switch on" variant="soft" loading={busy} onPress={() => setStatus(selected, 'active')} full />
            ) : (
              <Button title="Pause this gym" variant="outline" loading={busy} onPress={() => setStatus(selected, 'suspended')} full />
            )}
            <Input label="Set a new password for the owner" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" hint="For an owner who has forgotten theirs. At least 8 characters." />
            <Button title="Reset password" variant="ghost" loading={busy} disabled={password.length < 8} onPress={() => reset(selected)} full />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  gym: { gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
}));
