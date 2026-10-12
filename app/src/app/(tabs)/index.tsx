import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { IconName } from '../../components/Icon';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Platform, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { RecipeCard, warmRecipeCards } from '../../components/RecipeCard';
import { Brand, FadeIn, Glow } from '../../components/silk';
import { Zone } from '../../components/Zone';
import { IconButton, Press, SOFT, T, tap, Wordmark } from '../../components/ui';
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

// Six quick ways in (the scanner, the base and the builder also live in the tab bar): one compact row,
// each tile in its own soft pastel with the icon in a deeper shade of the same colour. Icon + one word.
const QUICK: { title: string; icon: IconName; href: string; bg: [string, string]; fg: string }[] = [
  { title: 'Сканер', icon: 'scan', href: '/scanner', bg: ['#EDE7FF', '#DCD2FF'], fg: '#6A4FE0' },
  { title: 'Подбор', icon: 'spark', href: '/match', bg: ['#FFE9F1', '#FFD3E3'], fg: '#D2457E' },
  { title: 'Сравнить', icon: 'swap', href: '/compare', bg: ['#E3F1FF', '#CDE3FF'], fg: '#3A78D6' },
  { title: 'Знания', icon: 'book', href: '/knowledge', bg: ['#FFF3DC', '#FFE6B8'], fg: '#C98418' },
  { title: 'Форум', icon: 'comment', href: '/forum', bg: ['#DFF7EC', '#C7EFDD'], fg: '#2E9F6E' },
  { title: 'Club', icon: 'heart', href: '/club', bg: ['#FFE8E1', '#FFD5C8'], fg: '#E0663F' },
];

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
      <View style={styles.quick}>
        {QUICK.map((a) => (
          <Press key={a.title} haptic={false} onPress={() => { tap(); router.push(a.href as never); }} style={styles.quickItem} accessibilityLabel={a.title}>
            <LinearGradient colors={a.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickIcon}>
              <Icon name={a.icon} size={20} color={a.fg} strokeWidth={2} />
            </LinearGradient>
            <Text style={styles.quickText} numberOfLines={1}>{a.title}</Text>
          </Press>
        ))}
      </View>

      <Text style={styles.section}>Рецепты</Text>
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
  // 3 × 2 grid of small tiles: a soft violet square with the icon, one word underneath.
  quick: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  quickItem: { width: 56, alignItems: 'center', gap: 6 },
  quickIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontFamily: fonts.medium, fontSize: 11, color: colors.ink2, letterSpacing: -0.1 },
  section: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.6, color: colors.ink, marginTop: 24 },
  modes: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 16, backgroundColor: '#F1F0F6', marginTop: 14 },
  mode: { flex: 1, height: 56, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 4 },
  modeOn: { backgroundColor: colors.accent },
  modeText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink2, textAlign: 'center' },
  kicker: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted, marginTop: 2, marginBottom: 10 },
  search: { height: 50, borderRadius: 99, backgroundColor: SOFT, marginTop: 12 },
  searchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 12 },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  filterBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  panel: { marginTop: 10, padding: 14, gap: 12, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, ...shadow },
  reset: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 99, backgroundColor: SOFT, justifyContent: 'center' },
  chipOn: { backgroundColor: '#EEE9FF' },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  chipTextOn: { color: colors.violet, fontFamily: fonts.semibold },
  sort: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 12 },
  sortChip: { height: 36, paddingHorizontal: 15, borderRadius: 99, backgroundColor: SOFT, justifyContent: 'center' },
  sortChipOn: { backgroundColor: colors.ink },
  sortText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  sortOn: { color: '#fff' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
});
