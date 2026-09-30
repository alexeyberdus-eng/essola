import { router } from 'expo-router';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useCommunity } from '../context/CommunityContext';
import { plural, recipeMeta, timeAgo } from '../data/community';
import { LEVELS, Recipe } from '../data/recipes';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';
import { LikeButton } from './RecipeRow';
import { Avatar, Card, ProductPhoto } from './silk';
import { Press } from './ui';

export function FeedPost({ recipe }: { recipe: Recipe }) {
  const { count, best } = useCommunity();
  const meta = recipeMeta(recipe);
  const n = count(recipe.id);
  const top = best(recipe.id);
  const open = () => router.push(`/recipe/${recipe.id}`);
  const comments = () => router.push(`/comments/${recipe.id}`);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Avatar name={meta.author.name} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{meta.author.name}</Text>
          <Text style={styles.role}>
            {meta.author.role} · {timeAgo(meta.postedAgo)}
          </Text>
        </View>
      </View>

      <Press haptic={false} onPress={open}>
        <ProductPhoto kind={meta.bottle} tone={recipe.tone} height={210} radius={18} />
      </Press>

      <Press haptic={false} onPress={open} style={{ marginTop: 12 }}>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.sub}>
          {recipe.subtitle} · {recipe.skin[0].toLowerCase()} кожа
        </Text>
      </Press>
      <View style={styles.tags}>
        {[`${recipe.minutes} мин`, recipe.category, LEVELS[recipe.level]].map((t) => (
          <Text key={t} style={styles.tag}>
            {t}
          </Text>
        ))}
      </View>

      <View style={styles.actions}>
        <LikeButton id={recipe.id} size={20} showCount />
        <Press haptic={false} onPress={comments} style={styles.action} accessibilityLabel="Комментарии">
          <Icon name="comment" size={20} />
          <Text style={styles.actionText}>{n}</Text>
        </Press>
        <View style={{ flex: 1 }} />
        <Press
          haptic={false}
          onPress={() => Share.share({ message: `${recipe.title} — ${recipe.subtitle}. Рецепт в Essola` }).catch(() => {})}
          accessibilityLabel="Поделиться"
        >
          <Icon name="send" size={19} />
        </Press>
      </View>

      {top && (
        <Press haptic={false} onPress={comments} style={styles.best}>
          <View style={styles.bestHead}>
            <Text style={styles.bestLabel}>Лучший ответ</Text>
            <View style={styles.bestWho}>
              <Avatar name={top.author} size={20} />
              <Text style={styles.bestName}>{top.author}</Text>
            </View>
          </View>
          <Text style={styles.bestText} numberOfLines={3}>
            {top.text}
          </Text>
          <View style={styles.more}>
            <Text style={styles.moreText}>
              Все {n} {plural(n, 'комментарий', 'комментария', 'комментариев')}
            </Text>
            <Icon name="arrowRight" size={13} color={colors.honeyText} />
          </View>
        </Press>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  author: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  role: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  title: { fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.6, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 10 },
  tag: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.ink2, backgroundColor: colors.surf, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
  best: { marginTop: 12, borderRadius: 14, padding: 12, backgroundColor: colors.honeySoft, borderWidth: 1, borderColor: '#F7E6A8' },
  bestHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bestLabel: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.honeyText },
  bestWho: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bestName: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink },
  bestText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink2, marginTop: 6 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  moreText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.honeyText },
});
