import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { checkForUpdate, restartIntoUpdate, updatesOn, useUpdateReady, versionLabel } from '@/lib/updates';

import { Text } from './ui';

/** The version line at the foot of Profile and More. Tapping it checks for an update straight away. */
export function AppVersion({ appName }: { appName: string }) {
  const [checked, setState] = useState<'idle' | 'checking' | 'ready' | 'latest' | 'failed'>('idle');
  const waiting = useUpdateReady((s) => s.ready);
  const state = waiting && checked !== 'checking' ? 'ready' : checked;

  const note =
    state === 'checking'
      ? 'Checking for updates…'
      : state === 'ready'
        ? 'Updated app ready. Tap to open it.'
        : state === 'latest'
          ? 'You have the latest version.'
          : state === 'failed'
            ? 'Couldn’t check. Try again when you’re online.'
            : updatesOn
              ? 'Tap to check for updates'
              : null;

  const onPress = async () => {
    if (state === 'ready') return restartIntoUpdate();
    setState('checking');
    setState(await checkForUpdate(true));
  };

  return (
    <Pressable
      accessibilityRole={updatesOn ? 'button' : undefined}
      disabled={!updatesOn || state === 'checking'}
      onPress={onPress}
      style={({ pressed }) => [{ marginTop: 18, paddingVertical: 8, alignItems: 'center' }, pressed && { opacity: 0.6 }]}
    >
      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="faint" align="center">
          {appName}, {versionLabel().replace(/^V/, 'v')}
        </Text>
        {note ? (
          <Text variant="caption" tone={state === 'ready' ? 'primary' : 'faint'} align="center">
            {note}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
