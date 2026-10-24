import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, makeStyles, useTheme } from '@/theme';

import { IconButton } from './Button';
import { Text } from './Text';

type HeaderKind = 'large' | 'stack' | 'modal' | 'none';

export function Screen({
  title,
  subtitle,
  header = 'large',
  left,
  right,
  scroll = true,
  footer,
  children,
  contentStyle,
  refreshing,
  onRefresh,
  onBack,
}: {
  title?: string;
  subtitle?: string;
  header?: HeaderKind;
  left?: ReactNode;
  right?: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  onBack?: () => void;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  const bar =
    header === 'stack' ? (
      <View style={s.bar}>
        <IconButton icon="chevron-back" label="Back" onPress={back} />
        <Text variant="h3" numberOfLines={1} style={s.barTitle}>
          {title}
        </Text>
        <View style={s.barRight}>{right}</View>
      </View>
    ) : header === 'modal' ? (
      <View style={s.bar}>
        <Text variant="h2" numberOfLines={1} style={[s.barTitle, { marginLeft: 4 }]}>
          {title}
        </Text>
        <View style={s.barRight}>
          {right}
          <IconButton icon="close" label="Close" onPress={back} />
        </View>
      </View>
    ) : header === 'large' && (left || right) ? (
      <View style={s.bar}>
        <View style={{ flex: 1 }}>{left}</View>
        <View style={s.barRight}>{right}</View>
      </View>
    ) : null;

  const largeTitle =
    header === 'large' && title ? (
      <View style={s.largeTitle}>
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="body" tone="soft" style={{ marginTop: 4 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    ) : subtitle && header !== 'none' ? (
      <Text variant="body" tone="soft" style={{ marginBottom: 8 }}>
        {subtitle}
      </Text>
    ) : null;

  const bottomPad = footer ? 24 : header === 'large' ? 28 : Math.max(insets.bottom, 16) + 24;

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[s.content, { paddingBottom: bottomPad }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
        ) : undefined
      }>
      {largeTitle}
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, s.contentFixed, contentStyle]}>
      {largeTitle}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      {bar}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer ? <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.c.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: gutter,
    paddingTop: 6,
    paddingBottom: 8,
    minHeight: 56,
  },
  barTitle: { flex: 1 },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  largeTitle: { marginTop: 6, marginBottom: 18 },
  content: { paddingHorizontal: gutter, paddingTop: 4 },
  contentFixed: { paddingHorizontal: gutter },
  footer: {
    paddingHorizontal: gutter,
    paddingTop: 14,
    backgroundColor: t.c.surface,
    borderTopWidth: 1,
    borderTopColor: t.c.line,
    gap: 10,
  },
}));
