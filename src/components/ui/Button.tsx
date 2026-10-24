import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/native';
import { makeStyles, useTheme } from '@/theme';

import { Icon, Text, type IconName } from './Text';

export type ButtonVariant = 'primary' | 'ink' | 'soft' | 'outline' | 'ghost' | 'danger' | 'onPrimary' | 'success';
type Size = 'lg' | 'md' | 'sm';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  loading,
  disabled,
  full,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { c, radius, alpha, mix } = useTheme();
  const s = useStyles();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary },
    ink: { bg: c.ink, fg: c.surface },
    soft: { bg: c.primarySoft, fg: c.primaryInk },
    outline: { bg: 'transparent', fg: c.ink, border: c.lineStrong },
    ghost: { bg: 'transparent', fg: c.primaryInk },
    danger: { bg: c.danger.bg, fg: c.danger.fg },
    success: { bg: c.success.solid, fg: '#FFFFFF' },
    onPrimary: { bg: c.onPrimary, fg: c.primary },
  };
  const p = palette[variant];
  const dims = {
    lg: { height: 52, px: 22, r: radius.md, icon: 20, text: 'bodyStrong' as const },
    md: { height: 42, px: 16, r: radius.md - 2, icon: 18, text: 'label' as const },
    sm: { height: 32, px: 12, r: radius.sm, icon: 16, text: 'smallStrong' as const },
  }[size];
  // Duolingo-style chunky buttons: a darker bottom edge that squashes flat when pressed.
  const edges: Partial<Record<ButtonVariant, string>> = {
    primary: c.primaryDeep,
    ink: mix(c.ink, '#000000', 0.45),
    success: mix(c.success.solid, '#000000', 0.28),
    onPrimary: alpha('#000000', 0.2),
    outline: c.lineStrong,
  };
  const edgeColor = edges[variant];
  const chunk = edgeColor ? (size === 'sm' ? 3 : 4) : 0;
  const { backgroundColor: bgOverride, ...outer } = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const bg = (bgOverride as string | undefined) ?? p.bg;
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[{ height: dims.height + chunk, alignSelf: full ? 'stretch' : 'flex-start' }, outer, disabled && s.disabled, popStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
        disabled={disabled || loading}
        onPressIn={() => {
          if (!reduced) pop.set(withSpring(0.97, { damping: 14, stiffness: 400 }));
        }}
        onPressOut={() => {
          if (!reduced) pop.set(withSequence(withSpring(1.035, { damping: 8, stiffness: 420 }), withSpring(1, { damping: 12, stiffness: 260 })));
        }}
        onPress={() => {
          if (variant === 'primary' || variant === 'ink' || variant === 'success') haptic.tap();
          onPress?.();
        }}
        style={({ pressed }) => {
          const squash = pressed && chunk ? chunk - 1 : 0;
          return [
            s.base,
            {
              height: dims.height + chunk - squash,
              marginTop: squash,
              paddingHorizontal: dims.px,
              borderRadius: dims.r,
              backgroundColor: pressed && variant === 'ghost' ? alpha(c.primary, 0.08) : bg,
              borderColor: p.border ?? 'transparent',
              borderWidth: p.border ? 1.5 : 0,
              borderBottomWidth: chunk ? chunk - squash + (p.border ? 1.5 : 0) : p.border ? 1.5 : 0,
              borderBottomColor: edgeColor ?? p.border ?? 'transparent',
            },
            !chunk && pressed && s.pressed,
          ];
        }}>
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <>
            {icon ? <Icon name={icon} size={dims.icon} color={p.fg} /> : null}
            <Text variant={dims.text} color={p.fg} numberOfLines={1}>
              {title}
            </Text>
            {iconRight ? <Icon name={iconRight} size={dims.icon} color={p.fg} /> : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  variant = 'surface',
  size = 40,
  badge,
  iconColor,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  variant?: 'surface' | 'plain' | 'onPrimary' | 'soft';
  size?: number;
  badge?: boolean;
  iconColor?: string;
}) {
  const { c, alpha } = useTheme();
  const s = useStyles();
  const bg = {
    surface: c.surface,
    plain: 'transparent',
    onPrimary: alpha(c.onPrimary, 0.16),
    soft: c.primarySoft,
  }[variant];
  const fg = iconColor ?? (variant === 'onPrimary' ? c.onPrimary : variant === 'soft' ? c.primaryInk : c.ink);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconBtn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        variant === 'surface' && { borderWidth: 1, borderColor: c.line },
        pressed && s.pressed,
      ]}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={fg} />
      {badge ? <View style={[s.badge, { borderColor: variant === 'surface' ? c.surface : c.primary }]} /> : null}
    </Pressable>
  );
}

/** Text-only action used in section headers and inline links. */
export function LinkButton({ title, onPress, tone = 'primary' }: { title: string; onPress: () => void; tone?: 'primary' | 'soft' | 'danger' }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Text variant="smallStrong" tone={tone}>
        {title}
      </Text>
    </Pressable>
  );
}

export function PressableCard({
  onPress,
  children,
  style,
  accessibilityLabel,
}: {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { opacity: 0.9, transform: [{ scale: 0.992 }] }]}>
      {children}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.42 },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.c.danger.solid,
    borderWidth: 2,
  },
}));
