import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glow } from '../components/silk';
import { IconButton, Press, tap } from '../components/ui';
import { payCreate, refreshPoints, usePoints } from '../lib/ai';
import { canBuyPoints } from '../lib/store';
import { colors, fonts, space } from '../theme';

// Packs as the server sells them (it checks the price again when a payment is settled); these are shown until it answers.
const PACKS = [
  { id: 'p100', n: 100, rub: 199 },
  { id: 'p200', n: 200, rub: 299 },
  { id: 'p300', n: 300, rub: 399 },
];

/** «Баллы»: today's free ★, bought points, what costs points, and buying a pack through ЮKassa (where allowed). */
export default function PointsScreen() {
  const insets = useSafeAreaInsets();
  const p = usePoints();
  const cost = p?.cost ?? { photo: 3, label: 1, review: 3, compare: 3 };
  const daily = p?.daily ?? 20;
  const packs = p?.packs?.length ? p.packs : PACKS;
  const buyable = !!p?.paid && canBuyPoints();
  const [pick, setPick] = useState('p200');
  const [busy, setBusy] = useState(false);
  const buy = async () => {
    if (!p?.signedIn) {
      Alert.alert('Войдите в аккаунт', 'Купленные баллы хранятся в аккаунте и доступны на любом телефоне.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Войти', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    tap('medium');
    setBusy(true);
    try {
      const { url } = await payCreate(pick);
      if (!url) throw new Error('no_url');
      await WebBrowser.openAuthSessionAsync(url, 'essola://points');
      // ЮKassa confirms within seconds; ask a few times so the points show up without leaving the screen.
      for (let i = 0; i < 4; i++) {
        await refreshPoints();
        await new Promise((r) => setTimeout(r, 2500));
      }
      await refreshPoints();
    } catch {
      Alert.alert('Не получилось открыть оплату', 'Проверьте интернет и попробуйте ещё раз.');
    }
    setBusy(false);
  };
  const rows: [string, number][] = [
    ['Распознать состав по фото', cost.photo],
    ['Технолог в конструкторе', cost.review],
    ['Технолог в сравнении', cost.compare],
    ['Фото этикетки', cost.label],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <View style={{ height: 52, justifyContent: 'center' }}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile' as never))} />
        </View>

        <View style={styles.hero}>
          <View style={styles.circle} />
          <Text style={styles.kicker}>Баллы на сегодня</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
            <Text style={styles.big}>★ {p ? p.left : '…'}</Text>
            <Text style={styles.of}>из {daily}</Text>
          </View>
          <Text style={styles.heroText}>Каждый день — {daily} баллов ★ бесплатно. Неиспользованные сгорают в конце дня.</Text>
          {!!p?.bought && (
            <View style={styles.boughtRow}>
              <Text style={styles.boughtText}>Купленные: ★ {p.bought}</Text>
              <Text style={styles.boughtSub}>не сгорают, тратятся после дневных</Text>
            </View>
          )}
        </View>

        {!buyable && (
          <View style={styles.free}>
            <Text style={styles.freeTitle}>Пока бесплатно</Text>
            <Text style={styles.freeText}>Покупка баллов скоро появится. Сейчас всем дарим {daily} баллов ★ каждый день.</Text>
          </View>
        )}

        <Text style={styles.h2}>Что стоит баллы</Text>
        <View style={styles.card}>
          {rows.map(([t, n], i) => (
            <View key={t} style={[styles.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.rowText}>{t}</Text>
              <Text style={styles.rowPts}>★ {n}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Всё остальное бесплатно: база средств, оценка состава, сравнение, подбор, конструктор, рецепты, форум. Если ответ уже есть в базе, баллы не списываются.</Text>

        <Text style={styles.h2}>Пакеты баллов</Text>
        {packs.map((x) => (
          <Press key={x.id} haptic={false} disabled={!buyable} onPress={() => { tap(); setPick(x.id); }} style={[styles.pack, buyable && pick === x.id && styles.packOn]} accessibilityLabel={`${x.n} баллов за ${x.rub} рублей`}>
            {buyable && <View style={[styles.radio, pick === x.id && styles.radioOn]} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.packTitle}>{x.n} баллов</Text>
              <Text style={styles.packSub}>Не сгорают</Text>
            </View>
            <Text style={styles.packPrice}>{x.rub} ₽</Text>
          </Press>
        ))}
        {buyable ? (
          <>
            <Press onPress={buy} disabled={busy} style={styles.payBtn} accessibilityLabel="Оплатить">
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>Оплатить {packs.find((x) => x.id === pick)?.rub ?? ''} ₽</Text>}
            </Press>
            <Text style={styles.payNote}>Банковская карта или СБП · оплата через ЮKassa. Чек придёт на почту аккаунта. Покупая, вы принимаете условия (Кабинет → Правила, данные и условия).</Text>
          </>
        ) : (
          <View style={styles.soon}>
            <Text style={styles.soonText}>Покупка скоро</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 4, borderRadius: 28, padding: 20, backgroundColor: colors.ink, overflow: 'hidden' },
  circle: { position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(160,140,245,0.35)' },
  kicker: { fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' },
  big: { fontFamily: fonts.display, fontSize: 48, lineHeight: 52, letterSpacing: -1.5, color: '#FFFFFF' },
  of: { fontFamily: fonts.medium, fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  heroText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  free: { marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: '#DFF7EC' },
  freeTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: '#1F7A52' },
  freeText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: '#2C5E47', marginTop: 2 },
  h2: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginTop: 24, marginBottom: 10 },
  card: { borderRadius: 22, backgroundColor: '#FFFFFF', paddingHorizontal: 16, shadowColor: '#5B47C9', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
  rowText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink },
  rowPts: { fontFamily: fonts.semibold, fontSize: 14.5, color: '#9A6A00' },
  note: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 10 },
  pack: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: '#F1F0F6', marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  packTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  packSub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  packPrice: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  packOn: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.ink },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.faint, marginRight: 12 },
  radioOn: { borderWidth: 7, borderColor: colors.ink },
  payBtn: { marginTop: 6, height: 56, borderRadius: 99, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  payText: { fontFamily: fonts.semibold, fontSize: 16.5, color: '#FFFFFF' },
  payNote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, textAlign: 'center', marginTop: 10 },
  boughtRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  boughtText: { fontFamily: fonts.semibold, fontSize: 15, color: '#FFFFFF' },
  boughtSub: { fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  soon: { marginTop: 6, height: 52, borderRadius: 99, backgroundColor: '#F1F0F6', alignItems: 'center', justifyContent: 'center' },
  soonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
});
