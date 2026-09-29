import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { RecipeCard } from '../../components/RecipeCard';
import { Chip, Press, SectionTitle, T } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { CATEGORIES, Category, RECIPES } from '../../data/recipes';
import { colors, fonts, radius, space } from '../../theme';

type Filter = 'Все' | 'Избранное' | Category;

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { liked, likeCount } = useLibrary();
  const [filter, setFilter] = useState<Filter>('Все');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      RECIPES.filter((r) => {
        if (filter === 'Избранное' && !liked.has(r.id)) return false;
        if (filter !== 'Все' && filter !== 'Избранное' && r.category !== filter) return false;
        if (!q) return true;
        return [r.title, r.subtitle, r.category, ...r.ingredients.map((i) => i.name)].some((t) => t.toLowerCase().includes(q));
      }),
    [filter, q, liked],
  );
  const featured = useMemo(() => [...RECIPES].sort((a, b) => likeCount(b.id) - likeCount(a.id)).slice(0, 6), [likeCount]);
  const showFeatured = filter === 'Все' && !q;

  const header = (
    <View style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <Logo size={17} />
        <Press onPress={() => router.push(user ? '/profile' : '/auth')} style={styles.avatar} accessibilityLabel="Кабинет">
          {user ? (
            <Text style={styles.avatarText}>{(user.name || user.email || 'E').slice(0, 1).toUpperCase()}</Text>
          ) : (
            <Icon name="user" size={18} />
          )}
        </Press>
      </View>

      <View style={styles.hero}>
        <T v="label">Лаборатория домашней косметики</T>
        <Text style={styles.display}>
          Уход, который{'\n'}
          <Text style={styles.displaySerif}>вы создаёте сами</Text>
        </Text>
        <T v="small" style={{ maxWidth: 300 }}>
          {RECIPES.length} выверенных рецептов с дозировками, сроками хранения и советами технолога.
        </T>
      </View>

      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Рецепт или ингредиент — ши, алоэ…"
          placeholderTextColor={colors.faint}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {!!query && (
          <Press onPress={() => setQuery('')} haptic={false}>
            <Icon name="close" size={16} color={colors.muted} />
          </Press>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(['Все', ...CATEGORIES, 'Избранное'] as Filter[]).map((c) => (
          <Chip key={c} label={c === 'Избранное' ? `♥ ${liked.size}` : c} active={filter === c} onPress={() => setFilter(c)} />
        ))}
      </ScrollView>

      {showFeatured && (
        <View style={{ marginTop: space.xl }}>
          <View style={{ paddingHorizontal: space.gutter }}>
            <SectionTitle kicker="Выбор сообщества" title="Самые любимые" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featured} snapToInterval={284} decelerationRate="fast">
            {featured.map((r) => (
              <RecipeCard key={r.id} recipe={r} wide />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ paddingHorizontal: space.gutter, marginTop: space.xl, marginBottom: space.md }}>
        <SectionTitle
          kicker={filter === 'Избранное' ? 'Ваша коллекция' : 'Каталог'}
          title={filter === 'Все' ? 'Все рецепты' : filter}
          right={<T v="label">{list.length}</T>}
        />
      </View>
    </View>
  );

  return (
    <FlatList
      data={list}
      keyExtractor={(r) => r.id}
      numColumns={2}
      ListHeaderComponent={header}
      columnWrapperStyle={styles.row}
      contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      renderItem={({ item }) => (
        <View style={{ flex: 1, maxWidth: '50%' }}>
          <RecipeCard recipe={item} />
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptySerif}>{filter === 'Избранное' ? 'Пока пусто' : 'Ничего не нашлось'}</Text>
          <T v="small" style={{ textAlign: 'center' }}>
            {filter === 'Избранное' ? 'Нажмите ♥ на рецепте, чтобы сохранить его сюда.' : 'Попробуйте другой ингредиент или категорию.'}
          </T>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.serif, fontSize: 20, color: colors.goldDeep },
  hero: { paddingHorizontal: space.gutter, paddingTop: space.xl, gap: 14 },
  display: { fontFamily: fonts.medium, fontSize: 36, lineHeight: 40, letterSpacing: -1.5, color: colors.ink },
  displaySerif: { fontFamily: fonts.serif, fontSize: 40, letterSpacing: -0.5, color: colors.goldDeep },
  search: {
    marginHorizontal: space.gutter,
    marginTop: space.xl,
    height: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 10,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, height: '100%' },
  chips: { gap: 8, paddingHorizontal: space.gutter, paddingTop: space.lg },
  featured: { gap: 12, paddingHorizontal: space.gutter, paddingTop: space.lg, paddingBottom: 8 },
  row: { gap: 12, paddingHorizontal: space.gutter, marginBottom: 12 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 40 },
  emptySerif: { fontFamily: fonts.serif, fontSize: 28, color: colors.goldDeep },
});
