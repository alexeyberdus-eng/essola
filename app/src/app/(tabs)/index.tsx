import { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedPost } from '../../components/FeedPost';
import { Icon } from '../../components/Icon';
import { FadeIn, Glow } from '../../components/silk';
import { IconButton, Seg, T, Wordmark } from '../../components/ui';
import { useCommunity } from '../../context/CommunityContext';
import { useLibrary } from '../../context/LibraryContext';
import { recipeMeta } from '../../data/community';
import { CATEGORIES, Category, RECIPES } from '../../data/recipes';
import { colors, fonts, space, TAB_SPACE } from '../../theme';

type Sort = 'for-you' | 'new' | 'hot' | 'saved';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { liked, likeCount } = useLibrary();
  const { count } = useCommunity();
  const [sort, setSort] = useState<Sort>('for-you');
  const [cat, setCat] = useState<'all' | Category>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef<TextInput>(null);

  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    let l = RECIPES.filter((r) => {
      if (sort === 'saved' && !liked.has(r.id)) return false;
      if (cat !== 'all' && r.category !== cat) return false;
      if (!q) return true;
      return [r.title, r.subtitle, r.category, ...r.ingredients.map((i) => i.name)].some((t) => t.toLowerCase().includes(q));
    });
    if (sort === 'new') l = [...l].sort((a, b) => recipeMeta(a).postedAgo - recipeMeta(b).postedAgo);
    if (sort === 'hot') l = [...l].sort((a, b) => count(b.id) - count(a.id));
    if (sort === 'for-you') l = [...l].sort((a, b) => likeCount(b.id) - likeCount(a.id));
    return l;
  }, [sort, cat, q, liked, likeCount, count]);

  const toggleSearch = () => {
    if (searching) {
      setQuery('');
      setSearching(false);
    } else {
      setSearching(true);
      setTimeout(() => input.current?.focus(), 60);
    }
  };

  const header = (
    <View style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <Wordmark />
        <IconButton icon={searching ? 'close' : 'search'} label="Поиск" onPress={toggleSearch} />
      </View>
      {searching && (
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
      )}
      <Seg
        inset={space.gutter}
        value={sort}
        onChange={setSort}
        options={[
          { key: 'for-you', label: 'Для вас' },
          { key: 'new', label: 'Новое' },
          { key: 'hot', label: 'Обсуждают' },
          { key: 'saved', label: `♥ ${liked.size}` },
        ]}
      />
      <View style={{ height: 8 }} />
      <Seg
        small
        inset={space.gutter}
        value={cat}
        onChange={setCat}
        options={[{ key: 'all', label: 'Все' }, ...CATEGORIES.map((c) => ({ key: c as 'all' | Category, label: c }))]}
      />
      <View style={{ height: 16 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: TAB_SPACE }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={4}
        renderItem={({ item, index }) => (
          <FadeIn index={index}>
            <FeedPost recipe={item} />
          </FadeIn>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <T v="heading">{sort === 'saved' ? 'Пока пусто' : 'Ничего не нашлось'}</T>
            <Text style={styles.emptyText}>{sort === 'saved' ? 'Нажмите ♡ под рецептом, чтобы сохранить его.' : 'Попробуйте другой ингредиент или категорию.'}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  search: { height: 48, borderRadius: 99, backgroundColor: colors.surf, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
});
