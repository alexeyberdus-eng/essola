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
    <LinearGradient colors={['#5B47C9', '#8A74F2', '#C9A2F5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
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
      {/* The verdict on a white pill, so its colour reads on the violet background. */}
      <View style={styles.verdictPill}>
        <View style={[styles.verdictDot, { backgroundColor: c }]} />
        <Text style={[styles.verdict, { color: c }]} numberOfLines={1}>
          {label}
        </Text>
      </View>

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

      {(!!good[0] || !!bad[0]) && (
        <View style={styles.notes}>
          {!!good[0] && (
            <View style={styles.noteRow}>
              <Text style={[styles.noteTag, { color: '#9BF0C0' }]}>Сильное</Text>
              <Text style={styles.note} numberOfLines={1}>{good.slice(0, 3).join(', ')}</Text>
            </View>
          )}
          {!!bad[0] && (
            <View style={styles.noteRow}>
              <Text style={[styles.noteTag, { color: '#FFD0A8' }]}>Внимание</Text>
              <Text style={styles.note} numberOfLines={1}>{bad.slice(0, 3).join(', ')}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.cta}>
        <View style={styles.ctaIcon}>
          <Icon name="scan" size={22} color={colors.violetDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>Наведи камеру — узнай правду о составе</Text>
          <Text style={styles.ctaText}>Сканер косметики, домашние рецепты и технолог в кармане</Text>
          <Text style={styles.ctaLink}>essola.ru</Text>
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
  photoBox: { alignSelf: 'center', marginTop: 14, width: 170, height: 170 },
  photo: { width: 170, height: 170, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { position: 'absolute', right: -26, bottom: -12, width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff' },
  badgeN: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, color: '#fff' },
  badgeL: { fontFamily: fonts.medium, fontSize: 10, color: 'rgba(255,255,255,0.9)' },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25, letterSpacing: -0.5, color: '#fff', marginTop: 24, textAlign: 'center' },
  verdictPill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: '#fff' },
  verdictDot: { width: 8, height: 8, borderRadius: 4 },
  verdict: { fontFamily: fonts.bold, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  cell: { width: 152, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', gap: 7 },
  cellHead: { flexDirection: 'row', justifyContent: 'space-between' },
  cellL: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.75)' },
  cellN: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#fff' },
  bar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3 },
  notes: { marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', gap: 8 },
  noteRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noteTag: { width: 66, fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 17 },
  note: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: '#fff' },
  // Frosted glass in the card's colours instead of a white block.
  cta: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  ctaIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 17, color: '#fff' },
  ctaText: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  ctaLink: { fontFamily: fonts.bold, fontSize: 12.5, color: '#fff', marginTop: 3 },
});
