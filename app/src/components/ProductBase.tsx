import { router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibrary } from '../context/LibraryContext';
import { searchProducts } from '../lib/ai';
import { analyze } from '../lib/analyze';
import { personalize } from '../lib/personal';
import { useProfile } from '../lib/profile';
import { colors, fonts, scoreColor, space, TAB_SPACE } from '../theme';
import { Icon } from './Icon';
import { Ring } from './lab';
import { Brand, FadeIn, Glow } from './silk';
import { Press, tap } from './ui';

type Found = { key: string; title: string; brand?: string; image?: string | null; text: string; source: string; barcode?: string };

const OBF = 'https://world.openbeautyfacts.org/cgi/search.pl';
const FIELDS = 'code,product_name,product_name_ru,brands,ingredients_text,ingredients_text_ru,ingredients_text_en,image_small_url';

type OBFProduct = { code?: string; product_name?: string; product_name_ru?: string; brands?: string; ingredients_text?: string; ingredients_text_ru?: string; ingredients_text_en?: string; image_small_url?: string };

/** Open Beauty Facts full-text search: products with an ingredient list only. */
async function searchOBF(q: string): Promise<Found[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`${OBF}?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&fields=${FIELDS}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Essola/1.0 (cosmetics composition app)' },
    });
    const json = (await res.json()) as { products?: OBFProduct[] };
    return (json.products ?? [])
      .map((p) => {
        const text = p.ingredients_text_ru || p.ingredients_text_en || p.ingredients_text || '';
        const title = p.product_name_ru || p.product_name || '';
        return { key: `obf:${p.code}`, title, brand: p.brands?.split(',')[0]?.trim(), image: p.image_small_url ?? null, text, source: 'Open Beauty Facts', barcode: p.code };
      })
      .filter((p) => p.title && p.text.length > 15);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/** Search across our shared base and Open Beauty Facts; every result is scored on the device. */
export function ProductBase({ toggle }: { toggle: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { saveScan } = useLibrary();
  const { profile } = useProfile();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Found[] | null>(null);
  const seq = useRef(0);

  const run = async (text: string) => {
    const query = text.trim();
    if (query.length < 2) return;
    Keyboard.dismiss();
    const my = ++seq.current;
    setBusy(true);
    const [ours, open] = await Promise.all([
      searchProducts(query).then((list) =>
        list.map((p) => ({ key: `our:${p.url ?? p.title}`, title: p.title ?? 'Средство', image: p.image ?? null, text: `Ingredients: ${p.ingredients.join(', ')}`, source: 'База essola' })),
      ),
      searchOBF(query),
    ]);
    if (my !== seq.current) return;
    setItems([...ours, ...open]);
    setBusy(false);
  };

  // Debounced search while typing.
  useEffect(() => {
    if (q.trim().length < 3) return;
    const t = setTimeout(() => run(q), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const scored = useMemo(
    () =>
      (items ?? []).map((p) => {
        const a = analyze(p.text);
        const me = personalize(a, profile);
        return { p, overall: a.scores.overall, me, n: a.items.length, ok: !a.unreadable };
      })
        // Lists we can't read well (e.g. translated into French) would get a misleading score.
        .filter((x) => x.ok),
    [items, profile],
  );

  const open = (p: Found, overall: number) => {
    tap();
    const scan = saveScan({ title: [p.brand, p.title].filter(Boolean).join(' · '), text: p.text, overall, barcode: p.barcode, source: p.source });
    router.push(`/analysis/${scan.id}`);
  };

  const header = (
    <View style={{ paddingTop: insets.top + 10 }}>
      <Brand />
      {toggle}
      <Text style={styles.h1}>База средств</Text>
      <Text style={styles.sub}>Найдите крем, шампунь или сыворотку — покажем оценку состава{profile.done ? ' и как он подходит именно вам' : ''}.</Text>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => run(q)}
          returnKeyType="search"
          placeholder="Название или бренд: CeraVe, The Ordinary…"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
        {busy && <ActivityIndicator color={colors.violet} />}
      </View>
      {items && !busy && <Text style={styles.count}>{scored.length ? `Нашли ${scored.length}` : 'Ничего не нашли — попробуйте название на латинице или отсканируйте средство'}</Text>}
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
        ListEmptyComponent={
          !items ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Как это работает</Text>
              <Text style={styles.emptyText}>
                Ищем сразу в двух местах: в нашей общей базе — составы, которые проверили пользовательницы essola, — и в открытой базе Open Beauty Facts. База растёт с каждым сканом.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item: { p, overall, me, n }, index }) => {
          const score = me?.score ?? overall;
          return (
            <FadeIn index={Math.min(index, 6)}>
              <Press haptic={false} onPress={() => open(p, overall)} style={styles.row}>
                {p.image ? <Image source={{ uri: p.image }} style={styles.img} /> : <View style={[styles.img, styles.noImg]}><Icon name="drop" size={20} color={colors.faint} /></View>}
                <View style={{ flex: 1, gap: 2 }}>
                  {!!p.brand && <Text style={styles.brand} numberOfLines={1}>{p.brand}</Text>}
                  <Text style={styles.title} numberOfLines={2}>
                    {p.title}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {n} ингр. · {p.source}
                    {me ? ` · ${me.label.toLowerCase()}` : ''}
                  </Text>
                </View>
                <Ring value={score} size={46} stroke={4} color={scoreColor(score)} track={colors.line}>
                  <Text style={styles.score}>{score}</Text>
                </Ring>
              </Press>
            </FadeIn>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -1, color: colors.ink, marginTop: 14 },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2, marginTop: 4 },
  search: { marginTop: 14, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  count: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  img: { width: 56, height: 56, borderRadius: 14, backgroundColor: colors.surf },
  noImg: { alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.violet, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  score: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  empty: { marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: '#F4F0FF' },
  emptyTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  emptyText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink2, marginTop: 4 },
});
