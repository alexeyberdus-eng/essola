import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { myId, saveMe } from '../../lib/social';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../../components/Icon';
import { RecipeCard } from '../../components/RecipeCard';
import { ScoreBadge } from '../../components/ScoreBadge';
import { LinearGradient } from 'expo-linear-gradient';
import { CountUp, FadeIn, Glow } from '../../components/silk';
import { Button, IconButton, LinkText, Press } from '../../components/ui';
import { HairType, useAuth } from '../../context/AuthContext';
import { SavedScan, useLibrary } from '../../context/LibraryContext';
import { profileSummary, useProfile } from '../../lib/profile';
import { daysLeft, ShelfItem, useUserContent } from '../../context/UserContentContext';
import { DarkBlock, Ring } from '../../components/lab';
import { RECIPES } from '../../data/recipes';
import type { SkinType } from '../../lib/analyze';
import { colors, fonts, GRADIENT, scoreColor, shadow, space, TAB_SPACE } from '../../theme';

const SKIN: { id: SkinType; label: string }[] = [
  { id: 'normal', label: 'Нормальная' },
  { id: 'dry', label: 'Сухая' },
  { id: 'oily', label: 'Жирная' },
  { id: 'combo', label: 'Комбинированная' },
  { id: 'sensitive', label: 'Чувствительная' },
];

const HAIR: { id: HairType; label: string }[] = [
  { id: 'normal', label: 'Нормальные' },
  { id: 'dry', label: 'Сухие' },
  { id: 'oily', label: 'Жирные у корней' },
  { id: 'colored', label: 'Окрашенные' },
  { id: 'damaged', label: 'Повреждённые' },
  { id: 'thin', label: 'Тонкие' },
  { id: 'curly', label: 'Кудрявые' },
];

