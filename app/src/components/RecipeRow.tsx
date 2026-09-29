import { router } from 'expo-router';
import { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLibrary } from '../context/LibraryContext';
import { LEVELS, Recipe } from '../data/recipes';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';
import { Press, tap } from './ui';
import { Vial } from './Vial';

export function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(n);
}

export function LikeButton({ id, size = 19, withCount }: { id: string; size?: number; withCount?: boolean }) {
  const { isLiked, toggleLike, likeCount } = useLibrary();
  const liked = isLiked(id);
  const pop = useRef(new Animated.Value(1)).current;
  const onPress = () => {
    tap(liked ? 'light' : 'medium');
    pop.setValue(0.7);
    Animated.spring(pop, { toValue: 1, friction: 3, tension: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    toggleLike(id);
  };
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Убрать из избранного' : 'В избранное'}
      style={withCount ? styles.pill : undefined}
    >
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Icon name={liked ? 'heartFill' : 'heart'} size={size} color={liked ? colors.bad : withCount ? colors.ink : colors.muted} />
      </Animated.View>
      {withCount && <Text style={styles.pillText}>{formatCount(likeCount(id))}</Text>}
    </Pressable>
  );
}

export function VialTile({ recipe, size = 58 }: { recipe: Recipe; size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size * (size > 60 ? 1.3 : 1) }]}>
      <Vial recipe={recipe} height={size * (size > 60 ? 0.95 : 0.8)} />
    </View>
  );
}

export function RecipeRow({ recipe, last }: { recipe: Recipe; last?: boolean }) {
  return (
    <Press haptic={false} onPress={() => router.push(`/recipe/${recipe.id}`)} style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <VialTile recipe={recipe} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {recipe.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {recipe.subtitle}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{recipe.category}</Text>
          <Text style={styles.metaText}>{recipe.minutes} мин</Text>
          <Text style={styles.metaText}>{LEVELS[recipe.level]}</Text>
        </View>
      </View>
      <View style={{ alignSelf: 'flex-start', paddingTop: 4 }}>
        <LikeButton id={recipe.id} size={18} />
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line },
  tile: { borderRadius: 12, backgroundColor: colors.honeySoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.semibold, fontSize: 15.5, letterSpacing: -0.2, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  meta: { flexDirection: 'row', gap: 10, marginTop: 5 },
  metaText: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  pill: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillText: { fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.ink },
});
