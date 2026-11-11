import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { signOut } from '@/lib/remote';
import { syncNow, useSync } from '@/lib/sync';
import { makeStyles, useTheme } from '@/theme';

import { Logo } from './Brand';
import { LaunchMark } from './Launch';
import { Button, Text } from './ui';

/**
 * Covers the app while a gym's data loads for the first time, explains if it can't be reached,
 * and shows a thin note when the phone is offline and changes are waiting to send.
 */
export function SyncGate() {
  const { c } = useTheme();
  const s = useStyles();
  const status = useSync((x) => x.status);
  const error = useSync((x) => x.error);
  const offline = useSync((x) => x.offline);
  const insets = useSafeAreaInsets();

  if (status === 'loading' || status === 'error') {
    return (
      <View style={[StyleSheet.absoluteFill, s.cover, { backgroundColor: status === 'loading' ? c.primary : c.bg }]}>
        {status === 'loading' ? (
          <LaunchMark />
        ) : (
          <>
            <Logo size={64} />
            <Text variant="title" align="center" style={{ marginTop: 24 }}>
              Can’t open your gym
            </Text>
            <Text tone="soft" align="center" style={{ marginTop: 8, maxWidth: 320 }}>
              {error ?? 'Something went wrong.'}
            </Text>
            <View style={{ marginTop: 20, gap: 10, alignSelf: 'stretch', paddingHorizontal: 40 }}>
              <Button title="Try again" full onPress={() => void syncNow()} />
              <Button title="Sign out" variant="ghost" full onPress={signOut} />
            </View>
          </>
        )}
      </View>
    );
  }

  if (offline) {
    return (
      <View pointerEvents="none" style={[s.banner, { top: insets.top + 4, backgroundColor: c.ink }]}>
        <Text variant="caption" color={c.surface}>
          You’re offline. Changes will send when you’re back.
        </Text>
      </View>
    );
  }
  return null;
}

const useStyles = makeStyles(() => ({
  cover: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  banner: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, zIndex: 50 },
}));
