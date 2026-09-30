import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useCommunity } from '../context/CommunityContext';
import { recipeMeta, timeAgo } from '../data/community';
import { LEVELS, Recipe, RECIPES } from '../data/recipes';
import { colors, fonts, shadow } from '../theme';
import { Icon } from './Icon';
import { Tilt3D } from './lab';
import { LikeButton } from './RecipeRow';
import { Avatar } from './silk';
import { Press } from './ui';

export function recipeNo(recipe: Recipe) {
  const i = RECIPES.indexOf(recipe);
  return i >= 0 ? `№${String(i + 1).padStart(2, '0')}` : 'Моё';
}

/** Product type shown above the title: first words of the subtitle ("Крем-эмульсия", "Тоник"…). */
function typeOf(recipe: Recipe) {
  const t = recipe.subtitle.split(/[,:—–]| с | для /)[0].trim();
  return t.length > 28 ? recipe.category : t;
}

function forLabel(s: string) {
  if (s === 'Все типы') return 'Любая кожа';
  if (/волос|головы|кожа/.test(s)) return s;
  return `${s} кожа`;
}

export type CardVariant = 'grad' | 'dark' | 'light';

/** Recipe as a social post: author, type, title, who it's for, short description, key ingredients, likes/comments. */
export function RecipeCard({ recipe, variant = 'light', index = 0 }: { recipe: Recipe; variant?: CardVariant; index?: number }) {
  const { count } = useCommunity();
  const meta = recipeMeta(recipe);
  const onColor = variant !== 'light';
  const author = recipe.own ? 'Вы' : meta.author.name;
  const body = (
    <View style={styles.pad}>
      <View style={styles.head}>
        <Avatar name={author} size={24} />
        <Text style={[styles.author, onColor && { color: '#fff' }]} numberOfLines={1}>
          {author}
        </Text>
        {!recipe.own && meta.author.role ? (
          <Text style={[styles.role, onColor && styles.roleOn]} numberOfLines={1}>
            {meta.author.role}
          </Text>
        ) : null}
        <Text style={[styles.time, onColor && { color: 'rgba(255,255,255,0.6)' }]}>{recipe.own ? 'моё' : timeAgo(meta.postedAgo)}</Text>
      </View>
      <Text style={[styles.type, onColor && { color: variant === 'grad' ? 'rgba(255,255,255,0.85)' : colors.brassLight }]} numberOfLines={1}>
        {typeOf(recipe)} · {recipe.category}
      </Text>
      <Text style={[styles.title, onColor && { color: '#fff' }]}>{recipe.title}</Text>
      <View style={styles.forRow}>
        {recipe.skin.slice(0, 2).map((s) => (
          <View key={s} style={[styles.for, onColor && styles.forOn]}>
            <Icon name="check" size={11} color={onColor ? '#fff' : colors.violet} strokeWidth={2.4} />
            <Text style={[styles.forText, onColor && { color: '#fff' }]}>{forLabel(s)}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.desc, onColor && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={2}>
        {recipe.subtitle}. {recipe.tip}
      </Text>
      <Text style={[styles.ings, onColor && { color: 'rgba(255,255,255,0.6)' }]} numberOfLines={1}>
        {recipe.ingredients
          .slice(0, 3)
          .map((i) => i.name)
          .join(' · ')}
      </Text>
      <View style={[styles.foot, onColor && { borderColor: 'rgba(255,255,255,0.14)' }]}>
        <LikeButton id={recipe.id} size={17} showCount dark={onColor} />
        <Press haptic={false} onPress={() => router.push(`/comments/${recipe.id}`)} style={styles.stat} hitSlop={8}>
          <Icon name="comment" size={16} color={onColor ? '#fff' : colors.ink} />
          <Text style={[styles.statText, onColor && { color: '#fff' }]}>{count(recipe.id)}</Text>
        </Press>
        <Text style={[styles.meta, onColor && { color: 'rgba(255,255,255,0.6)' }]}>
          {recipe.minutes} мин · {LEVELS[recipe.level]}
        </Text>
      </View>
    </View>
  );
  return (
    <Tilt3D style={{ marginBottom: 10 }}>
      <Press haptic={false} onPress={() => router.push(`/recipe/${recipe.id}`)}>
        {variant === 'grad' ? (
          <View style={[styles.card, styles.shadowV]}>
            <LinearGradient colors={[colors.violet, colors.lilac, colors.orchid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.bubble} />
            {body}
          </View>
        ) : variant === 'dark' ? (
          <View style={[styles.card, { backgroundColor: colors.ink }, styles.shadowD]}>
            <View style={styles.darkGlow} />
            {body}
          </View>
        ) : (
          <LinearGradient colors={['#D9CEFF', '#F1EDFF', '#EBC4F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.frame, shadow]}>
            <View style={[styles.card, { backgroundColor: '#fff', borderRadius: 19 }]}>
              <View style={styles.lightGlow} />
              {body}
            </View>
          </LinearGradient>
        )}
      </Press>
    </Tilt3D>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 20, padding: 1.5 },
  card: { borderRadius: 20, overflow: 'hidden' },
  shadowV: { shadowColor: colors.violet, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  shadowD: { shadowColor: colors.ink, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  bubble: { position: 'absolute', right: -40, top: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.14)' },
  darkGlow: { position: 'absolute', right: -60, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(123,92,250,0.35)' },
  lightGlow: { position: 'absolute', right: -50, top: -60, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(224,139,245,0.1)' },
  pad: { paddingHorizontal: 13, paddingTop: 11, paddingBottom: 9 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  author: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink, flexShrink: 1 },
  role: { fontFamily: fonts.semibold, fontSize: 10, color: colors.violet, backgroundColor: colors.tint, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
  roleOn: { color: '#fff', backgroundColor: 'rgba(255,255,255,0.18)' },
  time: { marginLeft: 'auto', fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  type: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.violet, marginTop: 9 },
  title: { fontFamily: fonts.display, fontSize: 18, letterSpacing: -0.7, color: colors.ink, marginTop: 3 },
  forRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  for: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: colors.tint },
  forOn: { backgroundColor: 'rgba(255,255,255,0.16)' },
  forText: { fontFamily: fonts.semibold, fontSize: 11, color: '#5A3FD6' },
  desc: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.ink2, marginTop: 7 },
  ings: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, marginTop: 5 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderColor: colors.line },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  meta: { marginLeft: 'auto', fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
});
