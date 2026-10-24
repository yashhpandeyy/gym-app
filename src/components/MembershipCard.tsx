import { View } from 'react-native';

import { diffDays, fmtDate, fmtDay, plural, today } from '@/lib/date';
import type { MembershipInfo } from '@/lib/domain';
import { makeStyles, useTheme } from '@/theme';

import { Logo, PlateRings } from './Brand';
import { Sheen, Spin } from './fun/Effects';
import { CountUp } from './fun/Motion';
import { Button, PressableCard, ProgressBar, Text } from './ui';

/**
 * The member's card. Its colour carries the status: brand colour when active,
 * ice when paused, ink when expired, so the state reads before any words do.
 */
export function MembershipCard({
  info,
  memberName,
  onPress,
  onAction,
}: {
  info: MembershipInfo;
  memberName: string;
  onPress?: () => void;
  onAction?: () => void;
}) {
  const { c, brand, alpha } = useTheme();
  const s = useStyles();
  const t = today();

  const look = {
    active: { bg: c.primary, fg: c.onPrimary },
    upcoming: { bg: c.primary, fg: c.onPrimary },
    paused: { bg: c.ice.solid, fg: '#FFFFFF' },
    expired: { bg: c.ink, fg: c.surface },
  }[info.status];

  let big: string;
  let line1: string;
  let line2: string;
  let action: string | undefined;

  switch (info.status) {
    case 'paused': {
      const back = info.activePause!.end;
      const n = diffDays(t, back) + 1;
      big = String(n);
      line1 = n === 1 ? 'day until you’re back' : 'days until you’re back';
      line2 = `Paused to ${fmtDay(back)}. Your plan now ends ${fmtDate(info.end)}.`;
      action = 'I’m back early';
      break;
    }
    case 'expired':
      big = 'Ended';
      line1 = `on ${fmtDate(info.end)}`;
      line2 = 'Renew to book slots and check in again.';
      action = 'Renew membership';
      break;
    case 'upcoming': {
      const n = diffDays(t, info.start);
      big = String(n);
      line1 = n === 1 ? 'day until your plan starts' : 'days until your plan starts';
      line2 = `${info.plan?.name ?? 'Your plan'} starts ${fmtDate(info.start)}.`;
      break;
    }
    default:
      big = String(info.daysLeft);
      line1 = info.daysLeft === 1 ? 'day left, ends today' : `days left on ${info.plan?.name ?? 'your plan'}`;
      line2 = `Ends ${fmtDate(info.end)}`;
      if (info.daysLeft <= 7) action = 'Renew now';
  }

  return (
    <PressableCard onPress={onPress} accessibilityLabel={`Membership, ${big} ${line1}`} style={[s.card, { backgroundColor: look.bg, shadowColor: look.bg }]}>
      <Spin seconds={90} style={{ position: 'absolute', right: -78, top: -70, width: 250, height: 250 }}>
        <PlateRings size={250} color={alpha(look.fg, 0.1)} style={{ left: 0, top: 0 }} />
      </Spin>
      {info.status !== 'expired' ? <Sheen every={6000} delay={1200} opacity={0.22} /> : null}
      <View style={s.top}>
        <Logo size={28} inverted />
        <Text variant="smallStrong" color={look.fg} numberOfLines={1} style={{ flex: 1 }}>
          {brand.name}
        </Text>
        <View style={[s.status, { backgroundColor: alpha(look.fg, 0.16) }]}>
          <View style={[s.dot, { backgroundColor: look.fg }]} />
          <Text variant="micro" color={look.fg}>
            {info.status === 'active' ? 'Active' : info.status === 'paused' ? 'Paused' : info.status === 'expired' ? 'Expired' : 'Starts soon'}
          </Text>
        </View>
      </View>

      <View style={s.heroRow}>
        {/^\d+$/.test(big) ? (
          <CountUp value={Number(big)} from={0} duration={900} variant="hero" color={look.fg} />
        ) : (
          <Text variant={big.length > 4 ? 'display' : 'hero'} color={look.fg}>
            {big}
          </Text>
        )}
        <Text variant="bodyStrong" color={look.fg} style={s.heroLabel}>
          {line1}
        </Text>
      </View>

      {info.status === 'active' ? (
        <ProgressBar value={info.progress} color={look.fg} track={alpha(look.fg, 0.22)} height={5} style={{ marginTop: 14 }} />
      ) : null}

      <View style={s.foot}>
        <Text variant="small" color={alpha(look.fg, 0.86)} style={{ flex: 1 }}>
          {line2}
        </Text>
        {info.status === 'active' && info.pauseAllowance > 0 ? (
          <Text variant="small" color={alpha(look.fg, 0.86)}>
            {plural(info.pauseLeft, 'pause day')} left
          </Text>
        ) : null}
      </View>

      {action && onAction ? (
        <Button
          title={action}
          onPress={onAction}
          variant="onPrimary"
          size="md"
          style={[s.action, { backgroundColor: look.fg }]}
          accessibilityLabel={action}
        />
      ) : null}
      <Text variant="caption" color={alpha(look.fg, 0.7)} style={s.name} numberOfLines={1}>
        {memberName}
      </Text>
    </PressableCard>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    borderRadius: t.radius.xl,
    padding: 20,
    paddingBottom: 18,
    overflow: 'hidden',
    shadowOpacity: t.scheme === 'dark' ? 0 : 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' },
  heroLabel: { marginBottom: 12, flexShrink: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  action: { marginTop: 16 },
  name: { marginTop: 14 },
}));
