import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { ScoreBadge } from '../components/ScoreBadge';
import { Glow } from '../components/silk';
import { IconButton, Press, tap } from '../components/ui';
import { useLibrary } from '../context/LibraryContext';
import { Analysis, AnalyzedItem, analyze, normalize } from '../lib/analyze';
import { aiEnabled, catalogPage, CatalogItem } from '../lib/ai';
import { colors, fonts, scoreColor, space } from '../theme';

/** One side of the comparison: any composition with a name (a saved scan, a base product, pasted text). */
type Side = { title: string; text: string; image?: string | null };

const ROWS: [keyof Analysis['scores'], string][] = [
  ['overall', 'Общая оценка'],
  ['safety', 'Безопасность'],
  ['efficacy', 'Активные компоненты'],
  ['natural', 'Натуральность'],
  ['pores', 'Не забивает поры'],
];
const ROW_WORD: Record<string, string> = { safety: 'безопаснее', efficacy: 'больше активов', natural: 'натуральнее', pores: 'меньше комедогенных' };

const keyOf = (it: AnalyzedItem) => (it.match === 'unknown' ? normalize(it.raw) : it.ing.inci);
const nameOf = (it: AnalyzedItem) => it.ing.ru || (it.match === 'guess' || it.match === 'unknown' ? it.raw : it.ing.inci);
const fromItem = (x: CatalogItem): Side => ({ title: [x.b, x.t].filter(Boolean).join(' · '), text: x.x, image: x.i || null });

/**
 * Two products side by side. Everything is computed on the phone by the same analyzer as the product card —
 * no AI request, so comparing costs nothing and works offline for saved scans.
 */
export default function CompareScreen() {
  const insets = useSafeAreaInsets();
  const { a: aId } = useLocalSearchParams<{ a?: string }>();
  const { getScan, scans } = useLibrary();
  const first = aId ? getScan(aId) : undefined;
  const [a, setA] = useState<Side | null>(first ? { title: first.title, text: first.text, image: first.image } : null);
  const [b, setB] = useState<Side | null>(null);
  // Which side the picker fills: the first one only when the screen was opened without a product.
  const picking = !a ? 'a' : !b ? 'b' : null;

  const ra = useMemo(() => (a ? analyze(a.text) : null), [a]);
  const rb = useMemo(() => (b ? analyze(b.text) : null), [b]);

  const choose = (s: Side) => {
    tap('success');
    if (picking === 'a') setA(s);
    else setB(s);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/scanner'))} />
          <Text style={styles.topTitle}>Сравнение</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.heads}>
          <Head side={a} result={ra} onChange={() => { setA(null); setB(b); }} />
          <Text style={styles.vs}>vs</Text>
          <Head side={b} result={rb} onChange={() => setB(null)} />
        </View>

        {picking ? (
          <Picker key={picking} title={picking === 'a' ? 'Выберите первое средство' : 'С чем сравнить?'} scans={scans.filter((s) => s.id !== aId)} onPick={choose} />
        ) : (
          ra && rb && a && b && <Result a={a} b={b} ra={ra} rb={rb} />
        )}
      </ScrollView>
    </View>
  );
}

