import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Button, IconButton, MetricTable, Press, ScoreStrip, Seg, T, Tag } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { FLAG_LABEL, FN_LABEL, ORIGIN_LABEL } from '../../data/ingredients';
import { AnalyzedItem, analyze } from '../../lib/analyze';
import { colors, fonts, radius, space } from '../../theme';

type Filter = 'all' | 'active' | 'risk' | 'allergen';
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
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<number | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!scan || !result) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 80 }]}>
        <T v="heading">Разбор не найден</T>
        <Press onPress={back}>
          <T v="label">Назад</T>
        </Press>
      </View>
    );
  }

  const { scores, items } = result;
  const groups: Record<Filter, AnalyzedItem[]> = {
    all: items,
    active: items.filter((it) => it.ing.act >= 2),
    risk: items.filter((it) => it.ing.risk >= 2 || (it.ing.risk >= 1 && it.ing.flags.some((f) => f !== 'allergen'))),
    allergen: items.filter((it) => it.ing.flags.includes('allergen')),
  };
  const shown = groups[filter];
  const verdictTone = scores.overall >= 68 ? 'good' : scores.overall >= 50 ? 'warn' : 'bad';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="arrowLeft" label="Назад" onPress={back} />
        <Text style={styles.navTitle}>Разбор</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <T v="label" numberOfLines={1}>
          {scan.title} · {items.length} компонентов
        </T>
        <View style={styles.scoreRow}>
          <Text style={styles.big}>
            {scores.overall}
            <Text style={styles.bigOf}> /100</Text>
          </Text>
          <View style={{ flex: 1, gap: 6, paddingBottom: 6 }}>
            <Tag label={result.verdict.title} tone={verdictTone} />
            <T v="small">{result.verdict.text}</T>
          </View>
        </View>
        <ScoreStrip value={scores.overall} />

        <View style={{ marginTop: 10 }}>
          <MetricTable
            rows={[
              ['Безопасность', scores.safety],
              ['Эффективность', scores.efficacy],
              ['Натуральность', scores.natural],
              ['Для пор', scores.pores],
            ]}
          />
        </View>

        {!!result.freeFrom.length && (
          <View style={styles.tags}>
            {result.freeFrom.map((f) => (
              <Tag key={f} label={f} tone="good" />
            ))}
          </View>
        )}

        {result.personal.length > 0 ? (
          <View style={styles.personal}>
            <View style={styles.personalHead}>
              <Icon name="user" size={15} color={colors.honeyText} />
              <Text style={styles.personalTitle}>Для вашей кожи</Text>
            </View>
            {result.personal.map((p) => (
              <T key={p} style={{ fontSize: 14, lineHeight: 20 }}>
                {p}
              </T>
            ))}
          </View>
        ) : (
          <Press onPress={() => router.push(user ? '/profile' : '/auth')} style={[styles.personal, styles.personalGhost]}>
            <View style={styles.personalHead}>
              <Icon name="user" size={15} color={colors.honeyText} />
              <Text style={styles.personalTitle}>Персональный разбор</Text>
            </View>
            <T style={{ fontSize: 14, lineHeight: 20 }}>Укажите тип кожи в кабинете — и Essola подсветит, что подходит именно вам.</T>
          </Press>
        )}

        <View style={{ marginTop: space.xl, marginBottom: 6 }}>
          <Seg
            small
            inset={space.gutter}
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setOpen(null);
            }}
            options={[
              { key: 'all', label: `Все ${groups.all.length}` },
              { key: 'active', label: `Активы ${groups.active.length}` },
              { key: 'risk', label: `Риски ${groups.risk.length}` },
              { key: 'allergen', label: `Аллергены ${groups.allergen.length}` },
            ]}
          />
        </View>

        {shown.length ? (
          shown.map((it) => <Row key={it.position} item={it} open={open === it.position} onPress={() => setOpen(open === it.position ? null : it.position)} />)
        ) : (
          <T v="small" style={{ paddingVertical: 20, textAlign: 'center' }}>
            {filter === 'active' ? 'Сильных активов в составе нет.' : 'Таких компонентов нет — отлично.'}
          </T>
        )}

        {result.unknown > 0 && (
          <T v="small" style={{ marginTop: 12 }}>
            {result.unknown} компонент(ов) пока нет в базе — они учтены в оценке с пониженным весом.
          </T>
        )}
        <Button label="Найти аналоги дешевле" icon="swap" onPress={() => router.push({ pathname: '/analogs', params: { scan: scan.id } })} style={{ marginTop: 22 }} />
        <T v="small" style={{ marginTop: 20, color: colors.faint }}>
          Оценка информационная и не заменяет консультацию дерматолога: концентрации производитель обычно не указывает.
        </T>
        <Press
          onPress={() => {
            removeScan(scan.id);
            back();
          }}
          style={{ alignSelf: 'center', padding: 14, marginTop: 8 }}
        >
          <T v="label" style={{ color: colors.bad }}>
            Удалить из истории
          </T>
        </Press>
      </ScrollView>
    </View>
  );
}

