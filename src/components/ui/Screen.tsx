import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, makeStyles, useTheme } from '@/theme';

import { IconButton } from './Button';
import { Text } from './Text';

const WEB = Platform.OS === 'web';

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
  bleed,
  bleedColor,
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
  /** A block that runs edge to edge under the status bar, above the page content. */
  bleed?: ReactNode;
  bleedColor?: string;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // On a computer the page is a centred column, not a phone stretched edge to edge.
  const margin = WEB && width >= 700 ? 32 : gutter;
  const webColumn = WEB ? ({ width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: margin } as const) : null;
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  const bar =
    header === 'stack' ? (
      <View style={[s.bar, webColumn, WEB && { paddingTop: 22, paddingBottom: 4 }]}>
        {/* The sidebar is the way around on a computer; the back arrow stays for phones and for detail pages. */}
        {WEB && !onBack ? null : <IconButton icon="chevron-back" label="Back" onPress={back} />}
        <Text variant={WEB ? 'title' : 'h3'} numberOfLines={1} style={s.barTitle}>
          {title}
        </Text>
        <View style={s.barRight}>{right}</View>
      </View>
    ) : header === 'modal' ? (
      <View style={[s.bar, webColumn]}>
        <Text variant="h2" numberOfLines={1} style={[s.barTitle, { marginLeft: 4 }]}>
          {title}
        </Text>
        <View style={s.barRight}>
          {right}
          <IconButton icon="close" label="Close" onPress={back} />
        </View>
      </View>
    ) : header === 'large' && !(WEB && title) && ((!WEB && left) || right) ? (
      <View style={[s.bar, webColumn]}>
        <View style={{ flex: 1 }}>{WEB ? null : left}</View>
        <View style={s.barRight}>{right}</View>
      </View>
    ) : null;

  const largeTitle =
    header === 'large' && title ? (
      <View style={s.largeTitle}>
        <View style={{ flex: 1 }}>
          <Text variant="title">{title}</Text>
          {subtitle ? (
            <Text variant="body" tone="soft" style={{ marginTop: 4 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {/* On a computer the page's actions sit level with its title. */}
        {WEB ? right : null}
      </View>
    ) : subtitle && header !== 'none' ? (
      <Text variant="body" tone="soft" style={{ marginBottom: 8 }}>
        {subtitle}
      </Text>
    ) : null;

  const bottomPad = footer ? 24 : header === 'large' ? 28 : Math.max(insets.bottom, 16) + 24;

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[s.content, webColumn, WEB && !bar && { paddingTop: 28 }, { paddingBottom: bottomPad }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
        ) : undefined
      }>
      {bleed ? (
        <View style={{ marginHorizontal: -margin, marginTop: -(WEB && !bar ? 28 : 4), marginBottom: 20 }}>
          {/* Pulling the page down past the top shows the same colour, not a gap. */}
          <View style={{ position: 'absolute', left: 0, right: 0, top: -600, height: 640, backgroundColor: bleedColor }} />
          {bleed}
        </View>
      ) : null}
      {largeTitle}
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, s.contentFixed, webColumn, WEB && !bar && { paddingTop: 28 }, contentStyle]}>
      {largeTitle}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[s.root, bleed ? { backgroundColor: bleedColor } : null]}>
      {bar}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
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
  largeTitle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 18 },
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
