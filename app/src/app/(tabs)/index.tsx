import { router } from 'expo-router';
import { Hero } from '../../components/Hero';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Platform, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { RecipeCard, warmRecipeCards } from '../../components/RecipeCard';
import { Brand, FadeIn, Glow } from '../../components/silk';
import { Zone } from '../../components/Zone';
import { IconButton, Press, T, tap, Wordmark } from '../../components/ui';
import { useCommunity } from '../../context/CommunityContext';
import { useLibrary } from '../../context/LibraryContext';
import { useUserContent } from '../../context/UserContentContext';
import { recipeMeta } from '../../data/community';
import { useExtraRecipes } from '../../lib/editorial';
import { useNotices } from '../../lib/notices';
import { Stories } from '../../components/Stories';
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
  const extra = useExtraRecipes();
  const { unread } = useNotices();
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
    // The feed is essola's own recipes only; the user's recipes live in the profile.
    const all: Recipe[] = [...extra, ...RECIPES];
    let l = all.filter((r) => {
      if (sort === 'saved' && !liked.has(r.id)) return false;
      if (cat !== 'all' && cat !== 'mine' && r.category !== cat) return false;
      if (skin && !r.skin.some((s) => s.toLowerCase().startsWith(skin.toLowerCase().slice(0, 5)))) return false;
      if (level && r.level !== level) return false;
      if (time && r.minutes > time) return false;
      if (!q) return true;
      return [r.title, r.subtitle, r.category, ...r.ingredients.map((i) => i.name)].some((t) => t.toLowerCase().includes(q));
    });
    // Sort keys are computed once per recipe, not inside every comparison.
    const by = (key: (r: Recipe) => number) => {
      const k = new Map(l.map((r) => [r.id, key(r)]));
      return [...l].sort((a, b) => k.get(a.id)! - k.get(b.id)!);
    };
    if (sort === 'new') l = by((r) => recipeMeta(r).postedAgo);
    if (sort === 'hot') l = by((r) => -count(r.id));
    if (sort === 'easy') l = [...l].sort((a, b) => a.level - b.level || a.minutes - b.minutes);
    if (sort === 'for-you') l = by((r) => -likeCount(r.id));
    return l;
  }, [sort, cat, q, liked, likeCount, count, extra, skin, level, time]);

  useEffect(() => warmRecipeCards([...extra, ...RECIPES]), [extra]);

  const togglePanel = () => {
    tap();
    LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
    setPanel((p) => !p);
  };

  const header = (
    <View style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <Brand />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon={sort === 'saved' ? 'heartFill' : 'heart'} label="Избранное" onPress={() => setSort(sort === 'saved' ? 'for-you' : 'saved')} color={sort === 'saved' ? colors.violet : colors.ink} />
          <View>
            <IconButton icon="bell" label="Уведомления" onPress={() => router.push('/notifications' as never)} />
            {unread > 0 && (
              <View pointerEvents="none" style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <Stories />
      <View style={styles.hello}>
        <Text style={styles.h1}>
          Что сегодня{'\n'}
          <Text style={{ color: colors.muted, fontFamily: fonts.regular }}>сварим?</Text>
        </Text>
      </View>
      <Hero kicker="Лента essola lab" title="Рецепты домашней косметики от технологов" text="Кремы, сыворотки и маски с точными граммами. «Подбор» найдёт рецепты и средства под ваши цели." style={{ marginTop: 12 }} />
      <View style={styles.modes}>
        <View style={[styles.mode, styles.modeOn]}>
          <Icon name="flask" size={18} color="#fff" />
          <Text style={[styles.modeText, { color: '#fff' }]} numberOfLines={1}>Рецепты</Text>
        </View>
        <Press haptic={false} onPress={() => { tap(); router.push('/knowledge'); }} style={styles.mode}>
          <Icon name="book" size={18} color={colors.ink2} />
          <Text style={styles.modeText} numberOfLines={1}>Знания</Text>
        </Press>
        <Press haptic={false} onPress={() => { tap(); router.push('/match' as never); }} style={styles.mode}>
          <Icon name="spark" size={18} color={colors.violet} />
          <Text style={[styles.modeText, { color: colors.violet }]} numberOfLines={1}>Подбор</Text>
        </Press>
        <Press haptic={false} onPress={() => { tap(); router.push('/forum' as never); }} style={styles.mode}>
          <Icon name="user" size={18} color={colors.ink2} />
          <Text style={styles.modeText} numberOfLines={1}>Форум</Text>
        </Press>
      </View>

      <View style={styles.search}>
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
        </View>
      </View>

      <View style={styles.sort}>
        {(
          [
            ['for-you', 'В топе'],
            ['new', 'Новое'],
            ['hot', 'Обсуждают'],
          ] as const
        ).map(([k, l]) => (
          <Press key={k} haptic={false} onPress={() => { tap(); startTransition(() => setSort(k)); }} style={[styles.sortChip, sort === k && styles.sortChipOn]}>
            <Text style={[styles.sortText, sort === k && styles.sortOn]}>{l}</Text>
          </Press>
        ))}
        <Zone
          value={cat}
          onChange={(c) => startTransition(() => setCat(c))}
          options={[['all', 'Все'], ...CATEGORIES.map((c) => [c, c] as const)]}
        />
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
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        renderItem={({ item, index }: { item: Recipe; index: number }) => (
          <FadeIn index={index}>
            <RecipeCard recipe={item} index={index} />
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
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.94)" }]} />
      </Animated.View>
    </View>
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
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#E0466E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: '#fff' },
  add: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  hello: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  h1: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -1.1, color: colors.ink },
  modes: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', marginTop: 14 },
  mode: { flex: 1, height: 56, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 4 },
  modeOn: { backgroundColor: colors.accent },
  modeText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink2, textAlign: 'center' },
  kicker: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted, marginTop: 2, marginBottom: 10 },
  search: { height: 50, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', marginTop: 12 },
  searchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6 },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  filterBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  panel: { marginTop: 10, padding: 14, gap: 12, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, ...shadow },
  reset: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  chip: { height: 32, paddingHorizontal: 13, borderRadius: 99, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.tint, borderColor: colors.violet },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  chipTextOn: { color: colors.violet, fontFamily: fonts.semibold },
  sort: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 12 },
  sortChip: { height: 36, paddingHorizontal: 13, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: 'rgba(21,23,43,0.06)', justifyContent: 'center' },
  sortChipOn: { backgroundColor: colors.accent },
  sortText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  sortOn: { color: '#fff' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
});
