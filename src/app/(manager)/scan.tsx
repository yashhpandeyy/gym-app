import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  Empty,
  Group,
  Icon,
  Input,
  Row,
  Screen,
  Segmented,
  Sheet,
  StatusPill,
  Text,
  toast,
} from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDay, fmtTime, plural, stampToDate } from '@/lib/date';
import { membership, parseGuestQRValue, parseQRValue } from '@/lib/domain';
import { firstName } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { haptic } from '@/lib/native';
import { useApp, type Member } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type Pairing = { qr: string; request: { name: string; phone: string }; member: { id: string; name: string; phone: string } | null };

type Outcome = { ok: boolean; title: string; body: string; member?: Member; guestCode?: string; needsHost?: boolean };

export default function Scan() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow();
  const focused = useIsFocused();
  const members = useApp((st) => st.members);
  const plans = useApp((st) => st.plans);
  const pauses = useApp((st) => st.pauses);
  const checkins = useApp((st) => st.checkins);
  const checkIn = useApp((st) => st.checkIn);
  const checkInGuest = useApp((st) => st.checkInGuest);
  const guestPasses = useApp((st) => st.guestPasses);
  const [mode, setMode] = useState<'scan' | 'search'>(Platform.OS === 'web' ? 'search' : 'scan');
  const [permission, requestPermission] = useCameraPermissions();
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const busy = useRef(false);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pairBusy, setPairBusy] = useState(false);
  const [pasted, setPasted] = useState('');

  const run = (m: Member, method: 'qr' | 'desk') => {
    const r = checkIn(m.id, method);
    if (r.ok) haptic.success();
    else haptic.warn();
    setOutcome({ ok: r.ok, title: r.ok ? m.name : `${firstName(m.name)} can’t come in`, body: r.message ?? '', member: m });
  };

  const runGuest = (code: string, override?: boolean) => {
    const r = checkInGuest(code, override);
    if (r.ok) haptic.success();
    else haptic.warn();
    setOutcome({
      ok: r.ok,
      title: r.ok ? `Guest: ${r.pass?.name ?? code}` : r.needsHost ? 'Waiting for their host' : 'Guest not checked in',
      body: r.message ?? '',
      guestCode: code,
      needsHost: r.needsHost,
    });
  };

  /** A person joining without an invite shows a pairing code. Look who is asking, and let staff confirm it's the person in front of them. */
  const startPairing = async (qr: string) => {
    const r = await api.previewPairing(qr.trim());
    if (!r.ok) {
      haptic.warn();
      setOutcome({ ok: false, title: 'Pairing code not accepted', body: r.message });
      return;
    }
    haptic.tap();
    setPairing({ qr: qr.trim(), request: r.data.request, member: r.data.member });
  };

  const confirmPairing = async () => {
    if (!pairing?.member) return;
    setPairBusy(true);
    const r = await api.approvePairing(pairing.qr, pairing.member.id);
    setPairBusy(false);
    if (!r.ok) {
      haptic.warn();
      setPairing(null);
      setOutcome({ ok: false, title: 'Couldn’t let them in', body: r.message });
      return;
    }
    haptic.success();
    toast.success(`${pairing.member.name} is in. Their app opens in a few seconds.`);
    closePairing();
  };

  const closePairing = () => {
    setPairing(null);
    setPasted('');
    setTimeout(() => {
      busy.current = false;
    }, 800);
  };

  const onScan = ({ data }: BarcodeScanningResult) => {
    if (busy.current || outcome || pairing) return;
    busy.current = true;
    if (data.startsWith('GYMPAIR:')) {
      void startPairing(data);
      return;
    }
    const guest = parseGuestQRValue(data);
    if (guest) {
      runGuest(guest);
      return;
    }
    const parsed = parseQRValue(data);
    if (!parsed.ok) {
      haptic.warn();
      setOutcome({ ok: false, title: 'Pass not accepted', body: parsed.reason });
      return;
    }
    const m = members.find((x) => x.code === parsed.code);
    if (!m) {
      haptic.warn();
      setOutcome({ ok: false, title: 'Member not found', body: `No member with ID ${parsed.code}. Check the members list.` });
      return;
    }
    run(m, 'qr');
  };

  const close = () => {
    setOutcome(null);
    setTimeout(() => {
      busy.current = false;
    }, 800);
  };

  const q = query.trim().toLowerCase();
  const matches = q
    ? members
        .filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || (q.length >= 3 && m.phone.includes(q)))
        .slice(0, 20)
    : [];
  const guestMatches = q
    ? guestPasses.filter((g) => !g.joinedAs && (g.code.toLowerCase() === q || (q.length >= 3 && g.name.toLowerCase().includes(q)))).slice(0, 5)
    : [];
  const today = checkins.filter((ci) => stampToDate(ci.at) === now.date).sort((a, b) => (a.at < b.at ? 1 : -1));
  const info = outcome?.member ? membership(outcome.member, plans, pauses, now.date) : undefined;

  const camera =
    !permission ? null : !permission.granted ? (
      <Card style={{ gap: 12, alignItems: 'flex-start' }}>
        <Icon name="camera-outline" size={28} tone="primary" />
        <Text variant="h3">Allow the camera to scan passes</Text>
        <Text variant="small" tone="soft">
          Members show a QR code in their app. The camera reads it and checks them in, no typing needed.
        </Text>
        <Button title="Allow camera" size="md" onPress={requestPermission} />
      </Card>
    ) : (
      <View style={s.cameraWrap}>
        {focused && !outcome ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScan}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#000' }} />
        )}
        <View pointerEvents="none" style={s.frameLayer}>
          <View style={s.frame}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
              <View key={k} style={[s.corner, s[k], { borderColor: c.primary }]} />
            ))}
          </View>
          <Text variant="smallStrong" color="#FFFFFF" style={s.hint}>
            Point at the member’s pass
          </Text>
        </View>
      </View>
    );

  return (
    <Screen title="Check in" subtitle="Scan a member’s pass, or find them by name.">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'scan', label: 'Scan pass' },
          { value: 'search', label: 'Find by name' },
        ]}
      />
      <View style={{ marginTop: 14 }}>
        {mode === 'scan' ? (
          Platform.OS === 'web' ? (
            <Card>
              <Text variant="small" tone="soft">
                Scanning works in the phone app. Use Find by name here.
              </Text>
            </Card>
          ) : (
            camera
          )
        ) : (
          <View style={{ gap: 12 }}>
            <Input icon="search" placeholder="Name, phone, member ID or guest code" value={query} onChangeText={setQuery} autoCorrect={false} autoFocus />
            <Input label="Someone joining? Paste their pairing code" placeholder="GYMPAIR:..." value={pasted} onChangeText={(v) => (setPasted(v), v.startsWith('GYMPAIR:') && v.includes('.') ? startPairing(v) : undefined)} autoCapitalize="none" autoCorrect={false} />
            {guestMatches.length ? (
              <Group>
                {guestMatches.map((g) => (
                  <Row
                    key={g.id}
                    leading={<Avatar name={g.name} size={36} />}
                    title={g.name}
                    subtitle={`Guest pass ${g.code}, ${g.visits.length ? `${plural(g.visits.length, 'visit')} so far` : 'first visit'}`}
                    chevron={false}
                    right={<StatusPill status="upcoming" />}
                    onPress={() => runGuest(g.code)}
                  />
                ))}
              </Group>
            ) : null}
            {matches.length ? (
              <Group>
                {matches.map((m) => {
                  const mi = membership(m, plans, pauses, now.date);
                  return (
                    <Row
                      key={m.id}
                      leading={<Avatar name={m.name} size={36} />}
                      title={m.name}
                      subtitle={m.code}
                      chevron={false}
                      right={<StatusPill status={mi.status} />}
                      onPress={() => run(m, 'desk')}
                    />
                  );
                })}
              </Group>
            ) : q && !guestMatches.length ? (
              <Empty icon="search-outline" title="No one by that name" body="Check the spelling, or search by phone number." />
            ) : null}
          </View>
        )}
      </View>

      <Text variant="h3" style={{ marginTop: 28, marginBottom: 12 }}>
        Checked in from this phone today
      </Text>
      {today.length ? (
        <Group>
          {today.slice(0, 12).map((ci) => {
            const m = members.find((x) => x.id === ci.memberId);
            const d = new Date(ci.at);
            return (
              <Row
                key={ci.id}
                leading={<Avatar name={m?.name ?? '?'} size={34} />}
                title={m?.name ?? 'Former member'}
                subtitle={ci.method === 'qr' ? 'Scanned pass' : 'Found by name'}
                value={fmtTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)}
              />
            );
          })}
        </Group>
      ) : (
        <Text variant="small" tone="soft">
          Nobody yet. Scans you make here show up in this list.
        </Text>
      )}

      <Sheet
        visible={!!pairing}
        onClose={closePairing}
        title="Is this who you think?"
        subtitle="Only let them in if it's the person standing in front of you."
        footer={
          pairing?.member ? (
            <>
              <Button title={`Yes, that's ${firstName(pairing.member.name)}`} full loading={pairBusy} onPress={confirmPairing} />
              <Button title="No, not them" variant="ghost" full onPress={closePairing} />
            </>
          ) : (
            <>
              <Button
                title="Add them as a member"
                full
                onPress={() => {
                  const p = pairing;
                  closePairing();
                  if (p) router.push({ pathname: '/manage/add-member', params: { name: p.request.name, phone: p.request.phone } });
                }}
              />
              <Button title="Close" variant="ghost" full onPress={closePairing} />
            </>
          )
        }>
        {pairing ? (
          <View style={s.result}>
            <Text variant="caption" tone="soft">
              They say they are
            </Text>
            <Text variant="h2" align="center">
              {pairing.request.name}
            </Text>
            <Text tone="soft">+91 {pairing.request.phone}</Text>
            {pairing.member ? (
              <Card variant="inset" style={s.resultFacts}>
                <Text variant="smallStrong">Matches your member {pairing.member.name}</Text>
                <Text variant="small" tone="soft">
                  +91 {pairing.member.phone}
                </Text>
              </Card>
            ) : (
              <Card variant="inset" style={s.resultFacts}>
                <Text variant="smallStrong" tone="warning">
                  No member has that number
                </Text>
                <Text variant="small" tone="soft">
                  Add them as a member first, or ask them for the number you have on file.
                </Text>
              </Card>
            )}
          </View>
        ) : null}
      </Sheet>

      <Sheet
        visible={!!outcome}
        onClose={close}
        title={outcome?.ok ? 'Checked in' : 'Not checked in'}
        footer={
          <>
            {outcome?.needsHost && outcome.guestCode ? (
              <Button title="Let them in anyway" variant="outline" full onPress={() => runGuest(outcome.guestCode!, true)} />
            ) : null}
            <Button title={mode === 'scan' ? 'Scan the next pass' : 'Done'} full onPress={close} />
          </>
        }>
        {outcome ? (
          <View style={s.result}>
            <View style={[s.resultIcon, { backgroundColor: outcome.ok ? c.success.bg : outcome.needsHost ? c.warning.bg : c.danger.bg }]}>
              <Icon
                name={outcome.ok ? 'checkmark' : outcome.needsHost ? 'people' : 'close'}
                size={40}
                color={outcome.ok ? c.success.fg : outcome.needsHost ? c.warning.fg : c.danger.fg}
              />
            </View>
            <Text variant="h2" align="center">
              {outcome.title}
            </Text>
            <Text tone="soft" align="center">
              {outcome.body}
            </Text>
            {info && outcome.member ? (
              <Card variant="inset" style={s.resultFacts}>
                <Text variant="smallStrong">
                  {info.plan?.name ?? 'Plan'}, {outcome.member.code}
                </Text>
                <Text variant="small" tone="soft">
                  {info.status === 'active'
                    ? `${plural(info.daysLeft, 'day')} left, ends ${fmtDay(info.end)}`
                    : info.status === 'paused'
                      ? `Paused until ${fmtDay(info.activePause!.end)}`
                      : info.status === 'expired'
                        ? `Ended ${fmtDay(info.end)}. Offer a renewal at the desk.`
                        : `Starts ${fmtDay(info.start)}`}
                </Text>
                {outcome.member.dues > 0 ? (
                  <Text variant="smallStrong" tone="danger">
                    Has unpaid dues. Collect at the desk.
                  </Text>
                ) : null}
              </Card>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const FRAME = 220;
const useStyles = makeStyles((t) => ({
  cameraWrap: { height: 360, borderRadius: t.radius.xl, overflow: 'hidden', backgroundColor: '#000' },
  frameLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 18 },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: 34, height: 34 },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  hint: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
  result: { alignItems: 'center', gap: 8 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  resultFacts: { alignSelf: 'stretch', gap: 4, marginTop: 8 },
}));
