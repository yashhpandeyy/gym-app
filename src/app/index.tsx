import { Redirect } from 'expo-router';
import { Platform, View } from 'react-native';

import { Logo } from '@/components/Brand';
import { Button, Text } from '@/components/ui';
import { signOut } from '@/lib/remote';
import { useApp } from '@/store';

/** Entry point: send people to the right side of the app for who they are. */
export default function Index() {
  const session = useApp((s) => s.session);
  const link = useApp((s) => s.link);
  if (!session) return <Redirect href="/welcome" />;
  if (session.role === 'admin') return <Redirect href="/live/admin" />;
  // The website is the owner dashboard. A member who lands here is pointed back to their app.
  if (session.role === 'member' && Platform.OS === 'web') return <MembersUseTheApp />;
  if (session.role === 'member') return <Redirect href="/home" />;
  return <Redirect href={link?.status === 'pending' ? '/live/setup' : '/dashboard'} />;
}

function MembersUseTheApp() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
      <Logo size={48} />
      <Text variant="title" align="center">
        Members use the mobile app
      </Text>
      <Text tone="soft" align="center" style={{ maxWidth: 380 }}>
        This website is the owner dashboard. Open the gym app on your phone to book slots, see your pass and track your progress.
      </Text>
      <Button title="Sign out" variant="outline" onPress={signOut} />
    </View>
  );
}
