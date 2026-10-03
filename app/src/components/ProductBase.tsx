import { Image } from 'expo-image';
import { Hint } from './Hint';
import { router } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibrary } from '../context/LibraryContext';
import { catalogPage, searchProducts } from '../lib/ai';
import { analyze } from '../lib/analyze';
import { personalize } from '../lib/personal';
import { useProfile } from '../lib/profile';
import { colors, fonts, space, TAB_SPACE } from '../theme';
import { Icon } from './Icon';
import { ScoreBadge } from './ScoreBadge';
import { Brand, Glow } from './silk';
import { Press, tap } from './ui';

export type Found = { key: string; title: string; brand?: string; image?: string | null; text: string; source: string; barcode?: string; url?: string; /** the shop doesn't publish the composition */ none?: boolean };
type Sort = 'popular' | 'best' | 'worst';

const OBF = 'https://world.openbeautyfacts.org/cgi/search.pl';
const FIELDS = 'code,product_name,product_name_ru,brands,ingredients_text,ingredients_text_ru,ingredients_text_en,image_front_thumb_url,image_thumb_url,image_small_url';
const PAGE = 40;

// Category chips map to Open Beauty Facts category tags.
const CATS: { key: string; label: string; tag?: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'makeup', label: 'Макияж', tag: 'makeup' },
  { key: 'perfume', label: 'Парфюм', tag: 'perfume' },
  { key: 'face', label: 'Лицо', tag: 'face-creams' },
  { key: 'serum', label: 'Сыворотки', tag: 'serums' },
  { key: 'clean', label: 'Умывание', tag: 'face-cleansers' },
  { key: 'hair', label: 'Шампуни', tag: 'shampoos' },
  { key: 'body', label: 'Тело', tag: 'body-lotions' },
  { key: 'sun', label: 'SPF', tag: 'sunscreens' },
  { key: 'lips', label: 'Губы', tag: 'lip-balms' },
  { key: 'shower', label: 'Душ', tag: 'shower-gels' },
  { key: 'hairmask', label: 'Маски для волос', tag: 'hair-masks' },
  { key: 'deo', label: 'Дезодоранты', tag: 'deodorants' },
  { key: 'mask', label: 'Маски', tag: 'face-masks' },
  { key: 'hands', label: 'Руки', tag: 'hand-creams' },
  { key: 'teeth', label: 'Зубные пасты', tag: 'toothpastes' },
];

type OBFProduct = {
  code?: string;
  product_name?: string;
  product_name_ru?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients_text_ru?: string;
  ingredients_text_en?: string;
  image_front_thumb_url?: string;
  image_thumb_url?: string;
  image_small_url?: string;
};

