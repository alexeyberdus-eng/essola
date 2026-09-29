import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { RecipeRow } from '../../components/RecipeRow';
import { IconButton, Press, SectionHead, Seg, T, Wordmark } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { CATEGORIES, Category, RECIPES } from '../../data/recipes';
import { colors, fonts, radius, space } from '../../theme';

type Filter = 'all' | 'fav' | Category;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { liked, scans } = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef<TextInput>(null);

  const q = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      RECIPES.filter((r) => {
        if (filter === 'fav' && !liked.has(r.id)) return false;
        if (filter !== 'all' && filter !== 'fav' && r.category !== filter) return false;
        if (!q) return true;
        return [r.title, r.subtitle, r.category, ...r.ingredients.map((i) => i.name)].some((t) => t.toLowerCase().includes(q));
      }),
    [filter, q, liked],
  );
  const last = scans[0];

  const toggleSearch = () => {
    if (searching) {
      setQuery('');
      setSearching(false);
    } else {
      setSearching(true);
      setTimeout(() => input.current?.focus(), 50);
    }
  };

  const header = (
    <View style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <Wordmark />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon={searching ? 'close' : 'search'} label="Поиск" onPress={toggleSearch} />
          <Press onPress={() => router.push(user ? '/profile' : '/auth')} style={styles.avatar} accessibilityLabel="Кабинет">
            {user ? <Text style={styles.avatarText}>{(user.name || user.email || 'E').slice(0, 1).toUpperCase()}</Text> : <Icon name="user" size={18} />}
          </Press>
        </View>
      </View>

      {searching ? (
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            ref={input}
            value={query}
            onChangeText={setQuery}
            placeholder="Рецепт или ингредиент — ши, алоэ…"
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      ) : (
        <Press haptic={false} onPress={() => router.navigate('/scanner')} style={styles.cta}>
          <View style={styles.ctaTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaKicker}>Сканер составов</Text>
              <Text style={styles.ctaTitle}>Проверьте состав{'\n'}любого средства</Text>
            </View>
            <View style={styles.ctaIcon}>
              <Icon name="scan" size={26} color={colors.honey} strokeWidth={1.7} />
            </View>
          </View>
          {last ? (
            <Press haptic={false} onPress={() => router.push(`/analysis/${last.id}`)} style={styles.ctaLast}>
              <Text style={styles.ctaLastText} numberOfLines={1}>
                Последний · {last.title}
              </Text>
              <Text style={styles.ctaScore}>{last.overall}</Text>
            </Press>
          ) : (
            <View style={styles.ctaLast}>
              <Text style={styles.ctaLastText}>Сфотографируйте этикетку — разбор за секунды</Text>
            </View>
          )}
        </Press>
      )}

      <View style={{ marginTop: space.xl, marginBottom: space.md }}>
        <SectionHead
          kicker={filter === 'fav' ? 'Избранное' : 'Формулы'}
          title={q ? `Найдено: ${list.length}` : filter === 'all' ? `${RECIPES.length} рецептов` : `${list.length} рецептов`}
        />
      </View>
      <Seg
        inset={space.gutter}
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'all', label: 'Все' },
          ...CATEGORIES.map((c) => ({ key: c as Filter, label: c })),
          { key: 'fav', label: `♥ ${liked.size}` },
        ]}
      />
      <View style={{ height: 6 }} />
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={list}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      renderItem={({ item, index }) => <RecipeRow recipe={item} last={index === list.length - 1} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <T v="heading">{filter === 'fav' ? 'Пока пусто' : 'Ничего не нашлось'}</T>
          <T v="small" style={{ textAlign: 'center' }}>
            {filter === 'fav' ? 'Нажмите ♡ у рецепта, чтобы сохранить его сюда.' : 'Попробуйте другой ингредиент или категорию.'}
          </T>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surf, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  cta: { backgroundColor: colors.honey, borderRadius: radius.xl, padding: 18 },
  ctaTop: { flexDirection: 'row', gap: 12 },
  ctaKicker: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: '#6B4E00' },
  ctaTitle: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 26, letterSpacing: -0.7, color: colors.ink, marginTop: 8 },
  ctaIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ctaLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(28,26,21,0.14)',
  },
  ctaLastText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: '#4A3A10' },
  ctaScore: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    color: colors.honey,
    backgroundColor: colors.ink,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  search: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surf,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 30 },
});
