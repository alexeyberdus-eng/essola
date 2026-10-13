import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { usePoints } from '../lib/ai';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';
import { Press, tap } from './ui';

/** «★ 3» on a button: this action costs daily points. `dark` for light text on an ink button. */
export function Star({ n, dark }: { n: number; dark?: boolean }) {
  return (
    <View style={[s.star, dark && s.starDark]}>
      <Text style={[s.starText, dark && { color: '#FFFFFF' }]}>★ {n}</Text>
    </View>
  );
}

/** Today's balance as a tappable line: «★ 14 из 20 на сегодня» → the «Баллы» screen. */
export function PointsCard() {
  const p = usePoints();
  if (!p) return null;
  return (
    <Press onPress={() => { tap(); router.push('/points' as never); }} style={s.card} accessibilityLabel="Баллы">
      <View style={s.badge}>
        <Text style={s.badgeText}>★</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>
          {p.left} из {p.daily} баллов на сегодня
        </Text>
        <Text style={s.sub}>Пока бесплатно · обновляются каждый день</Text>
      </View>
      <Icon name="arrowRight" size={16} color={colors.muted} />
    </Press>
  );
}

const s = StyleSheet.create({
  star: { height: 22, paddingHorizontal: 8, borderRadius: 99, backgroundColor: '#FFF1C9', justifyContent: 'center' },
  starDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
  starText: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#9A6A00' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: '#FFFFFF', shadowColor: '#5B47C9', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  badge: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF1C9', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 20, color: '#C98A00' },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 2 },
});
