import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecipeRow } from '../../components/RecipeRow';
import { Card, FadeIn, Glow } from '../../components/silk';
import { IconButton, T, Tag } from '../../components/ui';
import { FLAG_LABEL, FN_LABEL, ORIGIN_LABEL } from '../../data/ingredients';
import { ingredientById, recipesWith } from '../../lib/wiki';
import { colors, fonts, RISK_COLOR, space } from '../../theme';

const RISK_LABEL = ['Безопасно', 'Низкий риск', 'Умеренный риск', 'Высокий риск'];
const COM_LABEL = ['не забивает поры', 'почти не забивает', 'низкая', 'средняя', 'высокая', 'очень высокая'];

export default function IngredientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ing = ingredientById(id);
  const insets = useSafeAreaInsets();
  if (!ing) return null;
  const recipes = recipesWith(ing);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/knowledge'))} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <FadeIn>
          <T v="label">{ing.fn.map((f) => FN_LABEL[f]).join(' · ')}</T>
          <Text style={styles.title}>{ing.ru}</Text>
          <Text style={styles.inci}>{ing.inci}</Text>
          <Text style={styles.note}>{ing.note}</Text>
          {!!ing.about && <Text style={styles.about}>{ing.about}</Text>}
        </FadeIn>

        <FadeIn index={1}>
          <Card style={styles.card}>
            <Text style={styles.cardLabel}>Безопасность</Text>
            <View style={styles.meter}>
              {[0, 1, 2, 3].map((k) => (
                <View key={k} style={[styles.meterCell, { backgroundColor: k <= ing.risk ? RISK_COLOR[ing.risk] : colors.surf }]} />
              ))}
            </View>
            <Text style={[styles.cardValue, { color: RISK_COLOR[ing.risk] }]}>{RISK_LABEL[ing.risk]}</Text>

            <View style={styles.divider} />
            <Text style={styles.cardLabel}>Комедогенность · {ing.com}/5</Text>
            <View style={styles.meter}>
              {[1, 2, 3, 4, 5].map((k) => (
                <View key={k} style={[styles.meterCell, { backgroundColor: k <= ing.com ? (ing.com >= 3 ? colors.warn : colors.honey) : colors.surf }]} />
              ))}
            </View>
            <Text style={styles.cardValue}>{COM_LABEL[ing.com]}</Text>

            <View style={styles.divider} />
            <Text style={styles.cardLabel}>Происхождение</Text>
            <Text style={styles.cardValue}>{ORIGIN_LABEL[ing.origin]}</Text>
          </Card>
        </FadeIn>

        {(ing.flags.length > 0 || ing.act >= 2) && (
          <FadeIn index={2}>
            <View style={styles.tags}>
              {ing.act >= 2 && <Tag label="Доказанный актив" tone="honey" />}
              {ing.flags.map((f) => (
                <Tag key={f} label={FLAG_LABEL[f]} tone="warn" />
              ))}
            </View>
          </FadeIn>
        )}

        <FadeIn index={3}>
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
  title: { fontFamily: fonts.semibold, fontSize: 32, lineHeight: 36, letterSpacing: -1.2, color: colors.ink, marginTop: 8 },
  inci: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted, marginTop: 4 },
  note: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23, color: colors.ink, marginTop: 14 },
  about: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 24, color: colors.ink2, marginTop: 10 },
  card: { padding: 18, marginTop: 20 },
  cardLabel: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted },
  cardValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, marginTop: 6 },
  meter: { flexDirection: 'row', gap: 4, marginTop: 10 },
  meterCell: { flex: 1, height: 8, borderRadius: 4 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },
  section: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.4, color: colors.ink, marginTop: 28, marginBottom: 4 },
});
