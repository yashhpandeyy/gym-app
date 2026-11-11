import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, Switch, View } from 'react-native';

import { Button, Card, Chip, Empty, Icon, IconButton, Input, Screen, Sheet, Text, toast } from '@/components/ui';
import {
  ALARM_KINDS,
  alarmPermission,
  askAlarmPermission,
  askExactAlarms,
  askFullScreen,
  closedAppAlarms,
  exactAlarmsAllowed,
  fmtAlarmTime,
  fullScreenAllowed,
  nativeAlarms,
  removeAlarm,
  repeatLabel,
  saveAlarm,
  toggleAlarm,
  tryAlarm,
  useAlarms,
  type Alarm,
  type AlarmKind,
  type AlarmPermission,
} from '@/lib/alarms';
import { fmtTime, parseClock, WEEKDAYS_SHORT } from '@/lib/date';
import { confirm, haptic } from '@/lib/native';
import { playSound, stopSound } from '@/lib/sound';
import { makeStyles, useTheme } from '@/theme';

const PRESETS: { label: string; kind: AlarmKind; time: string; days: number[] }[] = [
  { label: 'Time for the gym', kind: 'gym', time: '06:00', days: [1, 2, 3, 4, 5, 6] },
  { label: 'Night medicine', kind: 'medicine', time: '21:00', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Pre-workout meal', kind: 'meal', time: '17:00', days: [1, 2, 3, 4, 5] },
];
const QUICK_TIMES = ['06:00', '07:00', '08:00', '17:00', '18:00', '21:00'];

type Draft = { id?: string; label: string; kind: AlarmKind; time: string; days: number[] };

export default function Alarms() {
  const { c } = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ kind?: AlarmKind }>();
  const alarms = useAlarms((st) => st.alarms);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [timeText, setTimeText] = useState('');
  const [error, setError] = useState<string>();
  const [perm, setPerm] = useState<AlarmPermission>('unavailable');
  const [exact, setExact] = useState(true);
  const [fullScreen, setFullScreen] = useState(true);

  // Check again whenever the person comes back from the phone's settings.
  useEffect(() => {
    const refresh = () => {
      void alarmPermission().then(setPerm);
      void exactAlarmsAllowed().then(setExact);
      setFullScreen(fullScreenAllowed());
    };
    refresh();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => sub.remove();
  }, []);

  const startDraft = (d: Draft) => {
    setError(undefined);
    setTimeText(fmtTime(d.time));
    setDraft(d);
  };

  // Opened from the medicines list: start a medicine alarm straight away.
  const [opened, setOpened] = useState(false);
  if (!opened && params.kind && ALARM_KINDS.some((k) => k.key === params.kind)) {
    setOpened(true);
    startDraft({ label: params.kind === 'medicine' ? 'Medicine' : '', kind: params.kind, time: params.kind === 'medicine' ? '21:00' : '06:00', days: [0, 1, 2, 3, 4, 5, 6] });
  }

  const time = parseClock(timeText);
  const save = async () => {
    if (!draft) return;
    if (!time) return setError('Enter a time, like 6:30 am or 21:00.');
    const label = draft.label.trim() || ALARM_KINDS.find((k) => k.key === draft.kind)!.label;
    const a = saveAlarm({ id: draft.id, label: label.slice(0, 60), kind: draft.kind, time, days: draft.days });
    haptic.success();
    setDraft(null);
    toast.success(`${a.label}, ${fmtTime(a.time)}, ${repeatLabel(a).toLowerCase()}.`);
    // Ask for notifications the first time someone sets an alarm, when the reason is obvious.
    if (closedAppAlarms && perm === 'ask') setPerm(await askAlarmPermission());
  };

  const testSound = () => {
    playSound('alarm', { force: true });
    setTimeout(() => stopSound('alarm'), 3000);
  };

  return (
    <Screen
      header="stack"
      title="Alarms"
      right={<IconButton icon="add" label="Add an alarm" variant="soft" onPress={() => startDraft({ label: '', kind: 'gym', time: '06:00', days: [1, 2, 3, 4, 5, 6] })} />}>
      <Text tone="soft" style={{ marginBottom: 14 }}>
        Alarms for the gym, medicines and meals. They stay on this phone.
      </Text>
      {nativeAlarms ? (
        <Button
          title="Try the alarm"
          icon="alarm-outline"
          variant="soft"
          size="md"
          style={{ marginBottom: 14 }}
          onPress={() => tryAlarm('Test alarm', 'This is how your alarms ring. Press Stop.')}
        />
      ) : null}

      {!closedAppAlarms ? (
        <Card variant="soft" style={s.note}>
          <Icon name="information-circle-outline" size={22} tone="primary" />
          <Text variant="small" style={{ flex: 1 }}>
            {Platform.OS === 'web'
              ? 'In the browser, alarms ring only while this tab is open. Install the app to hear them any time.'
              : 'Alarms ring while the app is open. To hear them when it’s closed, install the latest version of the app.'}
          </Text>
        </Card>
      ) : perm === 'denied' || perm === 'ask' ? (
        <Card variant="soft" style={s.note}>
          <Icon name="notifications-off-outline" size={22} tone="warning" />
          <View style={{ flex: 1, gap: 8 }}>
            <Text variant="small">Allow notifications so alarms can ring when the app is closed.</Text>
            <Button
              title={perm === 'denied' ? 'Open settings' : 'Allow'}
              size="sm"
              onPress={async () => (perm === 'denied' ? Linking.openSettings() : setPerm(await askAlarmPermission()))}
            />
          </View>
        </Card>
      ) : !fullScreen ? (
        <Card variant="soft" style={s.note}>
          <Icon name="phone-portrait-outline" size={22} tone="warning" />
          <View style={{ flex: 1, gap: 8 }}>
            <Text variant="small">Allow full-screen alarms, so an alarm fills the screen like the phone’s clock even when it’s locked.</Text>
            <Button title="Allow full-screen alarms" size="sm" onPress={askFullScreen} />
          </View>
        </Card>
      ) : !exact ? (
        <Card variant="soft" style={s.note}>
          <Icon name="time-outline" size={22} tone="primary" />
          <View style={{ flex: 1, gap: 8 }}>
            <Text variant="small">Your phone may ring alarms a few minutes late. Allow exact alarms to ring on the minute.</Text>
            <Button title="Allow exact alarms" size="sm" onPress={async () => setExact(await askExactAlarms())} />
          </View>
        </Card>
      ) : null}

      {alarms.length ? (
        <View style={{ gap: 10 }}>
          {alarms.map((a) => (
            <AlarmRow key={a.id} a={a} onEdit={() => startDraft({ id: a.id, label: a.label, kind: a.kind, time: a.time, days: a.days })} />
          ))}
        </View>
      ) : (
        <>
          <Empty icon="alarm-outline" title="No alarms yet" body="Set one for your gym time, a medicine or a meal. It rings like a phone alarm." />
          <View style={{ gap: 8 }}>
            {PRESETS.map((p) => (
              <Pressable key={p.label} accessibilityRole="button" onPress={() => startDraft({ ...p })} style={({ pressed }) => [s.preset, { borderColor: c.line }, pressed && { opacity: 0.7 }]}>
                <Icon name={ALARM_KINDS.find((k) => k.key === p.kind)!.icon} size={20} tone="primary" />
                <Text variant="label" style={{ flex: 1 }}>
                  {p.label}
                </Text>
                <Text variant="small" tone="soft">
                  {fmtTime(p.time)}, {repeatLabel(p).toLowerCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Sheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit alarm' : 'New alarm'}
        footer={
          <>
            {error ? (
              <Text variant="small" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button title="Save alarm" full onPress={save} />
            {draft?.id ? (
              <Button
                title="Delete alarm"
                variant="ghost"
                full
                onPress={() =>
                  confirm({
                    title: 'Delete this alarm?',
                    confirmText: 'Delete',
                    destructive: true,
                    onConfirm: () => {
                      removeAlarm(draft.id!);
                      setDraft(null);
                    },
                  })
                }
              />
            ) : null}
          </>
        }>
        {draft ? (
          <View style={{ gap: 14 }}>
            <View style={s.wrap}>
              {ALARM_KINDS.map((k) => (
                <Chip key={k.key} label={k.label} icon={k.icon} selected={draft.kind === k.key} onPress={() => setDraft({ ...draft, kind: k.key })} />
              ))}
            </View>
            <Input
              label="Name"
              value={draft.label}
              onChangeText={(v) => setDraft({ ...draft, label: v })}
              placeholder={draft.kind === 'medicine' ? 'Vitamin D, after dinner' : draft.kind === 'gym' ? 'Leave for the gym' : 'Alarm'}
              maxLength={60}
            />
            <Input
              label="Time"
              value={timeText}
              onChangeText={(v) => {
                setTimeText(v);
                setError(undefined);
              }}
              onBlur={() => time && setTimeText(fmtTime(time))}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              placeholder="6:30 am"
              hint={time ? `Rings at ${fmtTime(time)}.` : 'Type 6:30 am, 6.30 pm or 18:30.'}
              error={timeText.trim() && !time ? 'Not a time' : undefined}
            />
            <View style={s.wrap}>
              {QUICK_TIMES.map((t) => (
                <Chip key={t} label={fmtTime(t)} selected={time === t} onPress={() => setTimeText(fmtTime(t))} />
              ))}
            </View>
            <View style={{ gap: 8 }}>
              <Text variant="smallStrong" tone="soft">
                Repeat
              </Text>
              <View style={s.wrap}>
                {WEEKDAYS_SHORT.map((d, i) => (
                  <Chip
                    key={d}
                    label={d}
                    selected={draft.days.includes(i)}
                    onPress={() => setDraft({ ...draft, days: draft.days.includes(i) ? draft.days.filter((x) => x !== i) : [...draft.days, i] })}
                  />
                ))}
              </View>
              <View style={s.wrap}>
                <Chip label="Every day" selected={draft.days.length === 7} onPress={() => setDraft({ ...draft, days: [0, 1, 2, 3, 4, 5, 6] })} />
                <Chip label="Mon to Sat" selected={[...draft.days].sort().join() === '1,2,3,4,5,6'} onPress={() => setDraft({ ...draft, days: [1, 2, 3, 4, 5, 6] })} />
                <Chip label="Just once" selected={draft.days.length === 0} onPress={() => setDraft({ ...draft, days: [] })} />
              </View>
            </View>
            <Button title="Hear the alarm" variant="soft" size="sm" icon="volume-high-outline" onPress={testSound} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function AlarmRow({ a, onEdit }: { a: Alarm; onEdit: () => void }) {
  const { c } = useTheme();
  const s = useStyles();
  const kind = ALARM_KINDS.find((k) => k.key === a.kind) ?? ALARM_KINDS[3];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${a.label}, ${fmtAlarmTime(a.time)}, ${repeatLabel(a)}`} onPress={onEdit} style={({ pressed }) => [s.row, { opacity: pressed ? 0.75 : 1 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="display" style={{ opacity: a.on ? 1 : 0.45 }}>
          {fmtAlarmTime(a.time)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={kind.icon} size={15} tone={a.on ? 'primary' : 'faint'} />
          <Text variant="small" tone={a.on ? 'ink' : 'faint'} numberOfLines={1} style={{ flexShrink: 1 }}>
            {a.label}, {repeatLabel(a).toLowerCase()}
          </Text>
        </View>
      </View>
      <Switch
        value={a.on}
        onValueChange={(v) => {
          haptic.tap();
          toggleAlarm(a.id, v);
        }}
        trackColor={{ true: c.primary, false: c.line }}
        thumbColor="#FFFFFF"
        accessibilityLabel={a.on ? 'Switch off' : 'Switch on'}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: t.radius.lg, backgroundColor: t.c.surface },
  preset: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: t.radius.md, borderWidth: 1 },
}));
