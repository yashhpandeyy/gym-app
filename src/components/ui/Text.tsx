import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Platform, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type Palette, type TypeVariant } from '@/theme';

export type Tone =
  | 'ink'
  | 'soft'
  | 'faint'
  | 'primary'
  | 'onPrimary'
  | 'inverse'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ice';

export function toneColor(c: Palette, tone: Tone) {
  switch (tone) {
    case 'ink':
      return c.ink;
    case 'soft':
      return c.inkSoft;
    case 'faint':
      return c.inkFaint;
    case 'primary':
      return c.primaryInk;
    case 'onPrimary':
      return c.onPrimary;
    case 'inverse':
      return c.surface;
    case 'success':
      return c.success.fg;
    case 'warning':
      return c.warning.fg;
    case 'danger':
      return c.danger.fg;
    case 'ice':
      return c.ice.fg;
  }
}

const DISPLAY: TypeVariant[] = ['hero', 'display', 'title', 'h2', 'h3', 'num'];

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', tone = 'ink', color, align, style, ...rest }: TextProps) {
  const { c, type } = useTheme();
  const display = DISPLAY.includes(variant);
  return (
    <RNText
      maxFontSizeMultiplier={display ? 1.15 : 1.4}
      {...rest}
      style={[
        type[variant],
        { color: color ?? toneColor(c, tone) },
        align ? { textAlign: align } : null,
        display && Platform.OS === 'android' ? { includeFontPadding: false } : null,
        style,
      ]}
    />
  );
}

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({
  name,
  size = 20,
  color,
  tone = 'ink',
}: {
  name: IconName;
  size?: number;
  color?: string;
  tone?: Tone;
}) {
  const { c } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? toneColor(c, tone)} />;
}
