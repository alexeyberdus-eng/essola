import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import { ActivityIndicator, Animated, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { DarkBlock, Glass, RollingNumber, Ring } from '../../components/lab';
import { CompositionSummary } from '../../components/Summary';
import { aiAnalogs, aiEnabled, Analog, useAiSummary } from '../../lib/ai';
import { summarize } from '../../lib/effects';
import { recipeNo } from '../../components/RecipeCard';
import { Card, FadeIn, Glow } from '../../components/silk';
import { Button, IconButton, Press, Seg, T, Tag, tap } from '../../components/ui';
import { useUserContent } from '../../context/UserContentContext';
import { Similar, similarRecipes, storeQuery, STORES } from '../../lib/similar';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { FLAG_LABEL, FN_ICON, FN_LABEL, ORIGIN_LABEL } from '../../data/ingredients';
import { AnalyzedItem, analyze } from '../../lib/analyze';
import { colors, fonts, radius, scoreColor, space } from '../../theme';
import { personalize } from '../../lib/personal';
import { opinion } from '../../lib/opinion';
import { ingredientId } from '../../lib/wiki';
import { useProfile } from '../../lib/profile';
import { ShareCard } from '../../components/ShareCard';

const HERO: Record<'good' | 'caution' | 'avoid', [string, string, string]> = {
  good: ['#BFF0D8', '#D9E8FF', '#EDE3FF'],
  caution: ['#FFE3B8', '#FFD9E4', '#EDE3FF'],
  avoid: ['#FFC9C9', '#FFD9E4', '#F3E3FF'],
};

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
  const result = useMemo(() => (scan ? analyze(scan.text, null) : null), [scan]);
  const analogs = useMemo(() => (result ? similarRecipes(result, 4) : []), [result]);
  const local = useMemo(() => summarize(result?.items.map((i) => i.ing) ?? []), [result]);
  const summary = useAiSummary(result?.items.map((i) => i.ing.inci) ?? [], undefined, local);
  const [shop, setShop] = useState<{ busy?: boolean; list?: Analog[]; error?: boolean }>({});
  const findAnalogs = async () => {
    if (!result) return;
    tap('medium');
    setShop({ busy: true });
    try {
      const known = result.items.filter((i) => i.match === 'exact' || i.match === 'fuzzy');
      const keys = [...known].sort((a, b) => b.ing.act - a.ing.act).filter((i) => i.ing.act >= 1).slice(0, 3).map((i) => i.ing.ru.toLowerCase());
      setShop({ list: await aiAnalogs(known.map((i) => i.ing.inci), keys, local.kind) });
    } catch {
      setShop({ error: true });
    }
  };
  const { profile } = useProfile();
  const me = useMemo(() => (result ? personalize(result, profile) : null), [result, profile]);
  const op = useMemo(() => (result ? opinion(result) : { title: '', paragraphs: [] }), [result]);
  const card = useRef<View>(null);
  const share = async () => {
    try {
      tap();
      const uri = await captureRef(card, { format: 'png', quality: 1 });
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
          <LinearGradient colors={HERO[me?.verdict ?? (scores.overall >= 68 ? 'good' : scores.overall >= 50 ? 'caution' : 'avoid')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={styles.heroKicker} numberOfLines={1}>
              {scan.barcode ? `Штрихкод · ${scan.source ?? 'база Essola'}` : 'Скан состава'} · {items.length} ингредиентов
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Text style={[styles.heroTitle, { flex: 1 }]} numberOfLines={3}>
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

        <FadeIn index={2}>
          <View style={styles.opinion}>
            <View style={styles.opHead}>
              <View style={styles.opIcon}>
                <Icon name="flask" size={16} color={colors.violet} strokeWidth={2} />
              </View>
              <Text style={styles.opTitle}>Мнение технолога · {op.title}</Text>
            </View>
            {op.paragraphs.map((t) => (
              <Text key={t} style={styles.opText}>
                {t}
              </Text>
            ))}
          </View>
        </FadeIn>

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
          <CompositionSummary s={summary} />
        </FadeIn>

        {!!result.freeFrom.length && (
          <View style={styles.tags}>
            {result.freeFrom.map((f) => (
              <Tag key={f} label={f} tone="good" />
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button label={onShelf ? 'На полке' : 'На полку'} icon={onShelf ? 'check' : 'shelf'} onPress={toShelf} style={{ flex: 1 }} variant={onShelf ? 'outline' : 'honey'} />
          <Button label="Поделиться" icon="send" onPress={share} style={{ flex: 1 }} variant="outline" />
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
        {aiEnabled && (
          <View style={{ marginTop: 22, gap: 10 }}>
            <View style={styles.anHead}>
              <Text style={styles.section}>Аналоги по составу</Text>
              <Text style={styles.kicker}>Золотое Яблоко</Text>
            </View>
            {shop.list?.length ? (
              shop.list.map((a, i) => (
                <FadeIn key={a.url} index={i}>
                  <Press haptic={false} onPress={() => Linking.openURL(a.url).catch(() => {})}>
                    <Card style={styles.an}>
                      <Ring value={a.match} size={52} stroke={4} color={a.match >= 70 ? colors.good : a.match >= 45 ? colors.violet : colors.warn} track={colors.line}>
                        <Text style={styles.matchText}>{a.match}%</Text>
                      </Ring>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.anTitle} numberOfLines={2}>{a.title}</Text>
                        {!!a.common.length && <Text style={styles.anSub} numberOfLines={1}>Общее: {a.common.join(', ')}</Text>}
                        {!!a.note && <Text style={styles.anSub} numberOfLines={2}>{a.note}</Text>}
                      </View>
                      <Icon name="external" size={14} color={colors.muted} />
                    </Card>
                  </Press>
                </FadeIn>
              ))
            ) : (
              <Press onPress={findAnalogs} disabled={shop.busy} style={styles.findBtn}>
                {shop.busy ? <ActivityIndicator color={colors.onDark} /> : <Icon name="search" size={17} color={colors.onDark} />}
                <Text style={styles.findText}>{shop.busy ? 'Ищем аналоги…' : 'Найти аналоги по составу'}</Text>
              </Press>
            )}
            {shop.list && !shop.list.length && <T v="small">Похожих товаров не нашлось — попробуйте поиск в магазинах ниже.</T>}
            {shop.error && <T v="small" style={{ color: colors.bad }}>Не получилось выполнить поиск. Проверьте интернет и попробуйте ещё раз.</T>}
            {!!shop.list?.length && <T v="small" style={{ color: colors.faint }}>Процент — оценка совпадения ключевых компонентов, а не точное сравнение полного состава.</T>}
          </View>
        )}

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

function Row({ item, open, onPress }: { item: AnalyzedItem; open: boolean; onPress: () => void }) {
  const { ing } = item;
  const risk = RISK[ing.risk];
  const known = item.match !== 'unknown';
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
        </View>
        <Text style={[styles.fn, ing.fn[0] && known && { color: FN_ICON[ing.fn[0]].color }]}>{ing.fn[0] ? FN_LABEL[ing.fn[0]] : '—'}</Text>
        <View style={[styles.dot, { backgroundColor: known ? risk.color : colors.line }]} />
      </Press>
      {open && (
        <View style={styles.detail}>
          <Text style={styles.detailLead}>{ing.note}</Text>
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
  go: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F3F1F8', alignItems: 'center', justifyContent: 'center' },
  store: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 38, borderRadius: 12, backgroundColor: '#F3F1F8' },
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
  matchText: { fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.ink },
  findBtn: { height: 52, borderRadius: 18, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  findText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onDark },
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
  offscreen: { position: 'absolute', left: -2000, top: 0 },
  generalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: 8 },
  generalNum: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  generalLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink },
  opinion: { marginTop: 12, padding: 16, borderRadius: 22, backgroundColor: '#FBFAFF', borderWidth: 1, borderColor: '#E4DCFF', gap: 8 },
  opHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  opIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#EFEAFF', alignItems: 'center', justifyContent: 'center' },
  opTitle: { flex: 1, fontFamily: fonts.display, fontSize: 15.5, color: colors.ink },
  opText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20.5, color: colors.ink2 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  moreText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  heroImg: { width: 76, height: 76, borderRadius: 18, backgroundColor: '#fff' },
});