type TabKey = 'recipes' | 'scans' | 'shelf';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  // Keep the public profile (nickname) in sync for the community.
  useEffect(() => {
    if (user?.nick) saveMe(user.nick, user.name);
  }, [user?.nick, user?.name]);
  const { liked, scans } = useLibrary();
  const { myRecipes, shelf } = useUserContent();
  const favourites = RECIPES.filter((r) => liked.has(r.id));
  const [tab, setTab] = useState<TabKey>('recipes');
  const initial = (user?.name || user?.email || 'E').slice(0, 1).toUpperCase();
  const tabs: { key: TabKey; label: string; n: number }[] = [
    { key: 'recipes', label: 'Мои рецепты', n: favourites.length + myRecipes.length },
    { key: 'scans', label: 'Мои сканы', n: scans.length },
    { key: 'shelf', label: 'Полка', n: shelf.length },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: TAB_SPACE }}>
        <View style={styles.top}>
          <Text style={styles.h1}>Кабинет</Text>
          {user && <IconButton icon="logout" label="Выйти" onPress={signOut} />}
        </View>

        <LinearGradient colors={['#FFC2A8', '#E9D2FF', '#AFCBFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}>
          <View style={styles.card}>
            {user ? (
              <View style={styles.idRow}>
                <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </LinearGradient>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {user.name || user.email?.split('@')[0] || 'Моя лаборатория'}
                  </Text>
                  {!!user.nick && <Text style={styles.nick}>@{user.nick}</Text>}
                  <Text style={styles.mail} numberOfLines={1}>
                    {user.email ?? 'Почта скрыта через Apple'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Text style={styles.name}>Сохраните свою лабораторию</Text>
                <Text style={styles.mail}>Войдите — избранное, история сканов и тип кожи будут с вами на любом устройстве.</Text>
                <Button label="Войти или создать аккаунт" onPress={() => router.push('/auth')} />
              </View>
            )}
            <View style={styles.stats}>
              {([[liked.size + myRecipes.length, 'рецептов'], [scans.length, 'сканов'], [shelf.length, 'на полке']] as const).map(([v, k], i) => (
                <View key={k} style={[styles.stat, i > 0 && styles.statLine]}>
                  <CountUp value={v} style={styles.statValue} />
                  <Text style={styles.statLabel}>{k}</Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>

        <Press onPress={() => router.push('/about-me' as never)} style={styles.me}>
          <LinearGradient colors={['#F1ECFF', '#FFF0E8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
          <View style={styles.meIcon}>
            <Icon name={profile.done ? 'user' : 'spark'} size={20} color={colors.violet} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.meTitle}>{profile.done ? 'Мой профиль кожи и волос' : 'Расскажите о себе'}</Text>
            <Text style={styles.meText} numberOfLines={2}>
              {profile.done ? profileSummary(profile) || 'Заполнено' : 'Кожа, волосы, задачи, беременность, аллергии — и все оценки станут персональными'}
            </Text>
          </View>
          <Icon name="arrowRight" size={16} color={colors.violet} />
        </Press>

        <View style={styles.socialRow}>
          <Press haptic={false} onPress={async () => router.push(`/user/${await myId()}` as never)} style={styles.socialTile}>
            <Icon name="user" size={20} color={colors.violet} strokeWidth={2} />
            <Text style={styles.socialTitle}>Мой профиль</Text>
            <Text style={styles.socialText}>как его видят другие</Text>
          </Press>
          <Press haptic={false} onPress={() => router.push('/forum' as never)} style={styles.socialTile}>
            <Icon name="heart" size={20} color={colors.violet} strokeWidth={2} />
            <Text style={styles.socialTitle}>Форум</Text>
            <Text style={styles.socialText}>темы и рецепты</Text>
          </Press>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter, marginTop: 22 }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 6 }}>
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <Press key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
                {t.n > 0 && <Text style={[styles.tabN, on && { color: colors.onDarkMuted }]}>{t.n}</Text>}
              </Press>
            );
          })}
        </ScrollView>

        <View style={{ marginTop: 14 }}>
          {tab === 'recipes' && (
            <Press haptic={false} onPress={() => router.push('/import-recipes' as never)} style={styles.importRow}>
              <Icon name="plus" size={16} color={colors.violet} />
              <Text style={styles.importText}>Загрузить рецепты из таблицы (CSV)</Text>
            </Press>
          )}
          {tab === 'recipes' &&
            (favourites.length || myRecipes.length ? (
              <>
                {myRecipes.length > 0 && <Text style={styles.group}>Мои формулы</Text>}
                {myRecipes.map((r, i) => <RecipeCard key={r.id} recipe={r} index={i} />)}
                {favourites.length > 0 && <Text style={styles.group}>Сохранённые</Text>}
                {favourites.map((r, i) => <RecipeCard key={r.id} recipe={r} index={i + 1} />)}
              </>
            ) : (
              <Empty icon="heart" text="Отмечайте рецепты сердцем или соберите свою формулу в конструкторе — всё будет здесь." cta="К рецептам" onPress={() => router.navigate('/')} />
            ))}
          {tab === 'scans' &&
            (scans.length ? (
              <ScanHistory scans={scans} />
            ) : (
              <Empty icon="scan" text="Сфотографируйте состав любого средства — здесь появятся ваши сканы." cta="Открыть сканер" onPress={() => router.navigate('/scanner')} />
            ))}
          {tab === 'shelf' && <Shelf />}
        </View>
      </ScrollView>
    </View>
  );
}

