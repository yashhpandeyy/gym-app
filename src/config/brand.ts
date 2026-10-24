import brandJson from './brand.json';

export type FeatureKey = 'classes' | 'trainers' | 'progress' | 'workouts' | 'referrals' | 'leads' | 'gamification' | 'guestPass' | 'nutrition' | 'mind';

export type Hours = { label: string; days: number[]; open: string; close: string };

/**
 * What the app knows about the gym it is showing. `brand.json` holds the platform defaults (the
 * neutral "GYM" look before anyone has joined a gym, or a dedicated app's fixed identity). Once
 * a person is signed in to a gym, the gym's own details from the server replace those defaults.
 */
export type Brand = {
  id: string;
  name: string;
  shortName: string;
  monogram: string;
  tagline: string;
  slug: string;
  ios: { bundleIdentifier: string };
  android: { package: string };
  easProjectId: string;
  colors: { primary: string };
  currency: { code: string; locale: string; symbol: string };
  contact: { phone: string; phoneDisplay: string; whatsapp: string; email: string; instagram: string };
  address: { line1: string; line2: string; mapsQuery: string };
  hours: Hours[];
  amenities: string[];
  features: Record<FeatureKey, boolean>;
  referral: { reward: string };
  demo: boolean;
  logoUri?: string;
};

export const baseBrand: Brand = brandJson as Brand;

/**
 * Optional logo image for a dedicated build. Drop a square PNG at assets/brand/logo.png and point this at it:
 *   export const brandLogo: number | null = require('@/assets/brand/logo.png');
 * When null, the app draws a monogram tile from `brand.monogram` in the brand colour.
 */
export const brandLogo: number | null = null;

/** What a gym's own record changes about the default brand. Everything is optional. */
export type BrandOverride = {
  id?: string;
  name?: string;
  shortName?: string;
  monogram?: string;
  tagline?: string;
  primary?: string;
  /** Address of the gym's logo on the server. */
  logoUri?: string;
  /** Modules the owner turned on or off. Missing keys keep the default (on). */
  features?: Partial<Record<FeatureKey, boolean>>;
  contact?: Partial<Brand['contact']>;
  address?: Partial<Brand['address']>;
  hours?: Hours[];
  amenities?: string[];
  currency?: Partial<Brand['currency']>;
  referral?: Partial<Brand['referral']>;
};

export function applyBrandOverride(base: Brand, o: BrandOverride | null | undefined): Brand {
  if (!o) return base;
  return {
    ...base,
    id: o.id || base.id,
    name: o.name?.trim() || base.name,
    shortName: o.shortName?.trim() || o.name?.trim().split(' ')[0] || base.shortName,
    monogram: o.monogram?.trim() || base.monogram,
    tagline: o.tagline?.trim() || base.tagline,
    colors: { ...base.colors, primary: o.primary || base.colors.primary },
    features: { ...base.features, ...o.features },
    logoUri: o.logoUri,
    contact: { ...base.contact, ...o.contact },
    address: { ...base.address, ...o.address },
    hours: o.hours ?? base.hours,
    amenities: o.amenities ?? base.amenities,
    currency: { ...base.currency, ...o.currency },
    referral: { ...base.referral, ...o.referral },
  };
}

export function monogramFrom(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'G';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
