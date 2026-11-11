import { Image } from 'expo-image';
import { View } from 'react-native';

import type { Product, ProductCategory } from '@/store/types';
import { useTheme } from '@/theme';

import { Icon, type IconName } from './ui';

export const CATEGORY_ICON: Record<ProductCategory, IconName> = {
  Supplements: 'flask-outline',
  Drinks: 'water-outline',
  Gear: 'barbell-outline',
  Clothing: 'shirt-outline',
  Other: 'pricetag-outline',
};

/** A product's photo, or its category's icon on a tinted square when there's no photo. */
export function ProductThumb({ product, size, radius = 12 }: { product: Pick<Product, 'photo' | 'category'>; size: number | '100%'; radius?: number }) {
  const { c } = useTheme();
  const box = { width: size, aspectRatio: 1, borderRadius: radius, overflow: 'hidden' as const, backgroundColor: c.primarySoft };
  if (product.photo) return <Image source={{ uri: product.photo }} style={box} contentFit="cover" accessibilityIgnoresInvertColors />;
  return (
    <View style={[box, { alignItems: 'center', justifyContent: 'center' }]}>
      <Icon name={CATEGORY_ICON[product.category] ?? 'pricetag-outline'} size={typeof size === 'number' ? Math.round(size * 0.42) : 40} color={c.primaryInk} />
    </View>
  );
}

/** "Only 2 left", "Sold out", or nothing when there's plenty or the gym doesn't count stock. */
export function stockNote(p: Pick<Product, 'stock'>) {
  if (typeof p.stock !== 'number') return null;
  if (p.stock <= 0) return 'Sold out';
  if (p.stock <= 3) return `Only ${p.stock} left`;
  return null;
}
