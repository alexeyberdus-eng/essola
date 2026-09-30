import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, LayoutAnimation, Platform, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Glass } from '../../components/lab';
import { RecipeCard } from '../../components/RecipeCard';
import { FadeIn, Glow } from '../../components/silk';
import { IconButton, Press, T, tap, Wordmark } from '../../components/ui';
import { useCommunity } from '../../context/CommunityContext';
import { useLibrary } from '../../context/LibraryContext';
import { useUserContent } from '../../context/UserContentContext';
import { recipeMeta } from '../../data/community';
import { setDraft } from '../../lib/builder';
import { CATEGORIES, Category, LEVELS, Recipe, RECIPES } from '../../data/recipes';
import { colors, fonts, shadow, space, TAB_SPACE } from '../../theme';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

type Sort = 'for-you' | 'new' | 'hot' | 'easy' | 'saved';
const SKINS = ['Сухая', 'Жирная', 'Комбинированная', 'Чувствительная', 'Нормальная'];
const TIMES = [
  [15, 'до 15 мин'],
  [30, 'до 30 мин'],
  [60, 'до часа'],
] as const;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { liked, likeCount } = useLibrary();
  const { count } = useCommunity();
  const { myRecipes } = useUserContent();
  const [sort, setSort] = useState<Sort>('for-you');
  const [cat, setCat] = useState<'all' | 'mine' | Category>('all');
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState(false);
  const [skin, setSkin] = useState<string | null>(null);
  const [level, setLevel] = useState<1 | 2 | 3 | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const q = query.trim().toLowerCase();
  const filters = (skin ? 1 : 0) + (level ? 1 : 0) + (time ? 1 : 0);
  const list = useMemo(() => {
    const all: Recipe[] = cat === 'mine' ? myRecipes : [...myRecipes, ...RECIPES];
    let l = all.filter((r) => {
      if (sort === 'saved' && !liked.has(r.id)) return false;
      if (cat !== 'all' && cat !== 'mine' && r.category !== cat) return false;
      if (skin && !r.skin.some((s) => s.toLowerCase().startsWith(skin.toLowerCase().slice(0, 5)))) return false;
      if (level && r.level !== level) return false;
      if (time && r.minutes > time) return false;
      if (!q) return true;
      return [r.title, r.subtitle, r.category, ...r.ingredients.map((i) => i.name)].some((t) => t.toLowerCase().includes(q));
    });
    if (sort === 'new') l = [...l].sort((a, b) => (b.own ? 1 : 0) - (a.own ? 1 : 0) || recipeMeta(a).postedAgo - recipeMeta(b).postedAgo);
    if (sort === 'hot') l = [...l].sort((a, b) => count(b.id) - count(a.id));
    if (sort === 'easy') l = [...l].sort((a, b) => a.level - b.level || a.minutes - b.minutes);
    if (sort === 'for-you') l = [...l].sort((a, b) => likeCount(b.id) - likeCount(a.id));
    return l;
  }, [sort, cat, q, liked, likeCount, count, myRecipes, skin, level, time]);

  const togglePanel = () => {
    tap();
    LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
    setPanel((p) => !p);
  };

  const header = (
    <View style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <Wordmark />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon={sort === 'saved' ? 'heartFill' : 'heart'} label="Избранное" onPress={() => setSort(sort === 'saved' ? 'for-you' : 'saved')} color={sort === 'saved' ? colors.bad : colors.ink} />
          <Press onPress={() => {
            setDraft(null);
            router.push('/create');
          }} style={styles.add} accessibilityLabel="Свой рецепт">
            <Icon name="plus" size={20} color={colors.brassLight} strokeWidth={1.9} />
          </Press>
        </View>
      </View>
      <Text style={styles.kicker}>
        Формулы · {RECIPES.length + myRecipes.length} рецептов{myRecipes.length ? ` · ${myRecipes.length} моих` : ''}
      </Text>

      <Glass style={styles.search} tint="rgba(255,253,248,0.6)">
        <View style={styles.searchRow}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Рецепт или ингредиент…"
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {!!query && (
            <Press haptic={false} onPress={() => setQuery('')} hitSlop={8}>
              <Icon name="close" size={16} color={colors.muted} />
            </Press>
          )}
          <Press onPress={togglePanel} style={[styles.filterBtn, panel && { backgroundColor: colors.olive2 }]} accessibilityLabel="Фильтры">
            <Icon name="filter" size={17} color={colors.onDark} />
            {filters > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{filters}</Text>
              </View>
            )}
          </Press>
        </View>
      </Glass>

      {panel && (
        <View style={styles.panel}>
          <FilterRow title="Тип кожи" options={SKINS.map((s) => [s, s] as const)} value={skin} onChange={setSkin} />
          <FilterRow title="Сложность" options={([1, 2, 3] as const).map((l) => [l, LEVELS[l]] as const)} value={level} onChange={setLevel} />
          <FilterRow title="Время" options={TIMES} value={time} onChange={setTime} />
          {filters > 0 && (
            <Press
              haptic={false}
              onPress={() => {
                setSkin(null);
                setLevel(null);
                setTime(null);
              }}
              style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
            >
              <Text style={styles.reset}>Сбросить фильтры</Text>
            </Press>
          )}
        </View>
      )}

      <Chips
        value={cat}
        onChange={setCat}
        options={[['all', 'Все'], ...(myRecipes.length ? ([['mine', 'Мои']] as const) : []), ...CATEGORIES.map((c) => [c, c] as const)]}
      />
      <View style={styles.sort}>
        {(
          [
            ['for-you', 'Для вас'],
            ['new', 'Новые'],
            ['hot', 'Обсуждают'],
            ['easy', 'Просто'],
          ] as const
        ).map(([k, l]) => (
          <Press key={k} haptic={false} onPress={() => setSort(k)}>
            <Text style={[styles.sortText, sort === k && styles.sortOn]}>{l}</Text>
            {sort === k && <View style={styles.sortLine} />}
          </Press>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <Animated.FlatList
        data={list}
        keyExtractor={(r: Recipe) => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: TAB_SPACE }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={5}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        renderItem={({ item, index }: { item: Recipe; index: number }) => (
          <FadeIn index={index}>
            <RecipeCard recipe={item} dark={index === 0} index={index} />
          </FadeIn>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <T v="heading">{sort === 'saved' ? 'Пока пусто' : 'Ничего не нашлось'}</T>
            <Text style={styles.emptyText}>{sort === 'saved' ? 'Нажмите ♡ на карточке, чтобы сохранить рецепт.' : 'Попробуйте другой ингредиент или ослабьте фильтры.'}</Text>
          </View>
        }
      />
      {/* frosted status-bar strip that fades in while scrolling */}
      <Animated.View pointerEvents="none" style={[styles.topFade, { height: insets.top, opacity: scrollY.interpolate({ inputRange: [0, 60], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
        <Glass style={StyleSheet.absoluteFill} tint="rgba(242,238,230,0.6)" />
      </Animated.View>
    </View>
  );
}

function Chips<K extends string>({ options, value, onChange }: { options: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void }) {
  return (
    <FlatList
      horizontal
      data={options as (readonly [K, string])[]}
      keyExtractor={([k]) => k}
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -space.gutter, marginTop: 12 }}
      contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 6 }}
      renderItem={({ item: [k, l] }) => (
        <Press haptic={false} onPress={() => { tap(); onChange(k); }} style={[styles.chip, value === k && styles.chipOn]}>
          <Text style={[styles.chipText, value === k && styles.chipTextOn]}>{l}</Text>
        </Press>
      )}
    />
  );
}

function FilterRow<K extends string | number>({ title, options, value, onChange }: { title: string; options: readonly (readonly [K, string])[]; value: K | null; onChange: (k: K | null) => void }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.kicker}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map(([k, l]) => (
          <Press key={String(k)} haptic={false} onPress={() => { tap(); onChange(value === k ? null : k); }} style={[styles.chip, value === k && styles.chipOn]}>
            <Text style={[styles.chipText, value === k && styles.chipTextOn]}>{l}</Text>
          </Press>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  add: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(216,188,134,0.45)' },
  kicker: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted, marginTop: 2, marginBottom: 10 },
  search: { height: 52, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', ...shadow },
  searchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6 },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  filterBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.brassLight, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.olive },
  panel: { marginTop: 10, padding: 14, gap: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  reset: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brassText },
  chip: { height: 32, paddingHorizontal: 13, borderRadius: 99, backgroundColor: 'rgba(230,221,207,0.7)', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.olive },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  chipTextOn: { color: colors.onDark, fontFamily: fonts.semibold },
  sort: { flexDirection: 'row', gap: 18, marginTop: 16, marginBottom: 14 },
  sortText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  sortOn: { color: colors.ink, fontFamily: fonts.semibold },
  sortLine: { height: 2, borderRadius: 2, backgroundColor: colors.brass, marginTop: 5 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
});