const VERDICT = (v: number) => (v >= 80 ? 'Отличный состав' : v >= 60 ? 'Хороший состав' : v >= 40 ? 'Есть вопросы' : 'Много спорного');

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/** Scans grouped by day: score ring, name, verdict and how it was scanned. */
function ScanHistory({ scans }: { scans: SavedScan[] }) {
  const groups: { day: string; list: SavedScan[] }[] = [];
  for (const sc of scans) {
    const day = dayLabel(sc.createdAt);
    const g = groups[groups.length - 1];
    if (g?.day === day) g.list.push(sc);
    else groups.push({ day, list: [sc] });
  }
  return (
    <View style={{ gap: 6 }}>
      {groups.map((g) => (
        <View key={g.day} style={{ gap: 8 }}>
          <Text style={styles.group}>{g.day}</Text>
          {g.list.map((sc, i) => (
            <FadeIn key={sc.id} index={i}>
              <Press haptic={false} onPress={() => router.push(`/analysis/${sc.id}`)} style={styles.scanCard}>
                <ScoreBadge value={sc.overall} size={52} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.scanTitle} numberOfLines={2}>
                    {sc.title}
                  </Text>
                  <Text style={[styles.verdict, { color: scoreColor(sc.overall) }]}>{VERDICT(sc.overall)}</Text>
                  <View style={styles.scanMeta}>
                    <Icon name={sc.barcode ? 'barcode' : 'camera'} size={12} color={colors.muted} />
                    <Text style={styles.mail}>
                      {sc.barcode ? 'По штрихкоду' : 'По фото состава'} · {new Date(sc.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <Icon name="arrowRight" size={16} color={colors.faint} />
              </Press>
            </FadeIn>
          ))}
        </View>
      ))}
    </View>
  );
}

function Shelf() {
  const { shelf, conflicts, removeFromShelf } = useUserContent();
  return (
    <View>
      <View style={styles.shelfHead}>
        <Text style={styles.label}>Сроки годности и совместимость</Text>
        <LinkText label="Добавить" onPress={() => router.push('/shelf-add')} />
      </View>
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
        <Empty icon="shelf" text="Добавьте свои средства — напомним о сроке годности и предупредим, что нельзя наносить вместе." cta="Добавить" onPress={() => router.push('/shelf-add')} />
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

function Empty({ icon, text, cta, onPress }: { icon: IconName; text: string; cta: string; onPress: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={22} color={colors.violet} />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
      <Press onPress={onPress} style={styles.emptyBtn}>
        <Text style={styles.emptyBtnText}>{cta}</Text>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  importRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CFC4F7', marginBottom: 10 },
  importText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.violet },
  socialRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  socialTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: '#EAE6F7' },
  socialTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink, marginTop: 2 },
  socialText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  nick: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  me: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: '#E4DCFF', overflow: 'hidden' },
  meIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  meTitle: { fontFamily: fonts.display, fontSize: 16.5, color: colors.ink },
  meText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.ink2, marginTop: 2 },
  group: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: 10, marginBottom: 4 },
  scanCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow },
  ringScore: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  verdict: { fontFamily: fonts.semibold, fontSize: 12.5 },
  scanMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  h1: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -1.1, color: colors.ink },
  frame: { marginTop: 10, borderRadius: 26, padding: 1.5 },
  card: { borderRadius: 24.5, backgroundColor: 'rgba(255,255,255,0.96)', padding: 18, gap: 16 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  name: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.5, color: colors.ink },
  mail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, paddingTop: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statLine: { borderLeftWidth: 1, borderColor: colors.line },
  statValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.6, color: colors.ink },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  skin: { marginTop: 18, gap: 10 },
  label: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 99, backgroundColor: colors.surf, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink2 },
  chipTextOn: { color: colors.onDark, fontFamily: fonts.semibold },
  tab: { height: 38, paddingHorizontal: 15, borderRadius: 99, backgroundColor: colors.surf, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabN: { fontFamily: fonts.monoMedium, fontSize: 11.5, color: colors.muted },
  shelfHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow },
  score: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontFamily: fonts.monoMedium, fontSize: 14, color: '#fff' },
  scanTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 24, borderRadius: 24, backgroundColor: colors.surf },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2, textAlign: 'center' },
  emptyBtn: { marginTop: 4, height: 40, paddingHorizontal: 18, borderRadius: 99, backgroundColor: colors.ink, justifyContent: 'center' },
  emptyBtnText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.onDark },
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
});
