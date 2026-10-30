import { router, usePathname } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Logo } from '@/components/Brand';
import { Icon, Text, type IconName } from '@/components/ui';
import { signOut } from '@/lib/remote';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

/** Below this width the sidebar steps aside and the phone-style tab bar returns. */
export const SIDEBAR_MIN_WIDTH = 900;

type Item = { label: string; icon: IconName; path: string; badge?: number; match?: string[] };
type Group = { title?: string; items: Item[] };

/** True when the owner is on a computer-sized browser window, where the sidebar replaces the tab bar. */
export function useWideWeb() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= SIDEBAR_MIN_WIDTH;
}

/** Wraps the whole app for a signed-in gym owner on a computer: a fixed sidebar and the page beside it. */
export function WebShell({ children }: { children: ReactNode }) {
  const wide = useWideWeb();
  const manager = useApp((st) => st.session?.role === 'manager');
  const s = useStyles();
  if (!wide || !manager) return <>{children}</>;
  return (
    <View style={s.shell}>
      <Sidebar />
      <View style={s.page}>{children}</View>
    </View>
  );
}

function Sidebar() {
  const { c, brand } = useTheme();
  const s = useStyles();
  const path = usePathname();
  const session = useApp((st) => st.session);
  const link = useApp((st) => st.link);
  const pauses = useApp((st) => st.pauses);
  const ptRequests = useApp((st) => st.ptRequests);
  const tickets = useApp((st) => st.tickets);
  const leads = useApp((st) => st.leads);
  const f = brand.features;

  const requests = pauses.filter((p) => p.status === 'pending').length + (f.trainers ? ptRequests.filter((r) => r.status === 'pending').length : 0);
  const open = tickets.filter((t) => t.status === 'open').length;
  const fresh = leads.filter((l) => l.stage === 'new' || l.stage === 'trial').length;

  const groups: Group[] = [
    {
      items: [
        { label: 'Today', icon: 'pulse-outline', path: '/dashboard' },
        { label: 'Members', icon: 'people-outline', path: '/members', match: ['/manage/member'] },
        { label: 'Check in', icon: 'scan-outline', path: '/scan' },
        { label: 'Slots', icon: 'time-outline', path: '/slots' },
      ],
    },
    {
      title: 'Requests',
      items: [
        { label: 'Pause and coaching', icon: 'airplane-outline', path: '/manage/requests', badge: requests },
        { label: 'Complaints', icon: 'construct-outline', path: '/manage/tickets', badge: open },
        ...(f.leads ? [{ label: 'Enquiries', icon: 'person-add-outline' as const, path: '/manage/leads', badge: fresh }] : []),
      ],
    },
    {
      title: 'Business',
      items: [
        { label: 'Payments', icon: 'wallet-outline', path: '/manage/payments' },
        { label: 'Plans and prices', icon: 'pricetags-outline', path: '/manage/plans' },
        ...(f.classes ? [{ label: 'Classes', icon: 'calendar-outline' as const, path: '/manage/classes' }] : []),
        ...(f.trainers ? [{ label: 'Coaches', icon: 'barbell-outline' as const, path: '/manage/trainers' }] : []),
        { label: 'Staff logins', icon: 'key-outline', path: '/manage/staff' },
      ],
    },
    {
      title: 'Engage members',
      items: [
        { label: 'Announcements', icon: 'megaphone-outline', path: '/manage/announcements' },
        ...(f.guestPass ? [{ label: 'Guest passes', icon: 'ticket-outline' as const, path: '/manage/guests' }] : []),
        ...(f.gamification
          ? [
              { label: 'Station challenges', icon: 'stopwatch-outline' as const, path: '/manage/challenges' },
              { label: 'Prizes', icon: 'gift-outline' as const, path: '/manage/prizes' },
            ]
          : []),
      ],
    },
    {
      title: 'Settings',
      items: [
        { label: 'Gym profile', icon: 'color-palette-outline', path: '/live/setup' },
        { label: 'Booking rules', icon: 'options-outline', path: '/manage/settings' },
      ],
    },
  ];

  const active = (it: Item) => path === it.path || path.startsWith(it.path + '/') || !!it.match?.some((m) => path.startsWith(m));

  return (
    <View style={s.side} accessibilityRole="navigation">
      <View style={s.brand}>
        <Logo size={34} />
        <View style={{ flex: 1 }}>
          <Text variant="label" numberOfLines={1}>
            {brand.name}
          </Text>
          <Text variant="caption" tone="faint" numberOfLines={1}>
            Owner dashboard
          </Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/manage/add-member')} style={({ pressed }) => [s.add, { backgroundColor: c.primary }, pressed && { opacity: 0.85 }]}>
        <Icon name="add" size={18} color={c.onPrimary} />
        <Text variant="label" color={c.onPrimary}>
          Add member
        </Text>
      </Pressable>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {groups.map((g, i) => (
          <View key={g.title ?? i} style={{ marginTop: i ? 18 : 4 }}>
            {g.title ? (
              <Text variant="micro" tone="faint" style={s.groupTitle}>
                {g.title.toUpperCase()}
              </Text>
            ) : null}
            {g.items.map((it) => (
              <NavItem key={it.path} item={it} active={active(it)} />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={s.foot}>
        <View style={{ flex: 1 }}>
          <Text variant="smallStrong" numberOfLines={1}>
            {session?.staffName ?? link?.name ?? 'Owner'}
          </Text>
          <Text variant="caption" tone="faint" numberOfLines={1}>
            Gym code {link?.gymCode ?? ''}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => {
            signOut();
            router.replace('/');
          }}
          style={({ pressed }) => [s.signOut, pressed && { opacity: 0.6 }]}>
          <Icon name="log-out-outline" size={18} tone="soft" />
        </Pressable>
      </View>
    </View>
  );
}

function NavItem({ item, active }: { item: Item; active: boolean }) {
  const { c } = useTheme();
  const s = useStyles();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={() => router.push(item.path as never)}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={[s.item, active ? { backgroundColor: c.primarySoft } : hover ? { backgroundColor: c.surfaceAlt } : null]}>
      <Icon name={item.icon} size={18} color={active ? c.primaryInk : c.inkSoft} />
      <Text variant={active ? 'smallStrong' : 'small'} color={active ? c.primaryInk : c.ink} style={{ flex: 1 }} numberOfLines={1}>
        {item.label}
      </Text>
      {item.badge ? (
        <View style={[s.badge, { backgroundColor: c.danger.solid }]}>
          <Text variant="micro" color="#FFFFFF">
            {item.badge > 99 ? '99+' : item.badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: t.c.bg },
  page: { flex: 1, minWidth: 0 },
  side: {
    width: 256,
    backgroundColor: t.c.surface,
    borderRightWidth: 1,
    borderRightColor: t.c.line,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, marginBottom: 16 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 10, marginBottom: 14, cursor: 'pointer' },
  groupTitle: { paddingHorizontal: 10, marginBottom: 6, letterSpacing: 0.8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 38, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2, cursor: 'pointer' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: t.c.line },
  signOut: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
}));
