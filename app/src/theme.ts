import { Platform, TextStyle } from 'react-native';

// "Honey lab": vanilla white paper, graphite ink, honey-yellow accent for primary actions only.
export const colors = {
  bg: '#FFFCF6',
  card: '#FFFFFF',
  surf: '#F7F1E4',
  ink: '#1C1A15',
  ink2: '#3A362D',
  muted: '#7A7365',
  faint: '#B3AB9A',
  line: '#ECE4D3',
  honey: '#F0B429',
  honeyText: '#9A6B00',
  honeySoft: '#FDF3D8',
  honeyLine: '#F5D98A',
  good: '#3F8A55',
  goodSoft: '#EAF3E6',
  warn: '#B7791F',
  warnSoft: '#FBF0DA',
  bad: '#C8553D',
  badSoft: '#FAE7E1',
  night: '#12110E',
  nightCard: '#1E1C17',
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, gutter: 20 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const type = {
  display: { fontFamily: fonts.semibold, fontSize: 34, lineHeight: 38, letterSpacing: -1.4, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.9, color: colors.ink },
  heading: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 24, letterSpacing: -0.5, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
} satisfies Record<string, TextStyle>;

export const shadow = Platform.select({
  ios: { shadowColor: '#3B2E14', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 3 },
  default: { boxShadow: '0 6px 20px rgba(59,46,20,0.08)' },
}) as object;

/** pH-strip palette: red (risky) → green (clean). */
export const STRIP = ['#E4572E', '#EE7B30', '#F29C38', '#F4B942', '#F2CB4C', '#DCCB55', '#B9C65A', '#8FBC63', '#6AAF69', '#4C9D6B'];

export function scoreColor(score: number) {
  if (score >= 75) return colors.good;
  if (score >= 50) return colors.warn;
  return colors.bad;
}
