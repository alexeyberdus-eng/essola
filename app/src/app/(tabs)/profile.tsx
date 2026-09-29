import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { RecipeRow } from '../../components/RecipeRow';
import { Button, LinkText, Press, SectionHead, T, Tag } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { RECIPES } from '../../data/recipes';
import type { SkinType } from '../../lib/analyze';
import { colors, fonts, radius, scoreColor, space } from '../../theme';

const SKIN: { id: SkinType; label: string }[] = [
  { id: 'normal', label: 'Нормальная' },
  { id: 'dry', label: 'Сухая' },
  { id: 'oily', label: 'Жирная' },
  { id: 'combo', label: 'Комбинированная' },
  { id: 'sensitive', label: 'Чувствительная' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateProfile, signOut } = useAuth();
  const { liked, scans } = useLibrary();
  const favourites = RECIPES.filter((r) => liked.has(r.id));
  const since = user ? new Date(user.since).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) : '—';
  const initial = (user?.name || user?.email || 'E').slice(0, 1).toUpperCase();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: space.gutter, paddingBottom: 40, gap: space.xxl }}
    >
      <View style={{ gap: 14 }}>
        <T v="title">Кабинет</T>
        {user ? (
          <View style={styles.card}>
            <View style={styles.idRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {user.name || user.email?.split('@')[0] || 'Моя лаборатория'}
                </Text>
                <T v="small" numberOfLines={1}>
                  {user.email ?? 'Почта скрыта через Apple'}
                </T>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  <Tag label={user.provider === 'apple' ? 'Apple ID' : 'Почта'} tone="honey" />
                  {user.local && <Tag label="На этом устройстве" />}
                </View>
              </View>
            </View>
            <Stats liked={liked.size} scans={scans.length} since={since} />
          </View>
        ) : (
          <View style={[styles.card, { gap: 14 }]}>
            <T v="heading">Сохраните свою лабораторию</T>
            <T style={{ fontSize: 14, lineHeight: 20 }}>Войдите через Apple ID или почту — избранное, история сканов и тип кожи будут с вами.</T>
            <Button label="Войти или создать аккаунт" onPress={() => router.push('/auth')} />
            <Stats liked={liked.size} scans={scans.length} />
          </View>
        )}
      </View>

      {user && (
        <View style={{ gap: 12 }}>
          <SectionHead kicker="Для персонального разбора" title="Тип кожи" />
          <View style={styles.chips}>
            {SKIN.map((s) => {
              const on = user.skinType === s.id;
              return (
                <Press key={s.id} onPress={() => updateProfile({ skinType: on ? null : s.id })} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && { color: colors.bg }]}>{s.label}</Text>
                </Press>
              );
            })}
          </View>
        </View>
      )}

      <View>
        <SectionHead kicker="Коллекция" title="Избранные формулы" right={<T v="label">{favourites.length}</T>} />
        {favourites.length ? (
          favourites.map((r, i) => <RecipeRow key={r.id} recipe={r} last={i === favourites.length - 1} />)
        ) : (
          <Empty text="Отмечайте формулы сердцем — они соберутся здесь." cta="К формулам" onPress={() => router.navigate('/')} />
        )}
      </View>

      <View>
        <SectionHead kicker="Сканер" title="История проверок" right={<T v="label">{scans.length}</T>} />
        {scans.length ? (
          scans.map((s) => (
            <Press key={s.id} haptic={false} onPress={() => router.push(`/analysis/${s.id}`)} style={styles.scan}>
              <View style={[styles.score, { backgroundColor: scoreColor(s.overall) }]}>
                <Text style={styles.scoreText}>{s.overall}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scanTitle} numberOfLines={1}>
                  {s.title}
                </Text>
                <T v="small">{new Date(s.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</T>
              </View>
              <Icon name="arrowRight" size={16} color={colors.muted} />
            </Press>
          ))
        ) : (
          <Empty text="Сфотографируйте состав любого средства — здесь появится история." cta="Открыть сканер" onPress={() => router.navigate('/scanner')} />
        )}
      </View>

      {user && <Button label="Выйти" icon="logout" variant="outline" onPress={signOut} />}
    </ScrollView>
  );
}

function Stats({ liked, scans, since }: { liked: number; scans: number; since?: string }) {
  const cells: [string | number, string][] = [
    [liked, 'Избранное'],
    [scans, 'Проверок'],
  ];
  if (since) cells.push([since, 'С нами с']);
  return (
    <View style={styles.stats}>
      {cells.map(([v, k], i) => (
        <View key={k} style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderColor: colors.line }]}>
          <Text style={[styles.statValue, typeof v === 'string' && { fontSize: 15, lineHeight: 26 }]} numberOfLines={1}>
            {v}
          </Text>
          <T v="label" style={{ fontSize: 9.5 }}>
            {k}
          </T>
        </View>
      ))}
    </View>
  );
}

function Empty({ text, cta, onPress }: { text: string; cta: string; onPress: () => void }) {
  return (
    <View style={styles.empty}>
      <T v="small" style={{ flex: 1 }}>
        {text}
      </T>
      <LinkText label={cta} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 16 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.honey, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semibold, fontSize: 24, color: colors.ink },
  name: { fontFamily: fonts.semibold, fontSize: 19, letterSpacing: -0.5, color: colors.ink },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, paddingTop: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 26, letterSpacing: -0.6, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.surf, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink2 },
  scan: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderColor: colors.line },
  score: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontFamily: fonts.monoMedium, fontSize: 14, color: '#fff' },
  scanTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line },
});