/** One page of Open Beauty Facts: by text, by category, or the most scanned products when both are empty. */
export async function pageOBF(q: string, tag: string | undefined, page: number): Promise<Found[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  const params = [
    q ? `search_terms=${encodeURIComponent(q)}` : '',
    tag ? `tagtype_0=categories&tag_contains_0=contains&tag_0=${tag}` : '',
    'search_simple=1',
    'action=process',
    'json=1',
    `page=${page}`,
    `page_size=${PAGE}`,
    'sort_by=unique_scans_n',
    `fields=${FIELDS}`,
  ]
    .filter(Boolean)
    .join('&');
  try {
    const res = await fetch(`${OBF}?${params}`, { signal: ctrl.signal, headers: { 'User-Agent': 'Essola/1.0 (cosmetics composition app)' } });
    const json = (await res.json()) as { products?: OBFProduct[] };
    return (json.products ?? [])
      .map((p) => ({
        key: `obf:${p.code}`,
        title: p.product_name_ru || p.product_name || '',
        brand: p.brands?.split(',')[0]?.trim(),
        // Thumbnails (~100 px) load much faster than the regular photos.
        image: p.image_front_thumb_url || p.image_thumb_url || p.image_small_url || null,
        text: p.ingredients_text_ru || p.ingredients_text_en || p.ingredients_text || '',
        source: 'Open Beauty Facts',
        barcode: p.code,
      }))
      .filter((p) => p.title && p.text.length > 15);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/** Feed page: our pre-scored catalog first (fast, sorted on the server), Open Beauty Facts when it has nothing. */
export async function pageBase(q: string, tag: string | undefined, page: number, sort: Sort = 'popular'): Promise<{ list: Found[]; sorted: boolean }> {
  const c = await catalogPage(q, tag, sort, page);
  if (c && (c.total > 0 || page > 1)) {
    const list = c.items.map((x) => {
      const letu = x.k.startsWith('letu:');
      return { key: letu ? x.k : `obf:${x.k}`, title: x.t, brand: x.b || undefined, image: x.i || null, text: x.x, source: letu ? 'Летуаль' : 'Open Beauty Facts', barcode: letu ? undefined : x.k, url: x.u, none: !!x.z };
    });
    return { list, sorted: true };
  }
  return { list: await pageOBF(q, tag, page), sorted: false };
}

/** Product base: a feed from our shared base and Open Beauty Facts, infinite scroll, sorting and categories; scored on the device. */
export function ProductBase({ toggle }: { toggle: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { saveScan } = useLibrary();
  const { profile } = useProfile();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState<Sort>('popular');
  const [items, setItems] = useState<Found[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [end, setEnd] = useState(false);
  const [serverSorted, setServerSorted] = useState(false);
  const seq = useRef(0);
  const tag = CATS.find((c) => c.key === cat)?.tag;

  const load = useCallback(
    async (p: number) => {
      const my = ++seq.current;
      setBusy(true);
      const [ours, open] = await Promise.all([
        p === 1 && query
          ? searchProducts(query).then((list) =>
              list.map((x) => ({ key: `our:${x.url ?? x.title}`, title: x.title ?? 'Средство', image: x.image ?? null, text: `Ingredients: ${x.ingredients.join(', ')}`, source: 'База essola' })),
            )
          : Promise.resolve([] as Found[]),
        pageBase(query, tag, p, sort),
      ]);
      if (my !== seq.current) return;
      setServerSorted(open.sorted);
      setItems((prev) => {
        const all = p === 1 ? [...ours, ...open.list] : [...prev, ...open.list];
        const seen = new Set<string>();
        return all.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
      });
      setEnd(open.list.length === 0);
      setPage(p);
      setBusy(false);
    },
    [query, tag, sort],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  // Debounced search while typing.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim().length >= 2 ? q.trim() : ''), 600);
    return () => clearTimeout(t);
  }, [q]);

  const scored = useMemo(() => {
    const list = items
      .map((p) => {
        if (p.none) return { p, overall: 0, score: 0, me: null, n: 0, ok: true };
        const a = analyze(p.text);
        const me = personalize(a, profile);
        return { p, overall: a.scores.overall, score: me?.score ?? a.scores.overall, me, n: a.items.length, ok: !a.unreadable };
      })
      // Lists we can't read well (e.g. translated into French) would get a misleading score.
      .filter((x) => x.ok);
    // The catalog arrives sorted by overall score; re-sorting by personal score would reshuffle pages.
    if (serverSorted) return list;
    if (sort === 'best') return [...list].sort((a, b) => b.score - a.score);
    if (sort === 'worst') return [...list].sort((a, b) => a.score - b.score);
    return list;
  }, [items, profile, sort, serverSorted]);

  const open = (p: Found, overall: number) => {
    tap();
    if (p.none) {
      Alert.alert(p.title, 'Магазин не публикует состав этого средства. Его можно посмотреть на упаковке и отсканировать — оценка появится сразу.', [
        { text: 'Сканировать состав', onPress: () => router.navigate('/scanner') },
        ...(p.url ? [{ text: 'Открыть в Летуаль', onPress: () => Linking.openURL(p.url!).catch(() => {}) }] : []),
        { text: 'Закрыть', style: 'cancel' as const },
      ]);
      return;
    }
    const scan = saveScan({ title: [p.brand, p.title].filter(Boolean).join(' · '), text: p.text, overall, barcode: p.barcode, source: p.source, image: p.image, url: p.url });
    router.push(`/analysis/${scan.id}`);
  };

  const header = (
    <View style={{ paddingTop: insets.top + 10 }}>
      <Brand />
      {toggle}
      <Hint id="base" title="База средств" text="Ищите кремы, шампуни и сыворотки по названию. Оценка состава считается сразу, а с заполненной анкетой — персонально для вас." />
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => Keyboard.dismiss()}
          returnKeyType="search"
          placeholder="Название или бренд: CeraVe, La Roche…"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
        {busy && page === 1 && <ActivityIndicator color={colors.violet} />}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter, marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 6 }}>
        {CATS.map((c) => (
          <Press key={c.key} haptic={false} onPress={() => { tap(); setCat(c.key); }} style={[styles.chip, cat === c.key && styles.chipOn]}>
            <Text style={[styles.chipText, cat === c.key && styles.chipTextOn]}>{c.label}</Text>
          </Press>
        ))}
      </ScrollView>
      <View style={styles.sorts}>
        {(
          [
            ['popular', 'Популярные'],
            ['best', 'Оценка ↓'],
            ['worst', 'Оценка ↑'],
          ] as const
        ).map(([k, l]) => (
          <Press key={k} haptic={false} onPress={() => { tap(); setSort(k); }} style={[styles.sort, sort === k && styles.sortOn]}>
            <Text style={[styles.sortText, sort === k && { color: colors.violet, fontFamily: fonts.semibold }]}>{l}</Text>
          </Press>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <FlatList
        data={scored}
        keyExtractor={(x) => x.p.key}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: TAB_SPACE }}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (!busy && !end && items.length) load(page + 1);
        }}
        initialNumToRender={10}
        windowSize={7}
        ListEmptyComponent={
          busy ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Ничего не нашли — попробуйте название на латинице или отсканируйте средство: оно попадёт в базу.</Text>
            </View>
          )
        }
        ListFooterComponent={busy && page >= 1 && items.length ? <ActivityIndicator color={colors.violet} style={{ marginVertical: 18 }} /> : null}
        renderItem={({ item: { p, overall, score, me, n } }) => (
          <Press haptic={false} onPress={() => open(p, overall)} style={styles.row}>
            {p.image ? (
              <Image source={{ uri: p.image }} style={styles.img} contentFit="cover" cachePolicy="memory-disk" transition={150} />
            ) : (
              <View style={[styles.img, styles.noImg]}>
                <Icon name="drop" size={20} color={colors.faint} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              {!!p.brand && (
                <Text style={styles.brand} numberOfLines={1}>
                  {p.brand}
                </Text>
              )}
              <Text style={styles.title} numberOfLines={2}>
                {p.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {p.none ? 'Состав недоступен' : `${n} ингр.${me ? ` · ${me.label.toLowerCase()}` : ''}`}
              </Text>
            </View>
            {p.none ? (
              <View style={styles.noScore}>
                <Text style={styles.noScoreText}>—</Text>
              </View>
            ) : (
              <ScoreBadge value={score} size={46} />
            )}
          </Press>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  noScore: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F1F2F7', alignItems: 'center', justifyContent: 'center' },
  noScoreText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.muted },
  search: { marginTop: 14, height: 50, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 99, backgroundColor: colors.surf, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink2 },
  chipTextOn: { color: colors.onDark, fontFamily: fonts.semibold },
  sorts: { flexDirection: 'row', gap: 16, marginTop: 12, marginBottom: 4 },
  sort: { paddingVertical: 4 },
  sortOn: { borderBottomWidth: 2, borderColor: colors.violet },
  sortText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6F7' },
  img: { width: 58, height: 58, borderRadius: 14, backgroundColor: colors.surf },
  noImg: { alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.violet, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  empty: { marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: '#F4F0FF' },
  emptyText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
});
