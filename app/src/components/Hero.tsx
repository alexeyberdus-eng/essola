import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

/** The gradient banner at the top of a section: a small kicker, a headline and one line about it. */
export function Hero({ kicker, title, text, tone = 'violet', style }: { kicker: string; title: string; text?: string; tone?: 'violet' | 'rose' | 'mint' | 'sky'; style?: ViewStyle }) {
  const palette = TONES[tone];
  return (
    <View style={[styles.hero, style]}>
      <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.circle} />
      <View style={styles.circle2} />
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
      {!!text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const TONES = {
  violet: [colors.violet, colors.lilac, colors.orchid],
  rose: ['#C2559B', '#E07BA8', '#F2A7B8'],
  mint: ['#2E8F86', '#4DB3A2', '#8FD3B8'],
  sky: ['#4B5FD6', '#6E8BF0', '#9EC2F7'],
} as const satisfies Record<string, readonly [string, string, ...string[]]>;

const styles = StyleSheet.create({
  hero: { marginTop: 16, borderRadius: 24, padding: 18, overflow: 'hidden' },
  circle: { position: 'absolute', right: -40, top: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.15)' },
  circle2: { position: 'absolute', right: 40, bottom: -60, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.10)' },
  kicker: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, letterSpacing: -0.8, color: '#fff', marginTop: 8, maxWidth: 280 },
  text: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.92)', marginTop: 6 },
});
