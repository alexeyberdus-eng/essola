import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecipeCard } from '../../components/RecipeCard';
import { Glow } from '../../components/silk';
import { Button, IconButton, tap } from '../../components/ui';
import { COMMUNITY_RECIPES, Recipe } from '../../data/recipes';
import { follow, getUser, myId, PublicUser } from '../../lib/social';
import { colors, fonts, GRADIENT, space } from '../../theme';

/** Someone's public profile: nickname, recipes, followers and a follow button. */
export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [followers, setFollowers] = useState(0);
  const [follows, setFollows] = useState(0);
  const [following, setFollowing] = useState(false);
  const [me, setMe] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    myId().then(setMe);
    getUser(id)
      .then((d) => {
        setUser(d.user);
        const list = d.recipes.map((r) => {
          const x: Recipe = { ...r, own: false, author: d.user ? { id: d.user.id, nick: d.user.nick } : undefined };
          COMMUNITY_RECIPES.set(x.id, x);
          return x;
        });
        setRecipes(list);
        setFollowers(d.followers);
        setFollows(d.follows ?? 0);
        setFollowing(d.following);
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [id]);

  const toggle = async () => {
    tap('medium');
    const next = !following;
    setFollowing(next);
    setFollowers((n) => n + (next ? 1 : -1));
    try {
      const res = await follow(id, next);
      setFollowers(res.followers);
    } catch {
      setFollowing(!next);
    }
  };

  const initial = (user?.nick || '?').slice(0, 1).toUpperCase();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <View style={{ height: 48, justifyContent: 'center' }}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => router.back()} />
        </View>
        {busy ? (
          <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} />
        ) : !user ? (
          <Text style={styles.sub}>{me === id ? 'Ваш публичный профиль появится, когда вы войдёте в аккаунт и сохраните первый рецепт в конструкторе.' : 'Профиль не найден.'}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
              <Text style={styles.nick}>@{user.nick}</Text>
              {user.club && (
                <View style={styles.clubBadge}>
                  <Text style={styles.clubBadgeText}>✦ Essola Клуб</Text>
                </View>
              )}
              {!!user.name && <Text style={styles.name}>{user.name}</Text>}
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statN}>{recipes.length}</Text>
                  <Text style={styles.statL}>рецептов</Text>
                </View>
                <View style={[styles.stat, styles.statLine]}>
                  <Text style={styles.statN}>{followers}</Text>
                  <Text style={styles.statL}>подписчиков</Text>
                </View>
                <View style={[styles.stat, styles.statLine]}>
                  <Text style={styles.statN}>{follows}</Text>
                  <Text style={styles.statL}>подписок</Text>
                </View>
              </View>
              {me !== id && <Button label={following ? 'Вы подписаны' : 'Подписаться'} icon={following ? 'check' : 'plus'} variant={following ? 'outline' : undefined} onPress={toggle} style={{ alignSelf: 'stretch' }} />}
            </View>
            <Text style={styles.h2}>{recipes.length ? 'Рецепты' : 'Рецептов пока нет'}</Text>
            {recipes.map((r, i) => (
              <RecipeCard key={r.id} recipe={r} index={i} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', padding: 20, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: '#EAE6F7', gap: 6 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  nick: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginTop: 6 },
  clubBadge: { marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: colors.tint },
  clubBadgeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.violetDeep },
  name: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  stats: { flexDirection: 'row', alignSelf: 'stretch', marginVertical: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statLine: { borderLeftWidth: 1, borderColor: colors.line },
  statN: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  statL: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  h2: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginTop: 22, marginBottom: 10 },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink2, marginTop: 20 },
});
