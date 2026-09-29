import { router } from 'expo-router';
import { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLibrary } from '../context/LibraryContext';
import { LEVELS, Recipe } from '../data/recipes';
import { colors, fonts, radius, shadow } from '../theme';
import { Icon } from './Icon';
import { RecipeCover } from './RecipeCover';
import { Press, tap } from './ui';

export function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(n);
}

export function LikeButton({ id, variant = 'plain', size = 20 }: { id: string; variant?: 'plain' | 'glass' | 'pill'; size?: number }) {
  const { isLiked, toggleLike, likeCount } = useLibrary();
  const liked = isLiked(id);
  const pop = useRef(new Animated.Value(1)).current;

  const onPress = () => {
    tap(liked ? 'light' : 'medium');
    pop.setValue(0.7);
    Animated.spring(pop, { toValue: 1, friction: 3, tension: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    toggleLike(id);
  };

  const color = liked ? colors.bad : variant === 'pill' ? colors.ink : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Убрать лайк' : 'Поставить лайк'}
      style={[variant === 'glass' && styles.glass, variant === 'pill' && styles.pill]}
    >
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Icon name={liked ? 'heartFill' : 'heart'} size={size} color={color} />
      </Animated.View>
      {variant === 'pill' && <Text style={styles.pillText}>{formatCount(likeCount(id))}</Text>}
    </Pressable>
  );
}

export function RecipeCard({ recipe, wide }: { recipe: Recipe; wide?: boolean }) {
  const { likeCount } = useLibrary();
  return (
    <Press haptic={false} onPress={() => router.push(`/recipe/${recipe.id}`)} style={[styles.card, wide && { width: 272 }]}>
      <View>
        <RecipeCover recipe={recipe} style={[styles.cover, wide && { height: 190 }]} />
        <View style={styles.like}>
          <LikeButton id={recipe.id} variant="glass" size={18} />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {recipe.title}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {recipe.subtitle}
        </Text>
        <View style={styles.meta}>
          <Icon name="clock" size={13} color={colors.muted} />
          <Text style={styles.metaText}>{recipe.minutes} мин</Text>
          {wide && (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.metaText}>{LEVELS[recipe.level]}</Text>
            </>
          )}
          <View style={{ flex: 1 }} />
          <Icon name="heart" size={12} color={colors.muted} />
          <Text style={styles.metaText}>{formatCount(likeCount(recipe.id))}</Text>
        </View>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
    ...shadow,
  },
  cover: { height: 150 },
  like: { position: 'absolute', top: 10, right: 10 },
  glass: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
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
  pillText: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  body: { padding: 14, paddingTop: 12, gap: 3 },
  title: { fontFamily: fonts.medium, fontSize: 16.5, letterSpacing: -0.3, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, minHeight: 36 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  metaText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.muted, letterSpacing: 0.3 },
  dot: { color: colors.faint },
});
