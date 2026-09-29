import { Platform, TextStyle } from 'react-native';

// Tokens mirror the ESSOLA Lab web block: ivory paper, graphite ink, antique gold.
export const colors = {
  bg: '#F6F3EC',
  paper: '#FBF9F4',
  card: '#FFFFFF',
  ink: '#1C1C1A',
  ink2: '#3B3B37',
  muted: '#7A7A72',
  faint: '#A9A69C',
  line: '#E7E3D8',
  line2: '#D8D3C5',
  gold: '#B0822F',
  goldDeep: '#8F6820',
  goldSoft: '#EFE3CB',
  night: '#15130F',
  nightCard: '#1F1C17',
  nightLine: '#2E2A22',
  nightInk: '#EFE9DC',
  nightMuted: '#9A9384',
  good: '#5E7A4F',
  warn: '#B7832F',
  bad: '#A5503C',
} as const;

export const fonts = {
  body: 'Onest_400Regular',
  medium: 'Onest_500Medium',
  semibold: 'Onest_600SemiBold',
  serif: 'CormorantGaramond_500Medium_Italic',
  serifUpright: 'CormorantGaramond_500Medium',
  mono: 'JetBrainsMono_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, gutter: 20 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const type = {
  display: { fontFamily: fonts.medium, fontSize: 38, lineHeight: 40, letterSpacing: -1.6, color: colors.ink },
  title: { fontFamily: fonts.medium, fontSize: 26, lineHeight: 30, letterSpacing: -0.8, color: colors.ink },
  heading: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 23, letterSpacing: -0.3, color: colors.ink },
  serif: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 32, color: colors.goldDeep },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.ink2 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
} satisfies Record<string, TextStyle>;

export const shadow = Platform.select({
  ios: { shadowColor: '#3B2E14', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  android: { elevation: 2 },
  default: { boxShadow: '0 8px 24px rgba(59,46,20,0.07)' },
}) as object;

export function scoreColor(score: number) {
  if (score >= 75) return colors.good;
  if (score >= 50) return colors.warn;
  return colors.bad;
}
