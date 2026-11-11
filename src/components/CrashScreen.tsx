import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Appearance, Pressable, StyleSheet, Text, View } from 'react-native';

import { resyncFromServer } from '@/lib/sync';
import { useApp } from '@/store';

// This replaces the root layout, so the theme and the shared UI kit may not exist here. Plain greys keep it readable on any gym's brand.
const LIGHT = { bg: '#F6F6F7', ink: '#14161A', soft: '#5B606B', line: '#C9CCD3', button: '#14161A', buttonInk: '#FFFFFF' };
const DARK = { bg: '#14161A', ink: '#F6F6F7', soft: '#AEB2BB', line: '#4A4E58', button: '#F6F6F7', buttonInk: '#14161A' };

/** Shown instead of the app when a screen can't be drawn, with a way out that doesn't need anyone at the gym. */
export function CrashScreen({ retry }: ErrorBoundaryProps) {
  const c = Appearance.getColorScheme() === 'dark' ? DARK : LIGHT;
  const [busy, setBusy] = useState(false);
  const live = useApp((s) => !!s.session?.remote);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const reload = async () => {
    setBusy(true);
    await resyncFromServer().catch(() => {});
    setBusy(false);
    await retry();
  };

  return (
    <View style={[s.page, { backgroundColor: c.bg }]}>
      <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
        This screen couldn’t load
      </Text>
      <Text style={[s.body, { color: c.soft }]}>
        Try again. If this screen comes back, {live ? 'reload your gym’s data. Anything not yet sent from this phone is lost.' : 'close the app and open it again.'}
      </Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void retry()} style={[s.button, { backgroundColor: c.button }]}>
        <Text style={[s.label, { color: c.buttonInk }]}>Try again</Text>
      </Pressable>
      {live ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={reload} style={[s.button, { borderWidth: 1, borderColor: c.line }]}>
          {busy ? <ActivityIndicator color={c.ink} /> : <Text style={[s.label, { color: c.ink }]}>Reload gym data</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 28, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23, marginBottom: 12 },
  button: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  label: { fontSize: 16, fontWeight: '600' },
});