function Head({ side, result, onChange }: { side: Side | null; result: Analysis | null; onChange: () => void }) {
  if (!side || !result)
    return (
      <View style={[styles.head, styles.headEmpty]}>
        <Icon name="plus" size={22} color={colors.violet} />
        <Text style={styles.headHint}>Выберите средство</Text>
      </View>
    );
  return (
    <Press haptic={false} onPress={onChange} style={styles.head} accessibilityLabel="Заменить средство">
      <View style={styles.photo}>
        {side.image ? <Image source={{ uri: side.image }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" /> : <Icon name="drop" size={26} color={colors.faint} />}
      </View>
      <Text style={styles.headTitle} numberOfLines={3}>{side.title}</Text>
      <ScoreBadge value={result.scores.overall} size={46} />
      <Text style={styles.change}>Заменить</Text>
    </Press>
  );
}

function Picker({ title, scans, onPick }: { title: string; scans: { id: string; title: string; text: string; image?: string | null; overall: number }[]; onPick: (s: Side) => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<CatalogItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState('');

  // Base search as the person types (short pause, so a word isn't searched letter by letter).
  useEffect(() => {
    if (!aiEnabled || q.trim().length < 3) return setFound(null);
    const t = setTimeout(() => {
      setBusy(true);
      catalogPage(q.trim(), undefined, 'popular', 1)
        .then((r) => setFound((r?.items ?? []).filter((x) => x.x && !x.z).slice(0, 8)))
        .catch(() => setFound([]))
        .finally(() => setBusy(false));
    }, 450);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <View style={{ marginTop: 18, gap: 10 }}>
      <Text style={styles.section}>{title}</Text>
      {aiEnabled && (
        <View style={styles.search}>
          <Icon name="search" size={16} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Найти в базе: бренд и название" placeholderTextColor={colors.faint} style={styles.input} returnKeyType="search" />
          {busy && <ActivityIndicator color={colors.violet} />}
        </View>
      )}
      {found?.map((x) => (
        <Press key={x.k} onPress={() => onPick(fromItem(x))} style={styles.row}>
          <ScoreBadge value={x.s} size={36} />
          <View style={{ flex: 1 }}>
            {!!x.b && <Text style={styles.rowBrand} numberOfLines={1}>{x.b}</Text>}
            <Text style={styles.rowTitle} numberOfLines={2}>{x.t}</Text>
          </View>
        </Press>
      ))}
      {found && !found.length && !busy && <Text style={styles.muted}>В базе не нашли — попробуйте другое название.</Text>}

      {!found && scans.length > 0 && (
        <>
          <Text style={styles.sub}>Из истории проверок</Text>
          {scans.slice(0, 12).map((s) => (
            <Press key={s.id} onPress={() => onPick({ title: s.title, text: s.text, image: s.image })} style={styles.row}>
              <ScoreBadge value={s.overall} size={36} />
              <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={2}>{s.title}</Text>
            </Press>
          ))}
        </>
      )}

      <Text style={styles.sub}>Или вставьте состав</Text>
      <View style={styles.pasteBox}>
        <TextInput value={paste} onChangeText={setPaste} multiline placeholder="Aqua, Glycerin, Niacinamide…" placeholderTextColor={colors.faint} style={styles.paste} />
        {paste.trim().length > 10 && (
          <Press onPress={() => onPick({ title: 'Вставленный состав', text: paste })} style={styles.pasteGo}>
            <Text style={styles.pasteGoText}>Сравнить</Text>
          </Press>
        )}
      </View>
    </View>
  );
}

function Result({ a, b, ra, rb }: { a: Side; b: Side; ra: Analysis; rb: Analysis }) {
  const ka = new Map(ra.items.map((it) => [keyOf(it), it]));
  const kb = new Map(rb.items.map((it) => [keyOf(it), it]));
  const common = ra.items.filter((it) => kb.has(keyOf(it)));
  const onlyA = ra.items.filter((it) => !kb.has(keyOf(it)));
  const onlyB = rb.items.filter((it) => !ka.has(keyOf(it)));
  const short = (t: string) => t.split(' · ').pop()!.slice(0, 40);

  // The verdict in plain words, from the scores alone.
  const diff = ra.scores.overall - rb.scores.overall;
  const lead = diff >= 0 ? ra : rb;
  const lag = diff >= 0 ? rb : ra;
  const wins = (Object.keys(ROW_WORD) as (keyof Analysis['scores'])[]).filter((k) => lead.scores[k] - lag.scores[k] >= 8).map((k) => ROW_WORD[k]);
  const verdict =
    Math.abs(diff) < 4
      ? 'Составы примерно на одном уровне — выбирайте по текстуре, цене и задачам.'
      : `Состав «${short(diff >= 0 ? a.title : b.title)}» сильнее${wins.length ? `: ${wins.slice(0, 3).join(', ')}` : ''}.`;
  const overlap = Math.round((common.length / Math.max(1, Math.min(ra.items.length, rb.items.length))) * 100);

  return (
    <View style={{ marginTop: 18, gap: 14 }}>
      <View style={styles.verdict}>
        <Text style={styles.verdictText}>{verdict}</Text>
        <Text style={styles.verdictSub}>Составы совпадают на {overlap}% · общих компонентов: {common.length}</Text>
      </View>

      <View style={styles.card}>
        {ROWS.map(([k, label]) => {
          const x = ra.scores[k];
          const y = rb.scores[k];
          return (
            <View key={k} style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{label}</Text>
              <View style={styles.bars}>
                <Bar value={x} win={x > y + 2} flip />
                <Bar value={y} win={y > x + 2} />
              </View>
            </View>
          );
        })}
      </View>

      <Group title={`Только в «${short(a.title)}»`} items={onlyA} />
      <Group title={`Только в «${short(b.title)}»`} items={onlyB} />
      <Group title="Общие компоненты" items={common} />
      <Text style={styles.muted}>Сравнение считается по составу в телефоне, без запросов к ИИ. Порядок ингредиентов учитывается: то, что ближе к началу, весит больше.</Text>
    </View>
  );
}

function Bar({ value, win, flip }: { value: number; win: boolean; flip?: boolean }) {
  return (
    <View style={[styles.bar, flip && { flexDirection: 'row-reverse' }]}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(4, value)}%`, backgroundColor: scoreColor(value), opacity: win ? 1 : 0.45 }, flip && { alignSelf: 'flex-end' }]} />
      </View>
      <Text style={[styles.num, win && { color: colors.ink, fontFamily: fonts.bold }]}>{value}</Text>
    </View>
  );
}

function Group({ title, items }: { title: string; items: AnalyzedItem[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.groupTitle}>
        {title} <Text style={styles.count}>{items.length}</Text>
      </Text>
      <View style={styles.chips}>
        {items.slice(0, 30).map((it) => {
          const good = it.ing.act >= 2;
          const bad = it.ing.risk >= 2;
          return (
            <View key={keyOf(it)} style={[styles.chip, good && styles.chipGood, bad && styles.chipBad]}>
              <Text style={[styles.chipText, good && { color: colors.good }, bad && { color: colors.bad }]} numberOfLines={1}>
                {nameOf(it)}
              </Text>
            </View>
          );
        })}
        {items.length > 30 && <Text style={styles.muted}>и ещё {items.length - 30}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  heads: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 8 },
  vs: { alignSelf: 'center', fontFamily: fonts.semibold, fontSize: 13, color: colors.faint },
  head: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 12, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#EEEAF7' },
  headEmpty: { justifyContent: 'center', minHeight: 190, borderStyle: 'dashed', borderColor: '#CFC6F2', backgroundColor: '#F7F4FF' },
  headHint: { fontFamily: fonts.medium, fontSize: 13, color: colors.violet },
  photo: { width: 74, height: 74, borderRadius: 14, backgroundColor: '#F6F4FA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headTitle: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: colors.ink, textAlign: 'center', minHeight: 34 },
  change: { fontFamily: fonts.medium, fontSize: 12, color: colors.violet },
  section: { fontFamily: fonts.display, fontSize: 21, letterSpacing: -0.5, color: colors.ink },
  sub: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: '#E4E1F1' },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#EEEAF7' },
  rowBrand: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted },
  rowTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  pasteBox: { backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E4E1F1', gap: 8 },
  paste: { minHeight: 70, fontFamily: fonts.regular, fontSize: 14, color: colors.ink, textAlignVertical: 'top' },
  pasteGo: { alignSelf: 'flex-end', backgroundColor: colors.violet, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  pasteGoText: { fontFamily: fonts.semibold, fontSize: 14, color: '#fff' },
  verdict: { backgroundColor: '#EEE9FF', borderRadius: 20, padding: 16, gap: 4 },
  verdictText: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.violetDeep },
  verdictSub: { fontFamily: fonts.regular, fontSize: 13, color: '#5D5480' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 14, gap: 12, borderWidth: 1, borderColor: '#EEEAF7' },
  scoreRow: { gap: 6 },
  scoreLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, textAlign: 'center' },
  bars: { flexDirection: 'row', gap: 10 },
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F1EEF8', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  num: { width: 26, textAlign: 'center', fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  groupTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  count: { fontFamily: fonts.regular, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#F4F2F9', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '100%' },
  chipGood: { backgroundColor: '#E6F5EC' },
  chipBad: { backgroundColor: '#FDE8E8' },
  chipText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink },
});
