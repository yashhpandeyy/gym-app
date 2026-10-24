import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/native';
import { makeStyles, useTheme } from '@/theme';

import { Text } from './Text';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = width > 0 ? (width - 8) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withTiming(index * segW, { duration: 220 });
  }, [index, segW, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={s.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {segW > 0 ? <Animated.View style={[s.indicator, { width: segW }, indicator]} /> : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) haptic.tap();
              onChange(o.value);
            }}
            style={s.seg}>
            <Text variant="smallStrong" color={selected ? c.ink : c.inkSoft} numberOfLines={1}>
              {o.label}
            </Text>
            {o.count ? (
              <View style={[s.count, { backgroundColor: selected ? c.primary : c.lineStrong }]}>
                <Text variant="micro" color={selected ? c.onPrimary : c.ink}>
                  {o.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  track: {
    flexDirection: 'row',
    backgroundColor: t.scheme === 'dark' ? t.c.surface : t.c.line,
    borderRadius: t.radius.md,
    padding: 4,
    height: 44,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: t.radius.md - 4,
    backgroundColor: t.scheme === 'dark' ? t.c.surfaceAlt : t.c.surface,
    shadowColor: t.c.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  count: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
}));
