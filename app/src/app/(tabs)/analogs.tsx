import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { VialTile } from '../../components/RecipeRow';
import { Card, CountUp, FadeIn, Glow, Shimmer } from '../../components/silk';
import { Button, Press, Seg, T } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { LEVELS } from '../../data/recipes';
import { analyze, SAMPLES } from '../../lib/analyze';
import { similarRecipes, STORES, storeQuery, Similar } from '../../lib/similar';
import { colors, fonts, scoreColor, space, TAB_SPACE } from '../../theme';

type Sort = 'match' | 'fast';

function MatchBar({ value }: { value: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: value, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, value]);
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, { width: v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

function AnalogCard({ s, index }: { s: Similar; index: number }) {
  return (
    <FadeIn index={index + 1}>
      <Press haptic={false} onPress={() => router.push(`/recipe/${s.recipe.id}`)}>
        <Card style={styles.card}>
          <View style={styles.cardTop}>
            <VialTile recipe={s.recipe} />
            <View style={{ flex: 1 }}>
              <View style={styles.matchRow}>
                <View style={styles.badge}>
                  <CountUp value={s.score} suffix="% совпадение" style={styles.badgeText} />
                </View>
              </View>
              <Text style={styles.name}>{s.recipe.title}</Text>
              <Text style={styles.sub}>
                {s.recipe.subtitle} · {s.recipe.minutes} мин · {LEVELS[s.recipe.level]}
              </Text>
            </View>
          </View>
          <MatchBar value={s.score} />
          <View style={styles.chips}>
            {s.matched.map((m) => (
              <Text key={m} style={[styles.chip, styles.ok]}>
                ✓ {m}
              </Text>
            ))}
            {s.missing.map((m) => (
              <Text key={m} style={[styles.chip, styles.no]}>
                ✗ {m}
              </Text>
            ))}
          </View>
          <View style={styles.cardFoot}>
            <Text style={styles.diy}>Сварить дома · {s.recipe.yield}</Text>
            <View style={styles.go}>
              <Text style={styles.goText}>Рецепт</Text>
              <Icon name="arrowRight" size={14} color="#fff" />
              <Shimmer width={90} />
            </View>
          </View>
        </Card>
      </Press>
    </FadeIn>
  );
}

export default function AnalogsScreen() {
  const insets = useSafeAreaInsets();
  const { scan: scanParam } = useLocalSearchParams<{ scan?: string }>();
  const { scans, getScan, saveScan } = useLibrary();
  const { user } = useAuth();
  const [sort, setSort] = useState<Sort>('match');

  const scan = (scanParam && getScan(scanParam)) || scans[0];
  const analysis = useMemo(() => (scan ? analyze(scan.text, user?.skinType) : null), [scan, user?.skinType]);
  const list = useMemo(() => {
    if (!analysis) return [];
    const l = similarRecipes(analysis, 6);
    return sort === 'fast' ? [...l].sort((a, b) => a.recipe.minutes - b.recipe.minutes) : l;
  }, [analysis, sort]);

  if (!scan || !analysis) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Glow />
        <View style={[styles.emptyWrap, { paddingTop: insets.top + 60 }]}>
          <View style={styles.emptyIcon}>
            <Icon name="swap" size={30} color={colors.honeyText} />
          </View>
          <T v="title" style={{ textAlign: 'center' }}>
            Найдём аналог дешевле
          </T>
          <Text style={styles.emptyText}>Отсканируйте состав любого средства — покажем похожие по составу рецепты, которые можно сварить дома, и где искать аналоги в магазинах.</Text>
          <Button label="Отсканировать состав" icon="scan" onPress={() => router.navigate('/scanner')} style={{ alignSelf: 'stretch' }} />
          <Press
            haptic={false}
            onPress={() => {
              const s = SAMPLES[0];
              saveScan({ title: s.title, text: s.text, overall: analyze(s.text).scores.overall });
            }}
            style={{ padding: 12 }}
          >
            <Text style={styles.link}>Попробовать на примере</Text>
          </Press>
        </View>
      </View>
    );
  }

  const query = storeQuery(analysis);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: TAB_SPACE }}>
        <T v="title" style={{ fontSize: 30, lineHeight: 34 }}>
          Аналоги
        </T>
        <FadeIn>
          <Press haptic={false} onPress={() => router.push(`/analysis/${scan.id}`)}>
            <Card style={styles.orig}>
              <Text style={styles.kicker}>Ваше средство</Text>
              <View style={styles.origRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.origName} numberOfLines={1}>
                    {scan.title}
                  </Text>
                  <Text style={styles.sub}>{analysis.items.length} компонентов · ключевые: {query}</Text>
                </View>
                <View style={[styles.score, { backgroundColor: scoreColor(scan.overall) }]}>
                  <Text style={styles.scoreText}>{scan.overall}</Text>
                </View>
              </View>
            </Card>
          </Press>
        </FadeIn>

        {scans.length > 1 && (
          <Seg
            small
            inset={space.gutter}
            value={scan.id}
            onChange={(id) => router.setParams({ scan: id })}
            options={scans.slice(0, 6).map((s) => ({ key: s.id, label: s.title.length > 18 ? s.title.slice(0, 17) + '…' : s.title }))}
          />
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.section}>Сварить дома</Text>
          <Seg
            small
            value={sort}
            onChange={setSort}
            options={[
              { key: 'match', label: 'По совпадению' },
              { key: 'fast', label: 'Быстрее' },
            ]}
          />
        </View>
        {list.length ? (
          list.map((s, i) => <AnalogCard key={s.recipe.id} s={s} index={i} />)
        ) : (
          <Text style={styles.emptyText}>Похожих рецептов пока нет — база растёт.</Text>
        )}

        <Text style={[styles.section, { marginTop: 24 }]}>Искать в магазинах</Text>
        <Text style={styles.storeNote}>Ищем по ключевым активам: «{query}». Цены и наличие — на сайте магазина.</Text>
        <Card style={{ paddingHorizontal: 16 }}>
          {STORES.map((st, i) => (
            <Press key={st.name} haptic={false} onPress={() => Linking.openURL(st.url(query))} style={[styles.store, i > 0 && styles.storeBorder]}>
              <Text style={styles.storeName}>{st.name}</Text>
              <Icon name="external" size={17} color={colors.muted} />
            </Press>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.honeyText },
  orig: { padding: 16, marginTop: 14, marginBottom: 12, backgroundColor: colors.honeySoft, borderColor: '#F7E6A8' },
  origRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  origName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  score: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontFamily: fonts.monoMedium, fontSize: 15, color: '#fff' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10, gap: 10 },
  section: { fontFamily: fonts.semibold, fontSize: 19, letterSpacing: -0.5, color: colors.ink },
  card: { padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', gap: 12 },
  matchRow: { flexDirection: 'row' },
  badge: { backgroundColor: colors.honeySoft, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: colors.honeyLine },
  badgeText: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.honeyText },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, marginTop: 6 },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.surf, marginTop: 12, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: colors.honey },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  chip: { fontFamily: fonts.medium, fontSize: 11.5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  ok: { backgroundColor: colors.goodSoft, color: colors.good },
  no: { backgroundColor: colors.surf, color: colors.faint },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  diy: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  go: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.ink, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, overflow: 'hidden' },
  goText: { fontFamily: fonts.semibold, fontSize: 13, color: '#fff' },
  storeNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 10 },
  store: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  storeBorder: { borderTopWidth: 1, borderColor: colors.line },
  storeName: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  emptyWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 28, gap: 14 },
  emptyIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: colors.honeySoft, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.honeyText },
});
