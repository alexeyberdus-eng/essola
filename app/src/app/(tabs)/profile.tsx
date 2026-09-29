import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { LogoMark } from '../../components/Logo';
import { RecipeCard } from '../../components/RecipeCard';
import { Button, Chip, Hairline, Press, ScoreRing, SectionTitle, T, Tag } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { RECIPES } from '../../data/recipes';
import type { SkinType } from '../../lib/analyze';
import { colors, fonts, radius, shadow, space } from '../../theme';

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
  const since = user ? new Date(user.since).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) : '';
  const initial = (user?.name || user?.email || 'E').slice(0, 1).toUpperCase();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120, gap: space.xxl }}>
      <View style={styles.pad}>
        <T v="label">Личный кабинет</T>
        {user ? (
          <View style={styles.card}>
            <View style={styles.idRow}>
              <View style={styles.monogram}>
                <Text style={styles.monogramText}>{initial}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {user.name || user.email?.split('@')[0] || 'Моя лаборатория'}
                </Text>
                <T v="small" numberOfLines={1}>
                  {user.email ?? 'Почта скрыта через Apple'}
                </T>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <Tag label={user.provider === 'apple' ? 'Apple ID' : 'Почта'} tone="gold" />
                  {user.local && <Tag label="На этом устройстве" />}
                </View>
              </View>
            </View>
            <Hairline />
            <View style={styles.stats}>
              <Stat value={liked.size} label="Избранное" />
              <View style={styles.statDivider} />
              <Stat value={scans.length} label="Сканов" />
              <View style={styles.statDivider} />
              <Stat value={since} label="С нами с" small />
            </View>
          </View>
        ) : (
          <View style={[styles.card, { gap: 16 }]}>
            <LogoMark size={52} color={colors.goldDeep} />
            <Text style={styles.guestTitle}>
              Ваша <Text style={styles.serif}>лаборатория</Text>
            </Text>
            <T>Войдите через Apple ID или почту, чтобы избранное и история сканов были с вами на любом устройстве.</T>
            <Button label="Войти или создать аккаунт" onPress={() => router.push('/auth')} />
            <View style={styles.stats}>
              <Stat value={liked.size} label="Избранное" />
              <View style={styles.statDivider} />
              <Stat value={scans.length} label="Сканов" />
            </View>
          </View>
        )}
      </View>

      {user && (
        <View style={[styles.pad, { gap: 14 }]}>
          <SectionTitle kicker="Для персонального разбора" title="Тип кожи" />
          <View style={styles.chips}>
            {SKIN.map((s) => (
              <Chip key={s.id} label={s.label} active={user.skinType === s.id} onPress={() => updateProfile({ skinType: user.skinType === s.id ? null : s.id })} />
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: 14 }}>
        <View style={styles.pad}>
          <SectionTitle kicker="Коллекция" title="Избранные рецепты" right={<T v="label">{favourites.length}</T>} />
        </View>
        {favourites.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: space.gutter, paddingBottom: 8 }}>
            {favourites.map((r) => (
              <RecipeCard key={r.id} recipe={r} wide />
            ))}
          </ScrollView>
        ) : (
          <Empty icon="heart" text="Отмечайте рецепты сердцем — они соберутся здесь." cta="К рецептам" onPress={() => router.navigate('/')} />
        )}
      </View>

      <View style={{ gap: 14 }}>
        <View style={styles.pad}>
          <SectionTitle kicker="Сканер" title="История составов" right={<T v="label">{scans.length}</T>} />
        </View>
        {scans.length ? (
          <View style={[styles.pad]}>
            <View style={styles.list}>
              {scans.map((s, i) => (
                <View key={s.id}>
                  {i > 0 && <Hairline />}
                  <Press haptic={false} onPress={() => router.push(`/analysis/${s.id}`)} style={styles.scanRow}>
                    <ScoreRing value={s.overall} size={42} stroke={2.5} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.scanTitle} numberOfLines={1}>
                        {s.title}
                      </Text>
                      <T v="small" numberOfLines={1}>
                        {new Date(s.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {s.text.split(',').length} компонентов
                      </T>
                    </View>
                    <Icon name="arrowRight" size={17} color={colors.muted} />
                  </Press>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Empty icon="scan" text="Сфотографируйте состав любого средства, чтобы узнать, что внутри." cta="Открыть сканер" onPress={() => router.navigate('/scanner')} />
        )}
      </View>

      {user && (
        <View style={styles.pad}>
          <Button label="Выйти" icon="logout" variant="outline" onPress={signOut} />
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ value, label, small }: { value: number | string; label: string; small?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={[styles.statValue, small && { fontSize: 15, lineHeight: 30 }]} numberOfLines={1}>
        {value}
      </Text>
      <T v="label" style={{ fontSize: 9.5 }}>
        {label}
      </T>
    </View>
  );
}

function Empty({ icon, text, cta, onPress }: { icon: 'heart' | 'scan'; text: string; cta: string; onPress: () => void }) {
  return (
    <View style={[styles.pad]}>
      <View style={styles.empty}>
        <Icon name={icon} size={22} color={colors.gold} />
        <T style={{ textAlign: 'center' }}>{text}</T>
        <Press onPress={onPress} style={{ padding: 6 }}>
          <T v="label" style={{ color: colors.goldDeep }}>
            {cta} →
          </T>
        </Press>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter, gap: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 20,
    gap: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
    ...shadow,
  },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  monogram: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: '#E4D2AC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { fontFamily: fonts.serif, fontSize: 38, color: colors.goldDeep, marginTop: -2 },
  name: { fontFamily: fonts.medium, fontSize: 22, letterSpacing: -0.6, color: colors.ink },
  guestTitle: { fontFamily: fonts.medium, fontSize: 30, letterSpacing: -1, color: colors.ink },
  serif: { fontFamily: fonts.serif, fontSize: 34, color: colors.goldDeep },
  stats: { flexDirection: 'row', alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.line2 },
  statValue: { fontFamily: fonts.medium, fontSize: 26, lineHeight: 30, letterSpacing: -0.8, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  scanTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  empty: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line2,
  },
});
