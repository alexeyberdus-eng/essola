import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Hero } from './Hero';
import { router } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibrary } from '../context/LibraryContext';
import { catalogPage, searchProducts } from '../lib/ai';
import { BaseIngredient, ingredientSlug, onBaseIngredient, takePendingIngredient } from '../lib/baseIngredient';
import { analyze, normalize } from '../lib/analyze';
import { INGREDIENTS } from '../data/ingredients';
import { personalize } from '../lib/personal';
import { readJSON, writeJSON } from '../lib/storage';
import { useProfile } from '../lib/profile';
import { colors, fonts, LAVENDER, space, TAB_SPACE } from '../theme';
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
export async function pageBase(q: string, tag: string | undefined, page: number, sort: Sort = 'popular', ing?: string): Promise<{ list: Found[]; sorted: boolean }> {
  const c = await catalogPage(q, tag, sort, page, ing);
  // With an ingredient chosen only our base can answer (Open Beauty Facts has no such filter).
  if (c && (c.total > 0 || page > 1 || ing)) {
    const list = c.items.map((x) => {
      const letu = x.k.startsWith('letu:');
      const inci = x.k.startsWith('inci:');
      return { key: letu || inci ? x.k : `obf:${x.k}`, title: x.t, brand: x.b || undefined, image: x.i || null, text: x.x, source: letu ? 'Летуаль' : inci ? 'База essola' : 'Open Beauty Facts', barcode: letu || inci ? undefined : x.k, url: x.u || undefined, none: !!x.z };
    });
    return { list, sorted: true };
  }
  return { list: await pageOBF(q, tag, page), sorted: false };
}

