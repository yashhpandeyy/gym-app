import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptic } from '@/lib/native';
import { makeStyles, useTheme } from '@/theme';

import { LinkButton } from './Button';
import { Icon, Text, toneColor, type IconName, type Tone } from './Text';

export function Card({
  children,
  style,
  variant = 'surface',
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'surface' | 'inset' | 'outline' | 'soft';
  padded?: boolean;
}) {
  const s = useStyles();
  return <View style={[s.card, s[variant], padded && s.padded, style]}>{children}</View>;
}

/** A list container with hairlines between rows, like a grouped settings table. */
export function Group({ children, style, inset = 60 }: { children: ReactNode; style?: StyleProp<ViewStyle>; inset?: number }) {
  const s = useStyles();
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[s.group, style]}>
      {items.map((child, i) => (
        <Fragment key={child.key ?? i}>
          {i > 0 ? <View style={[s.sep, { marginLeft: inset }]} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

export function Row({
  icon,
  iconTone = 'primary',
  leading,
  title,
  subtitle,
  value,
  valueTone = 'soft',
  right,
  action,
  onPress,
  chevron,
  titleTone = 'ink',
  accessibilityLabel,
}: {
  icon?: IconName;
  iconTone?: Tone;
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  valueTone?: Tone;
  right?: ReactNode;
  /** Buttons at the end of the row. Kept outside the row's own tap area so presses don't nest. */
  action?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  titleTone?: Tone;
  accessibilityLabel?: string;
}) {
  const { c, alpha } = useTheme();
  const s = useStyles();
  const showChevron = chevron ?? (!!onPress && !action);
  const tint = toneColor(c, iconTone);
  const main = (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [s.row, action ? s.rowMain : null, pressed && { backgroundColor: c.surfaceAlt }]}>
      {leading ??
        (icon ? (
          <View style={[s.rowIcon, { backgroundColor: alpha(tint, 0.12) }]}>
            <Icon name={icon} size={19} color={tint} />
          </View>
        ) : null)}
      <View style={s.rowBody}>
        <Text variant="label" tone={titleTone} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" tone="soft" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="smallStrong" tone={valueTone} numberOfLines={1} style={s.rowValue}>
          {value}
        </Text>
      ) : null}
      {right}
      {showChevron ? <Icon name="chevron-forward" size={18} tone="faint" /> : null}
    </Pressable>
  );
  if (!action) return main;
  return (
    <View style={s.rowWithAction}>
      {main}
      <View style={s.rowAction}>{action}</View>
    </View>
  );
}

export function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { c } = useTheme();
  return (
    <Row
      icon={icon}
      title={title}
      subtitle={subtitle}
      chevron={false}
      right={
        <Switch
          value={value}
          onValueChange={(v) => {
            haptic.tap();
            onChange(v);
          }}
          trackColor={{ true: c.primary, false: c.lineStrong }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={c.lineStrong}
        />
      }
    />
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  hint,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  return (
    <View style={[s.section, style]}>
      <View style={{ flex: 1 }}>
        <Text variant="h3">{title}</Text>
        {hint ? (
          <Text variant="small" tone="soft" style={{ marginTop: 2 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {action && onAction ? <LinkButton title={action} onPress={onAction} /> : null}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return <View style={[s.divider, style]} />;
}

/** Small "label / value" pair used inside cards. */
export function Fact({ label, value, tone = 'ink', align = 'left' }: { label: string; value: string; tone?: Tone; align?: 'left' | 'right' }) {
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start', gap: 2 }}>
      <Text variant="caption" tone="soft">
        {label}
      </Text>
      <Text variant="label" tone={tone}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: { borderRadius: t.radius.lg },
  padded: { padding: 16 },
  surface: { backgroundColor: t.c.surface },
  inset: { backgroundColor: t.c.surfaceAlt },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: t.c.line },
  soft: { backgroundColor: t.c.primarySoft },
  group: { backgroundColor: t.c.surface, borderRadius: t.radius.lg, overflow: 'hidden' },
  sep: { height: 1, backgroundColor: t.c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, minHeight: 56 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 1 },
  rowValue: { maxWidth: 150 },
  rowWithAction: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, paddingRight: 8 },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 14 },
  section: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 30, marginBottom: 12 },
  divider: { height: 1, backgroundColor: t.c.line },
}));
