import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme, type TextStyle } from 'react-native';

import { applyBrandOverride, baseBrand, type Brand } from '@/config/brand';
import { useApp } from '@/store';

import { alpha, contrast, ensureContrast, mix, readableOn } from './color';

export type Scheme = 'light' | 'dark';

type Tone = { fg: string; solid: string; bg: string };

const isWeb = Platform.OS === 'web';

/** Greys for the page, lifted a touch on the website. buildPalette tints them with the gym's colour. */
const NEUTRAL = {
  light: {
    bg: isWeb ? '#F6F7F8' : '#F1F2F4',
    surface: '#FFFFFF',
    surfaceAlt: '#ECEEF1',
    line: '#E1E4E8',
    lineStrong: '#C6CBD2',
    /** The edge of anything you type into: 3:1 against the surface, so a field can be found without guessing. */
    fieldLine: '#8A919C',
    ink: '#15171B',
    inkSoft: '#555C67',
    inkFaint: '#666E7A',
    overlay: 'rgba(12,14,20,0.5)',
    shadow: '#0B0D14',
  },
  dark: {
    bg: '#0D0F12',
    surface: '#16191E',
    surfaceAlt: '#20242B',
    line: '#2A2F37',
    lineStrong: '#3C424D',
    fieldLine: '#6B7380',
    ink: '#F1F3F5',
    inkSoft: '#AEB5C0',
    inkFaint: '#868E9B',
    overlay: 'rgba(0,0,0,0.66)',
    shadow: '#000000',
  },
};

/** Status colours borrow from bumper plates: green 10s, yellow 15s, red 25s, and ice for a paused membership. */
const STATUS: Record<Scheme, Record<'success' | 'warning' | 'danger' | 'ice', Tone>> = {
  light: {
    success: { fg: '#0D7443', solid: '#19A463', bg: '#E1F4E9' },
    warning: { fg: '#865600', solid: '#EFA400', bg: '#FCEFD2' },
    danger: { fg: '#B0232A', solid: '#E5484D', bg: '#FBE4E4' },
    ice: { fg: '#0A6886', solid: '#1A9CC7', bg: '#DCF0F8' },
  },
  dark: {
    success: { fg: '#62D69E', solid: '#22B26B', bg: '#14301F' },
    warning: { fg: '#F4BE52', solid: '#EFA400', bg: '#33270B' },
    danger: { fg: '#FF8C8F', solid: '#E5484D', bg: '#3A191B' },
    ice: { fg: '#6FCCEA', solid: '#1A9CC7', bg: '#0E2B35' },
  },
};

function buildPalette(brandPrimary: string, scheme: Scheme) {
  const base = NEUTRAL[scheme];
  const light = scheme === 'light';
  // A trace of the gym's colour in every grey, so each gym's app feels like its own and not a recolour.
  const n = {
    ...base,
    bg: mix(base.bg, brandPrimary, 0.025),
    surfaceAlt: mix(base.surfaceAlt, brandPrimary, 0.035),
    line: mix(base.line, brandPrimary, 0.04),
    ink: mix(base.ink, brandPrimary, 0.05),
  };
  // A near-black brand vanishes on the dark background and a pale one on the light background,
  // so nudge the fill colour just enough to stay visible. Text colours are handled by primaryInk.
  let primary = brandPrimary;
  if (!light && contrast(primary, n.bg) < 1.8) primary = mix(primary, '#FFFFFF', 0.82);
  if (light && contrast(primary, n.bg) < 1.25) primary = mix(primary, '#000000', 0.3);
  return {
    ...n,
    ...STATUS[scheme],
    primary,
    onPrimary: readableOn(primary),
    /** Brand colour safe for text and icons on surfaces. */
    primaryInk: light
      ? ensureContrast(primary, n.surface, 4.5, '#000000')
      : ensureContrast(primary, n.surface, 4.5, '#FFFFFF'),
    primarySoft: mix(n.surface, primary, light ? 0.1 : 0.2),
    primaryLine: mix(n.surface, primary, light ? 0.32 : 0.45),
    primaryDeep: mix(primary, '#000000', 0.28),
    /** The dark rail beside the website and other ink-filled surfaces, the same in both schemes. */
    rail: mix('#14161B', primary, 0.04),
    railLine: mix('#2B2F37', primary, 0.04),
    railInk: '#F1F3F5',
    railSoft: '#A7AEBA',
  };
}

