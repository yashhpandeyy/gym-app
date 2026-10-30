import { Tabs } from 'expo-router/js-tabs';

import { TabBar, type TabItem } from '@/components/TabBar';
import { useWideWeb } from '@/components/web/WebShell';
import { useApp } from '@/store';
import { useTheme } from '@/theme';

export default function ManagerTabs() {
  const { c } = useTheme();
  const sidebar = useWideWeb();
  const pendingPauses = useApp((s) => s.pauses.filter((p) => p.status === 'pending').length);
  const pendingCoach = useApp((s) => s.ptRequests.filter((r) => r.status === 'pending').length);
  const openTickets = useApp((s) => s.tickets.filter((t) => t.status === 'open').length);

  const items: Record<string, TabItem> = {
    dashboard: { label: 'Today', icon: 'pulse-outline', iconActive: 'pulse' },
    members: { label: 'Members', icon: 'people-outline', iconActive: 'people' },
    scan: { label: 'Check in', icon: 'scan-outline', iconActive: 'scan', center: true },
    slots: { label: 'Slots', icon: 'time-outline', iconActive: 'time' },
    more: { label: 'Manage', icon: 'grid-outline', iconActive: 'grid', badge: pendingPauses + pendingCoach + openTickets },
  };

  return (
    <Tabs
      tabBar={(props) => (sidebar ? null : <TabBar {...props} items={items} />)}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}>
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="members" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="slots" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
