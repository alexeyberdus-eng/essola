import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, scoreColor } from '../theme';
import { Icon } from './Icon';

type Scores = { safety: number; efficacy: number; natural: number; pores: number };

/**
 * Story-sized card (rendered off-screen and captured as an image): product photo, score, four bars,
 * one strength, one caution and an invitation to try the app. Every text is clamped, so nothing overflows.
 */
export function ShareCard({
  title,
  score,
  personal,
  label,
  scores,
  good,
  bad,
  image,
}: {
  title: string;
  score: number;
  personal: boolean;
  label: string;
  scores: Scores;
  good: string[];
  bad: string[];
  image?: string | null;
}) {
  const c = scoreColor(score);
  return (
    <LinearGradient colors={['#15172B', '#2B2F7A', '#5B4BD6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.brand}>
          essola <Text style={styles.brandLab}>lab</Text>
        </Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>разбор состава</Text>
        </View>
      </View>

      <View style={styles.photoBox}>
        <View style={styles.photo}>
          {image ? (
            <Image source={{ uri: image.replace('.100.', '.400.') }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />
          ) : (
            <Icon name="flask" size={64} color="#C9D0FF" strokeWidth={1.2} />
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: c }]}>
          <Text style={styles.badgeN}>{score}</Text>
          <Text style={styles.badgeL}>{personal ? 'для меня' : 'из 100'}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.verdict, { color: c }]} numberOfLines={1}>
        {label}
      </Text>

      <View style={styles.grid}>
        {(
          [
            ['Безопасность', scores.safety],
            ['Польза', scores.efficacy],
            ['Природность', scores.natural],
            ['Поры', scores.pores],
          ] as const
        ).map(([l, v]) => (
          <View key={l} style={styles.cell}>
            <View style={styles.cellHead}>
              <Text style={styles.cellL}>{l}</Text>
              <Text style={styles.cellN}>{v}</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${Math.max(4, v)}%`, backgroundColor: scoreColor(v) }]} />
            </View>
          </View>
        ))}
      </View>

      {!!good[0] && (
        <Text style={styles.note} numberOfLines={1}>
          <Text style={{ color: '#8FE3B0' }}>+ </Text>
          {good.slice(0, 2).join(', ')}
        </Text>
      )}
      {!!bad[0] && (
        <Text style={styles.note} numberOfLines={1}>
          <Text style={{ color: '#FFB98F' }}>! </Text>
          {bad.slice(0, 2).join(', ')}
        </Text>
      )}

      <View style={styles.cta}>
        <View style={styles.ctaIcon}>
          <Icon name="scan" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>Наведи камеру — узнай правду о составе</Text>
          <Text style={styles.ctaText}>Сканер косметики, 250 рецептов и технолог в кармане</Text>
          <Text style={styles.ctaLink}>essola lab · essola.ru</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { width: 360, height: 640, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.8, color: '#fff' },
  brandLab: { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.6)' },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.14)' },
  chipText: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.85)' },
  photoBox: { alignSelf: 'center', marginTop: 18, width: 196, height: 196 },
  photo: { width: 196, height: 196, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { position: 'absolute', right: -22, bottom: -14, width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#2B2F7A' },
  badgeN: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, color: '#fff' },
  badgeL: { fontFamily: fonts.medium, fontSize: 10, color: 'rgba(255,255,255,0.9)' },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26, letterSpacing: -0.5, color: '#fff', marginTop: 26, textAlign: 'center' },
  verdict: { fontFamily: fonts.semibold, fontSize: 15, marginTop: 6, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  cell: { width: 152, padding: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', gap: 7 },
  cellHead: { flexDirection: 'row', justifyContent: 'space-between' },
  cellL: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.75)' },
  cellN: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#fff' },
  bar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3 },
  note: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 9 },
  cta: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: '#fff' },
  ctaIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 17, color: colors.ink },
  ctaText: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: colors.muted, marginTop: 2 },
  ctaLink: { fontFamily: fonts.semibold, fontSize: 12, color: colors.violet, marginTop: 3 },
});
