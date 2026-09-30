import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useCommunity } from '../context/CommunityContext';
import { LEVELS, Recipe, RECIPES } from '../data/recipes';
import { recipePhases } from '../lib/phases';
import { colors, fonts, PHASE_COLOR, shadow } from '../theme';
import { Icon } from './Icon';
import { DarkBlock, FormulaBar, Tilt3D } from './lab';
import { LikeButton } from './RecipeRow';
import { Press } from './ui';

export function recipeNo(recipe: Recipe) {
  const i = RECIPES.indexOf(recipe);
  return i >= 0 ? `№${String(i + 1).padStart(2, '0')}` : 'Моё';
}

/** Text-only recipe card: number, meta, title, short description and the phase bar. */
export function RecipeCard({ recipe, dark, index = 0 }: { recipe: Recipe; dark?: boolean; index?: number }) {
  const { count } = useCommunity();
  const body = (
    <View style={styles.pad}>
      <View style={styles.top}>
        <View style={[styles.no, dark && styles.noDark]}>
          <Text style={[styles.noText, dark && { color: colors.olive }]}>{recipeNo(recipe)}</Text>
        </View>
        <Text style={[styles.meta, dark && { color: colors.onDarkMuted }]} numberOfLines={1}>
          {recipe.category} · {recipe.minutes} мин · {LEVELS[recipe.level]}
        </Text>
        <LikeButton id={recipe.id} size={18} dark={dark} />
      </View>
      <Text style={[styles.title, dark && { color: colors.onDark }]}>{recipe.title}</Text>
      <Text style={[styles.sub, dark && { color: 'rgba(239,235,224,0.72)' }]} numberOfLines={2}>
        {recipe.subtitle}
      </Text>
      <View style={{ marginTop: 12 }}>
        <FormulaBar parts={recipePhases(recipe)} delay={120 + index * 80} track={dark ? 'rgba(255,255,255,0.08)' : undefined} />
      </View>
      <View style={styles.foot}>
        <View style={styles.stat}>
          <Icon name="comment" size={14} color={dark ? colors.onDarkMuted : colors.muted} />
          <Text style={[styles.statText, dark && { color: colors.onDarkMuted }]}>{count(recipe.id)}</Text>
        </View>
        <View style={styles.legend}>
          {(['water', 'oil', 'active'] as const).map((k) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PHASE_COLOR[k] }]} />
              <Text style={[styles.legendText, dark && { color: colors.onDarkMuted }]}>{k === 'water' ? 'вода' : k === 'oil' ? 'масла' : 'активы'}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
  return (
    <Tilt3D style={{ marginBottom: 10 }}>
      <Press haptic={false} onPress={() => router.push(`/recipe/${recipe.id}`)}>
        {dark ? <DarkBlock>{body}</DarkBlock> : <View style={styles.card}>{body}</View>}
      </Press>
    </Tilt3D>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', ...shadow },
  pad: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 13 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  no: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: 'rgba(230,221,207,0.8)' },
  noDark: { backgroundColor: colors.brassLight },
  noText: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.ink2 },
  meta: { flex: 1, fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted },
  title: { fontFamily: fonts.display, fontSize: 21, letterSpacing: -0.7, color: colors.ink, marginTop: 9 },
  sub: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink2, marginTop: 4 },
  foot: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  legend: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 2 },
  legendText: { fontFamily: fonts.regular, fontSize: 10.5, color: colors.muted },
});
