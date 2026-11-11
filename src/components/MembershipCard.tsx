import type { ReactNode } from 'react';
import { View } from 'react-native';

import { diffDays, fmtDate, fmtDay, plural, today } from '@/lib/date';
import type { MembershipInfo } from '@/lib/domain';
import { gutter, makeStyles, useTheme } from '@/theme';

import { PlateDial } from './Brand';
import { CountUp } from './fun/Motion';
import { Button, PressableCard, Text } from './ui';

/** The colour that carries the status: brand when active, ice when paused, ink when expired. */
export function useMembershipLook(status: MembershipInfo['status']) {
  const { c } = useTheme();
  return {
    active: { bg: c.primary, fg: c.onPrimary },
    upcoming: { bg: c.primary, fg: c.onPrimary },
    paused: { bg: c.ice.solid, fg: '#FFFFFF' },
    expired: { bg: c.rail, fg: c.railInk },
  }[status];
}

/**
 * The member's plate: the top of Home, edge to edge, in the gym's colour. Days left is the biggest
 * thing in the app, and the dial beside it shows how much of the plan remains, so the state reads
 * before any words do.
 */
export function MembershipCard({
  info,
  head,
  inset,
  onPress,
  onAction,
}: {
  info: MembershipInfo;
  /** The row above the figure: greeting, gym, notifications. */
  head?: ReactNode;
  /** Inside a page rather than edge to edge at the top of one. */
  inset?: boolean;
  onPress?: () => void;
  onAction?: () => void;
}) {
  const { alpha } = useTheme();
  const s = useStyles();
  const t = today();
  const look = useMembershipLook(info.status);

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

  const status = info.status === 'active' ? 'Active' : info.status === 'paused' ? 'Paused' : info.status === 'expired' ? 'Expired' : 'Starts soon';

  return (
    <View style={[s.plate, inset && s.inset, { backgroundColor: look.bg }]}>
      {head}
      <PressableCard onPress={onPress} accessibilityLabel={`Membership, ${status}, ${big} ${line1}`} style={head ? s.body : null}>
        <View style={s.reading}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {/^\d+$/.test(big) ? (
              <CountUp value={Number(big)} from={0} duration={900} variant="hero" color={look.fg} />
            ) : (
              <Text variant="hero" color={look.fg} numberOfLines={1} adjustsFontSizeToFit>
                {big}
              </Text>
            )}
            <Text variant="bodyStrong" color={look.fg}>
              {line1}
            </Text>
          </View>
          <PlateDial size={112} value={info.status === 'active' ? 1 - info.progress : 0} color={look.fg} track={alpha(look.fg, 0.24)} />
        </View>

        <View style={s.foot}>
          <Text variant="small" color={alpha(look.fg, 0.88)} style={{ flex: 1 }}>
            {status}. {line2}
          </Text>
          {info.status === 'active' && info.pauseAllowance > 0 ? (
            <Text variant="small" color={alpha(look.fg, 0.88)}>
              {plural(info.pauseLeft, 'pause day')} left
            </Text>
          ) : null}
        </View>
      </PressableCard>

      {action && onAction ? (
        <Button title={action} onPress={onAction} variant="onPrimary" size="md" full style={[s.action, { backgroundColor: look.fg }]} accessibilityLabel={action} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  plate: {
    paddingHorizontal: gutter,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomLeftRadius: t.radius.xl,
    borderBottomRightRadius: t.radius.xl,
    borderCurve: 'continuous',
  },
  inset: { borderRadius: t.radius.xl, paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  body: { marginTop: 20 },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foot: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 16 },
  action: { marginTop: 14 },
}));
