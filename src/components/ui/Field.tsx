import { useState } from 'react';
import { Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { haptic } from '@/lib/native';
import { makeStyles, useTheme } from '@/theme';

import { Icon, Text, type IconName } from './Text';

const WEB = Platform.OS === 'web';

export function Input({
  label,
  prefix,
  icon,
  error,
  hint,
  multiline,
  style,
  ...rest
}: TextInputProps & { label?: string; prefix?: string; icon?: IconName; error?: string; hint?: string }) {
  const { c, fonts } = useTheme();
  const s = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.wrap}>
      {label ? (
        <Text variant="smallStrong" tone="soft">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          s.box,
          multiline && s.multi,
          { borderColor: error ? c.danger.solid : focused ? c.primary : c.fieldLine },
        ]}>
        {icon ? <Icon name={icon} size={18} tone="faint" /> : null}
        {prefix ? (
          <Text variant="bodyStrong" tone="soft">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          placeholderTextColor={c.inkFaint}
          selectionColor={c.primary}
          cursorColor={c.primary}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          accessibilityLabel={label}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[s.input, { fontFamily: fonts.medium, color: c.ink }, multiline && s.inputMulti, style]}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="soft">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  format,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  label?: string;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const btn = (dir: -1 | 1) => {
    const next = Math.min(max, Math.max(min, value + dir * step));
    const disabled = next === value;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${dir < 0 ? 'Decrease' : 'Increase'}${label ? ` ${label}` : ''}`}
        disabled={disabled}
        onPress={() => {
          haptic.tap();
          onChange(next);
        }}
        hitSlop={6}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          s.stepBtn,
          disabled && { opacity: 0.35 },
          (pressed || hovered) && !disabled && { backgroundColor: c.line },
        ]}>
        <Icon name={dir < 0 ? 'remove' : 'add'} size={WEB ? 16 : 18} />
      </Pressable>
    );
  };
  return (
    <View style={s.stepper} accessibilityLabel={label}>
      {btn(-1)}
      <Text variant={WEB ? 'label' : 'num'} style={s.stepValue}>
        {format ? format(value) : value}
      </Text>
      {btn(1)}
    </View>
  );
}

/** Row of 4–6 boxes for a one-time code or PIN. */
export function CodeInput({
  length = 4,
  value,
  onChange,
  secure,
  autoFocus,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  autoFocus?: boolean;
}) {
  const { c, fonts } = useTheme();
  const s = useStyles();
  return (
    <View>
      <View style={s.codeRow} pointerEvents="none">
        {Array.from({ length }).map((_, i) => {
          const ch = value[i];
          const active = i === value.length;
          return (
            <View key={i} style={[s.codeBox, { borderColor: active ? c.primary : c.fieldLine }]}>
              <Text variant="h2">{ch ? (secure ? '•' : ch) : ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        maxLength={length}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        caretHidden
        accessibilityLabel={secure ? 'PIN' : 'Verification code'}
        style={[s.codeHidden, { fontFamily: fonts.body }]}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: 7 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: WEB ? 44 : 54,
    paddingHorizontal: 14,
    borderRadius: t.radius.md,
    borderWidth: WEB ? 1 : 1.5,
    backgroundColor: t.c.surface,
  },
  multi: { alignItems: 'flex-start', paddingVertical: 12 },
  // The box border already shows focus, so drop the browser's own outline on web.
  input: { flex: 1, fontSize: WEB ? 14 : 16, paddingVertical: 0, minHeight: WEB ? 40 : 50, outlineWidth: 0 },
  inputMulti: { minHeight: 96, paddingTop: 2 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.c.surfaceAlt,
    borderRadius: t.radius.md,
    padding: WEB ? 3 : 4,
  },
  stepBtn: {
    width: WEB ? 30 : 36,
    height: WEB ? 30 : 36,
    borderRadius: t.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.c.surface,
    ...(WEB ? { borderWidth: 1, borderColor: t.c.line, cursor: 'pointer' } : null),
  },
  stepValue: { minWidth: WEB ? 44 : 52, textAlign: 'center' },
  codeRow: { flexDirection: 'row', gap: 10 },
  codeBox: {
    // Shrinks to fit narrow screens and cards; never wider than the original 58.
    flex: 1,
    maxWidth: 58,
    height: 66,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    backgroundColor: t.c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeHidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.015, color: 'transparent' },
}));