export type Palette = ReturnType<typeof buildPalette>;


/**
 * Two faces on every platform. Bricolage Grotesque carries titles and the numbers people come for:
 * days left, money, spots. Figtree handles everything people read and tap. Both include the rupee sign.
 */
export const fonts = {
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  display: 'BricolageGrotesque_700Bold',
  displayBold: 'BricolageGrotesque_600SemiBold',
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
};

const figures: TextStyle = { fontVariant: ['tabular-nums'] };

const phoneType = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 76, lineHeight: 78, letterSpacing: -3, ...figures },
  display: { fontFamily: fonts.displayHeavy, fontSize: 44, lineHeight: 48, letterSpacing: -1.4, ...figures },
  title: { fontFamily: fonts.display, fontSize: 31, lineHeight: 36, letterSpacing: -0.9 },
  h2: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, letterSpacing: -0.5 },
  h3: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  num: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.4, ...figures },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17 },
  micro: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
} satisfies Record<string, TextStyle>;

/** The same voice sized for a computer: a 14px body like most dashboards, with headings that step down gently. */
const webType: Record<keyof typeof phoneType, TextStyle> = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 48, lineHeight: 52, letterSpacing: -1.8, ...figures },
  display: { fontFamily: fonts.displayHeavy, fontSize: 32, lineHeight: 36, letterSpacing: -1, ...figures },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.7 },
  h2: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.35 },
  h3: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  num: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, letterSpacing: -0.3, ...figures },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
};

export const type: Record<keyof typeof phoneType, TextStyle> = isWeb ? webType : phoneType;

export type TypeVariant = keyof typeof phoneType;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 44 } as const;
/** Corners are rounder on a phone, where thumbs and chunky buttons want them; websites use tighter ones. */
export const radius = (isWeb
  ? { xs: 4, sm: 8, md: 10, lg: 12, xl: 16, pill: 999 }
  : { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 }) as { xs: number; sm: number; md: number; lg: number; xl: number; pill: number };
export const gutter = 20;

export type Theme = {
  scheme: Scheme;
  c: Palette;
  brand: Brand;
  type: typeof type;
  fonts: typeof fonts;
  space: typeof space;
  radius: typeof radius;
  alpha: typeof alpha;
  mix: typeof mix;
};

function buildTheme(brand: Brand, scheme: Scheme): Theme {
  return {
    scheme,
    c: buildPalette(brand.colors.primary, scheme),
    brand,
    type,
    fonts,
    space,
    radius,
    alpha,
    mix,
  };
}

const ThemeContext = createContext<Theme>(buildTheme(baseBrand, 'light'));

export function ThemeProvider({ children, forceScheme }: { children: ReactNode; forceScheme?: Scheme }) {
  const system = useColorScheme();
  const pref = useApp((s) => s.prefs.scheme);
  const override = useApp((s) => s.brandOverride);
  const scheme: Scheme = forceScheme ?? (pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref);
  const theme = useMemo(
    () => buildTheme(applyBrandOverride(baseBrand, override), scheme),
    [override, scheme],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useBrand() {
  return useContext(ThemeContext).brand;
}

/** Define themed styles once at module level, then call the returned hook inside a component. */
type NamedStyles = Parameters<typeof StyleSheet.create>[0];

export function makeStyles<T extends NamedStyles>(
  // The intersection gives the factory's object literal a contextual type, so values like
  // flexDirection: 'row' stay literal instead of widening to string (same trick as StyleSheet.create).
  factory: (t: Theme) => T & NamedStyles,
) {
  return function useStyles(): Readonly<T> {
    const t = useTheme();
    return useMemo(() => StyleSheet.create(factory(t)), [t]);
  };
}
