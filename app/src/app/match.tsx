import { router } from 'expo-router';
import { Hint } from '../components/Hint';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
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
import type { Profile } from '../lib/profile';
import { CatalogItem, matchProducts } from '../lib/ai';
import { FREE_TAGS, GOAL_TAGS, productTags } from '../lib/tags';
import { Hero } from '../components/Hero';
import { Icon } from '../components/Icon';
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

// Product side: where it's used → catalog categories (see scripts/build-letu.ts), and which goal tags make sense there.
type Area = { key: string; label: string; cats: [string, string][]; goals: (keyof typeof GOAL_TAGS)[] };
const AREAS: Area[] = [
  { key: 'face', label: 'Лицо', cats: [['face-creams', 'Кремы'], ['serums', 'Сыворотки'], ['toners', 'Тоники'], ['face-cleansers', 'Умывание'], ['face-masks', 'Маски'], ['eye-creams', 'Вокруг глаз'], ['sunscreens', 'SPF']], goals: ['H', 'A', 'O', 'P', 'D', 'W', 'R', 'B'] },
  { key: 'body', label: 'Тело', cats: [['body-lotions', 'Кремы и лосьоны'], ['shower-gels', 'Для душа'], ['deodorants', 'Дезодоранты'], ['sunscreens', 'SPF']], goals: ['H', 'B', 'R', 'A', 'D'] },
  { key: 'hair', label: 'Волосы', cats: [['shampoos', 'Шампуни'], ['conditioners', 'Бальзамы'], ['hair-masks', 'Маски и уход']], goals: ['S', 'G', 'C', 'H'] },
  { key: 'hands', label: 'Руки', cats: [['hand-creams', 'Кремы для рук']], goals: ['H', 'B', 'R'] },
  { key: 'lips', label: 'Губы', cats: [['lip-balms', 'Бальзамы']], goals: ['H', 'B'] },
  { key: 'makeup', label: 'Макияж', cats: [['makeup', 'Всё для макияжа']], goals: ['H', 'O', 'R'] },
];
const FREE_KEYS = Object.keys(FREE_TAGS) as (keyof typeof FREE_TAGS)[];
const SORTS = [
  ['score', 'Лучший состав'],
  ['rating', 'Рейтинг покупателей'],
  ['popular', 'Популярные'],
] as const;

/** The questionnaire turned into tags: concerns → goals, preferences → free-from. */
function profileTags(p: Profile) {
  const goals = new Set<string>();
  const map: Record<string, string> = { acne: 'A', pigment: 'P', aging: 'W', dehydration: 'H', redness: 'R', pores: 'O', dullness: 'D' };
  for (const c of p.concerns) if (map[c]) goals.add(map[c]);
  if (p.hair.includes('dandruff')) goals.add('C');
  if (p.hair.some((h) => h === 'damaged' || h === 'dry' || h === 'colored')) goals.add('G');
  if (p.hair.includes('thin')) goals.add('S');
  const free = new Set<string>();
  const prefs: Record<string, string> = { noFragrance: 'f', vegan: 'v', noSilicone: 's', noSulfate: 'u', noParaben: 'p' };
  for (const x of p.prefs) if (prefs[x]) free.add(prefs[x]);
  if (p.pregnant) free.add('g');
  if (p.sensitive) free.add('k');
  if (p.skin === 'oily' || p.skin === 'combo') free.add('c');
  if (p.skin === 'dry') free.add('a');
  return { goals, free };
}

