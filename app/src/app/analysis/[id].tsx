import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Hairline, Press, ScoreRing, T, Tag } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { FLAG_LABEL, FN_LABEL, Fn, ORIGIN_LABEL } from '../../data/ingredients';
import { AnalyzedItem, analyze } from '../../lib/analyze';
import { colors, fonts, radius, shadow, space } from '../../theme';

const FN_COLOR: Partial<Record<Fn, string>> = {
  base: '#CFC8B8',
  emollient: '#D8B57A',
  humectant: '#9DBFC4',
  active: '#B0822F',
  extract: '#93AE87',
  soothing: '#B7C58F',
  antioxidant: '#CF8F87',
  emulsifier: '#B6AECB',
  surfactant: '#8F9BB3',
  thickener: '#D9CFBF',
  preservative: '#A58468',
  fragrance: '#D5B4AE',
  film: '#A7B3BF',
  uv: '#E0CE78',
  exfoliant: '#C9A27A',
};
const RISK = [
  { label: 'Безопасно', color: colors.good },
  { label: 'Низкий риск', color: '#8FA06A' },
  { label: 'Умеренный риск', color: colors.warn },
  { label: 'Высокий риск', color: colors.bad },
];

export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getScan, removeScan } = useLibrary();
  const { user } = useAuth();
  const scan = getScan(id);
  const result = useMemo(() => (scan ? analyze(scan.text, user?.skinType) : null), [scan, user?.skinType]);
  const [open, setOpen] = useState<number | null>(null);

  const groups = useMemo(() => {
    if (!result) return [];
    const map = new Map<Fn | 'other', number>();
    for (const it of result.items) {
      const key = it.ing.fn[0] ?? 'other';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [result]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/scanner'));

  if (!scan || !result) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
        <Text style={styles.serif}>Анализ не найден</Text>
        <Press onPress={back}>
          <T v="label">Вернуться к сканеру</T>
        </Press>
      </View>
    );
  }

  const { scores } = result;
  const metrics = [
    { label: 'Натуральность', value: scores.natural },
    { label: 'Безопасность', value: scores.safety },
    { label: 'Эффективность', value: scores.efficacy },
    { label: 'Для пор', value: scores.pores },
  ];
  const total = result.items.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Press onPress={back} style={styles.round} accessibilityLabel="Назад">
          <Icon name="arrowLeft" size={20} />
        </Press>
        <T v="label" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
          {scan.title}
        </T>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: insets.bottom + 48, gap: space.xl }}>
        <View style={styles.hero}>
          <ScoreRing value={scores.overall} size={132} stroke={4} />
          <View style={{ alignItems: 'center', gap: 6 }}>
            <T v="label">Оценка Essola</T>
            <Text style={styles.verdict}>{result.verdict.title}</Text>
            <T style={{ textAlign: 'center', maxWidth: 300 }}>{result.verdict.text}</T>
          </View>
          <Hairline style={{ alignSelf: 'stretch', marginVertical: 4 }} />
          <View style={styles.metrics}>
            {metrics.map((m) => (
              <ScoreRing key={m.label} value={m.value} size={58} label={m.label} />
            ))}
          </View>
        </View>

        {!!result.freeFrom.length && (
          <View style={styles.tags}>
            {result.freeFrom.map((f) => (
              <Tag key={f} label={f} tone="good" />
            ))}
          </View>
        )}

        {result.personal.length > 0 ? (
          <View style={[styles.note, { backgroundColor: colors.goldSoft }]}>
            <View style={styles.noteHead}>
              <Icon name="user" size={15} color={colors.goldDeep} />
              <Text style={[styles.noteTitle, { color: colors.goldDeep }]}>Для вас</Text>
            </View>
            {result.personal.map((p) => (
              <T key={p} style={{ color: colors.ink2 }}>
                {p}
              </T>
            ))}
          </View>
        ) : (
          <Press onPress={() => router.push(user ? '/profile' : '/auth')} style={[styles.note, styles.noteOutline]}>
            <View style={styles.noteHead}>
              <Icon name="user" size={15} color={colors.goldDeep} />
              <Text style={[styles.noteTitle, { color: colors.goldDeep }]}>Персональный разбор</Text>
            </View>
            <T>Укажите тип кожи в кабинете — и Essola подсветит компоненты, которые подходят или мешают именно вам.</T>
          </Press>
        )}

        <View style={{ gap: 12 }}>
          <T v="label">Из чего состоит · {total} компонентов</T>
          <View style={styles.bar}>
            {groups.map(([fn, count]) => (
              <View key={fn} style={{ flex: count, backgroundColor: fn === 'other' ? colors.line2 : FN_COLOR[fn] ?? colors.line2 }} />
            ))}
          </View>
          <View style={styles.legend}>
            {groups.map(([fn, count]) => (
              <View key={fn} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: fn === 'other' ? colors.line2 : FN_COLOR[fn] ?? colors.line2 }]} />
                <Text style={styles.legendText}>
                  {fn === 'other' ? 'Не определено' : FN_LABEL[fn]} · {count}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {result.stars.length > 0 && (
          <View style={{ gap: 12 }}>
            <Text style={styles.h2}>
              Звёзды <Text style={styles.h2Serif}>состава</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginHorizontal: -space.gutter }}>
              <View style={{ width: space.gutter - 10 }} />
              {result.stars.map((it) => (
                <View key={it.ing.inci} style={styles.star}>
                  <Icon name="spark" size={18} color={colors.gold} />
                  <Text style={styles.starName}>{it.ing.ru || it.raw}</Text>
                  <T v="small" numberOfLines={4}>
                    {it.ing.note}
                  </T>
                </View>
              ))}
              <View style={{ width: space.gutter - 10 }} />
            </ScrollView>
          </View>
        )}

        {result.concerns.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.h2}>
              Обратите <Text style={styles.h2Serif}>внимание</Text>
            </Text>
            {result.concerns.map((it) => (
              <View key={it.ing.inci + it.position} style={styles.concern}>
                <View style={[styles.riskDot, { backgroundColor: RISK[it.ing.risk].color }]} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.concernName}>{it.ing.ru || it.raw}</Text>
                  <T v="small">{it.ing.note}</T>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ gap: 4 }}>
          <Text style={[styles.h2, { marginBottom: 8 }]}>
            Полный <Text style={styles.h2Serif}>разбор</Text>
          </Text>
          <View style={styles.list}>
            {result.items.map((it, i) => (
              <IngredientRow key={it.position} item={it} first={i === 0} open={open === i} onPress={() => setOpen(open === i ? null : i)} />
            ))}
          </View>
          {result.unknown > 0 && (
            <T v="small" style={{ marginTop: 10 }}>
              {result.unknown} компонент(ов) пока нет в базе — они учтены в оценке с пониженным весом.
            </T>
          )}
        </View>

        <T v="small" style={{ color: colors.faint }}>
          Оценка носит информационный характер и не заменяет консультацию дерматолога. Безопасность зависит от концентрации, которую производитель не указывает.
        </T>

        <Press
          onPress={() => {
            removeScan(scan.id);
            back();
          }}
          style={styles.delete}
        >
          <T v="label" style={{ color: colors.bad }}>
            Удалить из истории
          </T>
        </Press>
      </ScrollView>
    </View>
  );
}

