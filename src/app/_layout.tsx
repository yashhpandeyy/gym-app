import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold } from '@expo-google-fonts/barlow';
import {
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  BigShouldersDisplay_900Black,
} from '@expo-google-fonts/big-shoulders-display';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationTheme, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';

import { CelebrationHost } from '@/components/fun/Celebration';
import { SyncGate } from '@/components/SyncGate';
import { ToastHost } from '@/components/ui';
import '@/lib/remote';
import { setSoundEnabled } from '@/lib/sound';
import { currentSyncKey, startSync, stopSync } from '@/lib/sync';
import { useApp } from '@/store';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Every route outside the tab groups is listed here so the role guards cover it.
const MEMBER_SCREENS = [
  'membership',
  'payments',
  'progress',
  'attendance',
  'workout',
  'trainers',
  'refer',
  'support',
  'gym',
  'notifications',
  'rewards',
  'strength',
  'challenge/[id]',
  'guest',
  'diet',
  'supplements',
  'mind',
  'leaderboards',
];
const MEMBER_MODALS = ['pause', 'renew', 'edit-profile', 'breathe/[id]'];
const MANAGER_SCREENS = ['member/[id]', 'requests', 'payments', 'plans', 'leads', 'announcements', 'tickets', 'settings', 'challenges', 'prizes', 'guests', 'classes', 'trainers', 'staff'];
const MANAGER_MODALS = ['add-member'];

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BigShouldersDisplay_700Bold,
    BigShouldersDisplay_800ExtraBold,
    BigShouldersDisplay_900Black,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
  });
  const hydrated = useApp((s) => s.hydrated);
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const t = useTheme();
  const session = useApp((s) => s.session);
  const sound = useApp((s) => s.prefs.sound);
  const link = useApp((s) => s.link);
  const hydrated = useApp((s) => s.hydrated);
  const role = session?.role;
  const memberId = session?.memberId;
  const remote = !!session?.remote;

  // Whenever someone is signed in to a live gym, keep their phone and the server in step.
  useEffect(() => {
    if (!hydrated) return;
    if (remote && role && role !== 'admin' && link?.status === 'active') {
      const key = `${link.gymCode}:${role}:${memberId ?? ''}`;
      if (currentSyncKey() !== key) void startSync(key);
    } else if (currentSyncKey()) {
      stopSync();
    }
  }, [hydrated, remote, role, memberId, link?.gymCode, link?.status]);

  useEffect(() => {
    setSoundEnabled(sound !== false);
  }, [sound]);

  const navTheme = useMemo(() => {
    const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: t.c.primary,
        background: t.c.bg,
        card: t.c.surface,
        text: t.c.ink,
        border: t.c.line,
        notification: t.c.danger.solid,
      },
    };
  }, [t]);

  return (
    <NavigationTheme value={navTheme}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={session?.role === 'member'}>
          <Stack.Screen name="(member)" />
          {MEMBER_SCREENS.map((name) => (
            <Stack.Screen key={name} name={`member/${name}`} />
          ))}
          {MEMBER_MODALS.map((name) => (
            <Stack.Screen key={name} name={`member/${name}`} options={{ presentation: 'modal' }} />
          ))}
        </Stack.Protected>
        <Stack.Protected guard={session?.role === 'manager'}>
          <Stack.Screen name="(manager)" />
          {MANAGER_SCREENS.map((name) => (
            <Stack.Screen key={name} name={`manage/${name}`} />
          ))}
          {MANAGER_MODALS.map((name) => (
            <Stack.Screen key={name} name={`manage/${name}`} options={{ presentation: 'modal' }} />
          ))}
          <Stack.Screen name="live/setup" />
        </Stack.Protected>
        <Stack.Protected guard={session?.role === 'admin'}>
          <Stack.Screen name="live/admin" />
          <Stack.Screen name="live/admin-create" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
      <CelebrationHost />
      <SyncGate />
      <ToastHost />
    </NavigationTheme>
  );
}
