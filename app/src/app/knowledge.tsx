import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, LayoutAnimation, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Hero } from '../components/Hero';
import { Icon } from '../components/Icon';
import { DarkBlock, Glass } from '../components/lab';
import { Breathe, Card, FadeIn, Glow } from '../components/silk';
import { IconButton, Press, Seg, tap } from '../components/ui';
import { ARTICLE_CATS, ArticleCat, ARTICLES, Article, Term, TERMS } from '../data/articles';
import { FN_LABEL, Fn, INGREDIENTS, Ingredient } from '../data/ingredients';
import { normalize } from '../lib/analyze';
import { ingredientId, recipesWith, WIKI_GROUPS } from '../lib/wiki';
import { colors, fonts, RISK_COLOR, shadow, space, TAB_SPACE } from '../theme';

type Mode = 'articles' | 'glossary';
type Row = { kind: 'article'; a: Article } | { kind: 'term'; t: Term } | { kind: 'head'; title: string; sub: string } | { kind: 'ing'; ing: Ingredient };
const native = Platform.OS !== 'web';

export default function KnowledgeScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('articles');
  const [cat, setCat] = useState<'all' | ArticleCat>('all');
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const [group, setGroup] = useState<'all' | Fn>('all');
  const knob = useRef(new Animated.Value(0)).current;
  const [segW, setSegW] = useState(0);

  useEffect(() => {
    Animated.spring(knob, { toValue: mode === 'articles' ? 0 : 1, speed: 16, bounciness: 10, useNativeDriver: native }).start();
  }, [mode, knob]);

  const nq = normalize(q);
  const featured = ARTICLES.find((a) => a.featured)!;
  const rows: Row[] = useMemo(() => {
    if (mode === 'articles') {
      return ARTICLES.filter((a) => (cat === 'all' || a.cat === cat) && (!nq || normalize(a.title + ' ' + a.lead).includes(nq)) && (cat !== 'all' || nq || !a.featured)).map((a) => ({ kind: 'article' as const, a }));
    }
    const terms = TERMS.filter((t) => (!letter || t.term.toUpperCase().startsWith(letter)) && (!nq || normalize(t.term + ' ' + t.def).includes(nq)));
    const ings = INGREDIENTS.filter((ing) => {
      if (group !== 'all' && !ing.fn.includes(group)) return false;
      if (letter && !ing.ru.toUpperCase().startsWith(letter)) return false;
      if (!nq) return true;
      return [ing.ru, ing.inci, ing.note, ...ing.aliases, ...ing.fn.map((f) => FN_LABEL[f])].some((t) => normalize(t).includes(nq));
    }).sort((a, b) => a.ru.localeCompare(b.ru, 'ru'));
    return [
      { kind: 'head' as const, title: 'Ингредиенты', sub: `${ings.length}` },
      ...ings.map((ing) => ({ kind: 'ing' as const, ing })),
    ];
  }, [mode, cat, nq, letter, group]);

  const letters = useMemo(() => {
    const set = new Set([...INGREDIENTS.map((i) => i.ru[0]?.toUpperCase())].filter((l) => l && /[А-Я]/.test(l)));
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, []);

  const header = (
    <View style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text style={styles.h1}>Знания</Text>
      </View>
      <Hero kicker="Знания essola" title="Статьи и словарь ингредиентов" text="Разбираем, как работает кожа и что делает каждый компонент — простыми словами." tone="mint" style={{ marginTop: 4, marginBottom: 14 }} />
      <View style={styles.seg} onLayout={(e) => setSegW(e.nativeEvent.layout.width)}>
        {(
          [
            ['articles', 'Статьи'],
            ['glossary', 'Ингредиенты'],
          ] as const
        ).map(([k, l]) => (
          <Press
            key={k}
            haptic={false}
            onPress={() => {
              tap();
              setMode(k);
              setQ('');
            }}
            style={[styles.segItem, mode === k && styles.segItemOn]}
          >
            <Text style={[styles.segText, mode === k && styles.segOn]}>{l}</Text>
          </Press>
        ))}
      </View>

      <Glass style={styles.search} tint="rgba(255,255,255,0.9)">
        <View style={styles.searchRow}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={mode === 'articles' ? 'Поиск по статьям' : 'Ингредиент или INCI'}
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
          />
          {!!q && (
            <Press haptic={false} onPress={() => setQ('')}>
              <Icon name="close" size={16} color={colors.muted} />
            </Press>
          )}
        </View>
      </Glass>

      {mode === 'articles' ? (
        <>
          <View style={{ marginTop: 12 }}>
            <Seg small inset={space.gutter} value={cat} onChange={setCat} options={[{ key: 'all', label: 'Все' }, ...ARTICLE_CATS.map((c) => ({ key: c as 'all' | ArticleCat, label: c }))]} />
          </View>
          {cat === 'all' && !nq && (
            <Press haptic={false} onPress={() => router.push(`/article/${featured.id}`)} style={{ marginTop: 14 }}>
              <DarkBlock style={styles.hero}>
                <Molecule />
                <Text style={styles.heroKicker}>Главное · {featured.minutes} мин</Text>
                <Text style={styles.heroTitle}>{featured.title}</Text>
                <Text style={styles.heroLead}>{featured.lead}</Text>
              </DarkBlock>
            </Press>
          )}
          <View style={{ height: 12 }} />
        </>
      ) : (
        <>
          <View style={styles.abc}>
            {letters.map((l) => (
              <Press
                key={l}
                haptic={false}
                onPress={() => {
                  tap();
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setLetter(letter === l ? null : l);
                }}
                style={[styles.letter, letter === l && styles.letterOn]}
              >
                <Text style={[styles.letterText, letter === l && { color: colors.brassLight }]}>{l}</Text>
              </Press>
            ))}
          </View>
          <View style={{ marginTop: 10 }}>
            <Seg small inset={space.gutter} value={group} onChange={setGroup} options={WIKI_GROUPS} />
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'article' ? r.a.id : r.kind === 'term' ? r.t.term : r.kind === 'ing' ? r.ing.inci : `h${i}`)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 30 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item, index }) => (
          <FadeIn index={index % 10}>
            {item.kind === 'article' && <ArticleCard a={item.a} />}
            {item.kind === 'term' && <TermCard t={item.t} />}
            {item.kind === 'ing' && <IngredientCard ing={item.ing} />}
            {item.kind === 'head' && (
              <View style={styles.head}>
                <Text style={styles.headTitle}>{item.title}</Text>
                <Text style={styles.headSub}>{item.sub}</Text>
              </View>
            )}
          </FadeIn>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Ничего не нашлось</Text>}
      />
    </View>
  );
}

