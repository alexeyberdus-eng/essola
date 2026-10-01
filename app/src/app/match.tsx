import { router } from 'expo-router';
import { Hint } from '../components/Hint';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Found, pageOBF } from '../components/ProductBase';
import { ScoreBadge } from '../components/ScoreBadge';
import { useLibrary } from '../context/LibraryContext';
import { analyze } from '../lib/analyze';
import { personalize } from '../lib/personal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecipeCard } from '../components/RecipeCard';
import { Glow } from '../components/silk';
import { IconButton, Press, tap } from '../components/ui';
import { INGREDIENTS } from '../data/ingredients';
import { Category, RECIPES } from '../data/recipes';
import { useProfile } from '../lib/profile';
import { RECIPE_INCI } from '../lib/wiki';
import { colors, fonts, space } from '../theme';

// Each goal is a set of actives that work for it; zones narrow the recipe category.
const GOALS: { key: string; q: string; label: string; zone: Category[]; re: RegExp }[] = [
  { key: 'moist', q: 'hyaluronic', label: 'Увлажнение', zone: ['Лицо', 'Тело', 'Руки', 'Губы'], re: /hyaluron|glycerin|aloe|panthenol|urea|betaine|squalane|sodium pca|honey|trehalose/i },
  { key: 'acne', q: 'salicylic', label: 'Против высыпаний', zone: ['Лицо'], re: /salicylic|niacinamide|zinc|azelaic|melaleuca|kaolin|bentonite|hamamelis|mandelic/i },
  { key: 'tone', q: 'niacinamide', label: 'Ровный тон', zone: ['Лицо'], re: /ascorb|niacinamide|arbutin|tranexamic|glycyrrhiza|lactic|glycolic|rosa canina/i },
  { key: 'calm', q: 'centella', label: 'Успокоить кожу', zone: ['Лицо', 'Тело', 'Руки'], re: /centella|bisabolol|allantoin|panthenol|chamomilla|calendula|aloe|avena|oatmeal/i },
  { key: 'age', q: 'retinol', label: 'Упругость, морщины', zone: ['Лицо'], re: /retin|bakuchiol|peptide|ascorb|adenosine|ubiquinone|rosa canina|squalane|tocopherol/i },
  { key: 'barrier', q: 'ceramide', label: 'Восстановить барьер', zone: ['Лицо', 'Тело', 'Руки', 'Губы'], re: /ceramide|cholesterol|squalane|butyrospermum|panthenol|niacinamide|oil/i },
  { key: 'glow', q: 'vitamin c', label: 'Сияние', zone: ['Лицо', 'Тело'], re: /ascorb|lactic|glycolic|mandelic|gluconolactone|niacinamide|citrus/i },
  { key: 'hairShine', q: 'argan', label: 'Блеск и гладкость волос', zone: ['Волосы'], re: /oil|argania|camellia|simmondsia|protein|silk|keratin|dimethicone|panthenol/i },
  { key: 'hairStrong', q: 'caffeine', label: 'Укрепить волосы', zone: ['Волосы'], re: /caffeine|rosmarinus|urtica|panthenol|biotin|niacinamide|protein|keratin|ricinus/i },
  { key: 'scalp', q: 'tea tree', label: 'Жирная кожа головы', zone: ['Волосы'], re: /salicylic|zinc|kaolin|bentonite|melaleuca|urtica|mentha|rosmarinus/i },
  { key: 'relax', q: 'lavender', label: 'Расслабиться', zone: ['Ванна', 'Тело'], re: /lavandula|maris|magnesium|sodium bicarbonate|citric|chamomilla|oil/i },
];
const ZONES: Category[] = ['Лицо', 'Волосы', 'Тело', 'Руки', 'Губы', 'Ванна'];
const ZONE_TAG: Partial<Record<Category, string>> = { Лицо: 'face-creams', Волосы: 'shampoos', Тело: 'body-lotions', Губы: 'lip-balms', Руки: 'hand-creams' };

