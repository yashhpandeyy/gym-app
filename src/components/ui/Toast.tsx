import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/native';
import type { Result } from '@/store/types';
import { makeStyles, useTheme } from '@/theme';

import { Icon, Text } from './Text';

type ToastTone = 'success' | 'error' | 'info';
type Msg = { id: number; text: string; tone: ToastTone };

const listeners = new Set<(m: Msg) => void>();
let seq = 0;

function emit(text: string, tone: ToastTone) {
  seq += 1;
  const m = { id: seq, text, tone };
  listeners.forEach((l) => l(m));
}

export const toast = {
  success(text: string) {
    haptic.success();
    emit(text, 'success');
  },
  error(text: string) {
    haptic.warn();
    emit(text, 'error');
  },
  info(text: string) {
    emit(text, 'info');
  },
  /** Show a store Result: success message (or fallback) / error message. Returns ok. */
  result(r: Result, fallback?: string) {
    if (r.ok) {
      if (r.message || fallback) toast.success(r.message ?? fallback!);
    } else toast.error(r.message);
    return r.ok;
  },
};

export function ToastHost() {
  const { c } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<Msg | null>(null);

  useEffect(() => {
    const l = (m: Msg) => setMsg(m);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), msg.tone === 'error' ? 4200 : 3000);
    return () => clearTimeout(id);
  }, [msg]);

  if (!msg) return null;
  const tone = msg.tone === 'success' ? c.success : msg.tone === 'error' ? c.danger : { solid: c.primary, fg: c.primaryInk, bg: c.primarySoft };
  return (
    <View pointerEvents="box-none" style={[s.host, { top: insets.top + 8 }]}>
      <Animated.View key={msg.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
        <Pressable onPress={() => setMsg(null)} style={s.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <View style={[s.icon, { backgroundColor: tone.solid }]}>
            <Icon
              name={msg.tone === 'success' ? 'checkmark' : msg.tone === 'error' ? 'alert' : 'information'}
              size={15}
              color="#FFFFFF"
            />
          </View>
          <Text variant="smallStrong" color={c.surface} style={{ flex: 1 }}>
            {msg.text}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  host: { position: 'absolute', left: 16, right: 16, zIndex: 1000, elevation: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: t.c.ink,
    borderRadius: t.radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  icon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
}));
