import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Breathe, Card, FadeIn, Glow } from '../../components/silk';
import { Press, Seg, T } from '../../components/ui';
import { FN_LABEL, Fn, INGREDIENTS, Ingredient } from '../../data/ingredients';
import { normalize } from '../../lib/analyze';
import { ingredientId, recipesWith, WIKI_GROUPS } from '../../lib/wiki';
import { colors, fonts, RISK_COLOR, space, TAB_SPACE } from '../../theme';

type Toggle = 'safe' | 'natural' | 'noAllergen';
const TOGGLES: { key: Toggle; label: string }[] = [
  { key: 'safe', label: 'Безопасные' },
  { key: 'natural', label: 'Натуральные' },
  { key: 'noAllergen', label: 'Без аллергенов' },
];

const GUIDE = INGREDIENTS.find((i) => i.inci === 'Niacinamide')!;

export default function WikiScreen() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<'all' | Fn>('all');
  const [toggles, setToggles] = useState<Set<Toggle>>(new Set());

  const list = useMemo(() => {
    const nq = normalize(q);
    return INGREDIENTS.filter((ing) => {
      if (group !== 'all' && !ing.fn.includes(group)) return false;
      if (toggles.has('safe') && ing.risk > 1) return false;
      if (toggles.has('natural') && !(ing.origin === 'natural' || ing.origin === 'mineral')) return false;
      if (toggles.has('noAllergen') && ing.flags.includes('allergen')) return false;
      if (!nq) return true;
      return [ing.ru, ing.inci, ing.note, ...ing.aliases, ...ing.fn.map((f) => FN_LABEL[f])].some((t) => normalize(t).includes(nq));
    }).sort((a, b) => b.act - a.act || a.risk - b.risk);
  }, [q, group, toggles]);

  const flip = (t: Toggle) =>
    setToggles((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const header = (
    <View style={{ paddingTop: insets.top + 8 }}>
      <T v="title" style={{ fontSize: 30, lineHeight: 34 }}>
        Энциклопедия
      </T>
      <Text style={styles.lead}>{INGREDIENTS.length} ингредиентов: что делает, насколько безопасно, где встречается</Text>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Ингредиент, INCI или задача: «поры»" placeholderTextColor={colors.faint} style={styles.searchInput} />
        {!!q && (
          <Press haptic={false} onPress={() => setQ('')}>
            <Icon name="close" size={16} color={colors.muted} />
          </Press>
        )}
      </View>
      <View style={styles.toggles}>
        {TOGGLES.map((t) => {
          const on = toggles.has(t.key);
          return (
            <Press key={t.key} onPress={() => flip(t.key)} style={[styles.toggle, on && styles.toggleOn]}>
              {on && <Icon name="check" size={13} color={colors.honeyText} strokeWidth={2.2} />}
              <Text style={[styles.toggleText, on && { color: colors.honeyText }]}>{t.label}</Text>
            </Press>
          );
        })}
      </View>
      <Seg small inset={space.gutter} value={group} onChange={setGroup} options={WIKI_GROUPS} />

      {!q && group === 'all' && toggles.size === 0 && (
        <Press haptic={false} onPress={() => router.push(`/ingredient/${ingredientId(GUIDE)}`)} style={{ marginTop: 16 }}>
          <View style={styles.guide}>
            <LinearGradient colors={['#FFF6D6', '#FFFDF6', '#FFF0C4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={{ flex: 1 }}>
              <Text style={styles.guideKicker}>Гид · 4 мин</Text>
              <Text style={styles.guideTitle}>Ниацинамид: всё, что нужно знать</Text>
              <Text style={styles.guideSub}>Концентрации, сочетания и мифы</Text>
            </View>
            <View style={styles.orb} />
          </View>
        </Press>
      )}
      <Text style={styles.count}>{list.length} найдено</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <FlatList
        data={list}
        keyExtractor={(i) => i.inci}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: TAB_SPACE }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item, index }) => (
          <FadeIn index={index % 10}>
            <IngredientCard ing={item} />
          </FadeIn>
        )}
      />
    </View>
  );
}

function IngredientCard({ ing }: { ing: Ingredient }) {
  const uses = recipesWith(ing).length;
  const dot = <View style={[styles.dot, { backgroundColor: RISK_COLOR[ing.risk] }]} />;
  return (
    <Press haptic={false} onPress={() => router.push(`/ingredient/${ingredientId(ing)}`)}>
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.name}>{ing.ru}</Text>
          {ing.risk >= 2 ? <Breathe amount={0.3}>{dot}</Breathe> : dot}
        </View>
        <Text style={styles.inci}>{ing.inci}</Text>
        <Text style={styles.note} numberOfLines={2}>
          {ing.note}
        </Text>
        <View style={styles.meta}>
          {ing.fn.slice(0, 2).map((f) => (
            <Text key={f} style={styles.tag}>
              {FN_LABEL[f]}
            </Text>
          ))}
          {uses > 0 && <Text style={styles.metaText}>в {uses} рецептах</Text>}
        </View>
      </Card>
    </Press>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.muted, marginTop: 4 },
  search: { height: 48, borderRadius: 99, backgroundColor: colors.surf, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, marginTop: 16 },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  toggles: { flexDirection: 'row', gap: 6, marginVertical: 12, flexWrap: 'wrap' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: colors.line },
  toggleOn: { backgroundColor: colors.honeySoft, borderColor: colors.honeyLine },
  toggleText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink2 },
  guide: { borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#F7E6A8' },
  guideKicker: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.honeyText },
  guideTitle: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 23, letterSpacing: -0.5, color: colors.ink, marginTop: 6 },
  guideSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4 },
  orb: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.honey, marginLeft: 12, borderWidth: 6, borderColor: '#FFE9A6' },
  count: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted, marginTop: 18, marginBottom: 10 },
  card: { padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink, flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  inci: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.ink2, marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  tag: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.ink2, backgroundColor: colors.surf, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' },
  metaText: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
});
