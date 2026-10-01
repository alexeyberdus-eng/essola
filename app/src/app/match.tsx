import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
const GOALS: { key: string; label: string; zone: Category[]; re: RegExp }[] = [
  { key: 'moist', label: 'Увлажнение', zone: ['Лицо', 'Тело', 'Руки', 'Губы'], re: /hyaluron|glycerin|aloe|panthenol|urea|betaine|squalane|sodium pca|honey|trehalose/i },
  { key: 'acne', label: 'Против высыпаний', zone: ['Лицо'], re: /salicylic|niacinamide|zinc|azelaic|melaleuca|kaolin|bentonite|hamamelis|mandelic/i },
  { key: 'tone', label: 'Ровный тон', zone: ['Лицо'], re: /ascorb|niacinamide|arbutin|tranexamic|glycyrrhiza|lactic|glycolic|rosa canina/i },
  { key: 'calm', label: 'Успокоить кожу', zone: ['Лицо', 'Тело', 'Руки'], re: /centella|bisabolol|allantoin|panthenol|chamomilla|calendula|aloe|avena|oatmeal/i },
  { key: 'age', label: 'Упругость, морщины', zone: ['Лицо'], re: /retin|bakuchiol|peptide|ascorb|adenosine|ubiquinone|rosa canina|squalane|tocopherol/i },
  { key: 'barrier', label: 'Восстановить барьер', zone: ['Лицо', 'Тело', 'Руки', 'Губы'], re: /ceramide|cholesterol|squalane|butyrospermum|panthenol|niacinamide|oil/i },
  { key: 'glow', label: 'Сияние', zone: ['Лицо', 'Тело'], re: /ascorb|lactic|glycolic|mandelic|gluconolactone|niacinamide|citrus/i },
  { key: 'hairShine', label: 'Блеск и гладкость волос', zone: ['Волосы'], re: /oil|argania|camellia|simmondsia|protein|silk|keratin|dimethicone|panthenol/i },
  { key: 'hairStrong', label: 'Укрепить волосы', zone: ['Волосы'], re: /caffeine|rosmarinus|urtica|panthenol|biotin|niacinamide|protein|keratin|ricinus/i },
  { key: 'scalp', label: 'Жирная кожа головы', zone: ['Волосы'], re: /salicylic|zinc|kaolin|bentonite|melaleuca|urtica|mentha|rosmarinus/i },
  { key: 'relax', label: 'Расслабиться', zone: ['Ванна', 'Тело'], re: /lavandula|maris|magnesium|sodium bicarbonate|citric|chamomilla|oil/i },
];
const ZONES: Category[] = ['Лицо', 'Волосы', 'Тело', 'Руки', 'Губы', 'Ванна'];

/** Pick goals and a zone → recipes from our base ranked by how many fitting actives they contain, respecting the profile. */
export default function Match() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [zone, setZone] = useState<Category>('Лицо');
  const [goals, setGoals] = useState<string[]>([]);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.top}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => router.back()} />
        </View>
        <Text style={styles.h1}>Подбор под ваши цели</Text>
        <Text style={styles.sub}>Выберите зону и что хочется получить — подберём рецепты с подходящими активами{profile.done ? ' и учтём ваш профиль' : ''}.</Text>

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
  why: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.good, marginTop: 10, marginBottom: 6 },
});
