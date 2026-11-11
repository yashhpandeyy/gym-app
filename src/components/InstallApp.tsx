import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { platform } from '@/config/platform';
import { installSnoozed, snoozeInstall, useInstall } from '@/lib/install';
import { makeStyles, useTheme } from '@/theme';

import { Button, Icon, Sheet, Text, type IconName } from './ui';

const IOS_STEPS: { icon: IconName; text: string }[] = [
  { icon: 'share-outline', text: 'Tap the Share button. In Safari it’s at the bottom of the screen; in Chrome it’s next to the address bar.' },
  { icon: 'add-circle-outline', text: 'Scroll down and tap Add to Home Screen.' },
  { icon: 'checkmark-circle-outline', text: 'Tap Add. Open the app from your home screen and sign in once more.' },
];

const ANDROID_STEPS: { icon: IconName; text: string }[] = [
  { icon: 'ellipsis-vertical', text: 'Open your browser’s menu, the three dots at the top right.' },
  { icon: 'download-outline', text: 'Tap Install app or Add to Home screen.' },
  { icon: 'checkmark-circle-outline', text: 'Open the app from your home screen and sign in once more.' },
];

/** How to put the app on the home screen when the browser can't do it with one tap. */
export function InstallSteps({ visible, onClose, ios }: { visible: boolean; onClose: () => void; ios: boolean }) {
  const { c } = useTheme();
  const s = useStyles();
  return (
    <Sheet visible={visible} onClose={onClose} title={`Put ${platform.name} on your home screen`} subtitle="It opens full screen like any other app. No App Store needed." footer={<Button title="Got it" full onPress={onClose} />}>
      <View style={{ gap: 16 }}>
        {(ios ? IOS_STEPS : ANDROID_STEPS).map((step, i) => (
          <View key={step.text} style={s.step}>
            <View style={[s.num, { backgroundColor: c.primarySoft }]}>
              <Text variant="smallStrong" color={c.primaryInk}>
                {i + 1}
              </Text>
            </View>
            <Icon name={step.icon} size={22} color={c.primaryInk} />
            <Text style={{ flex: 1 }}>{step.text}</Text>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

/** Installs straight away on Android, or opens the steps on an iPhone. */
function useInstallAction() {
  const { mode, install } = useInstall();
  const [steps, setSteps] = useState(false);
  const start = async () => {
    if (!(await install())) setSteps(true);
  };
  const sheet = <InstallSteps visible={steps} onClose={() => setSteps(false)} ios={mode === 'ios'} />;
  return { mode, start, sheet };
}

/** A card for the sign-in screen, shown in a phone's browser until the app is installed. */
export function InstallCard() {
  const { c } = useTheme();
  const s = useStyles();
  const { mode, start, sheet } = useInstallAction();
  if (mode === 'none' || mode === 'installed') return null;
  return (
    <View style={[s.card, { backgroundColor: c.primarySoft }]}>
      <Icon name="phone-portrait-outline" size={22} color={c.primaryInk} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" color={c.primaryInk}>
          Install the app
        </Text>
        <Text variant="small" color={c.primaryInk}>
          Add {platform.name} to your home screen. No App Store needed.
        </Text>
      </View>
      <Button title="Install" size="sm" onPress={() => void start()} />
      {sheet}
    </View>
  );
}

/** A slim bar at the top of every screen in a phone's browser, until the app is installed or put off for a few days. */
export function InstallBanner() {
  const { c } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { mode, start, sheet } = useInstallAction();
  const [hidden, setHidden] = useState(installSnoozed);
  if (mode === 'none' || mode === 'installed') return null;
  return (
    <>
      {!hidden ? (
        <View pointerEvents="box-none" style={[s.host, { bottom: insets.bottom + 84 }]}>
          <Animated.View entering={FadeInUp.duration(220)} style={[s.bar, { backgroundColor: c.ink }]}>
            <Icon name="download-outline" size={18} color={c.surface} />
            <Text variant="smallStrong" color={c.surface} style={{ flex: 1 }}>
              Install {platform.name} on this phone
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not now"
              hitSlop={8}
              onPress={() => {
                snoozeInstall();
                setHidden(true);
              }}
              style={({ pressed }) => [s.action, pressed && { opacity: 0.6 }]}>
              <Text variant="small" color={c.surface} style={{ opacity: 0.75 }}>
                Not now
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void start()} hitSlop={8} style={({ pressed }) => [s.action, s.install, { backgroundColor: c.surface }, pressed && { opacity: 0.7 }]}>
              <Text variant="smallStrong" color={c.ink}>
                Install
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
      {sheet}
    </>
  );
}

const useStyles = makeStyles((t) => ({
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: t.radius.lg },
  host: { position: 'absolute', left: 12, right: 12, zIndex: 800 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: t.radius.lg,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 8,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  action: { minHeight: 34, paddingHorizontal: 8, justifyContent: 'center' },
  install: { paddingHorizontal: 14, borderRadius: 999 },
}));
