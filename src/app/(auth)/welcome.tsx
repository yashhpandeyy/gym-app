import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo, PlateRings } from '@/components/Brand';
import { Button, Text } from '@/components/ui';
import { gutter, makeStyles, useTheme } from '@/theme';

/** The first screen: join a gym as a member, or run one. */
export default function Welcome() {
  const { c, brand, alpha } = useTheme();
  const s = useStyles();
  const words = brand.name.split(' ');

  return (
    <View style={[s.root, { backgroundColor: c.primary }]}>
      <StatusBar style={c.onPrimary === '#FFFFFF' ? 'light' : 'dark'} />
      <PlateRings size={460} color={alpha(c.onPrimary, 0.09)} style={{ right: -190, bottom: 120 }} />
      <SafeAreaView style={s.safe}>
        <Logo size={48} inverted />

        <View style={s.hero}>
          <View>
            {words.map((w, i) => (
              <Text key={i} variant="hero" color={c.onPrimary} style={s.word} numberOfLines={1} adjustsFontSizeToFit>
                {w}
              </Text>
            ))}
          </View>
          <Text variant="body" color={alpha(c.onPrimary, 0.86)} style={s.tagline}>
            {brand.tagline} Book your slot, pause when you travel and check in with your phone.
          </Text>
        </View>

        <View style={s.actions}>
          <Button title="Join your gym with a code" variant="onPrimary" full onPress={() => router.push('/join')} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/owner')}
            style={({ pressed }) => [s.secondary, { borderColor: alpha(c.onPrimary, 0.4) }, pressed && { opacity: 0.7 }]}>
            <Text variant="bodyStrong" color={c.onPrimary}>
              I run a gym
            </Text>
          </Pressable>
          <Text variant="caption" color={alpha(c.onPrimary, 0.75)} align="center" style={{ marginTop: 4 }}>
            Members: ask your gym for its code. Owners: sign in or create your gym.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, overflow: 'hidden' },
  safe: { flex: 1, paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 16 },
  hero: { flex: 1, justifyContent: 'center', gap: 18 },
  word: { fontSize: 92, lineHeight: 88, letterSpacing: -1.5 },
  tagline: { maxWidth: 330 },
  actions: { gap: 12 },
  secondary: {
    height: 54,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