/** «Подбор»: products from our base by area, goals, free-from tags and the questionnaire — or recipes by actives. */
export default function Match() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { saveScan } = useLibrary();
  const [what, setWhat] = useState<'products' | 'recipes'>('products');
  // Products
  const [area, setArea] = useState(AREAS[0]);
  const [cats, setCats] = useState<string[]>([]);
  const [pg, setPg] = useState<string[]>([]);
  const [free, setFree] = useState<string[]>([]);
  const [useMe, setUseMe] = useState(profile.done);
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>('score');
  const [found, setFound] = useState<{ items: CatalogItem[]; total: number; page: number; exact: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // Recipes
  const [zone, setZone] = useState<Category>('Лицо');
  const [goals, setGoals] = useState<string[]>([]);
  const goalsHere = GOALS.filter((g) => g.zone.includes(zone));
  const chosen = goalsHere.filter((g) => goals.includes(g.key));

  useEffect(() => setUseMe(profile.done), [profile.done]);

  const query = useMemo(() => {
    const me = useMe && profile.done ? profileTags(profile) : { goals: new Set<string>(), free: new Set<string>() };
    const g = new Set([...pg, ...[...me.goals].filter((x) => area.goals.includes(x as keyof typeof GOAL_TAGS))]);
    const f = new Set([...free, ...me.free]);
    return { cats: cats.length ? cats : area.cats.map((c) => c[0]), goals: [...g].join(''), free: [...f].join(''), sort };
  }, [area, cats, pg, free, useMe, profile, sort]);
  const qKey = JSON.stringify(query);
  // The search runs only on the button: filters can be changed freely without a request per tap.
  const [runKey, setRunKey] = useState<string | null>(null);
  const stale = runKey?.split('#')[0] !== qKey;

  // Server pages from `from`: when the catalog has no tags yet, the phone tags each composition itself and keeps
  // reading pages until enough products fit.
  const fetchFrom = async (from: number) => {
    let page = from;
    const items: CatalogItem[] = [];
    let total = 0;
    let exact = true;
    for (let i = 0; i < 6; i++) {
      const r = await matchProducts({ ...query, page });
      if (!r) break;
      total = r.total;
      if (!r.untagged) {
        items.push(...r.items);
        break;
      }
      exact = false;
      for (const x of r.items) {
        const m = productTags(analyze(x.x));
        const okGoals = !query.goals || [...query.goals].some((g) => m.includes(g));
        const okFree = [...query.free].every((f) => m.includes(f));
        if (okGoals && okFree) items.push({ ...x, m });
      }
      if (items.length >= 20 || page * 40 >= r.total) break;
      page++;
    }
    return { items, total, page, exact };
  };

  useEffect(() => {
    if (what !== 'products' || !runKey) return;
    let alive = true;
    setBusy(true);
    setFound(null);
    fetchFrom(1)
      .then((r) => alive && setFound(r))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // runKey captures the query at the moment of the tap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, what]);

  const more = async () => {
    if (!found || busy || found.page * 40 >= found.total) return;
    setBusy(true);
    const r = await fetchFrom(found.page + 1);
    setFound({ items: [...found.items, ...r.items], total: r.total, page: r.page, exact: found.exact && r.exact });
    setBusy(false);
  };

  const scored = useMemo(
    () =>
      (found?.items ?? []).map((x) => {
        const a = analyze(x.x);
        const me = useMe ? personalize(a, profile) : null;
        const fits = [...query.goals].filter((g) => x.m?.includes(g)).map((g) => GOAL_TAGS[g as keyof typeof GOAL_TAGS].label);
        return { x, overall: a.scores.overall, score: me?.score ?? a.scores.overall, me, fits };
      }),
    [found, useMe, profile, query.goals],
  );

  const openProduct = (x: CatalogItem, overall: number) => {
    tap();
    const scan = saveScan({ title: [x.b, x.t].filter(Boolean).join(' · '), text: x.x, overall, source: 'Летуаль', image: x.i || null, url: x.u });
    router.push(`/analysis/${scan.id}`);
  };

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
        return { r, score, why };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.score - a.score);
  }, [chosen, zone, profile]);

  const toggle = (list: string[], set: (v: string[]) => void, k: string) => {
    tap();
    set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.top}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => router.back()} />
        </View>
        <Hero kicker="Подбор essola" title="Подбор под ваши цели" text="Средства из нашей базы с оценкой состава или рецепты, которые можно сварить дома." tone="sky" style={{ marginTop: 4 }} />

        <View style={styles.switch}>
          {(
            [
              ['products', 'Средства'],
              ['recipes', 'Рецепты'],
            ] as const
          ).map(([k, l]) => (
            <Press key={k} haptic={false} onPress={() => { tap(); setWhat(k); }} style={[styles.sw, what === k && styles.swOn]}>
              <Text style={[styles.swText, what === k && styles.swTextOn]}>{l}</Text>
            </Press>
          ))}
        </View>

        {what === 'products' ? (
          <>
            <Press
              onPress={() => {
                if (!profile.done) return router.push('/about-me' as never);
                tap();
                setUseMe(!useMe);
              }}
              style={styles.me}
            >
              <View style={[styles.box, useMe && profile.done && styles.boxOn]}>{useMe && profile.done && <Icon name="check" size={14} color="#fff" strokeWidth={2.6} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.meTitle}>Учитывать мой профиль</Text>
                <Text style={styles.meText}>{profile.done ? 'Тип кожи, задачи, беременность, непереносимость и предпочтения из кабинета' : 'Заполните анкету в кабинете — нажмите сюда'}</Text>
              </View>
            </Press>

            <Text style={styles.label}>Для чего</Text>
            <View style={styles.chips}>
              {AREAS.map((a) => (
                <Press key={a.key} haptic={false} onPress={() => { tap(); setArea(a); setCats([]); setPg([]); }} style={[styles.chip, area.key === a.key && styles.chipOn]}>
                  <Text style={[styles.chipText, area.key === a.key && styles.chipTextOn]}>{a.label}</Text>
                </Press>
              ))}
            </View>
            {area.cats.length > 1 && (
              <>
                <Text style={styles.label}>Что ищем · можно несколько</Text>
                <View style={styles.chips}>
                  {area.cats.map(([k, l]) => (
                    <Press key={k} haptic={false} onPress={() => toggle(cats, setCats, k)} style={[styles.chip, cats.includes(k) && styles.chipPick]}>
                      <Text style={[styles.chipText, cats.includes(k) && styles.chipTextOn]}>{l}</Text>
                    </Press>
                  ))}
                </View>
              </>
            )}
            <Text style={styles.label}>Задачи</Text>
            <View style={styles.chips}>
              {area.goals.map((k) => (
                <Press key={k} haptic={false} onPress={() => toggle(pg, setPg, k)} style={[styles.chip, pg.includes(k) && styles.chipPick]}>
                  <Text style={[styles.chipText, pg.includes(k) && styles.chipTextOn]}>{GOAL_TAGS[k].label}</Text>
                </Press>
              ))}
            </View>
            <Text style={styles.label}>Состав</Text>
            <View style={styles.chips}>
              {FREE_KEYS.map((k) => (
                <Press key={k} haptic={false} onPress={() => toggle(free, setFree, k)} style={[styles.chip, free.includes(k) && styles.chipPick]}>
                  <Text style={[styles.chipText, free.includes(k) && styles.chipTextOn]}>{FREE_TAGS[k]}</Text>
                </Press>
              ))}
            </View>
            <Text style={styles.label}>Сортировка</Text>
            <View style={styles.chips}>
              {SORTS.map(([k, l]) => (
                <Press key={k} haptic={false} onPress={() => { tap(); setSort(k); }} style={[styles.chip, sort === k && styles.chipOn]}>
                  <Text style={[styles.chipText, sort === k && styles.chipTextOn]}>{l}</Text>
                </Press>
              ))}
            </View>

            <Press
              onPress={() => {
                if (busy) return;
                setRunKey(stale ? qKey : `${qKey}#${Date.now()}`);
              }}
              style={[styles.go, busy && { opacity: 0.7 }]}
            >
              {busy && !found ? <ActivityIndicator color="#fff" /> : <Text style={styles.goText}>{found && !stale ? 'Подобрать заново' : 'Подобрать'}</Text>}
            </Press>
            {runKey && !stale && (busy || found) ? (
              <Text style={[styles.h2, { marginTop: 22 }]}>
                {busy && !found?.items.length ? 'Подбираем…' : found?.items.length ? (found.exact ? `Нашли ${found.total.toLocaleString('ru-RU')}` : `Подобрали ${found.items.length}`) : 'Ничего не нашли — уберите часть фильтров'}
              </Text>
            ) : found && stale ? (
              <Text style={styles.staleNote}>Фильтры изменились — нажмите «Подобрать», чтобы обновить список</Text>
            ) : null}
            {scored.map(({ x, score, overall, me, fits }) => (
              <Press key={x.k} haptic={false} onPress={() => openProduct(x, overall)} style={styles.prod}>
                {x.i ? <Image source={{ uri: x.i }} style={styles.prodImg} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.prodImg} />}
                <View style={{ flex: 1, gap: 2 }}>
                  {!!x.b && <Text style={styles.prodBrand} numberOfLines={1}>{x.b}</Text>}
                  <Text style={styles.prodTitle} numberOfLines={2}>{x.t}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[x.r ? `★ ${x.r.toFixed(1)}` : '', fits.length ? fits.join(', ') : '', me ? me.label.toLowerCase() : ''].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <ScoreBadge value={score} size={44} />
              </Press>
            ))}
            {!!found && found.page * 40 < found.total && (
              <Press onPress={more} style={styles.more}>
                {busy ? <ActivityIndicator color={colors.violet} /> : <Text style={styles.moreText}>Показать ещё</Text>}
              </Press>
            )}
          </>
        ) : (
          <>
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
                  <Press key={g.key} haptic={false} onPress={() => toggle(goals, setGoals, g.key)} style={[styles.chip, on && styles.chipPick]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{g.label}</Text>
                  </Press>
                );
              })}
            </View>
            {chosen.length > 0 && (
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
          </>
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
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 99, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipPick: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink2 },
  chipTextOn: { color: colors.onDark, fontFamily: fonts.semibold },
  switch: { flexDirection: 'row', marginTop: 18, padding: 4, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1' },
  sw: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  swOn: { backgroundColor: colors.ink },
  swText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  swTextOn: { fontFamily: fonts.semibold, color: '#fff' },
  me: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: '#F6F7FD', borderWidth: 1, borderColor: '#E6E8F6' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#C9CDE0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  boxOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  meTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  meText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 1 },
  prod: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6F7' },
  prodImg: { width: 54, height: 54, borderRadius: 14, backgroundColor: colors.surf },
  prodBrand: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.violet, textTransform: 'uppercase' },
  prodTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.ink },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  go: { height: 54, marginTop: 22, borderRadius: 18, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  goText: { fontFamily: fonts.semibold, fontSize: 16, color: '#fff' },
  staleNote: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 4 },
  more: { height: 46, marginTop: 12, borderRadius: 16, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.violet },
  why: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.good, marginTop: 10, marginBottom: 6 },
});