/** Pick goals and a zone → recipes from our base ranked by how many fitting actives they contain, respecting the profile. */
export default function Match() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [zone, setZone] = useState<Category>('Лицо');
  const [goals, setGoals] = useState<string[]>([]);
  const [what, setWhat] = useState<'recipes' | 'products'>('recipes');
  const [products, setProducts] = useState<{ p: Found; score: number; overall: number; why: string[] }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { saveScan } = useLibrary();
  const goalsHere = GOALS.filter((g) => g.zone.includes(zone));
  const chosen = goalsHere.filter((g) => goals.includes(g.key));

  const results = useMemo(() => {
    if (!chosen.length) return [];
    const byInci = new Map(INGREDIENTS.map((i) => [i.inci, i]));
    return RECIPES.filter((r) => r.category === zone)
      .map((r) => {
        const inci = RECIPE_INCI.get(r.id) ?? [];
        const ings = inci.map((x) => byInci.get(x)).filter((x): x is NonNullable<typeof x> => !!x);
        if (profile.pregnant && ings.some((i) => i.flags.includes('pregnancy'))) return null;
        if (ings.some((i) => profile.avoid.includes(i.inci))) return null;
        const hits = chosen.map((g) => ({ g, list: ings.filter((i) => g.re.test(i.inci)) })).filter((h) => h.list.length);
        if (!hits.length) return null;
        const score = hits.reduce((s, h) => s + 10 + h.list.length * 3, 0);
        const why = [...new Set(hits.flatMap((h) => h.list.map((i) => i.ru)))].slice(0, 4);
        return { r, score, why, goals: hits.map((h) => h.g.label) };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.score - a.score);
  }, [chosen, zone, profile]);

  const goalKey = chosen.map((g) => g.key).join(',');
  useEffect(() => {
    if (what !== 'products' || !chosen.length) return;
    let alive = true;
    setLoading(true);
    Promise.all(chosen.map((g) => pageOBF(g.q, ZONE_TAG[zone], 1)))
      .then((pages) => {
        if (!alive) return;
        const seen = new Set<string>();
        const list = pages
          .flat()
          .filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)))
          .map((p) => {
            const a = analyze(p.text);
            if (a.unreadable) return null;
            const me = personalize(a, profile);
            if (me?.verdict === 'avoid') return null;
            const hits = a.items.filter((it) => chosen.some((g) => g.re.test(it.ing.inci)));
            if (!hits.length) return null;
            return { p, overall: a.scores.overall, score: me?.score ?? a.scores.overall, why: [...new Set(hits.map((h) => h.ing.ru))].slice(0, 3), fit: hits.length };
          })
          .filter((x): x is NonNullable<typeof x> => !!x)
          .sort((a, b) => b.fit * 5 + b.score - (a.fit * 5 + a.score))
          .slice(0, 30);
        setProducts(list);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // goalKey captures the chosen goals
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [what, goalKey, zone, profile]);

  const openProduct = (p: Found, overall: number) => {
    tap();
    const scan = saveScan({ title: [p.brand, p.title].filter(Boolean).join(' · '), text: p.text, overall, barcode: p.barcode, source: p.source, image: p.image });
    router.push(`/analysis/${scan.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.top}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => router.back()} />
        </View>
        <Text style={styles.h1}>Подбор под ваши цели</Text>
        <Text style={styles.sub}>Выберите зону
 и что хочется получить — подберём рецепты с подходящими активами{profile.done ? ' и учтём ваш профиль' : ''}.</Text>

        <Text style={styles.label}>Зона</Text>
        <View style={styles.chips}>
          {ZONES.map((z) => (
            <Press key={z} haptic={false} onPress={() => { tap(); setZone(z); setGoals([]); }} style={[styles.chip, zone === z && styles.chipOn]}>
              <Text style={[styles.chipText, zone === z && styles.chipTextOn]}>{z}</Text>
            </Press>
          ))}
        </View>

        <Text style={styles.label}>Цели · можно несколько</Text>
        <View style={styles.chips}>
          {goalsHere.map((g) => {
            const on = goals.includes(g.key);
            return (
              <Press key={g.key} haptic={false} onPress={() => { tap(); setGoals(on ? goals.filter((x) => x !== g.key) : [...goals, g.key]); }} style={[styles.chip, on && styles.goalOn]}>
                <Text style={[styles.chipText, on && { color: colors.violet, fontFamily: fonts.semibold }]}>{g.label}</Text>
              </Press>
            );
          })}
        </View>

        <View style={styles.switch}>
          {(
            [
              ['recipes', 'Рецепты'],
              ['products', 'Средства'],
            ] as const
          ).map(([k, l]) => (
            <Press key={k} haptic={false} onPress={() => { tap(); setWhat(k); }} style={[styles.sw, what === k && styles.swOn]}>
              <Text style={[styles.swText, what === k && styles.swTextOn]}>{l}</Text>
            </Press>
          ))}
        </View>

        {what === 'products' && chosen.length > 0 && (
          <View style={{ marginTop: 16 }}>
            {loading ? (
              <ActivityIndicator color={colors.violet} style={{ marginTop: 20 }} />
            ) : (
              <>
                <Text style={styles.h2}>{products?.length ? `Подобрали ${products.length}` : 'Подходящих средств пока не нашли'}</Text>
                {products?.map(({ p, score, overall, why }) => (
                  <Press key={p.key} haptic={false} onPress={() => openProduct(p, overall)} style={styles.prod}>
                    {p.image ? <Image source={{ uri: p.image }} style={styles.prodImg} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.prodImg} />}
                    <View style={{ flex: 1, gap: 2 }}>
                      {!!p.brand && <Text style={styles.prodBrand} numberOfLines={1}>{p.brand}</Text>}
                      <Text style={styles.prodTitle} numberOfLines={2}>{p.title}</Text>
                      <Text style={styles.why} numberOfLines={1}>Подходит: {why.join(', ')}</Text>
                    </View>
                    <ScoreBadge value={score} size={44} />
                  </Press>
                ))}
              </>
            )}
          </View>
        )}

        {what === 'recipes' && chosen.length > 0 && (
          <View style={{ marginTop: 22 }}>
            <Text style={styles.h2}>{results.length ? `Подобрали ${results.length}` : 'Пока нет подходящих рецептов'}</Text>
            {results.map(({ r, why }, i) => (
              <View key={r.id}>
                <Text style={styles.why} numberOfLines={2}>
                  Подходит: {why.join(', ')}
                </Text>
                <RecipeCard recipe={r} index={i} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { height: 48, justifyContent: 'center' },
  h1: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -1, color: colors.ink },
  h2: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginBottom: 6 },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2, marginTop: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: 20, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { height: 38, paddingHorizontal: 15, borderRadius: 99, backgroundColor: colors.surf, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  goalOn: { backgroundColor: '#EFEAFF', borderWidth: 1.5, borderColor: colors.violet },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink2 },
  chipTextOn: { color: colors.onDark, fontFamily: fonts.semibold },
  switch: { flexDirection: 'row', marginTop: 22, padding: 4, borderRadius: 16, backgroundColor: 'rgba(21,23,43,0.05)' },
  sw: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  swOn: { backgroundColor: '#fff' },
  swText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  swTextOn: { fontFamily: fonts.semibold, color: colors.ink },
  prod: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6F7' },
  prodImg: { width: 54, height: 54, borderRadius: 14, backgroundColor: colors.surf },
  prodBrand: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.violet, textTransform: 'uppercase' },
  prodTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.ink },
  why: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.good, marginTop: 10, marginBottom: 6 },
});
