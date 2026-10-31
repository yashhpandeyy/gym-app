import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Logo, PlateRings } from '@/components/Brand';
import { Button, Card, Chip, Group, Icon, IconButton, Input, Pill, Row, Screen, SectionHeader, Text, ToggleRow, toast, type IconName } from '@/components/ui';
import { monogramFrom, type FeatureKey, type Hours } from '@/config/brand';
import { MODULES, SWATCHES } from '@/config/modules';
import { platform } from '@/config/platform';
import { api, type GymProfile } from '@/lib/api';
import { WEEKDAYS_SHORT } from '@/lib/date';
import { brandFromGym } from '@/lib/gymBrand';
import { haptic, share, whatsapp, whatsappShare } from '@/lib/native';
import { paletteFromPngBase64 } from '@/lib/palette';
import { signOut } from '@/lib/remote';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';
import { isHex, readableOn } from '@/theme/color';

const normal = (v: string) => {
  const h = v.trim().replace('#', '');
  return `#${h.length === 3 ? h.split('').map((x) => x + x).join('') : h}`.toUpperCase();
};

/** Widths to try so the logo stays under what the server accepts (about 200 KB). */
const LOGO_WIDTHS = [256, 192, 128, 96];
/** Monday first, the way people read a week. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function labelFor(days: number[]) {
  const set = [...days].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
  if (set.length === 7) return 'Every day';
  if (set.length === 1) return WEEKDAYS_SHORT[set[0]];
  const contiguous = set.every((d, i) => i === 0 || WEEK_ORDER.indexOf(d) === WEEK_ORDER.indexOf(set[i - 1]) + 1);
  return contiguous && set.length > 2 ? `${WEEKDAYS_SHORT[set[0]]} to ${WEEKDAYS_SHORT[set[set.length - 1]]}` : set.map((d) => WEEKDAYS_SHORT[d]).join(', ');
}

/**
 * Where an owner makes the app theirs: name, logo, colours, how to reach the gym, opening hours
 * and which parts of the app members get. The whole app re-skins as they change things, and what
 * they save is what every member and the front desk sees.
 */
