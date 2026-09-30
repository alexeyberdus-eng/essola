import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { RecipeRow } from '../../components/RecipeRow';
import { LinearGradient } from 'expo-linear-gradient';
import { CountUp, FadeIn, Glow } from '../../components/silk';
import { Button, LinkText, Press, SectionHead, T, Tag } from '../../components/ui';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { daysLeft, ShelfItem, useUserContent } from '../../context/UserContentContext';
import { DarkBlock, Ring } from '../../components/lab';
import { RECIPES } from '../../data/recipes';
import type { SkinType } from '../../lib/analyze';
import { colors, fonts, radius, scoreColor, shadow, space, TAB_SPACE } from '../../theme';

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
  const { myRecipes } = useUserContent();
  const favourites = RECIPES.filter((r) => liked.has(r.id));
  const since = user ? new Date(user.since).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) : '—';
  const initial = (user?.name || user?.email || 'E').slice(0, 1).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <Glow />
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: space.gutter, paddingBottom: TAB_SPACE, gap: space.xxl }}
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
        <FadeIn index={1} style={styles.skin}>
          <LinearGradient colors={['#E7E9DC', '#F7F4EC', '#E9E0CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
          <SectionHead kicker="Профиль кожи · для персональных подсказок" title="Тип кожи" />
          <View style={styles.chips}>
            {SKIN.map((s) => {
              const on = user.skinType === s.id;
              return (
                <Press key={s.id} onPress={() => updateProfile({ skinType: on ? null : s.id })} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && { color: colors.onDark, fontFamily: fonts.semibold }]}>{s.label}</Text>
                </Press>
              );
            })}
          </View>
        </FadeIn>
      )}

      <Shelf />

      {myRecipes.length > 0 && (
        <View>
          <SectionHead kicker="Мои формулы" title="Мои рецепты" right={<T v="label">{myRecipes.length}</T>} />
          {myRecipes.map((r, i) => (
            <RecipeRow key={r.id} recipe={r} last={i === myRecipes.length - 1} />
          ))}
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
    </View>
  );
}

function Stats({ liked, scans }: { liked: number; scans: number; since?: string }) {
  const { mineCount } = useCommunity();
  const { myRecipes } = useUserContent();
  const cells: [number, string][] = [
    [liked, 'Избранное'],
    [scans, 'Проверок'],
    [myRecipes.length || mineCount, myRecipes.length ? 'Мои рецепты' : 'Комментариев'],
  ];
  return (
    <View style={styles.stats}>
      {cells.map(([v, k], i) => (
        <View key={k} style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderColor: colors.line }]}>
          <CountUp value={v} style={styles.statValue} />
          <T v="label" style={{ fontSize: 9.5 }}>
            {k}
          </T>
        </View>
      ))}
    </View>
  );
}

function Shelf() {
  const { shelf, conflicts, removeFromShelf } = useUserContent();
  return (
    <View>
      <SectionHead kicker="Сроки и совместимость" title="Моя полка" right={<LinkText label="Добавить" onPress={() => router.push('/shelf-add')} />} />
      {conflicts.map((c) => (
        <DarkBlock key={c.a.id + c.b.id} style={styles.conflict}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Icon name="alert" size={17} color={colors.brassLight} />
            <View style={{ flex: 1 }}>
              <Text style={styles.conflictTitle}>
                Не наносите вместе: {c.a.name} и {c.b.name}
              </Text>
              <Text style={styles.conflictText}>{c.text}</Text>
            </View>
          </View>
        </DarkBlock>
      ))}
      {shelf.length ? (
        <View style={styles.shelf}>
          {shelf.map((item, i) => (
            <FadeIn key={item.id} index={i} style={styles.shelfCell}>
              <ShelfCard item={item} onRemove={() => removeFromShelf(item.id)} />
            </FadeIn>
          ))}
        </View>
      ) : (
        <Empty text="Добавьте свои средства: Essola напомнит о сроке годности и предупредит, что нельзя смешивать." cta="Сканер" onPress={() => router.navigate("/scanner")} />
      )}
    </View>
  );
}

function ShelfCard({ item, onRemove }: { item: ShelfItem; onRemove: () => void }) {
  const left = daysLeft(item);
  const all = Math.round(item.pao * 30.4);
  const soon = left <= 14;
  return (
    <Press haptic={false} onPress={() => item.scanId && router.push(`/analysis/${item.scanId}`)} style={[styles.shelfCard, soon && styles.shelfSoon]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Ring value={all ? (left / all) * 100 : 0} size={46} stroke={4} color={soon ? colors.bad : colors.good} track="rgba(138,154,123,0.18)">
          <Text style={styles.ringText}>{left}</Text>
        </Ring>
        <Press haptic={false} onPress={onRemove} hitSlop={10}>
          <Icon name="close" size={14} color={colors.faint} />
        </Press>
      </View>
      <Text style={styles.shelfKind}>{item.kind}</Text>
      <Text style={styles.shelfName} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={[styles.shelfLeft, soon && { color: colors.bad }]}>{left === 0 ? 'срок вышел — пора заменить' : soon ? `осталось ${left} дн. — скоро заменить` : `осталось ${left} дн.`}</Text>
    </Press>
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
  card: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', padding: 18, gap: 16, ...shadow },
  skin: { gap: 12, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', overflow: 'hidden' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 62, height: 62, borderRadius: 22, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 26, color: colors.brassLight },
  name: { fontFamily: fonts.semibold, fontSize: 19, letterSpacing: -0.5, color: colors.ink },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, paddingTop: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 26, letterSpacing: -0.6, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 99, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.olive },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink2 },
  conflict: { padding: 14, marginTop: 10 },
  conflictTitle: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18, color: colors.onDark },
  conflictText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: 'rgba(239,235,224,0.72)', marginTop: 3 },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  shelfCell: { width: '48.5%' },
  shelfCard: { padding: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', ...shadow },
  shelfSoon: { backgroundColor: 'rgba(243,225,217,0.85)', borderColor: 'rgba(181,86,63,0.3)' },
  ringText: { fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.ink },
  shelfKind: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted, marginTop: 8 },
  shelfName: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 17, color: colors.ink, marginTop: 2 },
  shelfLeft: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 3 },
  scan: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderColor: colors.line },
  score: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontFamily: fonts.monoMedium, fontSize: 14, color: '#fff' },
  scanTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line },
});
