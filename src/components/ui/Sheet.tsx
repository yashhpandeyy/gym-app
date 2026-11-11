import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, makeStyles } from '@/theme';

import { IconButton } from './Button';
import { Text } from './Text';

/** Bottom sheet for short tasks: confirmations, quick forms, receipts. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView behavior="padding">
          <Animated.View entering={SlideInDown.duration(260)} style={[s.panel, { maxHeight: height * 0.88, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.handle} />
            <View style={s.head}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h2">{title}</Text>
                {subtitle ? (
                  <Text variant="small" tone="soft">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <IconButton icon="close" label="Close" onPress={onClose} size={36} />
            </View>
            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            {footer ? <View style={s.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.c.overlay },
  panel: {
    backgroundColor: t.c.bg,
    borderTopLeftRadius: t.radius.xl,
    borderTopRightRadius: t.radius.xl,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.c.lineStrong, marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: gutter, paddingTop: 14, paddingBottom: 6 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 8, gap: 14 },
  footer: { paddingHorizontal: gutter, paddingTop: 12, gap: 10 },
}));
