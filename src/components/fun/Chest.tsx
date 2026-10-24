import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

/** Gold is the universal colour of a prize, so the chest keeps it whatever the gym's brand colour is. */
const GOLD = { lid: '#E9A23B', body: '#C27A22', edge: '#8F5512', band: '#F8CF5A', lock: '#FFE69A', key: '#8F5512', glow: 'rgba(255,206,84,0.55)' };

export function ChestArt({ size = 120, open = false }: { size?: number; open?: boolean }) {
  const lid = useSharedValue(0);
  const glow = useSharedValue(0);
  useEffect(() => {
    lid.value = withSpring(open ? 1 : 0, { damping: 9, stiffness: 140 });
    glow.value = open
      ? withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.7, { duration: 700, easing: Easing.inOut(Easing.quad) })), -1, true)
      : withTiming(0);
  }, [open, lid, glow]);

  const lidStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -size * 0.26 * lid.value }, { translateX: -size * 0.08 * lid.value }, { rotate: `${-22 * lid.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.7 + glow.value * 0.5 }] }));

  const w = size;
  const lidH = size * 0.36;
  const bodyH = size * 0.48;
  return (
    <View style={{ width: w, height: lidH + bodyH + size * 0.1, justifyContent: 'flex-end' }} accessibilityElementsHidden>
      <Animated.View
        style={[
          { position: 'absolute', left: -w * 0.25, right: -w * 0.25, top: -w * 0.1, height: w * 1.1, borderRadius: w, backgroundColor: GOLD.glow },
          glowStyle,
        ]}
      />
      {/* body */}
      <View
        style={{
          width: w,
          height: bodyH,
          backgroundColor: GOLD.body,
          borderBottomLeftRadius: w * 0.1,
          borderBottomRightRadius: w * 0.1,
          borderBottomWidth: w * 0.05,
          borderColor: GOLD.edge,
          alignItems: 'center',
        }}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, width: w * 0.14, backgroundColor: GOLD.band }} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: w * 0.05, backgroundColor: GOLD.edge, opacity: 0.35 }} />
      </View>
      {/* lid */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: bodyH - 2,
            height: lidH,
            backgroundColor: GOLD.lid,
            borderTopLeftRadius: w * 0.22,
            borderTopRightRadius: w * 0.22,
            borderBottomWidth: w * 0.04,
            borderColor: GOLD.edge,
            alignItems: 'center',
          },
          lidStyle,
        ]}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, width: w * 0.14, backgroundColor: GOLD.band }} />
      </Animated.View>
      {/* lock */}
      {!open ? (
        <View
          style={{
            position: 'absolute',
            alignSelf: 'center',
            bottom: bodyH - w * 0.12,
            width: w * 0.2,
            height: w * 0.22,
            borderRadius: w * 0.05,
            backgroundColor: GOLD.lock,
            borderWidth: 2,
            borderColor: GOLD.edge,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View style={{ width: w * 0.05, height: w * 0.08, borderRadius: w * 0.03, backgroundColor: GOLD.key }} />
        </View>
      ) : null}
    </View>
  );
}
