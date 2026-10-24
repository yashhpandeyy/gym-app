import { monogramFrom, type BrandOverride, type FeatureKey } from '@/config/brand';

import { apiBase, type PublicGym } from './api';

/** Turns what the server knows about a gym into the look, details and feature set the app shows. */
export function brandFromGym(g: PublicGym): BrandOverride {
  const p = g.profile ?? undefined;
  return {
    id: g.id,
    name: g.name,
    shortName: g.name.split(' ')[0],
    monogram: monogramFrom(g.name),
    tagline: g.tagline || undefined,
    primary: g.primaryColor,
    logoUri: g.logoUrl ? apiBase() + g.logoUrl : undefined,
    features: g.features as Partial<Record<FeatureKey, boolean>>,
    contact: p?.contact,
    address: p?.address,
    hours: p?.hours,
    amenities: p?.amenities,
    currency: p?.currency,
    referral: p?.referral,
  };
}
