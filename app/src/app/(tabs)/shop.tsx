import { ReactNode, useEffect, useMemo, useState } from 'react';
import { onBaseIngredient } from '../../lib/baseIngredient';
import { LinearGradient } from 'expo-linear-gradient';
import { ProductBase } from '../../components/ProductBase';
import { detailOf } from '../../data/shop-details';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ProductArt } from '../../components/ProductArt';
import { Hero } from '../../components/Hero';
import { Icon } from '../../components/Icon';
import { Brand, FadeIn, Glow } from '../../components/silk';
import { Press, Seg, tap } from '../../components/ui';
import { SHOP_CATEGORIES, SHOP_ITEMS, ShopItem } from '../../data/shop';
import { colors, fonts, LAVENDER, shadow, space, TAB_SPACE } from '../../theme';

type Cat = 'all' | (typeof SHOP_CATEGORIES)[number];

type Mode = 'base' | 'shop';

/** «Средства»: search the product base, or the Essola shop of ingredients. */
export default function ShopScreen() {
  const [mode, setMode] = useState<Mode>('base');
  // «Средства с этим ингредиентом» from an ingredient page opens the base.
  useEffect(() => onBaseIngredient(() => setMode('base')), []);
  const toggle = (
    <View style={styles.toggle}>
      {(
        [
          ['base', 'База средств'],
          ['shop', 'Магазин Essola'],
        ] as const
      ).map(([k, l]) => (
        <Press key={k} haptic={false} onPress={() => { tap(); setMode(k); }} style={[styles.tg, mode === k && styles.tgOn]}>
          <Text style={[styles.tgText, mode === k && styles.tgTextOn]}>{l}</Text>
        </Press>
      ))}
    </View>
  );
  return mode === 'base' ? <ProductBase toggle={toggle} /> : <ShopStore toggle={toggle} />;
}

function ShopStore({ toggle }: { toggle: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState<Cat>('all');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return SHOP_ITEMS.filter((p) => (cat === 'all' || p.category === cat) && (!nq || (p.title + ' ' + p.desc).toLowerCase().includes(nq)));
  }, [cat, q]);

  const header = (
    <View style={{ paddingTop: insets.top + 10 }}>
      <Brand />
      {toggle}
      <Hero kicker="Магазин Essola" title="Всё для домашней лаборатории" text="Масла, гидролаты и глины для рецептов из ленты. Покупка на Wildberries и Ozon." />
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Масло, гидролат, глина…" placeholderTextColor={colors.faint} style={styles.input} />
      </View>
      <View style={{ marginTop: 12, marginBottom: 6 }}>
        <Seg small inset={space.gutter} value={cat} onChange={setCat} options={[{ key: 'all', label: 'Все' }, ...SHOP_CATEGORIES.map((c) => ({ key: c as Cat, label: c }))]} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: TAB_SPACE, gap: 10 }}
        keyboardDismissMode="on-drag"
        renderItem={({ item, index }) => (
          <FadeIn index={index % 8} style={{ flex: 1, maxWidth: '50%' }}>
            <ProductCard p={item} />
          </FadeIn>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Ничего не нашлось</Text>}
      />
    </View>
  );
}

/** Same-size card: photo, name, short description and one button; volumes and shop links are inside. */
function ProductCard({ p }: { p: ShopItem }) {
  const v = p.variants[0];
  const go = () => {
    tap();
    router.push(`/product/${v.id}` as never);
  };
  return (
    <Press haptic={false} onPress={go} style={styles.card}>
      <ProductArt p={{ ...v, volume: p.variants.map((x) => x.volume.replace(' мл', '')).join(' / ') + ' мл' }} />
      <Text style={styles.cat} numberOfLines={1}>{p.category}</Text>
      <Text style={styles.title} numberOfLines={2}>
        {p.title}
      </Text>
      <Text style={styles.desc} numberOfLines={4}>
        {detailOf(p.title)?.lead ?? p.desc}
      </Text>
      <View style={{ flex: 1 }} />
      <Press onPress={go} style={styles.open} accessibilityLabel={`Открыть ${p.title}`}>
        <LinearGradient colors={LAVENDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={styles.openText}>Открыть</Text>
      </Press>
    </Press>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', marginTop: 14, padding: 4, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1' },
  tg: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tgOn: { backgroundColor: colors.accent },
  tgText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  tgTextOn: { fontFamily: fonts.semibold, color: '#fff' },
  search: { marginTop: 14, height: 48, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  card: { flex: 1, height: 334, borderRadius: 20, backgroundColor: '#fff', padding: 10, borderWidth: 1, borderColor: colors.line, ...shadow },
  art: { height: 110, borderRadius: 14, overflow: 'hidden' },
  volume: { position: 'absolute', left: 8, top: 8, fontFamily: fonts.semibold, fontSize: 11, color: colors.ink2, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
  cat: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.violet, marginTop: 10 },
  title: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.ink, marginTop: 3, minHeight: 36 },
  desc: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted, marginTop: 4, minHeight: 64 },
  open: { height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 10 },
  openText: { fontFamily: fonts.semibold, fontSize: 14, color: '#fff' },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', paddingVertical: 40 },
});
