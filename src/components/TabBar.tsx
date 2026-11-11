import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/native';
import { makeStyles, useTheme } from '@/theme';

import { Icon, Text, type IconName } from './ui';

export type TabItem = {
  label: string;
  icon: IconName;
  iconActive: IconName;
  /** The raised centre action (the member pass or the manager's scanner). */
  center?: boolean;
  badge?: number;
};

export function TabBar({
  state,
  emitter,
  navigateToTab,
  insets,
  items,
}: BottomTabBarProps & { items: Record<string, TabItem> }) {
  const { c } = useTheme();
  const s = useStyles();

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const item = items[route.name];
        if (!item) return null;
        const focused = index === state.index;
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptic.tap();
            navigateToTab(route.key);
          }
        };
        const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });

        if (item.center) {
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={item.label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={s.item}>
              {({ pressed }) => (
                <>
                  <View style={[s.center, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
                    <Icon name={focused ? item.iconActive : item.icon} size={24} color={c.surface} />
                  </View>
                  <Text variant="micro" color={focused ? c.ink : c.inkSoft} style={s.centerLabel}>
                    {item.label}
                  </Text>
                </>
              )}
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.badge ? `${item.label}, ${item.badge} new` : item.label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [s.item, pressed && { opacity: 0.6 }]}>
            {focused ? <View style={s.mark} /> : null}
            <Hop active={focused}>
              <Icon name={focused ? item.iconActive : item.icon} size={23} color={focused ? c.primaryInk : c.inkFaint} />
              {item.badge ? (
                <View style={s.badge}>
                  <Text variant="micro" color="#FFFFFF" style={{ fontSize: 10, lineHeight: 12 }}>
                    {item.badge > 9 ? '9+' : item.badge}
                  </Text>
                </View>
              ) : null}
            </Hop>
            <Text variant="micro" color={focused ? c.ink : c.inkSoft}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A little hop when a tab becomes active. */
function Hop({ active, children }: { active: boolean; children: ReactNode }) {
  const y = useSharedValue(0);
  const s = useSharedValue(1);
  useEffect(() => {
    if (!active) return;
    y.value = withSequence(withSpring(-6, { damping: 8, stiffness: 400 }), withSpring(0, { damping: 9, stiffness: 220 }));
    s.value = withSequence(withSpring(1.15, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 9, stiffness: 220 }));
  }, [active, y, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: s.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const useStyles = makeStyles((t) => ({
  bar: {
    flexDirection: 'row',
    backgroundColor: t.c.surface,
    borderTopWidth: 1,
    borderTopColor: t.c.line,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, minHeight: 52 },
  // A short rule on the bar's top edge marks the current tab.
  mark: { position: 'absolute', top: -9, width: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: t.c.primary },
  center: {
    width: 52,
    height: 34,
    borderRadius: t.radius.md,
    borderCurve: 'continuous',
    backgroundColor: t.c.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: { marginTop: 0 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: t.c.danger.solid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: t.c.surface,
  },
}));
