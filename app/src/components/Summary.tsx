import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import type { Summary } from '../lib/effects';
import type { Opinion } from '../lib/opinion';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';

/** "Что даёт этот состав": plain-language result of the ingredients working together. */
export function CompositionSummary({ s, title = 'Что даёт этот состав' }: { s: Summary; title?: string }) {
  return (
    <LinearGradient colors={['#C9B6FF', '#F1EDFF', '#EBC4F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.lead}>{s.lead}</Text>
        {s.effects.map((e) => (
          <View key={e.title} style={styles.row}>
            <View style={styles.icon}>
              <Icon name={e.icon} size={16} color={colors.violet} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eTitle}>{e.title}</Text>
              <Text style={styles.eText}>{e.text}</Text>
            </View>
          </View>
        ))}
        {s.use.length > 0 && (
          <View style={styles.use}>
            <Text style={styles.useTitle}>Куда и как применять</Text>
            {s.use.map((u) => (
              <View key={u} style={styles.useRow}>
                <View style={styles.dot} />
                <Text style={styles.useText}>{u}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  opHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  opIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  frame: { borderRadius: 22, padding: 1.5, marginTop: 12 },
  card: { borderRadius: 21, backgroundColor: '#fff', padding: 14 },
  title: { fontFamily: fonts.display, fontSize: 15, letterSpacing: -0.5, color: colors.ink },
  lead: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink2, marginTop: 6 },
  row: { flexDirection: 'row', gap: 10, marginTop: 11 },
  icon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  eTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  eText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 1 },
  use: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line, gap: 6 },
  useTitle: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.violet },
  useRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lilac, marginTop: 6 },
  useText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.ink2 },
});

/**
 * One block for a scanned product: what it is and does, its strong side, what to watch, who it suits and how to use it.
 * Replaces the separate "Что даёт этот состав" and "Мнение технолога" cards, which repeated each other.
 */
export function TechnologistOpinion({ s, op }: { s: Summary; op: Opinion }) {
  const use = [...new Set([...s.use, ...op.tips])];
  return (
    <LinearGradient colors={['#C9B6FF', '#F1EDFF', '#EBC4F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}>
      <View style={styles.card}>
        <View style={styles.opHead}>
          <View style={styles.opIcon}>
            <Icon name="flask" size={16} color="#fff" strokeWidth={2} />
          </View>
          <Text style={styles.title}>Мнение технолога</Text>
        </View>
        <Text style={[styles.lead, { fontFamily: fonts.medium, color: colors.ink }]}>{s.lead}</Text>
        {s.effects.map((e) => (
          <View key={e.title} style={styles.row}>
            <View style={styles.icon}>
              <Icon name={e.icon} size={16} color={colors.violet} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eTitle}>{e.title}</Text>
              <Text style={styles.eText}>{e.text}</Text>
            </View>
          </View>
        ))}
        <Part title="Сильная сторона" text={op.strong} />
        {!!op.watch && <Part title="На что обратить внимание" text={op.watch} tone={colors.warn} />}
        {!!op.suits && <Part title="Кому подойдёт" text={op.suits} />}
        {use.length > 0 && (
          <View style={styles.use}>
            <Text style={styles.useTitle}>Как применять</Text>
            {use.map((u) => (
              <View key={u} style={styles.useRow}>
                <View style={styles.dot} />
                <Text style={styles.useText}>{u}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

function Part({ title, text, tone }: { title: string; text: string; tone?: string }) {
  return (
    <View style={styles.use}>
      <Text style={[styles.useTitle, tone ? { color: tone } : null]}>{title}</Text>
      <Text style={styles.useText}>{text}</Text>
    </View>
  );
}
