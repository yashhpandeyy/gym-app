import { useEffect } from 'react';
import { View } from 'react-native';

import { Empty, Icon, LinkButton, Screen, Text, type IconName } from '@/components/ui';
import { fmtStamp } from '@/lib/date';
import { useApp, useMe, type NoticeKind } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const ICON: Record<NoticeKind, IconName> = {
  booking: 'calendar-outline',
  pause: 'airplane-outline',
  payment: 'receipt-outline',
  announcement: 'megaphone-outline',
  reminder: 'chatbubble-ellipses-outline',
  class: 'barbell-outline',
};

export default function Notifications() {
  const { c } = useTheme();
  const s = useStyles();
  const me = useMe();
  const notices = useApp((st) => st.notices);
  const markRead = useApp((st) => st.markNoticesRead);
  const prefs = useApp((st) => st.prefs);
  const isRead = (n: { id: string; memberId: string | null; read: boolean }) => (n.memberId === null ? (prefs.readBroadcast ?? []).includes(n.id) : n.read);

  // Everything on screen counts as seen once the member leaves.
  useEffect(() => () => markRead(), [markRead]);

  if (!me) return null;
  const mine = notices
    .filter((n) => n.memberId === me.id || n.memberId === null)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  const unread = mine.some((n) => !isRead(n));

  return (
    <Screen header="stack" title="Notifications" right={unread ? <LinkButton title="Mark all read" onPress={markRead} /> : undefined}>
      {mine.length ? (
        <View style={{ gap: 8 }}>
          {mine.map((n) => (
            <View key={n.id} style={[s.item, !isRead(n) && { borderColor: c.primaryLine }]}>
              <View style={[s.icon, { backgroundColor: isRead(n) ? c.surfaceAlt : c.primarySoft }]}>
                <Icon name={ICON[n.kind]} size={19} tone={isRead(n) ? 'soft' : 'primary'} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="label">{n.title}</Text>
                <Text variant="small" tone="soft">
                  {n.body}
                </Text>
                <Text variant="caption" tone="faint">
                  {fmtStamp(n.at)}
                </Text>
              </View>
              {!isRead(n) ? <View style={[s.dot, { backgroundColor: c.primary }]} /> : null}
            </View>
          ))}
        </View>
      ) : (
        <Empty icon="notifications-outline" title="You’re all caught up" body="Booking reminders, pause updates and gym news show up here." />
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  item: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: t.c.surface,
    borderRadius: t.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
}));
