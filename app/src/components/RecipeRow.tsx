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

// Bubbles float up from the heart like in a flask; angles point mostly upwards.
const SPARKS = [-160, -125, -95, -70, -40, -15];

/** Bubbles rising out of a heart when it gets liked. */
export function Burst({ trigger, size }: { trigger: Animated.Value; size: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {SPARKS.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const dist = size * (1.1 + (deg % 3) * 0.15);
        return (
          <Animated.View
            key={deg}
            style={[
              styles.spark,
              {
                opacity: trigger.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: trigger.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * dist] }) },
                  { translateY: trigger.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * dist] }) },
                  { scale: trigger.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.1] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export function LikeButton({ id, size = 19, withCount, showCount, dark }: { id: string; size?: number; withCount?: boolean; showCount?: boolean; dark?: boolean }) {
  const { isLiked, toggleLike, likeCount } = useLibrary();
  const liked = isLiked(id);
  const pop = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const onPress = () => {
    tap(liked ? 'light' : 'medium');
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, friction: 3, tension: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    if (!liked) {
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 520, useNativeDriver: Platform.OS !== 'web' }).start();
    }
    toggleLike(id);
  };
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Убрать из избранного' : 'В избранное'}
      style={withCount ? styles.pill : showCount ? styles.inline : undefined}
    >
      <View>
        <Burst trigger={burst} size={size} />
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Icon name={liked ? 'heartFill' : 'heart'} size={size} color={liked ? (dark ? colors.brassLight : colors.bad) : dark ? colors.onDarkMuted : withCount || showCount ? colors.ink : colors.muted} />
        </Animated.View>
      </View>
      {(withCount || showCount) && <Text style={[styles.pillText, showCount && styles.countText, dark && { color: colors.onDark }]}>{formatCount(likeCount(id))}</Text>}
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
  tile: { borderRadius: 12, backgroundColor: colors.sageSoft, alignItems: 'center', justifyContent: 'center' },
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
  spark: { position: 'absolute', width: 7, height: 7, borderRadius: 4, borderWidth: 1.2, borderColor: colors.sageDeep, backgroundColor: 'rgba(255,255,255,0.7)' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countText: { fontFamily: fonts.medium, fontSize: 13.5 },
  pillText: { fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.ink },
});
