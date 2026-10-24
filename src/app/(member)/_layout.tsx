import { Tabs } from 'expo-router/js-tabs';

import { TabBar, type TabItem } from '@/components/TabBar';
import { useApp } from '@/store';
import { useTheme } from '@/theme';

export default function MemberTabs() {
  const { c, brand } = useTheme();
  const memberId = useApp((s) => s.session?.memberId);
  const chests = useApp((s) => s.chests.filter((x) => x.memberId === memberId && !x.openedAt).length);
  const ITEMS: Record<string, TabItem> = {
    home: { label: 'Home', icon: 'home-outline', iconActive: 'home' },
    book: { label: 'Book', icon: 'calendar-outline', iconActive: 'calendar' },
    pass: { label: 'Pass', icon: 'qr-code-outline', iconActive: 'qr-code', center: true },
    ...(brand.features.gamification ? { club: { label: 'Club', icon: 'trophy-outline', iconActive: 'trophy', badge: chests } as TabItem } : {}),
    profile: { label: 'You', icon: 'person-circle-outline', iconActive: 'person-circle' },
  };
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} items={ITEMS} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="book" />
      <Tabs.Screen name="pass" />
      <Tabs.Screen name="club" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