function Row({ item, open, onPress }: { item: AnalyzedItem; open: boolean; onPress: () => void }) {
  const { ing } = item;
  const risk = RISK[ing.risk];
  const known = item.match !== 'unknown';
  return (
    <View style={styles.rowWrap}>
      <Press haptic={false} onPress={onPress} style={styles.row}>
        <Text style={styles.pos}>{String(item.position + 1).padStart(2, '0')}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name} numberOfLines={open ? undefined : 1}>
            {ing.ru || item.raw}
          </Text>
          <Text style={styles.inci} numberOfLines={1}>
            {known && item.match !== 'guess' ? ing.inci : item.raw}
          </Text>
        </View>
        <Text style={styles.fn}>{ing.fn[0] ? FN_LABEL[ing.fn[0]] : '—'}</Text>
        <View style={[styles.dot, { backgroundColor: known ? risk.color : colors.line }]} />
      </Press>
      {open && (
        <View style={styles.detail}>
          <T style={{ fontSize: 14, lineHeight: 20 }}>{ing.note}</T>
          <View style={styles.tags}>
            {ing.fn.map((f) => (
              <Tag key={f} label={FN_LABEL[f]} />
            ))}
            <Tag label={ORIGIN_LABEL[ing.origin]} tone={ing.origin === 'natural' || ing.origin === 'mineral' ? 'good' : 'neutral'} />
            {known && <Tag label={risk.label} tone={ing.risk >= 3 ? 'bad' : ing.risk >= 2 ? 'warn' : 'good'} />}
            {ing.com >= 2 && <Tag label={`Комедогенность ${ing.com}/5`} tone={ing.com >= 3 ? 'warn' : 'neutral'} />}
            {ing.flags.map((f) => (
              <Tag key={f} label={FLAG_LABEL[f]} tone="warn" />
            ))}
            {item.match === 'fuzzy' && <Tag label={`Исправлено: ${item.raw} → ${ing.inci}`} tone="honey" />}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', gap: 14, backgroundColor: colors.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 14 },
  navTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 10 },
  big: { fontFamily: fonts.semibold, fontSize: 64, lineHeight: 66, letterSpacing: -3.5, color: colors.ink },
  bigOf: { fontFamily: fonts.mono, fontSize: 15, letterSpacing: 0, color: colors.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  personal: { marginTop: 16, backgroundColor: colors.honeySoft, borderRadius: radius.lg, padding: 16, gap: 6 },
  personalGhost: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.honeyLine },
  personalHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  personalTitle: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.honeyText },
  rowWrap: { borderBottomWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  pos: { width: 20, fontFamily: fonts.monoMedium, fontSize: 11, color: colors.muted },
  name: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  inci: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  fn: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, maxWidth: 100 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  detail: { paddingLeft: 32, paddingBottom: 14 },
});
