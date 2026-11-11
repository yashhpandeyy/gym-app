import { useEffect } from 'react';
import { AppState, Modal, Platform, Vibration, View } from 'react-native';

import { ALARM_KINDS, dueAlarms, fmtAlarmTime, listenForAlarms, nativeAlarms, rescheduleAll, retirePastAlarms, ring, SNOOZE_MIN, snoozeRinging, stopRinging, useAlarms } from '@/lib/alarms';
import { playSound, stopSound } from '@/lib/sound';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

import { Button, Icon, Text } from './ui';

/**
 * Rings members' alarms while the app is open: a full-screen alarm with the alarm sound on a loop
 * and a repeating buzz until it's stopped or snoozed. When the app is closed the phone rings them
 * as notifications instead (see lib/alarms).
 */
export function AlarmHost() {
  const signedIn = useApp((s) => !!s.session);
  const ringing = useAlarms((s) => s.ringing);

  // Look for due alarms every few seconds, and the moment the app comes back to the front.
  useEffect(() => {
    const check = () => {
      // With the native alarm the phone rings them itself, app open or not, so nothing to do here.
      if (nativeAlarms || useAlarms.getState().ringing) return;
      const [first] = dueAlarms();
      if (first) ring(first);
    };
    const back = () => {
      // Back from the phone's settings (exact alarms allowed) or from a while away: set everything again.
      retirePastAlarms();
      void rescheduleAll();
      check();
    };
    if (nativeAlarms) retirePastAlarms();
    check();
    const id = setInterval(check, 5000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && back());
    const stop = listenForAlarms((alarmId) => {
      const a = useAlarms.getState().alarms.find((x) => x.id === alarmId);
      if (a && !useAlarms.getState().ringing && dueAlarms().some((x) => x.id === a.id)) ring(a);
    });
    // The phone forgets scheduled alarms when the app is reinstalled or updated; put them back.
    void rescheduleAll();
    return () => {
      clearInterval(id);
      sub.remove();
      stop();
    };
  }, []);

  // Signing out takes the alarms with it, like medicines.
  useEffect(() => {
    if (!signedIn && useAlarms.getState().alarms.length && useApp.getState().hydrated) {
      useAlarms.setState({ alarms: [], rung: {}, snoozed: {}, ringing: null });
      void rescheduleAll();
    }
  }, [signedIn]);

  useEffect(() => {
    if (!ringing) return;
    playSound('alarm', { force: true, loop: true });
    if (Platform.OS !== 'web') Vibration.vibrate([0, 800, 600], true);
    // Give up after two minutes, like a phone alarm, so it can't ring all day in a bag.
    const t = setTimeout(() => snoozeRinging(), 2 * 60_000);
    return () => {
      clearTimeout(t);
      stopSound('alarm');
      if (Platform.OS !== 'web') Vibration.cancel();
    };
  }, [ringing]);

  if (!ringing) return null;
  return <Ringing />;
}

function Ringing() {
  const { c } = useTheme();
  const s = useStyles();
  const a = useAlarms((st) => st.ringing)!;
  const kind = ALARM_KINDS.find((k) => k.key === a.kind) ?? ALARM_KINDS[3];
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={stopRinging} statusBarTranslucent>
      <View style={[s.root, { backgroundColor: c.primary }]}>
        <View style={s.badge}>
          <Icon name={kind.icon} size={40} color={c.primary} />
        </View>
        <Text variant="hero" color={c.onPrimary} align="center">
          {fmtAlarmTime(a.time)}
        </Text>
        <Text variant="title" color={c.onPrimary} align="center">
          {a.label}
        </Text>
        <Text variant="body" color={c.onPrimary} align="center" style={{ opacity: 0.85 }}>
          {kind.body}
        </Text>
        <View style={s.actions}>
          <Button title="Stop" variant="onPrimary" full onPress={stopRinging} />
          <Button title={`Snooze ${SNOOZE_MIN} min`} variant="ink" full onPress={snoozeRinging} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  badge: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actions: { alignSelf: 'stretch', gap: 12, marginTop: 36 },
}));
