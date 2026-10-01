import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, scoreColor } from '../theme';
import { Ring } from './lab';

type Scores = { safety: number; efficacy: number; natural: number; pores: number };

/** Story-sized card (rendered off-screen and captured as an image) with the score, verdict and highlights. */
export function ShareCard({ title, score, personal, label, scores, good, bad }: { title: string; score: number; personal: boolean; label: string; scores: Scores; good: string[]; bad: string[] }) {
  return (
    <LinearGradient colors={['#FFE1D3', '#EBDDFF', '#D9E8FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Text style={styles.brand}>
        essola <Text style={{ color: colors.muted, fontFamily: fonts.regular }}>lab</Text>
      </Text>
      <Text style={styles.title} numberOfLines={3}>
        {title}
      </Text>
      <View style={styles.ringBox}>
        <Ring value={score} size={190} stroke={16} color={scoreColor(score)} track="rgba(255,255,255,0.8)">
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.of}>{personal ? 'для меня' : 'из 100'}</Text>
        </Ring>
      </View>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{label}</Text>
      </View>
      <View style={styles.row}>
        {(
          [
            ['Безопасность', scores.safety],
            ['Польза', scores.efficacy],
            ['Природность', scores.natural],
            ['Поры', scores.pores],
          ] as const
        ).map(([l, v]) => (
          <View key={l} style={styles.cell}>
            <Text style={[styles.cellN, { color: scoreColor(v) }]}>{v}</Text>
            <Text style={styles.cellL}>{l}</Text>
          </View>
        ))}
      </View>
      {good.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Сильные стороны</Text>
          <Text style={styles.blockText}>{good.join(' · ')}</Text>
        </View>
      )}
      {bad.length > 0 && (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: colors.warn }]}>Обратить внимание</Text>
          <Text style={styles.blockText}>{bad.join(' · ')}</Text>
        </View>
      )}
      <Text style={styles.foot}>Проверено в essola lab — домашняя лаборатория косметики</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { width: 360, height: 640, padding: 28, alignItems: 'center' },
  brand: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.8, color: colors.ink, alignSelf: 'flex-start' },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, letterSpacing: -0.6, color: colors.ink, marginTop: 18, textAlign: 'center' },
  ringBox: { marginTop: 22, padding: 10, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.55)' },
  score: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60, color: colors.ink },
  of: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  pill: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 99, backgroundColor: '#fff' },
  pillText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  row: { flexDirection: 'row', gap: 8, marginTop: 18 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.75)' },
  cellN: { fontFamily: fonts.display, fontSize: 20 },
  cellL: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.ink2 },
  block: { alignSelf: 'stretch', marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.75)' },
  blockTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.good },
  blockText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink, marginTop: 3 },
  foot: { marginTop: 'auto', fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
});
