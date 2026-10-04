import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import { ActivityIndicator, Animated, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { DarkBlock, Glass, RollingNumber, Ring } from '../../components/lab';
import { TechnologistOpinion } from '../../components/Summary';
import { aiEnabled, catalogSimilar, SimilarItem, useAiSummary } from '../../lib/ai';
import { signature } from '../../lib/signature';
import { ProductReviews } from '../../components/ProductReviews';
import { specialKind, summarize } from '../../lib/effects';
import { recipeNo } from '../../components/RecipeCard';
import { Card, FadeIn, Glow } from '../../components/silk';
import { Button, IconButton, Press, Seg, T, Tag, tap } from '../../components/ui';
import { useUserContent } from '../../context/UserContentContext';
import { Similar, similarRecipes } from '../../lib/similar';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { FLAG_LABEL, FN_ICON, FN_LABEL, ORIGIN_LABEL } from '../../data/ingredients';
import { AnalyzedItem, analyze } from '../../lib/analyze';
import { detectNotCosmetic, NOT_COSMETIC_TEXT } from '../../lib/kind';
import { colors, fonts, radius, scoreColor, space } from '../../theme';
import { personalize } from '../../lib/personal';
import { opinion } from '../../lib/opinion';
import { ingredientId } from '../../lib/wiki';
import { useProfile } from '../../lib/profile';
import { ScoreBadge } from '../../components/ScoreBadge';
import { ShareCard } from '../../components/ShareCard';
import { cosingFor, EuEntry, euFunction, euLine, useCosing } from '../../lib/cosing';

const HERO: Record<'good' | 'caution' | 'avoid', [string, string, string]> = {
  good: ['#BFF0D8', '#D9E8FF', '#EDE3FF'],
  caution: ['#FFE3B8', '#FFD9E4', '#EDE3FF'],
  avoid: ['#FFC9C9', '#FFD9E4', '#F3E3FF'],
};

type Filter = 'all' | 'active' | 'risk' | 'allergen' | 'extract' | 'oil' | 'humectant' | 'acid' | 'peptide' | 'antioxidant' | 'uv' | 'preservative' | 'fragrance';
const RISK = [
  { label: 'Безопасно', color: colors.good },
  { label: 'Низкий риск', color: '#8FA06A' },
  { label: 'Умеренный риск', color: colors.warn },
  { label: 'Высокий риск', color: colors.bad },
];

export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getScan, removeScan, saveScan } = useLibrary();
  const { addToShelf, shelf } = useUserContent();
  const { user } = useAuth();
  const scan = getScan(id);
  const result = useMemo(() => (scan ? analyze(scan.text, null) : null), [scan]);
  const analogs = useMemo(() => (result ? similarRecipes(result, 4) : []), [result]);
  const local = useMemo(() => summarize(result?.items.map((i) => i.ing) ?? []), [result]);
  // Not skin care (nail polish remover, toothpaste…): our own description only, the AI would call it a skin product.
  const special = useMemo(() => specialKind(result?.items.map((i) => i.ing) ?? []), [result]);
  // A product found by its label, barcode or in our base already has a name: the technologist judges the composition
  // for that product instead of guessing what it is.
  const named = scan && !/^Состав №/.test(scan.title) ? scan.title : undefined;
  const summary = useAiSummary(special ? [] : result?.items.map((i) => i.ing.inci) ?? [], named, local);
  // EU facts (CosIng) for every ingredient: what it does and whether EU rules ban or limit it.
  const euName = (it: AnalyzedItem) => (it.match !== 'unknown' && it.match !== 'guess' ? it.ing.inci : it.raw);
  const eu = useCosing(useMemo(() => (result ? result.items.map(euName) : []), [result]));
  const euBanned = useMemo(() => (result ? result.items.filter((it) => euLine(cosingFor(eu, euName(it)))?.tone === 'bad') : []), [result, eu]);
  // Analogs by composition from our base (Letual), matched by the composition fingerprint.
  const [similar, setSimilar] = useState<SimilarItem[] | null | undefined>(undefined);
  const sig = useMemo(() => (result ? signature(result) : ''), [result]);
  useEffect(() => {
    if (!aiEnabled || !sig || sig.split('.').length < 3) return setSimilar(null);
    let live = true;
    const own = (scan?.title ?? '').toLowerCase();
    catalogSimilar(sig).then((list) => live && setSimilar(list ? list.filter((x) => !own.includes(x.t.toLowerCase())) : null));
    return () => {
      live = false;
    };
  }, [sig, scan?.title]);
  const openSimilar = (x: SimilarItem) => {
    tap();
    const a = analyze(x.x, null);
    const next = saveScan({ title: [x.b, x.t].filter(Boolean).join(' · '), text: x.x, overall: a.scores.overall, source: 'Летуаль', image: x.i || null, url: x.u });
    router.push(`/analysis/${next.id}`);
  };
  const { profile } = useProfile();
  const me = useMemo(() => (result ? personalize(result, profile) : null), [result, profile]);
  const op = useMemo(() => (result ? opinion(result, special?.type) : null), [result, special]);
  const card = useRef<View>(null);
  const share = async () => {
    try {
      tap();
      const uri = await captureRef(card, { format: 'png', quality: 1, width: 1080, height: 1920 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Поделиться разбором' });
    } catch {
      // sharing cancelled or unavailable
    }
  };
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

  // Repellents, nail polish removers, household products: no cosmetics score, one plain note.
  if (detectNotCosmetic(scan.text)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Glow flask={false} />
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter }}>
          <View style={{ height: 52, justifyContent: 'center' }}>
            <IconButton icon="arrowLeft" label="Назад" onPress={back} />
          </View>
          <Text style={styles.oddTitle}>{scan.title}</Text>
          <View style={styles.odd}>
            <Icon name="alert" size={20} color={colors.violet} />
            <Text style={styles.oddText}>{NOT_COSMETIC_TEXT.other}</Text>
          </View>
        </View>
      </View>
    );
  }

  const { scores, items } = result;
  const groups: Record<Filter, AnalyzedItem[]> = {
    all: items,
    active: items.filter((it) => it.ing.act >= 2),
    risk: items.filter((it) => it.ing.risk >= 2 || (it.ing.risk >= 1 && it.ing.flags.some((f) => f !== 'allergen'))),
    allergen: items.filter((it) => it.ing.flags.includes('allergen')),
    // Ingredient groups, the way people look for them: extracts, oils, acids, peptides…
    extract: items.filter((it) => it.ing.fn.includes('extract') || /extract|ferment|filtrate|leaf juice/i.test(it.ing.inci)),
    oil: items.filter((it) => /\b(oil|butter|squalane|squalene)\b/i.test(it.ing.inci)),
    humectant: items.filter((it) => it.ing.fn.includes('humectant')),
    acid: items.filter((it) => it.ing.fn.includes('exfoliant') || /\b(glycolic|lactic|salicylic|mandelic|azelaic|malic|tartaric|lactobionic) acid\b|gluconolactone/i.test(it.ing.inci)),
    peptide: items.filter((it) => /peptide|palmitoyl (tri|tetra|penta|hexa|oligo)|acetyl hexapeptide|copper tripeptide/i.test(it.ing.inci)),
    antioxidant: items.filter((it) => it.ing.fn.includes('antioxidant')),
    uv: items.filter((it) => it.ing.fn.includes('uv')),
    preservative: items.filter((it) => it.ing.fn.includes('preservative')),
    fragrance: items.filter((it) => it.ing.fn.includes('fragrance') || /parfum|fragrance/i.test(it.ing.inci)),
  };
  const shown = groups[filter];
  const verdictTone = scores.overall >= 68 ? colors.good : scores.overall >= 50 ? colors.warn : colors.bad;
  const onShelf = shelf.some((x) => x.scanId === scan.id);
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
          <LinearGradient colors={HERO[me?.verdict ?? (scores.overall >= 68 ? 'good' : scores.overall >= 50 ? 'caution' : 'avoid')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={styles.heroKicker} numberOfLines={1}>
              {scan.barcode || scan.url ? 'Средство' : 'Скан состава'} · {items.length} ингредиентов
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Text style={[styles.heroTitle, { flex: 1, fontSize: scan.title.length > 60 ? 17 : scan.title.length > 35 ? 20 : 24, lineHeight: scan.title.length > 60 ? 21 : scan.title.length > 35 ? 24 : 28 }]} numberOfLines={5}>
                {scan.title}
              </Text>
              {!!scan.image && <Image source={{ uri: scan.image.replace('.100.', '.400.') }} style={styles.heroImg} contentFit="cover" cachePolicy="memory-disk" />}
            </View>
            <View style={styles.heroRow}>
              <View style={styles.ringWrap}>
                <Ring value={me?.score ?? scores.overall} size={112} stroke={11} color={scoreColor(me?.score ?? scores.overall)} track="rgba(255,255,255,0.7)">
                  <RollingNumber value={me?.score ?? scores.overall} style={styles.ringNum} />
                  <Text style={styles.ringOf}>{me ? 'для вас' : 'общая'}</Text>
                </Ring>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <View style={styles.verdictPill}>
                  <Icon name={me ? (me.verdict === 'good' ? 'check' : 'alert') : 'spark'} size={14} color={colors.ink} strokeWidth={2.2} />
                  <Text style={styles.verdictPillText}>{me ? me.label : result.verdict.title}</Text>
                </View>
                {me ? (
                  <View style={styles.generalRow}>
                    <Ring value={scores.overall} size={46} stroke={4.5} color={scoreColor(scores.overall)} track="rgba(255,255,255,0.7)">
                      <Text style={styles.generalNum}>{scores.overall}</Text>
                    </Ring>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.generalLabel}>Общая оценка состава</Text>
                      <Text style={styles.heroText} numberOfLines={2}>
                        {me.score === scores.overall ? 'Под ваш профиль замечаний нет' : `Для вас ${me.score > scores.overall ? 'выше' : 'ниже'} — учли ваш профиль`}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.heroText} numberOfLines={4}>
                    {result.verdict.text}
                  </Text>
                )}
              </View>
            </View>
          </LinearGradient>

          <View style={styles.stats}>
            {(
              [
                ['bolt', 'Активы', groups.active.length, '#7B5CFA', '#EFEAFF'],
                ['alert', 'Спорные', groups.risk.length, '#E0962E', '#FFF2DE'],
                ['spark', 'Аллергены', groups.allergen.length, '#E46C9B', '#FDE8F1'],
              ] as const
            ).map(([icon, label, n, c, bg]) => (
              <View key={label} style={[styles.stat, { backgroundColor: bg }]}>
                <Icon name={icon} size={16} color={c} strokeWidth={2} />
                <Text style={[styles.statN, { color: c }]}>{n}</Text>
                <Text style={styles.statL}>{label}</Text>
              </View>
            ))}
          </View>
        </FadeIn>

        {me ? (
          me.reasons.length > 0 && (
            <FadeIn index={1}>
              <View style={styles.why}>
                <Text style={styles.whyTitle}>Почему такая оценка для вас</Text>
                {me.reasons.map((r) => (
                  <View key={r.text} style={styles.whyRow}>
                    <View style={[styles.whyDot, { backgroundColor: r.tone === 'bad' ? colors.bad : r.tone === 'warn' ? colors.warn : colors.good }]} />
                    <Text style={styles.whyText}>{r.text}</Text>
                    <Text style={[styles.whyDelta, { color: r.delta < 0 ? colors.bad : colors.good }]}>{r.delta > 0 ? `+${r.delta}` : r.delta}</Text>
                  </View>
                ))}
              </View>
            </FadeIn>
          )
        ) : (
          <Press onPress={() => router.push('/about-me' as never)} style={styles.meCta}>
            <View style={styles.meIcon}>
              <Icon name="user" size={18} color={colors.violet} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.meTitle}>Получить персональную оценку</Text>
              <Text style={styles.meText}>Расскажите о коже, волосах, беременности и аллергиях — оценка станет вашей</Text>
            </View>
            <Icon name="arrowRight" size={16} color={colors.violet} />
          </Press>
        )}

        <FadeIn index={3}>
          <View style={styles.tubes}>
            {(
              [
                ['Безопасность', scores.safety],
                ['Польза', scores.efficacy],
                ['Природность', scores.natural],
                ['Чистые поры', scores.pores],
              ] as const
            ).map(([l, v], i) => (
              <View key={l} style={styles.tubeCol}>
                <Ring value={v} size={50} stroke={5} color={scoreColor(v)} track="rgba(123,92,250,0.12)" delay={200 + i * 120}>
                  <Text style={styles.tubeNum}>{v}</Text>
                </Ring>
                <Text style={styles.tubeLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </FadeIn>

        {!!result.freeFrom.length && (
          <View style={styles.tags}>
            {result.freeFrom.map((f) => (
              <Tag key={f} label={f} tone="good" />
            ))}
          </View>
        )}

        {op && <TechnologistOpinion s={summary} op={op} />}

        {!!scan.url && (
          <Press onPress={() => Linking.openURL(scan.url!).catch(() => {})} style={styles.buy} accessibilityLabel="Купить">
            <LinearGradient colors={['#FF8FB1', '#B57BFF', '#7C66EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Icon name="bag" size={19} color="#fff" strokeWidth={2} />
            <Text style={styles.buyText}>Купить</Text>
          </Press>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Press onPress={toShelf} style={styles.soft}>
            <Icon name={onShelf ? 'check' : 'shelf'} size={17} color={colors.violetDeep} />
            <Text style={styles.softText}>{onShelf ? 'На полке' : 'На полку'}</Text>
          </Press>
          <Press onPress={share} style={styles.soft}>
            <Icon name="send" size={17} color={colors.violetDeep} />
            <Text style={styles.softText}>Поделиться</Text>
          </Press>
        </View>

        <View style={styles.offscreen} pointerEvents="none">
          <View ref={card} collapsable={false}>
            <ShareCard
              title={scan.title}
              score={me?.score ?? scores.overall}
              personal={!!me}
              label={me ? me.label : result.verdict.title}
              scores={scores}
              good={groups.active.slice(0, 3).map((i) => i.ing.ru)}
              bad={groups.risk.slice(0, 3).map((i) => i.ing.ru)}
              image={scan.image}
            />
          </View>
        </View>

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
            options={(
              [
                ['all', 'Все'],
                ['active', 'Активы'],
                ['risk', 'Риски'],
                ['allergen', 'Аллергены'],
                ['extract', 'Экстракты'],
                ['oil', 'Масла'],
                ['humectant', 'Увлажнители'],
                ['acid', 'Кислоты'],
                ['peptide', 'Пептиды'],
                ['antioxidant', 'Антиоксиданты'],
                ['uv', 'УФ-фильтры'],
                ['preservative', 'Консерванты'],
                ['fragrance', 'Отдушки'],
              ] as [Filter, string][]
            )
              // Empty groups are hidden, except the first four people always look at.
              .filter(([k]) => ['all', 'active', 'risk', 'allergen'].includes(k) || groups[k].length > 0)
              .map(([key, label]) => ({ key, label: `${label} ${groups[key].length}` }))}
          />
        </View>

        {shown.length ? (
          shown.map((it) => <Row key={it.position} item={it} eu={cosingFor(eu, euName(it))} open={open === it.position} onPress={() => setOpen(open === it.position ? null : it.position)} />)
        ) : (
          <T v="small" style={{ paddingVertical: 20, textAlign: 'center' }}>
            {filter === 'active' ? 'Сильных активов в составе нет.' : filter === 'risk' || filter === 'allergen' ? 'Таких компонентов нет — отлично.' : 'Таких компонентов в составе нет.'}
          </T>
        )}
        {euBanned.length > 0 && (
          <View style={styles.euAlert}>
            <Icon name="alert" size={18} color={colors.bad} />
            <Text style={styles.euAlertText}>
              В составе есть {euBanned.length === 1 ? 'вещество, запрещённое' : 'вещества, запрещённые'} в косметике ЕС: {euBanned.map((it) => it.ing.ru || it.raw).join(', ')}. Проверьте название на упаковке — возможно, ошибка распознавания.
            </Text>
          </View>
        )}
        {result.unknown > 0 && (
          <T v="small" style={{ marginTop: 12 }}>
            {result.unknown} компонент(ов) пока нет в базе — они учтены в оценке с пониженным весом.
          </T>
        )}
        {Object.keys(eu).length > 0 && (
          <T v="small" style={{ marginTop: 8, color: colors.faint }}>
            Функции и нормы ЕС — по данным базы CosIng (© Европейский союз), в переводе и обработке essola.
          </T>
        )}

        <View style={styles.anHead}>
          <Text style={styles.section}>Сварить похожее дома</Text>
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
        {aiEnabled && similar !== null && (
          <View style={{ marginTop: 22, gap: 10 }}>
            <View style={styles.anHead}>
              <Text style={styles.section}>Аналоги по составу</Text>
              <Text style={styles.kicker}>{similar?.length ? `${similar.length} в базе` : ''}</Text>
            </View>
            {similar === undefined ? (
              <ActivityIndicator color={colors.violet} style={{ marginVertical: 12 }} />
            ) : similar.length ? (
              similar.map((a, i) => (
                <FadeIn key={a.k} index={i}>
                  <Press haptic={false} onPress={() => openSimilar(a)}>
                    <Card style={styles.an}>
                      {a.i ? (
                        <Image source={{ uri: a.i }} style={styles.simImg} contentFit="contain" cachePolicy="memory-disk" />
                      ) : (
                        <View style={[styles.simImg, { alignItems: 'center', justifyContent: 'center' }]}>
                          <Icon name="flask" size={22} color={colors.faint} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.anTitle} numberOfLines={2}>{a.t}</Text>
                        <Text style={styles.anSub} numberOfLines={1}>{[a.b, `совпадение ${a.match}%`].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <ScoreBadge value={a.s} size={40} />
                    </Card>
                  </Press>
                </FadeIn>
              ))
            ) : (
              <T v="small">Похожих по составу средств в базе пока не нашлось.</T>
            )}
            {!!similar?.length && <T v="small" style={{ color: colors.faint }}>Совпадение — доля общих ключевых ингредиентов с учётом их места в составе.</T>}
          </View>
        )}


        {(scan.barcode || scan.url) && <ProductReviews id={scan.url ?? scan.barcode!} />}

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
          <Glass style={StyleSheet.absoluteFill} tint="rgba(255,255,255,0.94)" />
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

function Row({ item, eu, open, onPress }: { item: AnalyzedItem; eu?: EuEntry; open: boolean; onPress: () => void }) {
  const { ing } = item;
  const risk = RISK[ing.risk];
  const known = item.match !== 'unknown';
  const rule = euLine(eu);
  // Our own base doesn't know it: CosIng still tells what it is for.
  const euFn = !known && eu?.f?.length ? euFunction(eu.f[0]) : null;
  return (
    <View style={styles.rowWrap}>
      <Press haptic={false} onPress={onPress} style={styles.row}>
        {(() => {
          const look = ing.fn[0] ? FN_ICON[ing.fn[0]] : null;
          return (
            <View style={[styles.fnIcon, { backgroundColor: look && known ? look.bg : colors.surf }]}>
              {look && known ? <Icon name={look.icon} size={15} color={look.color} strokeWidth={1.9} /> : <Text style={styles.pos}>{item.position + 1}</Text>}
            </View>
          );
        })()}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name} numberOfLines={open ? undefined : 1}>
            {ing.ru || item.raw}
          </Text>
          <Text style={styles.inci} numberOfLines={1}>
            {known && item.match !== 'guess' ? ing.inci : item.raw}
          </Text>
          {rule && rule.tone !== 'neutral' && <Text style={[styles.euRow, { color: rule.tone === 'bad' ? colors.bad : colors.warn }]} numberOfLines={open ? undefined : 1}>ЕС: {rule.text}</Text>}
        </View>
        <Text style={[styles.fn, ing.fn[0] && known && { color: FN_ICON[ing.fn[0]].color }]} numberOfLines={1}>{known && ing.fn[0] ? FN_LABEL[ing.fn[0]] : euFn ?? (ing.fn[0] ? FN_LABEL[ing.fn[0]] : '—')}</Text>
        <View style={[styles.dot, { backgroundColor: known ? risk.color : colors.line }]} />
      </Press>
      {open && (
        <View style={styles.detail}>
          {known ? (
            <Text style={styles.detailLead}>{ing.note}</Text>
          ) : eu?.f?.length ? (
            <Text style={styles.detailLead}>По данным CosIng: {eu.f.map(euFunction).join(', ')}.</Text>
          ) : (
            <Text style={styles.detailLead}>{ing.note}</Text>
          )}
          {rule && (
            <Text style={styles.euDetail}>
              Нормы ЕС: {rule.text}
              {eu?.a?.find((a) => a.p)?.p ? ` (${eu.a.find((a) => a.p)!.p})` : ''}.
            </Text>
          )}
          {known && (
            <Press haptic={false} onPress={() => router.push(`/ingredient/${ingredientId(ing)}`)} style={styles.more}>
              <Text style={styles.moreText}>Подробнее об ингредиенте</Text>
              <Icon name="arrowRight" size={13} color={colors.violet} />
            </Press>
          )}
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
  euAlert: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#FDECEE' },
  euAlertText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  euRow: { fontFamily: fonts.medium, fontSize: 11.5, marginTop: 1 },
  euDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 6 },
  buy: { height: 56, marginTop: 14, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: '#7C66EE', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  buyText: { fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: 0.2 },
  soft: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#EEE9FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  softText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.violetDeep },
  oddTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, color: colors.ink, marginTop: 8 },
  odd: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: colors.tint },
  oddText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.ink },
  center: { flex: 1, alignItems: 'center', gap: 14, backgroundColor: colors.bg },
  nav: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 10 },
  navTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  kicker: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, padding: 16 },
  headSub: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  title: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, letterSpacing: -0.7, color: '#fff', marginTop: 4 },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 5 },
  ringNum: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -1, color: colors.ink },
  ringOf: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(21,23,43,0.6)', marginTop: -2 },
  verdict: { marginTop: 12, padding: 12, borderRadius: 16 },
  verdictText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.5, color: colors.ink2 },
  tubes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tubeCol: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.tint },
  tubeNum: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  tubeLabel: { fontFamily: fonts.semibold, fontSize: 10, color: colors.ink2, textAlign: 'center' },
  section: { fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.5, color: colors.ink, marginTop: 24, marginBottom: 10 },
  anHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  an: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8 },
  anPct: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.ink },
  mono: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  anTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink, marginTop: 2 },
  anSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  go: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', alignItems: 'center', justifyContent: 'center' },
  store: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1' },
  storeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  personal: { marginTop: 14, backgroundColor: colors.sageSoft, borderRadius: radius.lg, padding: 16, gap: 6 },
  personalGhost: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: '#D9D2EC' },
  personalHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  personalTitle: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.sageDeep },
  rowWrap: { borderBottomWidth: 1, borderColor: '#EFECF6' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  pos: { fontFamily: fonts.monoMedium, fontSize: 11.5, color: colors.muted, textAlign: 'center' },
  name: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  inci: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  fn: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, maxWidth: 100 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  detail: { paddingLeft: 32, paddingBottom: 14 },
  detailLead: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  detailText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.ink2, marginTop: 6 },
  fnIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 28, padding: 18, overflow: 'hidden' },
  heroKicker: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(21,23,43,0.6)' },
  heroTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.6, color: colors.ink, marginTop: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 },
  ringWrap: { borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.55)', padding: 6 },
  heroText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: 'rgba(21,23,43,0.78)' },
  verdictPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 12, height: 32, borderRadius: 99 },
  verdictPillText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  stats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stat: { flex: 1, borderRadius: 18, paddingVertical: 12, alignItems: 'center', gap: 2 },
  statN: { fontFamily: fonts.display, fontSize: 22 },
  statL: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink2 },
  why: { marginTop: 12, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, gap: 10 },
  whyTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  whyDot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  whyText: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  whyDelta: { fontFamily: fonts.semibold, fontSize: 13 },
  meCta: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: '#F4F0FF', borderWidth: 1, borderColor: '#E4DCFF' },
  meIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  meTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  meText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.ink2, marginTop: 2 },
  simImg: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff' },
  offscreen: { position: 'absolute', left: -2000, top: 0 },
  generalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: 8 },
  generalNum: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  generalLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  moreText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  heroImg: { width: 76, height: 76, borderRadius: 18, backgroundColor: '#fff' },
});
