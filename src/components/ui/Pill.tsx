import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptic } from '@/lib/native';
import { hash, initials } from '@/lib/format';
import { makeStyles, useTheme } from '@/theme';

import { Icon, Text, type IconName } from './Text';

type PillTone = 'success' | 'warning' | 'danger' | 'ice' | 'primary' | 'neutral';

export function Pill({
  label,
  tone = 'neutral',
  dot,
  icon,
  style,
  solid,
}: {
  label: string;
  tone?: PillTone;
  dot?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  solid?: boolean;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const colors = {
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    ice: c.ice,
    primary: { fg: c.primaryInk, bg: c.primarySoft, solid: c.primary },
    neutral: { fg: c.inkSoft, bg: c.surfaceAlt, solid: c.inkSoft },
  }[tone];
  const fg = solid ? (tone === 'primary' ? c.onPrimary : '#FFFFFF') : colors.fg;
  return (
    <View style={[s.pill, { backgroundColor: solid ? colors.solid : colors.bg }, style]}>
      {dot ? <View style={[s.dot, { backgroundColor: solid ? fg : colors.solid }]} /> : null}
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <Text variant="micro" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export type StatusKey =
  | 'active'
  | 'paused'
  | 'expired'
  | 'upcoming'
  | 'expiring'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'dues'
  | 'open'
  | 'resolved';

const STATUS_MAP: Record<StatusKey, [string, PillTone]> = {
  active: ['Active', 'success'],
  paused: ['Paused', 'ice'],
  expired: ['Expired', 'danger'],
  upcoming: ['Starts soon', 'primary'],
  expiring: ['Ending soon', 'warning'],
  pending: ['Waiting', 'warning'],
  approved: ['Approved', 'success'],
  rejected: ['Declined', 'danger'],
  cancelled: ['Withdrawn', 'neutral'],
  dues: ['Dues', 'danger'],
  open: ['Open', 'warning'],
  resolved: ['Resolved', 'success'],
};

export function StatusPill({ status, style }: { status: StatusKey; style?: StyleProp<ViewStyle> }) {
  const [label, tone] = STATUS_MAP[status];
  return <Pill label={label} tone={tone} dot style={style} />;
}

export function Chip({
  label,
  selected,
  onPress,
  count,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  count?: number;
  icon?: IconName;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const fg = selected ? c.surface : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        s.chip,
        selected ? { backgroundColor: c.ink, borderColor: c.ink } : { backgroundColor: c.surface, borderColor: c.line },
        pressed && { opacity: 0.8 },
      ]}>
      {icon ? <Icon name={icon} size={15} color={fg} /> : null}
      <Text variant="smallStrong" color={fg}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="caption" color={selected ? c.surface : c.inkFaint} style={{ opacity: selected ? 0.75 : 1 }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

const AVATAR_TONES = [
  ['#FDE6D8', '#8A3B12'],
  ['#E2ECFF', '#1F3F99'],
  ['#E0F4EA', '#13603A'],
  ['#F3E5FB', '#6A2A8C'],
  ['#FFF0C9', '#7A5300'],
  ['#DDF2F7', '#0C5E73'],
  ['#FCE3EC', '#8F1F48'],
  ['#E9E9F2', '#3C3F5C'],
];
const AVATAR_TONES_DARK = [
  ['#3A2418', '#FFB892'],
  ['#1D2A4A', '#9DB8FF'],
  ['#163223', '#7FDCAA'],
  ['#2E1F3A', '#D9A6F5'],
  ['#3A2F12', '#F5CF6E'],
  ['#14313A', '#7FD3E8'],
  ['#3A1A26', '#F59BBB'],
  ['#25263A', '#B9BCDA'],
];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { scheme, fonts } = useTheme();
  const tones = scheme === 'dark' ? AVATAR_TONES_DARK : AVATAR_TONES;
  const [bg, fg] = tones[hash(name) % tones.length];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.42, lineHeight: size * 0.5, color: fg }}>{initials(name)}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: t.radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: t.radius.pill,
    borderWidth: 1,
  },
}));