/** Niacinamide-like molecule, slowly turning — the lab signature of the featured article. */
function Molecule() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View style={[styles.mol, { transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
      <Svg width={150} height={150} viewBox="0 0 120 100">
        <G fill="none" stroke={colors.brassLight} strokeWidth={1.6} opacity={0.9}>
          <Path d="M40 30 60 18l20 12v24L60 66 40 54Z" />
          <Path d="M60 66v16M80 30l16-9M40 30 24 21M80 54l14 8" />
        </G>
        <G fill={colors.brassLight}>
          {[
            [60, 18, 3.5],
            [80, 30, 3.5],
            [80, 54, 3.5],
            [60, 66, 3.5],
            [40, 54, 3.5],
            [40, 30, 3.5],
            [60, 82, 5],
            [96, 21, 5],
            [24, 21, 4],
            [94, 62, 4],
          ].map(([cx, cy, r], i) => (
            <Circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}

function ArticleCard({ a }: { a: Article }) {
  return (
    <Press haptic={false} onPress={() => router.push(`/article/${a.id}`)}>
      <Card style={styles.art}>
        <View style={styles.artIcon}>
          <Icon name={a.icon} size={20} color={colors.sageDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.mono}>
            {a.cat} · {a.minutes} мин
          </Text>
          <Text style={styles.artTitle}>{a.title}</Text>
          <Text style={styles.artLead} numberOfLines={2}>
            {a.lead}
          </Text>
        </View>
      </Card>
    </Press>
  );
}

function TermCard({ t }: { t: Term }) {
  const [open, setOpen] = useState(false);
  return (
    <Press
      haptic={false}
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen(!open);
      }}
    >
      <Card style={styles.term}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.termName}>{t.term}</Text>
          <Icon name={open ? 'minus' : 'plus'} size={16} color={colors.muted} />
        </View>
        <Text style={styles.termDef} numberOfLines={open ? undefined : 1}>
          {t.def}
        </Text>
      </Card>
    </Press>
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
  top: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -1.1, color: colors.ink },
  seg: { flexDirection: 'row', height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', padding: 4, marginTop: 4 },
  knob: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 12, backgroundColor: colors.cardSolid, ...shadow },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  segItemOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  segOn: { color: '#fff' },
  search: { height: 50, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', marginTop: 12 },
  searchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  hero: { padding: 18, minHeight: 190 },
  mol: { position: 'absolute', right: -14, top: 20 },
  heroKicker: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.brassLight },
  heroTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 27, letterSpacing: -0.9, color: colors.onDark, marginTop: 8, maxWidth: 220 },
  heroLead: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: 'rgba(239,235,224,0.75)', marginTop: 8, maxWidth: 230 },
  art: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, marginBottom: 8 },
  artIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.sageSoft, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  artTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 19, color: colors.ink, marginTop: 3 },
  artLead: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 3 },
  abc: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 12 },
  letter: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F1F8' },
  letterOn: { backgroundColor: colors.olive },
  letterText: { fontFamily: fonts.monoMedium, fontSize: 12, color: colors.ink2 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  headTitle: { fontFamily: fonts.display, fontSize: 18, letterSpacing: -0.5, color: colors.ink },
  headSub: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: colors.muted },
  term: { padding: 13, marginBottom: 8 },
  termName: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  termDef: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.5, color: colors.ink2, marginTop: 4 },
  card: { padding: 14, marginBottom: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink, flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  inci: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.ink2, marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  tag: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.ink2, backgroundColor: colors.sageSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' },
  metaText: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', paddingVertical: 40 },
});