/** Warms the server and fills the saved first page so «База средств» opens instantly. Called once at app start. */
export function prefetchBase() {
  // All three orders, so switching «Оценка ↓ / ↑» shows a ready list at once.
  for (const sort of ['popular', 'best', 'worst'] as Sort[])
    pageBase('', undefined, 1, sort)
      .then((r) => {
        if (r.list.length) writeJSON(`essola.base.||${sort}`, r.list.slice(0, 40));
      })
      .catch(() => {});
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
  // «Средства с ингредиентом»: chosen here or handed over from an ingredient page.
  const [ing, setIng] = useState<BaseIngredient | null>(() => takePendingIngredient());
  const [ingQ, setIngQ] = useState<string | null>(null);
  useEffect(() => onBaseIngredient((x) => {
    takePendingIngredient();
    setIng(x);
  }), []);
  const ingFound = useMemo(() => {
    const n = normalize(ingQ ?? '');
    if (n.length < 2) return [];
    return INGREDIENTS.filter((i) => [i.ru, i.inci, ...i.aliases].some((t) => normalize(t).includes(n))).slice(0, 6);
  }, [ingQ]);
  const seq = useRef(0);
  const tag = CATS.find((c) => c.key === cat)?.tag;

  const load = useCallback(
    async (p: number) => {
      const my = ++seq.current;
      setBusy(true);
      // First page: show the last saved copy at once, then refresh it from the server.
      const cacheKey = `essola.base.${query}|${tag ?? ''}|${sort}${ing ? `|${ing.slug}` : ''}`;
      if (p === 1) {
        const saved = await readJSON<Found[] | null>(cacheKey, null);
        if (saved?.length && my === seq.current) {
          setItems(saved);
          setPage(1);
          setEnd(false);
        }
      }
      const [ours, open] = await Promise.all([
        p === 1 && query && !ing
          ? searchProducts(query).then((list) =>
              list.map((x) => ({ key: `our:${x.url ?? x.title}`, title: x.title ?? 'Средство', image: x.image ?? null, text: `Ingredients: ${x.ingredients.join(', ')}`, source: 'База essola' })),
            )
          : Promise.resolve([] as Found[]),
        pageBase(query, tag, p, sort, ing?.slug),
      ]);
      if (my !== seq.current) return;
      setServerSorted(open.sorted);
      setItems((prev) => {
        const all = p === 1 ? [...ours, ...open.list] : [...prev, ...open.list];
        const seen = new Set<string>();
        return all.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
      });
      setEnd(open.list.length === 0);
      if (p === 1 && open.list.length) writeJSON(cacheKey, [...ours, ...open.list].slice(0, 40));
      setPage(p);
      setBusy(false);
    },
    [query, tag, sort, ing],
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
      router.push({ pathname: '/item', params: { title: p.title, brand: p.brand ?? '', image: p.image ?? '', url: p.url ?? '' } } as never);
      return;
    }
    const scan = saveScan({ title: [p.brand, p.title].filter(Boolean).join(' · '), text: p.text, overall, barcode: p.barcode, source: p.source, image: p.image, url: p.url });
    router.push(`/analysis/${scan.id}`);
  };

  const header = (
    <View style={{ paddingTop: insets.top + 10 }}>
      <Brand />
      {toggle}
      <Hero kicker="База средств essola" title="Крупнейшая база косметических средств" text="Очень много кремов, сывороток, парфюмов и средств макияжа с оценкой состава — и персонально под вашу анкету." tone="sky" />
      <Press onPress={() => { tap(); router.push('/match' as never); }} style={styles.matchBtn} accessibilityLabel="Подбор средств">
        <LinearGradient colors={LAVENDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Icon name="spark" size={17} color="#fff" />
        <Text style={styles.matchText}>Подбор средств под мои цели</Text>
      </Press>
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
      {ing ? (
        <Press haptic={false} onPress={() => { tap(); setIng(null); }} style={styles.ingChip} accessibilityLabel="Убрать ингредиент">
          <Text style={styles.ingChipText} numberOfLines={1}>С ингредиентом: {ing.label}</Text>
          <Icon name="close" size={14} color="#fff" />
        </Press>
      ) : ingQ === null ? (
        <Press haptic={false} onPress={() => { tap(); setIngQ(''); }} style={styles.ingAdd}>
          <Icon name="plus" size={15} color={colors.violet} />
          <Text style={styles.ingAddText}>Найти средства с ингредиентом</Text>
        </Press>
      ) : (
        <View style={{ marginTop: 10 }}>
          <View style={styles.search}>
            <Icon name="flask" size={17} color={colors.muted} />
            <TextInput
              value={ingQ}
              onChangeText={setIngQ}
              autoFocus
              placeholder="Ингредиент: ниацинамид, ретинол, пептиды…"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
            <Press haptic={false} onPress={() => setIngQ(null)} accessibilityLabel="Закрыть">
              <Icon name="close" size={16} color={colors.muted} />
            </Press>
          </View>
          {ingFound.map((i) => (
            <Press
              key={i.inci}
              haptic={false}
              onPress={() => {
                tap();
                Keyboard.dismiss();
                setIng({ slug: ingredientSlug(i.inci), label: i.ru || i.inci });
                setIngQ(null);
              }}
              style={styles.ingRow}
            >
              <Text style={styles.ingRowRu}>{i.ru}</Text>
              <Text style={styles.ingRowInci} numberOfLines={1}>{i.inci}</Text>
            </Press>
          ))}
        </View>
      )}
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
  matchBtn: { marginTop: 12, height: 50, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  matchText: { fontFamily: fonts.semibold, fontSize: 15, color: '#fff' },
  noScore: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F1F2F7', alignItems: 'center', justifyContent: 'center' },
  noScoreText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.muted },
  search: { marginTop: 14, height: 50, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 99, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink2 },
  chipTextOn: { color: colors.onDark, fontFamily: fonts.semibold },
  sorts: { flexDirection: 'row', gap: 16, marginTop: 12, marginBottom: 4 },
  ingAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: colors.tint },
  ingAddText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  ingChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', marginTop: 10, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, backgroundColor: colors.violet },
  ingChipText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13, color: '#fff' },
  ingRow: { paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  ingRowRu: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  ingRowInci: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
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
