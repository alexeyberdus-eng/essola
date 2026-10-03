import { router, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { ProductArt } from '../../components/ProductArt';
import { RecipeCard } from '../../components/RecipeCard';
import { Glow } from '../../components/silk';
import { IconButton, Press, tap } from '../../components/ui';
import { RECIPES } from '../../data/recipes';
import { PRODUCTS, shopItemOf } from '../../data/shop';
import { useState } from 'react';
import { SITE } from '../../data/shop-site';
import { colors, fonts, space } from '../../theme';

// "Масло абрикосовой косточки" → "абрикосов": a stem good enough to find recipes that use the product.
const stem = (title: string) =>
  title
    .toLowerCase()
    .replace(/^(масло|эфирное масло|гидролат|глина|маска)\s+/, '')
    .split(/[\s,(]/)[0]
    .slice(0, 7);

/** An essola product: description, volume and where to buy, plus recipes that use it. */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const item = shopItemOf(id);
  const [pick, setPick] = useState(id);
  const p = PRODUCTS.find((x) => x.id === pick) ?? PRODUCTS.find((x) => x.id === id);
  if (!p || !item) return null;
  const site = SITE[p.id] ?? {};
  const s = stem(p.title);
  const recipes = s.length >= 4 ? RECIPES.filter((r) => r.ingredients.some((i) => i.name.toLowerCase().includes(s))).slice(0, 6) : [];
  const open = (url: string | null) => {
    if (!url) return;
    tap('medium');
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 180 }}>
        <View style={{ height: 52, justifyContent: 'center' }}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/shop' as never))} />
        </View>
        <ProductArt p={p} height={230} />
        <Text style={styles.cat}>
          {p.category} · {p.volume}
        </Text>
        <Text style={styles.title}>{p.title}</Text>
        <Text style={styles.desc}>{site.about || p.desc}</Text>
        {!!site.inci && (
          <View style={styles.inci}>
            <Text style={styles.inciLabel}>Состав (INCI)</Text>
            <Text style={styles.inciText}>{site.inci}</Text>
          </View>
        )}
        {!!site.site && (
          <Press haptic={false} onPress={() => Linking.openURL(site.site!).catch(() => {})} style={styles.more}>
            <Text style={styles.moreText}>Подробнее на essola.ru: происхождение, протоколы, формулы</Text>
            <Icon name="external" size={14} color={colors.violet} />
          </Press>
        )}

        <View style={styles.facts}>
          <View style={styles.fact}>
            <Icon name="drop" size={16} color={colors.violet} />
            <Text style={styles.factText}>{p.volume}</Text>
          </View>
          <View style={styles.fact}>
            <Icon name="shield" size={16} color={colors.violet} />
            <Text style={styles.factText}>Бренд Essola</Text>
          </View>
        </View>

        {recipes.length > 0 && (
          <>
            <Text style={styles.h2}>Рецепты с этим продуктом</Text>
            {recipes.map((r, i) => (
              <RecipeCard key={r.id} recipe={r} index={i} />
            ))}
          </>
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        {item.variants.length > 1 && (
          <View style={styles.vols}>
            {item.variants.map((v) => (
              <Press key={v.id} haptic={false} onPress={() => { tap(); setPick(v.id); }} style={[styles.vol, v.id === p.id && styles.volOn]} accessibilityLabel={`Объём ${v.volume}`}>
                <Text style={[styles.volText, v.id === p.id && styles.volTextOn]}>{v.volume}</Text>
              </Press>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
        {p.wb && (
          <Press onPress={() => open(p.wb)} style={[styles.buy, styles.wb]} accessibilityLabel="Купить на Wildberries">
            <Text style={styles.buyText}>Купить на WB</Text>
          </Press>
        )}
        {p.ozon && (
          <Press onPress={() => open(p.ozon)} style={[styles.buy, styles.oz]} accessibilityLabel="Купить на Ozon">
            <Text style={[styles.buyText, { color: '#fff' }]}>Купить на Ozon</Text>
          </Press>
        )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inci: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: '#F4F0FF', gap: 4 },
  inciLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.violet, textTransform: 'uppercase', letterSpacing: 0.5 },
  inciText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink },
  more: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 6 },
  moreText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.violet },
  cat: { fontFamily: fonts.semibold, fontSize: 12, color: colors.violet, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.8, color: colors.ink, marginTop: 6 },
  desc: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink2, marginTop: 10 },
  facts: { flexDirection: 'row', gap: 10, marginTop: 16 },
  fact: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, backgroundColor: '#F4F0FF' },
  factText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  h2: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginTop: 26, marginBottom: 4 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 10, paddingHorizontal: space.gutter, paddingTop: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderColor: colors.line },
  vols: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#F1F2F8', gap: 4 },
  vol: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  volOn: { backgroundColor: '#fff', shadowColor: '#15172B', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  volText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.muted },
  volTextOn: { color: colors.ink },
  buy: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  wb: { backgroundColor: '#CB11AB' },
  oz: { backgroundColor: '#005BFF' },
  buyText: { fontFamily: fonts.semibold, fontSize: 15, color: '#fff' },
});