export default function Setup() {
  const { c, alpha, brand } = useTheme();
  const s = useStyles();
  const link = useApp((st) => st.link);
  const override = useApp((st) => st.brandOverride);
  const setOverride = useApp((st) => st.setBrandOverride);
  const joinRemote = useApp((st) => st.joinRemote);
  const plans = useApp((st) => st.plans);
  const slots = useApp((st) => st.slots);
  const members = useApp((st) => st.members);

  const [name, setName] = useState(brand.name === platform.name && !link ? '' : brand.name);
  const [tagline, setTagline] = useState(brand.tagline);
  const [hex, setHex] = useState(brand.colors.primary);
  const [features, setFeatures] = useState<Record<string, boolean>>(() => Object.fromEntries(MODULES.map((m) => [m.key, brand.features[m.key] !== false])));
  const [logoData, setLogoData] = useState<string>();
  const [fromLogo, setFromLogo] = useState<string[]>([]);
  const [phone, setPhone] = useState(brand.contact.phoneDisplay || brand.contact.phone);
  const [whats, setWhats] = useState(brand.contact.whatsapp);
  const [email, setEmail] = useState(brand.contact.email);
  const [insta, setInsta] = useState(brand.contact.instagram);
  const [line1, setLine1] = useState(brand.address.line1);
  const [line2, setLine2] = useState(brand.address.line2);
  const [hours, setHours] = useState<Hours[]>(brand.hours);
  const [amenities, setAmenities] = useState(brand.amenities.join(', '));
  const [reward, setReward] = useState(brand.referral.reward);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  const pending = link?.status !== 'active';

  const preview = (patch: Partial<{ name: string; tagline: string; primary: string; logoUri: string; features: Record<string, boolean> }>) => {
    const next = { name, tagline, primary: hex, features, ...patch };
    setOverride({
      ...override,
      name: next.name || undefined,
      shortName: next.name ? next.name.split(' ')[0] : undefined,
      monogram: next.name ? monogramFrom(next.name) : undefined,
      tagline: next.tagline || undefined,
      primary: isHex(next.primary) ? normal(next.primary) : override?.primary,
      logoUri: patch.logoUri ?? override?.logoUri,
      features: next.features as Partial<Record<FeatureKey, boolean>>,
    });
  };

  const pickLogo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (r.canceled) return;
    let base64 = '';
    for (const width of LOGO_WIDTHS) {
      const ctx = ImageManipulator.manipulate(r.assets[0].uri);
      ctx.resize({ width });
      const img = await ctx.renderAsync();
      const out = await img.saveAsync({ format: SaveFormat.PNG, base64: true });
      base64 = out.base64 ?? '';
      if (base64 && base64.length <= 250_000) break;
    }
    if (!base64 || base64.length > 250_000) return toast.error('That image is too detailed. Try a simpler logo.');
    const uri = `data:image/png;base64,${base64}`;
    setLogoData(uri);
    try {
      const colours = paletteFromPngBase64(base64);
      setFromLogo(colours);
      if (colours[0]) {
        setHex(colours[0]);
        preview({ logoUri: uri, primary: colours[0] });
        haptic.success();
        return;
      }
    } catch {
      setFromLogo([]);
    }
    preview({ logoUri: uri });
  };

  const pickColour = (hexValue: string) => {
    haptic.tap();
    setHex(hexValue);
    preview({ primary: hexValue });
  };

  const toggle = (key: string, on: boolean) => {
    const next = { ...features, [key]: on };
    setFeatures(next);
    preview({ features: next });
  };

  const editHours = (i: number, patch: Partial<Hours>) => setHours((cur) => cur.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  const buildProfile = (): GymProfile => ({
    contact: { phone: phone.replace(/[^\d+]/g, ''), phoneDisplay: phone.trim(), whatsapp: whats.replace(/\D/g, ''), email: email.trim(), instagram: insta.trim().replace(/^@/, '') },
    address: { line1: line1.trim(), line2: line2.trim(), mapsQuery: [line1, line2].map((x) => x.trim()).filter(Boolean).join(', ') },
    hours: hours.filter((h) => h.days.length && HHMM.test(h.open) && HHMM.test(h.close) && h.close > h.open).map((h) => ({ ...h, label: labelFor(h.days) })),
    amenities: amenities.split(',').map((a) => a.trim()).filter(Boolean),
    currency: brand.currency,
    referral: { reward: reward.trim() },
  });

  const save = async () => {
    if (name.trim().length < 2) return toast.error('Give your gym a name first.');
    if (!isHex(hex) || hex.replace('#', '').length < 3) return toast.error('That colour isn’t valid.');
    setBusy(true);
    const r = await api.updateGym({ name: name.trim(), tagline: tagline.trim(), primaryColor: normal(hex), features, profile: buildProfile(), ...(logoData ? { logo: logoData } : {}) });
    if (!r.ok) {
      setBusy(false);
      return toast.error(r.message);
    }
    const me = await api.me();
    setBusy(false);
    if (!me.ok) return toast.error(me.message);
    joinRemote('manager', { gymCode: me.data.gym.code, gymName: me.data.gym.name, name: link?.name ?? '', status: me.data.gym.status === 'active' ? 'active' : 'pending' }, brandFromGym(me.data.gym));
    setLogoData(undefined);
    toast.success('Saved. Everyone sees this the next time they open the app.');
  };

  const refreshStatus = async () => {
    setChecking(true);
    const me = await api.me();
    setChecking(false);
    if (!me.ok) return toast.error(me.message);
    const active = me.data.gym.status === 'active';
    joinRemote('manager', { gymCode: me.data.gym.code, gymName: me.data.gym.name, name: link?.name ?? '', status: active ? 'active' : 'pending' }, brandFromGym(me.data.gym));
    if (active) {
      toast.success('Your gym is live.');
      router.replace('/dashboard');
    } else toast.info('Still waiting. We’ll switch it on once your payment is confirmed.');
  };

  const code = link?.gymCode ?? '';
  const shareText = `Download the ${platform.name} app, tap “Join your gym with a code” and enter our gym code ${code}. Your ${name || 'gym'} app will open and the front desk will get you set up.`;

  const steps: { done: boolean; icon: IconName; title: string; subtitle: string; go: () => void }[] = [
    { done: plans.some((p) => p.active && p.price > 0), icon: 'pricetag-outline', title: 'Set your plan prices', subtitle: 'Turn on the plans you sell and give each a price.', go: () => router.push('/manage/plans') },
    { done: slots.length > 0, icon: 'time-outline', title: 'Add your time slots', subtitle: 'When members can train and how many fit.', go: () => router.push('/slots') },
    { done: members.length > 0, icon: 'person-add-outline', title: 'Add your first member', subtitle: 'They get a code on WhatsApp to open the app.', go: () => router.push('/manage/add-member') },
  ];

  return (
    <Screen
      title="Gym settings"
      subtitle="Everything you change shows up in the app right away."
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!pending ? <IconButton icon="close" label="Back to the gym" onPress={() => router.replace('/dashboard')} /> : null}
          <IconButton icon="log-out-outline" label="Sign out" onPress={signOut} />
        </View>
      }
      footer={<Button title="Save my gym" full loading={busy} onPress={save} />}>
      <View style={[s.preview, { backgroundColor: c.primary }]}>
        <PlateRings size={220} color={alpha(c.onPrimary, 0.12)} style={{ right: -70, top: -70 }} />
        <Logo size={52} inverted />
        <Text variant="title" color={c.onPrimary} numberOfLines={2} style={{ marginTop: 16 }}>
          {brand.name}
        </Text>
        <Text variant="small" color={alpha(c.onPrimary, 0.85)} numberOfLines={2}>
          {brand.tagline}
        </Text>
      </View>

      <Card style={s.codeCard}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" tone="soft">
            Your gym code
          </Text>
          <Text variant="display">{code}</Text>
          <Text variant="small" tone="soft">
            Members enter this to open your app.
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <Pill label={pending ? 'Waiting for activation' : 'Live'} tone={pending ? 'warning' : 'success'} dot />
          <Button title="Share" size="sm" variant="soft" icon="share-outline" onPress={() => share(shareText)} />
        </View>
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">Dashboard on your computer</Text>
          <Text variant="small" tone="soft">
            Send the link to WhatsApp, open it on a PC and sign in with your email.
          </Text>
        </View>
        <Button title="WhatsApp" size="sm" variant="soft" icon="logo-whatsapp" onPress={() => whatsappShare(`${name || 'Gym'} dashboard for computer: ${platform.dashboardUrl}`)} />
      </Card>

      {pending ? (
        <Card style={{ gap: 10, marginTop: 12 }}>
          <Text variant="smallStrong">Your gym isn’t live yet</Text>
          <Text variant="small" tone="soft">
            Set everything up now. When your payment is confirmed we switch your gym on and members can join with your code.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Check status" size="md" variant="outline" loading={checking} onPress={refreshStatus} style={{ flex: 1 }} />
            {platform.supportWhatsApp ? (
              <Button title="Message us" size="md" icon="logo-whatsapp" onPress={() => whatsapp(platform.supportWhatsApp, `Hi, please activate my gym ${name} (code ${code}).`)} style={{ flex: 1 }} />
            ) : null}
          </View>
        </Card>
      ) : (
        <>
          <SectionHeader title="Get your gym ready" hint={`${steps.filter((x) => x.done).length} of ${steps.length} done`} />
          <Group>
            {steps.map((st) => (
              <Row key={st.title} icon={st.done ? 'checkmark-circle' : st.icon} iconTone={st.done ? 'success' : 'primary'} title={st.title} subtitle={st.done ? 'Done' : st.subtitle} onPress={st.go} />
            ))}
          </Group>
        </>
      )}

      <SectionHeader title="Name" />
      <View style={{ gap: 12 }}>
        <Input
          label="Gym name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            preview({ name: v });
          }}
          autoCapitalize="words"
        />
        <Input
          label="Tagline"
          value={tagline}
          onChangeText={(v) => {
            setTagline(v);
            preview({ tagline: v });
          }}
        />
      </View>

      <SectionHeader title="Logo" hint="Square works best" />
      <Pressable accessibilityRole="button" accessibilityLabel="Choose a logo" onPress={pickLogo} style={[s.logoBox, { borderColor: c.line, backgroundColor: c.surface }]}>
        <Logo size={56} />
        <View style={{ flex: 1 }}>
          <Text variant="label">{logoData || brand.logoUri ? 'Change logo' : 'Choose your logo'}</Text>
          <Text variant="small" tone="soft">
            We’ll suggest colours from it.
          </Text>
        </View>
        <Icon name="image-outline" size={22} tone="primary" />
      </Pressable>

      <SectionHeader title="Colour" hint={normal(hex)} />
      {fromLogo.length ? (
        <View style={{ gap: 8, marginBottom: 14 }}>
          <Text variant="caption" tone="soft">
            From your logo
          </Text>
          <View style={s.swatches}>
            {fromLogo.map((sw) => (
              <Swatch key={sw} colour={sw} selected={normal(hex) === sw} onPress={() => pickColour(sw)} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={s.swatches}>
        {SWATCHES.map((sw) => (
          <Swatch key={sw} colour={sw} selected={normal(hex) === sw} onPress={() => pickColour(sw)} />
        ))}
      </View>
      <View style={{ marginTop: 14 }}>
        <Input
          label="Or type an exact colour"
          value={hex}
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={(v) => {
            setHex(v);
            if (isHex(v) && v.replace('#', '').length === 6) preview({ primary: normal(v) });
          }}
          hint="Six-digit hex, like #E4572E."
        />
      </View>

      <SectionHeader title="How to reach you" hint="Shown to your members" />
      <View style={{ gap: 12 }}>
        <Input label="Phone" prefix="+91" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="WhatsApp number" prefix="+91" value={whats} onChangeText={(v) => setWhats(v.replace(/\D/g, ''))} keyboardType="phone-pad" hint="Digits with country code, like 919811100000." />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Input label="Instagram" prefix="@" value={insta} onChangeText={setInsta} autoCapitalize="none" autoCorrect={false} />
        <Input label="Address, line 1" value={line1} onChangeText={setLine1} />
        <Input label="Address, line 2" value={line2} onChangeText={setLine2} placeholder="City, state, pin code" />
      </View>

      <SectionHeader title="Opening hours" />
      <View style={{ gap: 12 }}>
        {hours.map((h, i) => (
          <Card key={i} style={{ gap: 12 }}>
            <View style={s.chips}>
              {WEEK_ORDER.map((d) => (
                <Chip key={d} label={WEEKDAYS_SHORT[d]} selected={h.days.includes(d)} onPress={() => editHours(i, { days: h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d] })} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Input label="Opens" value={h.open} onChangeText={(v) => editHours(i, { open: v })} placeholder="05:30" maxLength={5} keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Closes" value={h.close} onChangeText={(v) => editHours(i, { close: v })} placeholder="22:00" maxLength={5} keyboardType="numbers-and-punctuation" />
              </View>
              <Button title="Remove" size="sm" variant="ghost" onPress={() => setHours((cur) => cur.filter((_, j) => j !== i))} />
            </View>
          </Card>
        ))}
        <Button title={hours.length ? 'Add other hours' : 'Add opening hours'} icon="add" variant="outline" onPress={() => setHours((cur) => [...cur, { label: '', days: [1, 2, 3, 4, 5, 6], open: '06:00', close: '21:00' }])} />
        <Text variant="caption" tone="soft">
          Use 24-hour times, like 18:30 for 6:30 pm.
        </Text>
      </View>

      <SectionHeader title="Extras" />
      <View style={{ gap: 12 }}>
        <Input label="Facilities" value={amenities} onChangeText={setAmenities} placeholder="Lockers, Showers, Parking" hint="Separate with commas." />
        <Input label="Refer a friend reward" value={reward} onChangeText={setReward} placeholder="You both get 15 extra days." />
      </View>

      <SectionHeader title="What members get" hint="All on by default" />
      <Group>
        {MODULES.map((m) => (
          <ToggleRow key={m.key} icon={m.icon as IconName} title={m.title} subtitle={m.subtitle} value={features[m.key] !== false} onChange={(v) => toggle(m.key, v)} />
        ))}
      </Group>
    </Screen>
  );
}

function Swatch({ colour, selected, onPress }: { colour: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Colour ${colour}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.swatch, { backgroundColor: colour, borderColor: selected ? c.ink : 'transparent' }]}>
      {selected ? <Icon name="checkmark" size={20} color={readableOn(colour)} /> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  preview: { borderRadius: t.radius.xl, padding: 20, overflow: 'hidden', marginBottom: 12 },
  codeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: t.radius.lg, borderWidth: 1.5 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
