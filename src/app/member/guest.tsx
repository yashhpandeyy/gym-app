import { useState } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { PlateRings } from '@/components/Brand';
import { PopIn } from '@/components/fun/Motion';
import { Button, Card, Empty, Icon, Input, Pill, Screen, SectionHeader, Text, toast, type IconName } from '@/components/ui';
import { addDays, diffDays, fmtDay, fmtTime, plural } from '@/lib/date';
import { guestQRValue, membership } from '@/lib/domain';
import { firstName } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { share, whatsapp } from '@/lib/native';
import { useApp, useMe, type GuestPass } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function Guest() {
  const { c, brand, alpha } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const me = useMe();
  const plans = useApp((st) => st.plans);
  const pauses = useApp((st) => st.pauses);
  const passes = useApp((st) => st.guestPasses);
  const settings = useApp((st) => st.settings);
  const createGuestPass = useApp((st) => st.createGuestPass);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showing, setShowing] = useState<string | null>(null);
  if (!me) return null;

  const days = settings.guestPassDays;
  const mine = passes.filter((g) => g.hostId === me.id).sort((a, b) => (a.createdOn < b.createdOn ? 1 : -1));
  const usedThisMonth = mine.filter((g) => g.createdOn.slice(0, 7) === now.date.slice(0, 7)).length;
  const left = Math.max(0, settings.guestPassesPerMonth - usedThisMonth) + Math.max(0, (me.bonusGuestPasses ?? 0) - (me.bonusUsed ?? 0));
  const active = membership(me, plans, pauses, now.date).status === 'active';
  const today = brand.hours.find((h) => h.days.includes(new Date().getDay()));
  const open = showing ? mine.find((g) => g.id === showing) : undefined;

  const status = (g: GuestPass): { label: string; tone: 'success' | 'primary' | 'neutral' | 'warning' } => {
    if (g.joinedAs) return { label: 'Joined', tone: 'success' };
    if (!g.activatedOn) return now.date > addDays(g.createdOn, 30) ? { label: 'Expired', tone: 'neutral' } : { label: 'Not used yet', tone: 'primary' };
    const end = addDays(g.activatedOn, days - 1);
    if (now.date > end) return { label: 'Week finished', tone: 'neutral' };
    return { label: `Day ${diffDays(g.activatedOn, now.date) + 1} of ${days}`, tone: 'warning' };
  };

  const message = (g: GuestPass) =>
    `Hey ${firstName(g.name)}, I've got you a free ${days}-day pass at ${brand.name}! Your code is ${g.code}. Come with me and show it at the desk. ` +
    `${brand.address.line1}, ${brand.address.line2}.${today ? ` Open ${fmtTime(today.open)} to ${fmtTime(today.close)}.` : ''}`;

  const create = () => {
    const r = createGuestPass(name, phone);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    toast.success(r.message ?? 'Guest pass ready.');
    setName('');
    setPhone('');
    if (r.pass) setShowing(r.pass.id);
  };

  const rules: [IconName, string][] = [
    ['calendar-outline', `${days} free days, starting from their first visit.`],
    ['people-outline', settings.guestWithHost ? 'They come in with you, so check in first.' : 'They can come in on their own.'],
    ['ticket-outline', `${plural(settings.guestPassesPerMonth, 'guest pass', 'guest passes')} a month. Chests sometimes give you an extra one.`],
    ['gift-outline', 'If they join, you both get the referral reward.'],
  ];

  return (
    <Screen header="stack" title="Guest pass">
      <View style={[s.hero, { backgroundColor: c.primary }]}>
        <PlateRings size={240} color={alpha(c.onPrimary, 0.1)} style={{ right: -80, top: -70 }} />
        <Text variant="title" color={c.onPrimary}>
          Bring a friend, free for {days} days
        </Text>
        <Text color={alpha(c.onPrimary, 0.88)} style={{ marginTop: 6 }}>
          Training is easier with company. Give a friend a week at {brand.shortName} on us.
        </Text>
        <View style={[s.left, { backgroundColor: alpha(c.onPrimary, 0.16) }]}>
          <Icon name="ticket" size={18} color={c.onPrimary} />
          <Text variant="smallStrong" color={c.onPrimary}>
            {left === 0 ? 'No passes left this month' : `${plural(left, 'pass', 'passes')} left this month`}
          </Text>
        </View>
      </View>

      {open ? (
        <PopIn>
          <Card style={s.pass}>
            <Text variant="h3" align="center">
              {open.name}’s pass
            </Text>
            <View style={s.qr}>
              <QRCode value={guestQRValue(open.code)} size={170} color="#10141C" backgroundColor="#FFFFFF" />
            </View>
            <Text variant="display" align="center" style={{ letterSpacing: 3 }}>
              {open.code}
            </Text>
            <Text variant="small" tone="soft" align="center">
              Show this at the desk when you bring {firstName(open.name)}, or send them the code.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
              <Button title="WhatsApp" icon="logo-whatsapp" style={{ flex: 1 }} onPress={() => whatsapp(open.phone, message(open))} />
              <Button title="Share" icon="share-social-outline" variant="outline" style={{ flex: 1 }} onPress={() => share(message(open))} />
            </View>
            <Button title="Done" variant="ghost" full onPress={() => setShowing(null)} />
          </Card>
        </PopIn>
      ) : active ? (
        <Card style={{ gap: 14, marginTop: 14 }}>
          <Text variant="h3">Who are you bringing?</Text>
          <Input label="Friend’s name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Riya Sharma" />
          <Input label="Their mobile number" prefix="+91" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98765 43210" />
          <Button title="Create guest pass" full disabled={left === 0} onPress={create} />
        </Card>
      ) : (
        <Card variant="soft" style={{ marginTop: 14 }}>
          <Text variant="label">Guest passes need an active membership.</Text>
        </Card>
      )}

      <SectionHeader title="How it works" />
      <View style={{ gap: 12 }}>
        {rules.map(([icon, text]) => (
          <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name={icon} size={20} tone="primary" />
            <Text variant="small" tone="soft" style={{ flex: 1 }}>
              {text}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Your guests" />
      {mine.length ? (
        <View style={{ gap: 10 }}>
          {mine.map((g) => {
            const st = status(g);
            return (
              <Card key={g.id} style={s.guest}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{g.name}</Text>
                  <Text variant="caption" tone="soft">
                    {g.code}, {g.visits.length ? `${plural(g.visits.length, 'visit')}, last on ${fmtDay(g.visits[g.visits.length - 1])}` : `created ${fmtDay(g.createdOn)}`}
                  </Text>
                </View>
                <Pill label={st.label} tone={st.tone} />
                {!g.joinedAs && st.label !== 'Week finished' && st.label !== 'Expired' ? (
                  <Button title="Show" size="sm" variant="outline" onPress={() => setShowing(g.id)} />
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : (
        <Empty icon="people-outline" title="No guests yet" body="Your first guest earns you XP and the Good company badge." />
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  hero: { borderRadius: t.radius.xl, padding: 20, overflow: 'hidden' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, marginTop: 14 },
  pass: { alignItems: 'center', gap: 12, marginTop: 14, paddingVertical: 20 },
  qr: { padding: 12, backgroundColor: '#FFFFFF', borderRadius: 16 },
  guest: { flexDirection: 'row', alignItems: 'center', gap: 10 },
}));
