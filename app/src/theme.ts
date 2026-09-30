import { Platform, TextStyle } from 'react-native';

// "Travertine & sage": warm stone paper, sage greens, a dark olive anchor and brass accents — a natural lab.
export const colors = {
  bg: '#F2EEE6',
  card: 'rgba(255,253,248,0.72)',
  cardSolid: '#FBF8F2',
  surf: '#E9E3D7',
  trav: '#E6DDCF',
  ink: '#23271F',
  ink2: '#4E5247',
  muted: '#8C897C',
  faint: '#B4AE9F',
  line: '#E2DBCD',
  sage: '#8A9A7B',
  sageDeep: '#5F7058',
  sageSoft: '#E3E4D6',
  olive: '#2B2F27',
  olive2: '#3B4134',
  onDark: '#EFEBE0',
  onDarkMuted: 'rgba(239,235,224,0.55)',
  brass: '#B08D57',
  brassLight: '#D8BC86',
  brassDeep: '#A07F48',
  brassText: '#8A6A36',
  brassSoft: '#EFE6D3',
  water: '#AFC6CC',
  peach: '#C98B6F',
  // legacy names used across screens
  honey: '#D8BC86',
  honeyTop: '#E4CD9E',
  honeyBottom: '#B08D57',
  honeyText: '#8A6A36',
  honeySoft: '#EFE6D3',
  honeyLine: '#DCC9A2',
  glow: '#E9E3D3',
  good: '#4F7A48',
  goodSoft: '#E1E7D8',
  warn: '#9A6B2E',
  warnSoft: '#F1E5CC',
  bad: '#B5563F',
  badSoft: '#F3E1D9',
  night: '#141612',
  nightCard: '#23271F',
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'Manrope_700Bold',
  displayMedium: 'Manrope_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, gutter: 18 } as const;
/** Bottom padding so content scrolls clear of the floating tab bar. */
export const TAB_SPACE = 124;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -1.3, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -1.1, color: colors.ink },
  heading: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.5, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
} satisfies Record<string, TextStyle>;

/** Soft layered shadow: glass cards float above the paper. */
export const shadow = Platform.select({
  ios: { shadowColor: '#322D1E', shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 3 },
  default: { boxShadow: '0 1px 0 rgba(255,255,255,.85) inset, 0 14px 34px -16px rgba(50,45,30,.3), 0 2px 6px -3px rgba(50,45,30,.08)' },
}) as object;

/** Deep shadow under dark olive blocks and primary buttons. */
export const glowShadow = Platform.select({
  ios: { shadowColor: '#14160F', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 8 },
  default: { boxShadow: '0 16px 30px -12px rgba(20,20,10,.6)' },
}) as object;

/** Dot colours for ingredient risk 0–3. */
export const RISK_COLOR = [colors.good, '#A39A4E', '#C28A3E', colors.bad];

/** pH-strip palette: terracotta (risky) → sage (clean). */
export const STRIP = ['#B5563F', '#C06E4C', '#C98B6F', '#CFA276', '#D8BC86', '#C9BF8C', '#B2B88A', '#9CAA84', '#8A9A7B', '#6F8266'];

/** Colours of recipe phases in formula bars and the constructor flask. */
export const PHASE_COLOR = { water: colors.water, oil: colors.brassLight, active: colors.sageDeep, emulsifier: '#D6CCBA', preservative: colors.peach } as const;

export function scoreColor(score: number) {
  if (score >= 75) return colors.good;
  if (score >= 50) return colors.warn;
  return colors.bad;
}
