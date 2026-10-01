import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecipeCard } from '../components/RecipeCard';
import { Glow } from '../components/silk';
import { IconButton } from '../components/ui';
import { COMMUNITY_RECIPES, Recipe } from '../data/recipes';
import { recentRecipes } from '../lib/social';
import { colors, fonts, space } from '../theme';

/** Fresh recipes published by essola users, newest first. */
export default function Community() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Recipe[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await recentRecipes();
      const recipes = list.map(({ recipe, user }) => {
        const r: Recipe = { ...recipe, own: false, author: { id: user.id, nick: user.nick } };
        COMMUNITY_RECIPES.set(r.id, r);
        return r;
      });
      setItems(recipes);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <FlatList
        data={items ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <View style={{ height: 48, justifyContent: 'center' }}>
              <IconButton icon="arrowLeft" label="Назад" onPress={() => router.back()} />
            </View>
            <Text style={styles.h1}>Сообщество</Text>
            <Text style={styles.sub}>Свежие рецепты пользовательниц essola. Нажмите на автора, чтобы открыть профиль и подписаться.</Text>
            {items === null && <ActivityIndicator color={colors.violet} style={{ marginTop: 30 }} />}
            {items?.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Здесь пока пусто. Соберите формулу в конструкторе и сохраните её как рецепт — она появится в сообществе.</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => <RecipeCard recipe={item} index={index} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -1, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2, marginTop: 6 },
  empty: { marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: '#F4F0FF' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2 },
});
