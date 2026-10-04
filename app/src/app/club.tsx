import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../components/Icon';
import { Glow } from '../components/silk';
import { Button, IconButton, Press, tap } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { cloud } from '../lib/cloud';
import { colors, fonts, LAVENDER, space } from '../theme';

type Terms = { limit: number; club: number; describe: number; describeClub: number; price: number };
type ClubState = { member: boolean; since: string | null; signedIn: boolean; terms: Terms; promo: { code: string; text?: string; until?: string } | null };

const FALLBACK: Terms = { limit: 50, club: 150, describe: 200, describeClub: 600, price: 0 };

/** Essola Club: what it gives, a comparison with the free app, and joining (free for now). */
export default function Club() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [state, setState] = useState<ClubState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    cloud<ClubState>('club.get', {}, 10000)
      .then(setState)
      .catch(() => setState({ member: false, since: null, signedIn: !!user, terms: FALLBACK, promo: null }));
  }, [user]);
  useEffect(load, [load]);

  const t = state?.terms ?? FALLBACK;
  const member = !!state?.member;

  const join = async () => {
    if (!user) return router.push('/auth' as never);
    setBusy(true);
    setError('');
    try {
      setState(await cloud<ClubState>('club.join'));
      tap('success');
    } catch {
      setError('Не получилось вступить — проверьте интернет и попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };
  const leave = async () => {
    setBusy(true);
    try {
      setState(await cloud<ClubState>('club.leave'));
    } catch {
      setError('Не получилось — проверьте интернет.');
    } finally {
      setBusy(false);
    }
  };
  const copy = async (code: string) => {
    await Clipboard.setStringAsync(code).catch(() => {});
    tap('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const rows: [string, string, string][] = [
    ['Распознавание составов и этикеток по фото', `${t.limit} в день`, `${t.club} в день`],
    ['Советы технолога в конструкторе', `${t.limit} в день`, `${t.club} в день`],
    ['Поиск средств в интернете и по ссылкам', `${t.limit} в день`, `${t.club} в день`],
    ['Разборы «что даёт средство»', `${t.describe} в день`, `${t.describeClub} в день`],
    ['Промокод на косметику Essola каждый месяц', '—', '✓'],
    ['Значок участника клуба в профиле', '—', '✓'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 60 }}>
        <View style={styles.top}>
          <View style={{ flex: 1 }} />
          <IconButton icon="close" label="Закрыть" onPress={() => router.back()} />
        </View>

        <View style={styles.hero}>
          <LinearGradient colors={['#5B47C9', '#8A74F2', '#C9A2F5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.circle} />
          <View style={styles.circle2} />
          <Text style={styles.kicker}>{member ? 'вы в клубе' : 'для тех, кто любит уход'}</Text>
          <Text style={styles.title}>Essola Клуб</Text>
          <Text style={styles.lead}>Больше сканов и советов технолога и ежемесячные промокоды на косметику Essola.</Text>
          <View style={styles.price}>
            <Text style={styles.priceN}>0 ₽</Text>
            <Text style={styles.priceT}>сейчас вступление бесплатное</Text>
          </View>
        </View>

        {!state ? (
          <ActivityIndicator color={colors.violet} style={{ marginTop: 24 }} />
        ) : member ? (
          <View style={styles.memberCard}>
            <View style={styles.memberIcon}>
              <Icon name="check" size={20} color="#fff" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberTitle}>Вы участник клуба</Text>
              {!!state.since && <Text style={styles.memberText}>с {new Date(state.since).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>}
            </View>
          </View>
        ) : (
          <Button label={user ? 'Вступить бесплатно' : 'Войти и вступить'} icon="spark" onPress={join} loading={busy} style={{ marginTop: 16 }} />
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {member && (
          <View style={styles.promo}>
            <Text style={styles.sectionKicker}>промокод месяца</Text>
            {state?.promo ? (
              <>
                <Press onPress={() => copy(state.promo!.code)} style={styles.code}>
                  <Text style={styles.codeText}>{state.promo.code}</Text>
                  <Text style={styles.codeCopy}>{copied ? 'скопировано' : 'скопировать'}</Text>
                </Press>
                {!!state.promo.text && <Text style={styles.promoText}>{state.promo.text}</Text>}
                {!!state.promo.until && <Text style={styles.promoUntil}>действует до {new Date(state.promo.until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</Text>}
                <Press haptic={false} onPress={() => router.push('/(tabs)/shop' as never)} style={styles.shopLink}>
                  <Text style={styles.shopLinkText}>Перейти в магазин Essola</Text>
                  <Icon name="arrowRight" size={15} color={colors.violet} />
                </Press>
              </>
            ) : (
              <Text style={styles.promoText}>Промокод этого месяца появится здесь — загляните чуть позже.</Text>
            )}
          </View>
        )}

        <Text style={styles.h2}>Что даёт клуб</Text>
        {(
          [
            ['scan', 'Втрое больше распознаваний', 'Сканируйте всю полку и все покупки — фото составов, этикетки, поиск по коду и ссылкам.'],
            ['flask', 'Технолог без ограничений по ходу работы', 'Собирайте и улучшайте свои формулы в конструкторе: советов в три раза больше.'],
            ['bag', 'Промокод каждый месяц', 'Скидки на косметику и ингредиенты Essola — только для участников.'],
            ['user', 'Значок участника', 'В вашем профиле — его видят подписчики и собеседники на форуме.'],
          ] as [IconName, string, string][]
        ).map(([icon, title, text]) => (
          <View key={title} style={styles.perk}>
            <View style={styles.perkIcon}>
              <Icon name={icon} size={19} color={colors.violet} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.perkTitle}>{title}</Text>
              <Text style={styles.perkText}>{text}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.h2}>Без клуба и с клубом</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.td, styles.tdName, styles.th]}> </Text>
            <Text style={[styles.td, styles.th]}>Без клуба</Text>
            <View style={[styles.td, styles.clubCol, styles.clubHead]}>
              <LinearGradient colors={LAVENDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 14, borderTopRightRadius: 14 }]} />
              <Text style={[styles.th, { color: '#fff' }]}>Клуб</Text>
            </View>
          </View>
          {rows.map(([name, free, club], i) => (
            <View key={name} style={[styles.tr, i < rows.length - 1 && styles.trLine]}>
              <Text style={[styles.td, styles.tdName]}>{name}</Text>
              <Text style={[styles.td, styles.tdVal, free === '—' && styles.dash]}>{free}</Text>
              <View style={[styles.td, styles.clubCol, i === rows.length - 1 && styles.clubLast]}>
                <Text style={[styles.tdVal, styles.tdClub]}>{club}</Text>
              </View>
            </View>
          ))}
          <View style={[styles.tr, styles.trTop]}>
            <Text style={[styles.td, styles.tdName, styles.th]}>Стоимость</Text>
            <Text style={[styles.td, styles.tdVal]}>0 ₽</Text>
            <View style={[styles.td, styles.clubCol, styles.clubLast]}>
              <Text style={[styles.tdVal, styles.tdClub]}>0 ₽</Text>
            </View>
          </View>
        </View>
        <Text style={styles.note}>Лимиты обновляются каждый день. Всё основное — разбор составов, рецепты, конструктор, база средств — остаётся доступным без клуба.</Text>

        {member && (
          <Press haptic={false} onPress={leave} disabled={busy} style={styles.leave}>
            <Text style={styles.leaveText}>Выйти из клуба</Text>
          </Press>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center' },
  hero: { marginTop: 8, borderRadius: 26, padding: 20, overflow: 'hidden' },
  circle: { position: 'absolute', right: -50, top: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.14)' },
  circle2: { position: 'absolute', right: 50, bottom: -70, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.09)' },
  kicker: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -1, color: '#fff', marginTop: 8 },
  lead: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.94)', marginTop: 8 },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 16, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  priceN: { fontFamily: fonts.display, fontSize: 24, color: '#fff' },
  priceT: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.92)' },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 20, backgroundColor: '#EAF7F0', borderWidth: 1, borderColor: '#CDEBDA' },
  memberIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.good, alignItems: 'center', justifyContent: 'center' },
  memberTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  memberText: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.bad, marginTop: 10 },
  promo: { marginTop: 14, padding: 16, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: '#EAE6F7' },
  sectionKicker: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.violet },
  code: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.violet, backgroundColor: colors.tint },
  codeText: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5, color: colors.violetDeep },
  codeCopy: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.violet },
  promoText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink, marginTop: 10 },
  promoUntil: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
  shopLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  shopLinkText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.violet },
  h2: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.5, color: colors.ink, marginTop: 28, marginBottom: 10 },
  perk: { flexDirection: 'row', gap: 12, padding: 14, marginBottom: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: '#EAE6F7' },
  perkIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  perkText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 3 },
  table: { borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: '#EAE6F7', paddingHorizontal: 12, paddingBottom: 4 },
  tr: { flexDirection: 'row', alignItems: 'stretch' },
  thead: { paddingTop: 10 },
  trLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E6E1FA' },
  trTop: { borderTopWidth: 1, borderTopColor: '#E6E1FA' },
  td: { width: 78, paddingVertical: 11, paddingHorizontal: 4, justifyContent: 'center' },
  tdName: { flex: 1, width: undefined, fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.ink, paddingRight: 8 },
  th: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
  tdVal: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16, color: colors.muted, textAlign: 'center', textAlignVertical: 'center' },
  dash: { color: '#C7C1DD' },
  clubCol: { backgroundColor: colors.tint, alignItems: 'center' },
  clubHead: { borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  clubLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  tdClub: { fontFamily: fonts.semibold, color: colors.violetDeep },
  note: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 10 },
  leave: { alignSelf: 'center', marginTop: 26, padding: 8 },
  leaveText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
});