function IngredientRow({ item, first, open, onPress }: { item: AnalyzedItem; first: boolean; open: boolean; onPress: () => void }) {
  const { ing } = item;
  const risk = RISK[ing.risk];
  return (
    <View>
      {!first && <Hairline />}
      <Press haptic={false} onPress={onPress} style={styles.row}>
        <Text style={styles.pos}>{String(item.position + 1).padStart(2, '0')}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowName} numberOfLines={open ? undefined : 1}>
            {ing.ru || item.raw}
          </Text>
          <Text style={styles.rowInci} numberOfLines={1}>
            {item.match === 'exact' || item.match === 'fuzzy' ? ing.inci : item.raw}
          </Text>
        </View>
        <Text style={styles.rowFn}>{ing.fn[0] ? FN_LABEL[ing.fn[0]] : '—'}</Text>
        <View style={[styles.riskDot, { backgroundColor: item.match === 'unknown' ? colors.line2 : risk.color }]} />
      </Press>
      {open && (
        <View style={styles.detail}>
          <T>{ing.note}</T>
          <View style={styles.tags}>
            {ing.fn.map((f) => (
              <Tag key={f} label={FN_LABEL[f]} tone="neutral" />
            ))}
            <Tag label={ORIGIN_LABEL[ing.origin]} tone={ing.origin === 'natural' || ing.origin === 'mineral' ? 'good' : 'neutral'} />
            {item.match !== 'unknown' && <Tag label={risk.label} tone={ing.risk >= 3 ? 'bad' : ing.risk >= 2 ? 'warn' : 'good'} />}
            {ing.com >= 2 && <Tag label={`Комедогенность ${ing.com}/5`} tone={ing.com >= 3 ? 'warn' : 'neutral'} />}
            {ing.flags.map((f) => (
              <Tag key={f} label={FLAG_LABEL[f]} tone="warn" />
            ))}
            {item.match === 'fuzzy' && <Tag label={`Распознано как ${ing.inci}`} tone="gold" />}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', gap: 16, backgroundColor: colors.bg },
  serif: { fontFamily: fonts.serif, fontSize: 30, color: colors.goldDeep },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.gutter, paddingBottom: 8 },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 24,
    paddingTop: 30,
    alignItems: 'center',
    gap: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
    ...shadow,
  },
  verdict: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, color: colors.goldDeep },
  metrics: { flexDirection: 'row', alignSelf: 'stretch', gap: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { borderRadius: radius.md, padding: 18, gap: 8 },
  noteOutline: { borderWidth: 1, borderColor: colors.line2, borderStyle: 'dashed' },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteTitle: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink2 },
  h2: { fontFamily: fonts.medium, fontSize: 22, letterSpacing: -0.6, color: colors.ink },
  h2Serif: { fontFamily: fonts.serif, fontSize: 25, color: colors.goldDeep },
  star: {
    width: 200,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
  },
  starName: { fontFamily: fonts.medium, fontSize: 15.5, color: colors.ink },
  concern: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
  },
  concernName: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  riskDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  list: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  pos: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.faint, width: 20 },
  rowName: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink },
  rowInci: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  rowFn: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, maxWidth: 96 },
  detail: { paddingLeft: 32, paddingBottom: 16, gap: 10 },
  delete: { alignSelf: 'center', padding: 12 },
});
