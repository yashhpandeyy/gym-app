import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { brandLogo } from '@/config/brand';
import { useTheme } from '@/theme';

import { Text } from './ui';

/** The gym's mark: their logo if supplied, otherwise a monogram tile in the brand colour. */
export function Logo({ size = 36, inverted }: { size?: number; inverted?: boolean }) {
  const { c, brand, fonts } = useTheme();
  if (brand.logoUri) {
    return <Image source={{ uri: brand.logoUri }} accessibilityLabel={`${brand.name} logo`} style={{ width: size, height: size, borderRadius: size * 0.26 }} contentFit="cover" />;
  }
  if (brandLogo) {
    return <Image source={brandLogo} style={{ width: size, height: size, borderRadius: size * 0.26 }} contentFit="cover" />;
  }
  const bg = inverted ? c.onPrimary : c.primary;
  const fg = inverted ? c.primary : c.onPrimary;
  return (
    <View
      accessibilityLabel={`${brand.name} logo`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        style={{
          fontFamily: fonts.displayHeavy,
          fontSize: size * (brand.monogram.length > 2 ? 0.36 : 0.48),
          lineHeight: size * 0.56,
          color: fg,
          letterSpacing: -0.4,
        }}>
        {brand.monogram}
      </Text>
    </View>
  );
}

export function BrandLockup({ size = 34 }: { size?: number }) {
  const { brand } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Logo size={size} />
      <Text variant="label" numberOfLines={1}>
        {brand.name}
      </Text>
    </View>
  );
}

/**
 * The same plate as a dial: the rim fills with whatever share of the membership is left, so the
 * object on Home is the reading, not decoration around it.
 */
export function PlateDial({ size, value, color, track }: { size: number; value: number; color: string; track: string }) {
  const h = size / 2;
  const stroke = size * 0.06;
  const r = h - stroke / 2;
  const round = 2 * Math.PI * r;
  const left = Math.max(0, Math.min(1, value));
  return (
    <Svg width={size} height={size}>
      <Circle cx={h} cy={h} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      {left > 0 ? (
        <Circle
          cx={h}
          cy={h}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${round * left} ${round}`}
          transform={`rotate(-90 ${h} ${h})`}
        />
      ) : null}
      <Circle cx={h} cy={h} r={size * 0.32} stroke={track} strokeWidth={size * 0.012} fill="none" />
      <Circle cx={h} cy={h} r={size * 0.145} stroke={track} strokeWidth={size * 0.03} fill="none" />
      <Circle cx={h} cy={h} r={size * 0.06} fill={track} />
    </Svg>
  );
}

/**
 * A bumper plate seen end-on: rim, raised ring, hub and bore.
 * Used once per screen at most, as a watermark on brand-coloured surfaces.
 */
export function PlateRings({ size = 240, color, style }: { size?: number; color: string; style?: StyleProp<ViewStyle> }) {
  const h = size / 2;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Circle cx={h} cy={h} r={size * 0.47} stroke={color} strokeWidth={size * 0.05} fill="none" />
        <Circle cx={h} cy={h} r={size * 0.37} stroke={color} strokeWidth={size * 0.012} fill="none" />
        <Circle cx={h} cy={h} r={size * 0.17} stroke={color} strokeWidth={size * 0.03} fill="none" />
        <Circle cx={h} cy={h} r={size * 0.08} fill={color} />
      </Svg>
    </View>
  );
}
