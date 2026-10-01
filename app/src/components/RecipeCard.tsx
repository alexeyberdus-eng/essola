import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useCommunity } from '../context/CommunityContext';
import { recipeMeta } from '../data/community';
import { LEVELS, Recipe, RECIPES } from '../data/recipes';
import { identify } from '../lib/analyze';
import { formatPercent, percentages } from '../lib/formula';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';
import { LikeButton } from './RecipeRow';
import { Press } from './ui';
import { RecipeArt } from './RecipeArt';

export function recipeNo(recipe: Recipe) {
  const i = RECIPES.indexOf(recipe);
  return i >= 0 ? `№${String(i + 1).padStart(2, '0')}` : 'Моё';
}

// Hairline frames in the aurora hues, rotating through the feed.
const FRAMES: [string, string][] = [
  ['#FF9F7A', '#C9A2FF'],
  ['#7FB0FF', '#7FDDBE'],
  ['#B794FF', '#FF9FBF'],
];

const short = (n: string) => {
  const s = n.replace(/\s*\(.*?\)/, '').replace(/^(масло|экстракт|гидролат|эфирное масло)\s+/i, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Three key ingredients: the most active first, then the rest by share (water/base skipped). */
function actives(recipe: Recipe) {
  const pct = percentages(recipe);
  return recipe.ingredients
    .map((it, i) => {
      const ing = identify(it.name).ing;
      return { name: short(it.name), act: ing.act ?? 0, base: ing.fn.includes('base'), pct: pct?.[i] };
    })
    .filter((x) => !x.base)
    .sort((a, b) => b.act - a.act || (b.pct ?? 0) - (a.pct ?? 0))
    .slice(0, 3);
}

/** Recipe in the feed: type and time, title, short description, key actives, likes and comments. */
export function RecipeCard({ recipe, index = 0 }: { recipe: Recipe; index?: number }) {
  const { count } = useCommunity();
  const author = recipe.own ? 'Вы' : recipeMeta(recipe).author.name;
  const top = actives(recipe);
  return (
    <Press haptic={false} onPress={() => router.push(`/recipe/${recipe.id}`)} style={{ marginBottom: 12 }}>
      <LinearGradient colors={FRAMES[index % FRAMES.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}>
        <View style={styles.card}>
          <View style={styles.meta}>
            <Text style={styles.metaText}>
              {recipe.category} · {recipe.minutes} мин
            </Text>
            <Text style={styles.metaText}>{LEVELS[recipe.level]}</Text>
          </View>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{recipe.title}</Text>
              <Text style={styles.desc} numberOfLines={2}>
                {recipe.subtitle}
              </Text>
            </View>
            <RecipeArt recipe={recipe} size={76} />
          </View>
          {top.length > 0 && (
            <View style={styles.acts}>
              {top.map((a) => (
                <View key={a.name} style={styles.act}>
                  <Text style={styles.actName} numberOfLines={1}>
                    {a.name}
                  </Text>
                  {a.pct != null && <Text style={styles.actPct}>{formatPercent(a.pct)}</Text>}
                </View>
              ))}
            </View>
          )}
          <View style={styles.foot}>
            <LikeButton id={recipe.id} size={16} showCount />
            <Press haptic={false} onPress={() => router.push(`/comments/${recipe.id}`)} style={styles.stat} hitSlop={8}>
              <Icon name="comment" size={16} color={colors.muted} />
              <Text style={styles.statText}>{count(recipe.id)}</Text>
            </Press>
            <Text style={styles.author} numberOfLines={1}>
              {author}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Press>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 24, padding: 1.5, shadowColor: '#15172B', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  card: { borderRadius: 22.5, backgroundColor: 'rgba(255,255,255,0.96)', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  metaText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  title: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.6, color: colors.ink, marginTop: 5 },
  desc: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink2, marginTop: 3 },
  acts: { flexDirection: 'row', gap: 5, marginTop: 10, overflow: 'hidden' },
  act: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: '#F1EEFF', flexShrink: 1 },
  actName: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#4B3FC9', flexShrink: 1 },
  actPct: { fontFamily: fonts.semibold, fontSize: 11, color: '#8A80E0' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderColor: 'rgba(21,23,43,0.06)' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  author: { marginLeft: 'auto', fontFamily: fonts.medium, fontSize: 12, color: colors.muted, backgroundColor: 'rgba(21,23,43,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, overflow: 'hidden', maxWidth: 140 },
});
