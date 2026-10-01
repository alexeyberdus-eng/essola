import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecipeRow } from '../../components/RecipeRow';
import { FadeIn, Glow } from '../../components/silk';
import { IconButton } from '../../components/ui';
import { FN_ICON, FN_LABEL, ORIGIN_LABEL } from '../../data/ingredients';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../../components/Icon';
import { ingredientById, recipesWith } from '../../lib/wiki';
import { colors, fonts, RISK_COLOR, space } from '../../theme';

const RISK_LABEL = ['Безопасно', 'Низкий риск', 'Умеренный риск', 'Высокий риск'];
const COM_LABEL = ['Не забивает', 'Почти не забивает', 'Низкий риск', 'Средний риск', 'Высокий риск', 'Очень высокий'];
const ACT_LABEL = ['Вспомогательный', 'Полезный', 'Активный', 'Сильный актив'];

export default function IngredientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ing = ingredientById(id);
  const insets = useSafeAreaInsets();
  if (!ing) return null;
  const recipes = recipesWith(ing);
  const look = FN_ICON[ing.fn[0] ?? 'base'];
  const cautions = [
    ing.flags.includes('pregnancy') && 'При беременности и ГВ — не рекомендуют, обсудите с врачом',
    ing.flags.includes('allergen') && 'Возможный аллерген — при склонности к аллергии сделайте тест на сгибе локтя',
    (ing.flags.includes('irritant') || ing.flags.includes('drying-alcohol')) && 'Чувствительной и сухой коже — может раздражать или сушить',
    ing.com >= 3 && 'Жирной и склонной к высыпаниям коже — может забивать поры',
    ing.flags.includes('sulfate') && 'Сухим и окрашенным волосам — смывает защитные липиды и цвет',
  ].filter(Boolean) as string[];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/knowledge'))} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <FadeIn>
          <LinearGradient colors={[look.bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: '#fff' }]}>
              <Icon name={look.icon} size={28} color={look.color} strokeWidth={1.9} />
            </View>
            <View style={styles.roles}>
              {ing.fn.map((f) => (
                <View key={f} style={[styles.role, { backgroundColor: FN_ICON[f].bg }]}>
                  <Icon name={FN_ICON[f].icon} size={12} color={FN_ICON[f].color} strokeWidth={2} />
                  <Text style={[styles.roleText, { color: FN_ICON[f].color }]}>{FN_LABEL[f]}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.title}>{ing.ru}</Text>
            <Text style={styles.inci}>{ing.inci}</Text>
            <Text style={styles.note}>{ing.note}</Text>
          </LinearGradient>
        </FadeIn>

        {!!ing.about && (
          <FadeIn index={1}>
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <Icon name="book" size={16} color={colors.violet} />
                <Text style={styles.blockTitle}>Что это и зачем</Text>
              </View>
              <Text style={styles.about}>{ing.about}</Text>
            </View>
          </FadeIn>
        )}

        <FadeIn index={2}>
          <View style={styles.tiles}>
            {(
              [
                ['shield', 'Безопасность', RISK_LABEL[ing.risk], RISK_COLOR[ing.risk], ing.risk, 3],
                ['drop', 'Поры', COM_LABEL[ing.com], ing.com >= 3 ? colors.warn : colors.good, ing.com, 5],
                ['bolt', 'Польза', ACT_LABEL[Math.min(3, Math.round(ing.act))], colors.violet, Math.round(ing.act), 3],
                ['leaf', 'Происхождение', ORIGIN_LABEL[ing.origin], ing.origin === 'natural' || ing.origin === 'mineral' ? colors.good : colors.muted, -1, 0],
              ] as const
            ).map(([icon, label, value, c, v, max]) => (
              <View key={label} style={styles.tile}>
                <View style={[styles.tileIcon, { backgroundColor: `${c}1A` }]}>
                  <Icon name={icon} size={16} color={c} strokeWidth={2} />
                </View>
                <Text style={styles.tileLabel}>{label}</Text>
                <Text style={[styles.tileValue, { color: c }]}>{value}</Text>
                {max > 0 && (
                  <View style={styles.meter}>
                    {Array.from({ length: max }, (_, k) => (
                      <View key={k} style={[styles.meterCell, { backgroundColor: k < v ? c : colors.surf }]} />
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </FadeIn>

        {cautions.length > 0 && (
          <FadeIn index={3}>
            <View style={[styles.block, { backgroundColor: colors.warnSoft, borderColor: 'transparent' }]}>
              <View style={styles.blockHead}>
                <Icon name="alert" size={16} color={colors.warn} />
                <Text style={styles.blockTitle}>Кому осторожнее</Text>
              </View>
              {cautions.map((c) => (
                <Text key={c} style={styles.caution}>
                  • {c}
                </Text>
              ))}
            </View>
          </FadeIn>
        )}

        <FadeIn index={4}>
          <Text style={styles.section}>{recipes.length ? `В рецептах Essola · ${recipes.length}` : 'Пока нет в рецептах Essola'}</Text>
          {recipes.map((r, i) => (
            <RecipeRow key={r.id} recipe={r} last={i === recipes.length - 1} />
          ))}
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { paddingHorizontal: space.gutter, paddingBottom: 10 },
  hero: { borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#EEEAF8' },
  heroIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  role: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 26, borderRadius: 99 },
  roleText: { fontFamily: fonts.semibold, fontSize: 12 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 33, letterSpacing: -1, color: colors.ink, marginTop: 10 },
  inci: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted, marginTop: 4 },
  note: { fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 22, color: colors.ink, marginTop: 12 },
  block: { marginTop: 14, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, gap: 8 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  about: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.ink2 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tile: { width: '48.5%', padding: 14, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, gap: 4 },
  tileIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  tileValue: { fontFamily: fonts.semibold, fontSize: 14.5 },
  meter: { flexDirection: 'row', gap: 3, marginTop: 6 },
  meterCell: { flex: 1, height: 6, borderRadius: 3 },
  caution: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  section: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.4, color: colors.ink, marginTop: 28, marginBottom: 4 },
});
