import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { LikeButton } from '../../components/RecipeCard';
import { RecipeCover } from '../../components/RecipeCover';
import { Hairline, Press, T, Tag, tap } from '../../components/ui';
import { getRecipe, LEVELS } from '../../data/recipes';
import { colors, fonts, radius, space } from '../../theme';

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = getRecipe(id);
  const insets = useSafeAreaInsets();
  const [done, setDone] = useState<Set<number>>(new Set());

  if (!recipe) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.serif}>Рецепт не найден</Text>
        <Press onPress={() => router.back()}>
          <T v="label">Назад</T>
        </Press>
      </View>
    );
  }

  const toggle = (i: number) => {
    tap();
    setDone((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const share = () =>
    Share.share({
      message: `${recipe.title} — ${recipe.subtitle}\n\n${recipe.ingredients.map((i) => `• ${i.name} — ${i.amount}`).join('\n')}\n\nРецепт из Essola`,
    }).catch(() => {});

  const facts = [
    ['Время', `${recipe.minutes} мин`],
    ['Уровень', LEVELS[recipe.level]],
    ['Выход', recipe.yield],
    ['Хранение', recipe.shelfLife],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <RecipeCover recipe={recipe} big inset={insets.top + 56} style={{ height: 380 + insets.top }} />

        <View style={styles.sheet}>
          <View style={styles.headRow}>
            <T v="label">{recipe.category} · для кожи: {recipe.skin.join(', ').toLowerCase()}</T>
          </View>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.subtitle}>{recipe.subtitle}</Text>

          <View style={styles.facts}>
            {facts.map(([k, v], i) => (
              <View key={k} style={[styles.fact, i > 0 && styles.factBorder]}>
                <T v="label" style={{ fontSize: 9 }}>
                  {k}
                </T>
                <Text style={styles.factValue} numberOfLines={2}>
                  {v}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <LikeButton id={recipe.id} variant="pill" />
            <Press onPress={share} style={styles.shareBtn} accessibilityLabel="Поделиться">
              <Icon name="arrowRight" size={17} />
              <Text style={styles.shareText}>Поделиться</Text>
            </Press>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.h2}>Ингредиенты</Text>
              <T v="label">
                {done.size}/{recipe.ingredients.length}
              </T>
            </View>
            {recipe.ingredients.map((ing, i) => {
              const checked = done.has(i);
              return (
                <View key={ing.name}>
                  {i > 0 && <Hairline />}
                  <Press haptic={false} onPress={() => toggle(i)} style={styles.ingRow}>
                    <View style={[styles.check, checked && styles.checkOn]}>{checked && <Icon name="check" size={13} color={colors.paper} strokeWidth={2} />}</View>
                    <Text style={[styles.ingName, checked && styles.struck]}>{ing.name}</Text>
                    <Text style={styles.ingAmount}>{ing.amount}</Text>
                  </Press>
                </View>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.h2}>Приготовление</Text>
            {recipe.steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepNum}>{String(i + 1).padStart(2, '0')}</Text>
                <T style={{ flex: 1 }}>{step}</T>
              </View>
            ))}
          </View>

          <View style={[styles.note, { backgroundColor: colors.goldSoft }]}>
            <View style={styles.noteHead}>
              <Icon name="spark" size={16} color={colors.goldDeep} />
              <Text style={[styles.noteTitle, { color: colors.goldDeep }]}>Совет технолога</Text>
            </View>
            <T style={{ color: colors.ink2 }}>{recipe.tip}</T>
          </View>

          {recipe.caution && (
            <View style={[styles.note, { backgroundColor: '#F5E9E4' }]}>
              <View style={styles.noteHead}>
                <Icon name="alert" size={16} color={colors.bad} />
                <Text style={[styles.noteTitle, { color: colors.bad }]}>Важно</Text>
              </View>
              <T style={{ color: colors.ink2 }}>{recipe.caution}</T>
            </View>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.xl }}>
            <Tag label="Тест на сгибе локтя за 24 ч" tone="neutral" />
            <Tag label="Стерильная посуда" tone="neutral" />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.topBar, { top: insets.top + 6 }]} pointerEvents="box-none">
        <Press onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.round} accessibilityLabel="Назад">
          <Icon name="arrowLeft" size={20} />
        </Press>
        <View style={styles.round}>
          <LikeButton id={recipe.id} size={20} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', gap: 16, backgroundColor: colors.bg },
  serif: { fontFamily: fonts.serif, fontSize: 30, color: colors.goldDeep },
  sheet: {
    marginTop: -32,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.gutter,
    paddingTop: 26,
  },
  headRow: { flexDirection: 'row' },
  title: { fontFamily: fonts.medium, fontSize: 38, lineHeight: 42, letterSpacing: -1.6, color: colors.ink, marginTop: 12 },
  subtitle: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 28, color: colors.goldDeep, marginTop: 2 },
  facts: {
    flexDirection: 'row',
    marginTop: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
  },
  fact: { flex: 1, paddingVertical: 14, paddingHorizontal: 8, gap: 6 },
  factBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
  factValue: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.ink },
  actions: { flexDirection: 'row', gap: 10, marginTop: space.lg },
  shareBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  section: { marginTop: space.xxl, gap: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 },
  h2: { fontFamily: fonts.medium, fontSize: 22, letterSpacing: -0.6, color: colors.ink, marginBottom: 8 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  ingName: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  struck: { color: colors.faint, textDecorationLine: 'line-through' },
  ingAmount: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink2 },
  step: { flexDirection: 'row', gap: 16, paddingVertical: 10 },
  stepNum: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 26, color: colors.gold, width: 30 },
  note: { borderRadius: radius.md, padding: 18, gap: 8, marginTop: space.xl },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteTitle: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  topBar: { position: 'absolute', left: space.gutter, right: space.gutter, flexDirection: 'row', justifyContent: 'space-between' },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
