import { Platform, TextStyle } from 'react-native';

// "Essola violet": white, deep ink, one violet with a lavender→lilac gradient, soft lavender and blush tints.
export const colors = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  cardSolid: '#FFFFFF',
  surf: '#F5F6FA',
  trav: '#F5F6FA',
  ink: '#15172B',
  ink2: '#44475E',
  muted: '#7D8096',
  faint: '#B3B6C6',
  line: '#ECEDF3',
  // violet accent (legacy "sage/brass/olive" names map onto the new palette)
  violet: '#3F4BC9',
  violetDeep: '#2F3AB0',
  lilac: '#A6C8FF',
  orchid: '#FFB9A0',
  tint: '#F1F3FF',
  blush: '#FFF0F9',
  sage: '#3F4BC9',
  sageDeep: '#3F4BC9',
  sageSoft: '#F1F3FF',
  olive: '#15172B',
  olive2: '#262A45',
  onDark: '#FFFFFF',
  onDarkMuted: 'rgba(255,255,255,0.6)',
  brass: '#3F4BC9',
  brassLight: '#C9D0FF',
  brassDeep: '#2F3AB0',
  brassText: '#2F3AB0',
  brassSoft: '#F1F3FF',
  water: '#C9D3FF',
  peach: '#F4B3D6',
  honey: '#3F4BC9',
  honeyTop: '#A6C8FF',
  honeyBottom: '#3F4BC9',
  honeyText: '#2F3AB0',
  honeySoft: '#F1F3FF',
  honeyLine: '#D6DCFF',
  glow: '#F1F3FF',
  good: '#2F9E6A',
  goodSoft: '#E6F6EE',
  warn: '#C27A1A',
  warnSoft: '#FDF1DE',
  bad: '#D1435B',
  badSoft: '#FCE8EC',
  night: '#16121F',
  nightCard: '#221C30',
} as const;

/** Signature gradient: lavender → lilac → orchid. */
export const GRADIENT = ['#FFB9A0', '#C9B4FF', '#A6C8FF'] as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'Onest_600SemiBold',
  displayMedium: 'Onest_500Medium',
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
  ios: { shadowColor: '#3A2A8C', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 3 },
  default: { boxShadow: '0 1px 0 rgba(255,255,255,.85) inset, 0 14px 34px -16px rgba(58,42,140,.28), 0 2px 6px -3px rgba(58,42,140,.08)' },
}) as object;

/** Deep shadow under dark olive blocks and primary buttons. */
export const glowShadow = Platform.select({
  ios: { shadowColor: '#16121F', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 8 },
  default: { boxShadow: '0 16px 30px -12px rgba(20,20,10,.6)' },
}) as object;

/** Dot colours for ingredient risk 0–3. */
export const RISK_COLOR = [colors.good, '#9FB34A', '#E0962E', colors.bad];

/** pH-strip palette: terracotta (risky) → sage (clean). */
export const STRIP = ['#D1435B', '#E0663F', '#E8902F', '#E9B52C', '#C9C23A', '#9FC24A', '#6FBE5C', '#4BB26A', '#3AA56B', '#2F9E6A'];

/** Colours of recipe phases in formula bars and the constructor flask. */
export const PHASE_COLOR = { water: colors.water, oil: '#E6C6FF', active: colors.violet, emulsifier: '#E9E4F7', preservative: colors.peach } as const;

export function scoreColor(score: number) {
  if (score >= 75) return colors.good;
  if (score >= 50) return colors.warn;
  return colors.bad;
}
