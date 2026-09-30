import { Platform, TextStyle } from 'react-native';

// "Silk": clean white, warm glow at the top, soft layered shadows, gentle yellow accents.
export const colors = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  surf: '#F6F3EC',
  ink: '#1C1A15',
  ink2: '#3A362D',
  muted: '#827C6E',
  faint: '#B3AB9A',
  line: '#EFEBE1',
  honey: '#F5C542',
  honeyTop: '#FFDD6B',
  honeyBottom: '#F5B82E',
  honeyText: '#8A6200',
  honeySoft: '#FFF6D6',
  honeyLine: '#F5DA86',
  glow: '#FFF0BF',
  good: '#3F7A4C',
  goodSoft: '#EAF3E6',
  warn: '#B4621A',
  warnSoft: '#FCEBDD',
  bad: '#C8553D',
  badSoft: '#FAE7E1',
  night: '#0E0D0B',
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
/** Bottom padding so content scrolls clear of the floating tab bar. */
export const TAB_SPACE = 120;

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

/** Layered soft shadow that makes cards float above the page. */
export const shadow = Platform.select({
  ios: { shadowColor: '#3C2D0A', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 4 },
  default: { boxShadow: '0 12px 32px -14px rgba(60,45,10,0.22), 0 2px 6px -2px rgba(60,45,10,0.07)' },
}) as object;

export const glowShadow = Platform.select({
  ios: { shadowColor: '#F5B82E', shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  android: { elevation: 6 },
  default: { boxShadow: '0 10px 24px -8px rgba(245,184,46,0.8)' },
}) as object;

/** Dot colours for ingredient risk 0–3. */
export const RISK_COLOR = [colors.good, '#C9A227', '#E08A2E', colors.bad];

/** pH-strip palette: red (risky) → green (clean). */
export const STRIP = ['#E4572E', '#EE7B30', '#F29C38', '#F4B942', '#F2CB4C', '#DCCB55', '#B9C65A', '#8FBC63', '#6AAF69', '#4C9D6B'];

export function scoreColor(score: number) {
  if (score >= 75) return colors.good;
  if (score >= 50) return colors.warn;
  return colors.bad;
}
