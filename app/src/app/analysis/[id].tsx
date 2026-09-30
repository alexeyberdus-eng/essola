import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { DarkBlock, Glass, RollingNumber, Ring, Tube } from '../../components/lab';
import { recipeNo } from '../../components/RecipeCard';
import { Card, CountUp, FadeIn, Glow } from '../../components/silk';
import { Button, IconButton, Press, Seg, T, Tag, tap } from '../../components/ui';
import { useUserContent } from '../../context/UserContentContext';
import { Similar, similarRecipes, storeQuery, STORES } from '../../lib/similar';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { FLAG_LABEL, FN_LABEL, ORIGIN_LABEL } from '../../data/ingredients';
import { AnalyzedItem, analyze } from '../../lib/analyze';
import { colors, fonts, radius, space } from '../../theme';

type Filter = 'all' | 'active' | 'risk' | 'allergen';
const RISK = [
  { label: 'Безопасно', color: colors.good },
  { label: 'Низкий риск', color: '#8FA06A' },
  { label: 'Умеренный риск', color: colors.warn },
  { label: 'Высокий риск', color: colors.bad },
];

export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getScan, removeScan } = useLibrary();
  const { addToShelf, shelf } = useUserContent();
  const { user } = useAuth();
  const scan = getScan(id);
  const result = useMemo(() => (scan ? analyze(scan.text, user?.skinType) : null), [scan, user?.skinType]);
  const analogs = useMemo(() => (result ? similarRecipes(result, 4) : []), [result]);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<number | null>(null);
  const y = useRef(new Animated.Value(0)).current;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!scan || !result) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 80 }]}>
        <T v="heading">Разбор не найден</T>
        <Press onPress={back}>
          <T v="label">Назад</T>
        </Press>
      </View>
    );
  }

  const { scores, items } = result;
  const groups: Record<Filter, AnalyzedItem[]> = {
    all: items,
    active: items.filter((it) => it.ing.act >= 2),
    risk: items.filter((it) => it.ing.risk >= 2 || (it.ing.risk >= 1 && it.ing.flags.some((f) => f !== 'allergen'))),
    allergen: items.filter((it) => it.ing.flags.includes('allergen')),
  };
  const shown = groups[filter];
  const verdictTone = scores.overall >= 68 ? colors.good : scores.overall >= 50 ? colors.warn : colors.bad;
  const onShelf = shelf.some((x) => x.scanId === scan.id);
  const query = storeQuery(result);
  const toShelf = () => {
    if (onShelf) return router.push('/profile');
    tap('success');
    addToShelf({
      name: scan.title,
      kind: result.items.some((i) => i.ing.fn[0] === 'surfactant') ? 'Очищение' : result.items.some((i) => i.ing.fn.includes('emulsifier')) ? 'Крем' : 'Уход',
      openedAt: new Date().toISOString(),
      pao: 12,
      actives: result.items.filter((i) => i.ing.act >= 1 || /acid|retin/i.test(i.ing.inci)).map((i) => i.ing.inci),
      scanId: scan.id,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow flask={false} />
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 62, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <FadeIn>
          <Text style={styles.kicker} numberOfLines={1}>
            {scan.barcode ? `Штрихкод · ${scan.source ?? 'база Essola'}` : 'Скан состава'}
          </Text>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={3}>
                {scan.title}
              </Text>
              <Text style={styles.sub}>{items.length} ингредиентов</Text>
            </View>
            <Ring value={scores.overall} size={108} stroke={8}>
              <RollingNumber value={scores.overall} style={styles.ringNum} />
              <Text style={styles.ringOf}>/100</Text>
            </Ring>
          </View>
          <View style={[styles.verdict, { backgroundColor: verdictTone === colors.good ? colors.goodSoft : verdictTone === colors.warn ? colors.warnSoft : colors.badSoft }]}>
            <Text style={styles.verdictText}>
              <Text style={{ fontFamily: fonts.semibold, color: verdictTone }}>{result.verdict.title}</Text> · {result.verdict.text}
            </Text>
          </View>
        </FadeIn>

        <FadeIn index={1}>
          <Card style={styles.tubes}>
            {(
              [
                ['Безопасно', scores.safety],
                ['Польза', scores.efficacy],
                ['Природно', scores.natural],
                ['Поры', scores.pores],
              ] as const
            ).map(([l, v], i) => (
              <View key={l} style={styles.tubeCol}>
                <Tube value={v} delay={200 + i * 120} />
                <CountUp value={v} style={styles.tubeNum} />
                <Text style={styles.tubeLabel}>{l}</Text>
              </View>
            ))}
          </Card>
        </FadeIn>

        {!!result.freeFrom.length && (
          <View style={styles.tags}>
            {result.freeFrom.map((f) => (
              <Tag key={f} label={f} tone="good" />
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button label={onShelf ? 'На полке' : 'На мою полку'} icon={onShelf ? 'check' : 'shelf'} onPress={toShelf} style={{ flex: 1 }} variant={onShelf ? 'outline' : 'honey'} />
        </View>

        {result.personal.length > 0 ? (
          <View style={styles.personal}>
            <View style={styles.personalHead}>
              <Icon name="user" size={15} color={colors.sageDeep} />
              <Text style={styles.personalTitle}>Для вашей кожи</Text>
            </View>
            {result.personal.map((p) => (
              <T key={p} style={{ fontSize: 14, lineHeight: 20 }}>
                {p}
              </T>
            ))}
          </View>
        ) : (
          <Press onPress={() => router.push(user ? '/profile' : '/auth')} style={[styles.personal, styles.personalGhost]}>
            <View style={styles.personalHead}>
              <Icon name="user" size={15} color={colors.sageDeep} />
              <Text style={styles.personalTitle}>Персональный разбор</Text>
            </View>
            <T style={{ fontSize: 14, lineHeight: 20 }}>Укажите тип кожи в кабинете — и Essola подсветит, что подходит именно вам.</T>
          </Press>
        )}

        <Text style={styles.section}>Состав</Text>
        <View style={{ marginBottom: 6 }}>
          <Seg
            small
            inset={space.gutter}
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setOpen(null);
            }}
            options={[
              { key: 'all', label: `Все ${groups.all.length}` },
              { key: 'active', label: `Активы ${groups.active.length}` },
              { key: 'risk', label: `Риски ${groups.risk.length}` },
              { key: 'allergen', label: `Аллергены ${groups.allergen.length}` },
            ]}
          />
        </View>

        {shown.length ? (
          shown.map((it) => <Row key={it.position} item={it} open={open === it.position} onPress={() => setOpen(open === it.position ? null : it.position)} />)
        ) : (
          <T v="small" style={{ paddingVertical: 20, textAlign: 'center' }}>
            {filter === 'active' ? 'Сильных активов в составе нет.' : 'Таких компонентов нет — отлично.'}
          </T>
        )}
        {result.unknown > 0 && (
          <T v="small" style={{ marginTop: 12 }}>
            {result.unknown} компонент(ов) пока нет в базе — они учтены в оценке с пониженным весом.
          </T>
        )}

        <View style={styles.anHead}>
          <Text style={styles.section}>Аналоги по составу</Text>
          <Text style={styles.kicker}>{analogs.length ? `${analogs.length} рецепта` : ''}</Text>
        </View>
        {analogs.map((a, i) => (
          <FadeIn key={a.recipe.id} index={i}>
            <Press haptic={false} onPress={() => router.push(`/recipe/${a.recipe.id}`)}>
              {i === 0 ? (
                <DarkBlock style={styles.an}>
                  <AnalogBody a={a} dark />
                </DarkBlock>
              ) : (
                <Card style={styles.an}>
                  <AnalogBody a={a} />
                </Card>
              )}
            </Press>
          </FadeIn>
        ))}
        <Card style={[styles.an, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
          <View>
            <Text style={styles.mono}>Похожие товары в магазинах</Text>
            <Text style={styles.anTitle}>Поиск по ключевым активам: «{query}»</Text>
            <Text style={styles.anSub}>Сравните цены и составы — откроется поиск магазина.</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {STORES.map((st) => (
              <Press key={st.name} onPress={() => Linking.openURL(st.url(query)).catch(() => {})} style={styles.store}>
                <Text style={styles.storeText}>{st.name}</Text>
                <Icon name="external" size={13} color={colors.ink2} />
              </Press>
            ))}
          </View>
        </Card>

        <T v="small" style={{ marginTop: 20, color: colors.faint }}>
          Оценка информационная и не заменяет консультацию дерматолога: концентрации производитель обычно не указывает.
        </T>
        <Press
          onPress={() => {
            removeScan(scan.id);
            back();
          }}
          style={{ alignSelf: 'center', padding: 14, marginTop: 8 }}
        >
          <T v="label" style={{ color: colors.bad }}>
            Удалить из истории
          </T>
        </Press>
      </Animated.ScrollView>

      <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: y.interpolate({ inputRange: [0, 60], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
          <Glass style={StyleSheet.absoluteFill} tint="rgba(242,238,230,0.6)" />
        </Animated.View>
        <IconButton icon="arrowLeft" label="Назад" onPress={back} />
        <Text style={styles.navTitle}>Разбор</Text>
        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}

function AnalogBody({ a, dark }: { a: Similar; dark?: boolean }) {
  return (
    <>
      <Ring value={a.score} size={48} stroke={4} color={dark ? colors.brassLight : colors.sageDeep} track={dark ? 'rgba(255,255,255,0.12)' : undefined}>
        <Text style={[styles.anPct, dark && { color: colors.brassLight }]}>{a.score}</Text>
      </Ring>
      <View style={{ flex: 1 }}>
        <Text style={[styles.mono, dark && { color: colors.onDarkMuted }]}>{dark ? 'Рецепт Essola · сделать самой' : `Рецепт ${recipeNo(a.recipe)}`}</Text>
        <Text style={[styles.anTitle, dark && { color: colors.onDark }]}>{a.recipe.title}</Text>
        <Text style={[styles.anSub, dark && { color: 'rgba(239,235,224,0.7)' }]} numberOfLines={1}>
          Совпадает: {a.matched.join(', ')}
        </Text>
      </View>
      <View style={[styles.go, dark && { backgroundColor: colors.brassLight }]}>
        <Icon name="arrowRight" size={15} color={dark ? colors.olive : colors.ink} />
      </View>
    </>
  );
}

function Row({ item, open, onPress }: { item: AnalyzedItem; open: boolean; onPress: () => void }) {
  const { ing } = item;
  const risk = RISK[ing.risk];
  const known = item.match !== 'unknown';
  return (
    <View style={styles.rowWrap}>
      <Press haptic={false} onPress={onPress} style={styles.row}>
        <Text style={styles.pos}>{String(item.position + 1).padStart(2, '0')}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name} numberOfLines={open ? undefined : 1}>
            {ing.ru || item.raw}
          </Text>
          <Text style={styles.inci} numberOfLines={1}>
            {known && item.match !== 'guess' ? ing.inci : item.raw}
          </Text>
        </View>
        <Text style={styles.fn}>{ing.fn[0] ? FN_LABEL[ing.fn[0]] : '—'}</Text>
        <View style={[styles.dot, { backgroundColor: known ? risk.color : colors.line }]} />
      </Press>
      {open && (
        <View style={styles.detail}>
          <T style={{ fontSize: 14, lineHeight: 20 }}>{ing.note}</T>
          <View style={styles.tags}>
            {ing.fn.map((f) => (
              <Tag key={f} label={FN_LABEL[f]} />
            ))}
            <Tag label={ORIGIN_LABEL[ing.origin]} tone={ing.origin === 'natural' || ing.origin === 'mineral' ? 'good' : 'neutral'} />
            {known && <Tag label={risk.label} tone={ing.risk >= 3 ? 'bad' : ing.risk >= 2 ? 'warn' : 'good'} />}
            {ing.com >= 2 && <Tag label={`Комедогенность ${ing.com}/5`} tone={ing.com >= 3 ? 'warn' : 'neutral'} />}
            {ing.flags.map((f) => (
              <Tag key={f} label={FLAG_LABEL[f]} tone="warn" />
            ))}
            {item.match === 'fuzzy' && <Tag label={`Исправлено: ${item.raw} → ${ing.inci}`} tone="honey" />}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', gap: 14, backgroundColor: colors.bg },
  nav: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 10 },
  navTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  kicker: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 29, letterSpacing: -0.9, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 5 },
  ringNum: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -1, color: colors.ink },
  ringOf: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted, marginTop: -2 },
  verdict: { marginTop: 12, padding: 12, borderRadius: 16 },
  verdictText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.5, color: colors.ink2 },
  tubes: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, marginTop: 12 },
  tubeCol: { alignItems: 'center', width: 74 },
  tubeNum: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.ink, marginTop: 8 },
  tubeLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  section: { fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.5, color: colors.ink, marginTop: 24, marginBottom: 10 },
  anHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  an: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8 },
  anPct: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.ink },
  mono: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  anTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink, marginTop: 2 },
  anSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  go: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(230,221,207,0.8)', alignItems: 'center', justifyContent: 'center' },
  store: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 38, borderRadius: 12, backgroundColor: 'rgba(230,221,207,0.7)' },
  storeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  personal: { marginTop: 14, backgroundColor: colors.sageSoft, borderRadius: radius.lg, padding: 16, gap: 6 },
  personalGhost: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: '#CFC6B5' },
  personalHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  personalTitle: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.sageDeep },
  rowWrap: { borderBottomWidth: 1, borderColor: 'rgba(226,219,205,0.9)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  pos: { width: 20, fontFamily: fonts.monoMedium, fontSize: 11, color: colors.muted },
  name: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  inci: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  fn: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, maxWidth: 100 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  detail: { paddingLeft: 32, paddingBottom: 14 },
});
