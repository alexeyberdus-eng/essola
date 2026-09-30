import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { LikeButton } from '../../components/RecipeRow';
import { Avatar, FadeIn, ProductPhoto } from '../../components/silk';
import { useCommunity } from '../../context/CommunityContext';
import { plural, recipeMeta } from '../../data/community';
import { Button, IconButton, Press, T } from '../../components/ui';
import { getRecipe, LEVELS, RECIPES } from '../../data/recipes';
import { formatPercent, percentages } from '../../lib/formula';
import { colors, fonts, radius, space } from '../../theme';

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = getRecipe(id);
  const insets = useSafeAreaInsets();

  if (!recipe) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 80 }]}>
        <T v="heading">Рецепт не найден</T>
        <Press onPress={() => router.back()}>
          <T v="label">Назад</T>
        </Press>
      </View>
    );
  }

  const pct = percentages(recipe);
  const num = String(RECIPES.indexOf(recipe) + 1).padStart(2, '0');
  const share = () =>
    Share.share({
      message: `${recipe.title} — ${recipe.subtitle}\n\n${recipe.ingredients.map((i) => `• ${i.name} — ${i.amount}`).join('\n')}\n\nФормула из Essola`,
    }).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={styles.navRight}>
          <LikeButton id={recipe.id} withCount />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        <FadeIn>
          <ProductPhoto kind={recipeMeta(recipe).bottle} tone={recipe.tone} height={250} radius={22} />
        </FadeIn>
        <View style={styles.hero}>
          <T v="label">
            Формула №{num} · {recipe.category}
          </T>
          <Text style={styles.title}>{recipe.title}</Text>
        </View>
        <T style={{ marginTop: 10 }}>{recipe.subtitle}. Для кожи: {recipe.skin.join(', ').toLowerCase()}.</T>

        <View style={styles.facts}>
          {[
            [`${recipe.minutes} мин`, 'Время'],
            [LEVELS[recipe.level], 'Уровень'],
            [recipe.yield, 'Выход'],
            [recipe.shelfLife.replace(' с консервантом', '').replace(' в холодильнике', ''), 'Срок'],
          ].map(([v, k], i) => (
            <View key={k} style={[styles.fact, i > 0 && styles.factBorder]}>
              <Text style={styles.factValue} numberOfLines={2}>
                {v}
              </Text>
              <Text style={styles.factKey}>{k}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <T v="label">Формула{pct ? ' · 100%' : ''}</T>
          <Press onPress={share} haptic={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.link}>Поделиться</Text>
            <Icon name="arrowRight" size={13} color={colors.honeyText} />
          </Press>
        </View>
        {recipe.ingredients.map((ing, i) => (
          <View key={ing.name} style={styles.ingRow}>
            <Text style={styles.ingIdx}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={styles.ingName}>{ing.name}</Text>
            <Text style={styles.ingAmount}>{ing.amount}</Text>
            {pct && <Text style={styles.ingPct}>{formatPercent(pct[i])}</Text>}
          </View>
        ))}

        <View style={styles.sectionHead}>
          <T v="label">Процесс · {recipe.steps.length} шагов</T>
        </View>
        {recipe.steps.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <T style={{ flex: 1, fontSize: 14.5, lineHeight: 21 }}>{step}</T>
          </View>
        ))}

        <Discussion recipeId={recipe.id} />

        <View style={[styles.note, { backgroundColor: colors.honeySoft }]}>
          <View style={styles.noteHead}>
            <Icon name="spark" size={15} color={colors.honeyText} />
            <Text style={[styles.noteTitle, { color: colors.honeyText }]}>Совет технолога</Text>
          </View>
          <T style={{ fontSize: 14, lineHeight: 20 }}>{recipe.tip}</T>
        </View>
        {recipe.caution && (
          <View style={[styles.note, { backgroundColor: colors.badSoft }]}>
            <View style={styles.noteHead}>
              <Icon name="alert" size={15} color={colors.bad} />
              <Text style={[styles.noteTitle, { color: colors.bad }]}>Важно</Text>
            </View>
            <T style={{ fontSize: 14, lineHeight: 20 }}>{recipe.caution}</T>
          </View>
        )}
        <T v="small" style={{ marginTop: 16 }}>
          Хранение: {recipe.shelfLife}. Перед первым применением сделайте тест на сгибе локтя.
        </T>
      </ScrollView>

      <View style={[styles.sticky, { paddingBottom: insets.bottom + 14 }]}>
        <Button label="Начать приготовление" icon="play" onPress={() => router.push(`/cook/${recipe.id}`)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', gap: 14, backgroundColor: colors.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 12 },
  navRight: { flexDirection: 'row', gap: 8 },
  hero: { marginTop: 18 },
  discussion: { marginTop: space.xl, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16 },
  dHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  dRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  dText: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  dName: { fontFamily: fonts.semibold },
  dReplies: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginTop: 3 },
  dAll: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14 },
  dAllText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.honeyText },
  title: { fontFamily: fonts.semibold, fontSize: 34, lineHeight: 38, letterSpacing: -1.4, color: colors.ink, marginTop: 4 },
  facts: { flexDirection: 'row', marginTop: 18, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.card },
  fact: { flex: 1, paddingVertical: 11, paddingHorizontal: 9, gap: 3 },
  factBorder: { borderLeftWidth: 1, borderColor: colors.line },
  factValue: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: colors.ink },
  factKey: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, marginBottom: 4 },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.honeyText },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderColor: colors.line },
  ingIdx: { width: 20, fontFamily: fonts.monoMedium, fontSize: 11, color: colors.muted },
  ingName: { flex: 1, fontFamily: fonts.regular, fontSize: 14.5, color: colors.ink },
  ingAmount: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.ink2 },
  ingPct: { width: 50, textAlign: 'right', fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.ink },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 9 },
  stepNum: { width: 24, height: 24, borderRadius: 7, backgroundColor: colors.honey, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontFamily: fonts.monoMedium, fontSize: 11.5, color: colors.ink },
  note: { borderRadius: radius.lg, padding: 16, gap: 6, marginTop: 16 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  noteTitle: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase' },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: 12, backgroundColor: colors.bg, borderTopWidth: 1, borderColor: colors.line },
});

function Discussion({ recipeId }: { recipeId: string }) {
  const { threads, count } = useCommunity();
  const top = threads(recipeId).slice(0, 2);
  const n = count(recipeId);
  const open = () => router.push(`/comments/${recipeId}`);
  return (
    <Press haptic={false} onPress={open} style={styles.discussion}>
      <View style={styles.dHead}>
        <Text style={styles.dTitle}>Обсуждение</Text>
        <T v="label">{n}</T>
      </View>
      {top.map((t) => (
        <View key={t.id} style={styles.dRow}>
          <Avatar name={t.author} size={26} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dText} numberOfLines={2}>
              <Text style={styles.dName}>{t.author} </Text>
              {t.text}
            </Text>
            {t.replies.length > 0 && (
              <Text style={styles.dReplies}>
                {t.replies.length} {plural(t.replies.length, 'ответ', 'ответа', 'ответов')}
              </Text>
            )}
          </View>
        </View>
      ))}
      <View style={styles.dAll}>
        <Text style={styles.dAllText}>{n ? `Все ${n} ${plural(n, 'комментарий', 'комментария', 'комментариев')}` : 'Написать первый комментарий'}</Text>
        <Icon name="arrowRight" size={14} color={colors.honeyText} />
      </View>
    </Press>
  );
}
