import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme, type TextStyle } from 'react-native';

import { applyBrandOverride, baseBrand, type Brand } from '@/config/brand';
import { useApp } from '@/store';

import { alpha, contrast, ensureContrast, mix, readableOn } from './color';

export type Scheme = 'light' | 'dark';

type Tone = { fg: string; solid: string; bg: string };

const NEUTRAL = {
  light: {
    bg: '#ECEEF1',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F5F7',
    line: '#DCE0E6',
    lineStrong: '#C5CBD4',
    ink: '#151A24',
    inkSoft: '#586172',
    inkFaint: '#8D95A3',
    overlay: 'rgba(12,16,26,0.48)',
    shadow: '#0B1020',
  },
  dark: {
    bg: '#0E1117',
    surface: '#171B23',
    surfaceAlt: '#1F242E',
    line: '#2A303B',
    lineStrong: '#3A414E',
    ink: '#EEF1F5',
    inkSoft: '#A3ACBA',
    inkFaint: '#6E7787',
    overlay: 'rgba(0,0,0,0.62)',
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
  const n = NEUTRAL[scheme];
  const light = scheme === 'light';
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
  };
}

export type Palette = ReturnType<typeof buildPalette>;

const isWeb = Platform.OS === 'web';

/** The phone app uses Big Shoulders and Barlow. The website uses Inter, the face most sites and dashboards read in. */
export const fonts = (isWeb
  ? {
      displayHeavy: 'Inter_800ExtraBold',
      display: 'Inter_700Bold',
      displayBold: 'Inter_600SemiBold',
      body: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    }
  : {
      displayHeavy: 'BigShouldersDisplay_900Black',
      display: 'BigShouldersDisplay_800ExtraBold',
      displayBold: 'BigShouldersDisplay_700Bold',
      body: 'Barlow_400Regular',
      medium: 'Barlow_500Medium',
      semibold: 'Barlow_600SemiBold',
      bold: 'Barlow_700Bold',
    }) as {
  displayHeavy: string;
  display: string;
  displayBold: string;
  body: string;
  medium: string;
  semibold: string;
  bold: string;
};

/**
 * Big Shoulders is a condensed display face cut from Chicago's industrial signage.
 * It carries the numbers members care about (days left, times, spots). Barlow handles reading.
 */
const phoneType = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 88, lineHeight: 88, letterSpacing: -1 },
  display: { fontFamily: fonts.displayHeavy, fontSize: 56, lineHeight: 58, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, letterSpacing: -0.2 },
  h2: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  h3: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 26, letterSpacing: 0.1 },
  num: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17 },
  micro: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
} satisfies Record<string, TextStyle>;

/** Smaller, tighter sizes for reading on a computer screen. */
const webType: Record<keyof typeof phoneType, TextStyle> = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 48, lineHeight: 54, letterSpacing: -1 },
  display: { fontFamily: fonts.displayHeavy, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 22 },
  num: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 22 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
};

export const type: Record<keyof typeof phoneType, TextStyle> = isWeb ? webType : phoneType;

export type TypeVariant = keyof typeof phoneType;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 44 } as const;
export const radius = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;
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
