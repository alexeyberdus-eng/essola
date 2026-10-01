import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useMemo, useState } from 'react';
import { ProductBase } from '../../components/ProductBase';
import { FlatList, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { Icon } from '../../components/Icon';
import { Brand, FadeIn, Glow } from '../../components/silk';
import { Press, Seg, tap } from '../../components/ui';
import { Product, PRODUCTS, SHOP_CATEGORIES } from '../../data/shop';
import { colors, fonts, shadow, space, TAB_SPACE } from '../../theme';

type Cat = 'all' | (typeof SHOP_CATEGORIES)[number];

type Mode = 'base' | 'shop';

/** «Средства»: search the product base, or the essola shop of ingredients. */
export default function ShopScreen() {
  const [mode, setMode] = useState<Mode>('base');
  const toggle = (
    <View style={styles.toggle}>
      {(
        [
          ['base', 'База средств'],
          ['shop', 'Магазин essola'],
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
    return PRODUCTS.filter((p) => (cat === 'all' || p.category === cat) && (!nq || (p.title + ' ' + p.desc).toLowerCase().includes(nq)));
  }, [cat, q]);

  const header = (
    <View style={{ paddingTop: insets.top + 10 }}>
      <Brand />
      {toggle}
      <View style={styles.hero}>
        <LinearGradient colors={[colors.violet, colors.lilac, colors.orchid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.heroCircle} />
        <Text style={styles.heroKicker}>Магазин essola</Text>
        <Text style={styles.heroTitle}>Всё для домашней лаборатории</Text>
        <Text style={styles.heroText}>Масла, гидролаты и глины для рецептов из ленты. Покупка на Wildberries и Ozon.</Text>
      </View>
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
          <FadeIn index={index % 8} style={{ flex: 1 }}>
            <ProductCard p={item} />
          </FadeIn>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Ничего не нашлось</Text>}
      />
    </View>
  );
}

const TONES: Record<string, [string, string]> = {
  Масла: ['#F1EDFF', '#A77BFF'],
  'Эфирные масла': ['#FFF0F9', '#E08BF5'],
  Гидролаты: ['#EEF1FF', '#8C9CFF'],
  'Глины и маски': ['#F6F5F9', '#B9A6E0'],
  'Для бороды': ['#EFEAF8', '#6A4BF2'],
  Аксессуары: ['#EEF7F2', '#7FC7A0'],
};

/** Product visual: a bottle/jar silhouette tinted by category. */
function ProductArt({ p }: { p: Product }) {
  const [bg, tone] = TONES[p.category] ?? TONES['Масла'];
  const jar = p.category === 'Глины и маски';
  const small = p.category === 'Эфирные масла';
  return (
    <View style={[styles.art, { backgroundColor: bg }]}>
      <Svg width="100%" height="100%" viewBox="0 0 120 100">
        <Defs>
          <SvgGradient id={`g${p.id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tone} stopOpacity="0.55" />
            <Stop offset="1" stopColor={tone} stopOpacity="0.95" />
          </SvgGradient>
        </Defs>
        {jar ? (
          <>
            <Rect x="38" y="30" width="44" height="10" rx="4" fill={colors.ink} />
            <Rect x="35" y="39" width="50" height="46" rx="12" fill="rgba(255,255,255,0.7)" stroke="rgba(22,18,31,0.1)" />
            <Rect x="35" y="58" width="50" height="27" rx="12" fill={`url(#g${p.id})`} />
          </>
        ) : (
          <>
            <Rect x={small ? 55 : 53} y={small ? 26 : 14} width={small ? 10 : 14} height={small ? 12 : 18} rx="3" fill={colors.ink} />
            <Path d={small ? 'M50 38h20v44a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6Z' : 'M46 32h28v50a7 7 0 0 1-7 7H53a7 7 0 0 1-7-7Z'} fill="rgba(255,255,255,0.7)" stroke="rgba(22,18,31,0.1)" />
            <Path d={small ? 'M50 58h20v24a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6Z' : 'M46 56h28v26a7 7 0 0 1-7 7H53a7 7 0 0 1-7-7Z'} fill={`url(#g${p.id})`} />
            <Rect x={small ? 53 : 50} y={small ? 44 : 40} width={small ? 14 : 20} height="9" rx="2" fill="#fff" opacity="0.9" />
          </>
        )}
      </Svg>
      <Text style={styles.volume}>{p.volume}</Text>
    </View>
  );
}

function ProductCard({ p }: { p: Product }) {
  const open = (url: string | null) => {
    if (!url) return;
    tap();
    Linking.openURL(url).catch(() => {});
  };
  return (
    <View style={styles.card}>
      <ProductArt p={p} />
      <Text style={styles.cat}>{p.category}</Text>
      <Text style={styles.title} numberOfLines={2}>
        {p.title}
      </Text>
      <Text style={styles.desc} numberOfLines={3}>
        {p.desc}
      </Text>
      <View style={styles.buttons}>
        {p.wb && (
          <Press onPress={() => open(p.wb)} style={[styles.btn, styles.wb]} accessibilityLabel="Купить на Wildberries">
            <Text style={styles.btnText}>WB</Text>
          </Press>
        )}
        {p.ozon && (
          <Press onPress={() => open(p.ozon)} style={[styles.btn, styles.oz]} accessibilityLabel="Купить на Ozon">
            <Text style={[styles.btnText, { color: colors.ink }]}>Ozon</Text>
          </Press>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', marginTop: 14, padding: 4, borderRadius: 16, backgroundColor: 'rgba(21,23,43,0.05)' },
  tg: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tgOn: { backgroundColor: '#fff', shadowColor: '#15172B', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  tgText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  tgTextOn: { fontFamily: fonts.semibold, color: colors.ink },
  hero: { marginTop: 16, borderRadius: 24, padding: 18, overflow: 'hidden' },
  heroCircle: { position: 'absolute', right: -40, top: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroKicker: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' },
  heroTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, letterSpacing: -0.8, color: '#fff', marginTop: 8, maxWidth: 260 },
  heroText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.9)', marginTop: 6 },
  search: { marginTop: 14, height: 48, borderRadius: 16, backgroundColor: colors.surf, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  card: { flex: 1, borderRadius: 20, backgroundColor: '#fff', padding: 10, borderWidth: 1, borderColor: colors.line, ...shadow },
  art: { height: 110, borderRadius: 14, overflow: 'hidden' },
  volume: { position: 'absolute', left: 8, top: 8, fontFamily: fonts.semibold, fontSize: 11, color: colors.ink2, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
  cat: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.violet, marginTop: 10 },
  title: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.ink, marginTop: 3 },
  desc: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted, marginTop: 4, minHeight: 48 },
  buttons: { flexDirection: 'row', gap: 6, marginTop: 10 },
  btn: { flex: 1, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  wb: { backgroundColor: colors.ink },
  oz: { backgroundColor: colors.tint },
  btnText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', paddingVertical: 40 },
});
