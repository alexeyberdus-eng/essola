import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dropdown } from '../../components/Dropdown';
import { Hero } from '../../components/Hero';
import { Icon } from '../../components/Icon';
import { Flask, FormulaBar } from '../../components/lab';
import { Card, FadeIn, Glow } from '../../components/silk';
import { CompositionSummary } from '../../components/Summary';
import { makeSteps } from '../../lib/process';
import type { Summary } from '../../lib/effects';
import { aiEnabled, aiReview, Review } from '../../lib/ai';
import { summarize } from '../../lib/effects';
import { Button, IconButton, Press, tap } from '../../components/ui';
import { FN_ICON, FN_LABEL, INGREDIENTS } from '../../data/ingredients';
import { identify, normalize } from '../../lib/analyze';
import { checks, grams, Item, Kind, KINDS, newItem, PHASE_LABEL, PHASE_ORDER, phaseSums, pctText, predict, setDraft, total } from '../../lib/builder';
import { colors, fonts, PHASE_COLOR, scoreColor, shadow, space, TAB_SPACE } from '../../theme';

const AREAS = ['Лицо', 'Тело', 'Волосы', 'Кожа головы', 'Губы', 'Руки и ногти', 'Вокруг глаз'];
const GOALS = ['Увлажнение', 'Питание', 'Против акне', 'Успокоение', 'Сияние и тон', 'Антивозраст', 'Восстановление', 'Очищение'];
/** Starting points for each area: a base, a humectant, an emulsifier, actives and a preservative. */
const QUICK: Record<string, string[]> = {
  'Лицо': ['Aqua', 'Glycerin', 'Cetearyl Olivate', 'Squalane', 'Niacinamide', 'Panthenol', 'Sodium Hyaluronate', 'Simmondsia Chinensis Seed Oil', 'Ceramide NP', 'Phenoxyethanol'],
  'Вокруг глаз': ['Aqua', 'Caffeine', 'Sodium Hyaluronate', 'Squalane', 'Panthenol', 'Cetearyl Olivate', 'Palmitoyl Tripeptide-1', 'Phenoxyethanol'],
  'Тело': ['Aqua', 'Glycerin', 'Butyrospermum Parkii Butter', 'Prunus Amygdalus Dulcis Oil', 'Urea', 'Cetearyl Olivate', 'Cetearyl Alcohol', 'Tocopherol', 'Phenoxyethanol'],
  'Волосы': ['Aqua', 'Behentrimonium Methosulfate', 'Cetearyl Alcohol', 'Hydrolyzed Keratin', 'Panthenol', 'Argania Spinosa Kernel Oil', 'Glycerin', 'Phenoxyethanol'],
  'Кожа головы': ['Aqua', 'Caffeine', 'Niacinamide', 'Panthenol', 'Salicylic Acid', 'Menthol', 'Propanediol', 'Phenoxyethanol'],
  'Губы': ['Cera Alba', 'Butyrospermum Parkii Butter', 'Ricinus Communis Seed Oil', 'Theobroma Cacao Seed Butter', 'Lanolin', 'Tocopherol'],
  'Руки и ногти': ['Aqua', 'Glycerin', 'Urea', 'Butyrospermum Parkii Butter', 'Allantoin', 'Cetearyl Olivate', 'Simmondsia Chinensis Seed Oil', 'Phenoxyethanol'],
};
const PHASE_ICON: Record<string, 'drop' | 'leaf' | 'swap' | 'bolt' | 'shield'> = { water: 'drop', oil: 'leaf', emulsifier: 'swap', active: 'bolt', preservative: 'shield' };
const KIND_USE: Record<Kind, string> = {
  cream: 'Лицо и шея: утром и вечером на чистую кожу, горошина на всё лицо',
  toner: 'Лицо: после умывания, ватным диском или распылить, затем крем',
  serum: 'Лицо: 3–4 капли после тоника, перед кремом',
  oil: 'Лицо, тело, кончики волос: 2–3 капли на влажную кожу',
  balm: 'Губы, руки, сухие участки: по необходимости в течение дня',
};

export default function BuilderScreen() {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<Kind>('cream');
  const [items, setItems] = useState<Item[]>([]);
  const [review, setReview] = useState<{ sig: string; data?: Review; busy?: boolean; error?: boolean } | null>(null);
  const [volume, setVolume] = useState(50);
  const [q, setQ] = useState('');
  const [area, setArea] = useState<string>(AREAS[0]);
  const [goal, setGoal] = useState<string | null>(null);
  const [drop, setDrop] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [dropColor, setDropColor] = useState<string>(colors.sageDeep);

  const sum = total(items);
  const list = useMemo(() => checks(items), [items]);
  const prediction = useMemo(() => predict(items), [items]);
  const score = prediction.scores.overall;
  const local = useMemo(() => {
    const k = KINDS.find((x) => x.key === kind)!;
    const s = summarize(prediction.items.map((i) => i.ing), k.label);
    return { ...s, use: [KIND_USE[kind], ...s.use.slice(1)] };
  }, [prediction, kind]);
  const summary = local;
  // Roles come from our base, so the model doesn't have to guess what a trade name is.
  const formula = items.map((i) => {
    const fn = INGREDIENTS.find((x) => x.inci === i.inci)?.fn[0];
    return `${i.inci || i.name} ${i.pct}%${fn ? ` (${FN_LABEL[fn].toLowerCase()})` : ` (${PHASE_LABEL[i.phase].toLowerCase()})`}`;
  });
  const purpose = `${local.kind}. Для чего: ${area}${goal ? `. Задача: ${goal.toLowerCase()}` : ''}`;
  const sig = `${purpose}|${formula.join(',')}`;
  const nq = normalize(q);
  const found = useMemo(
    () =>
      nq
        ? INGREDIENTS.filter((i) => i.risk <= 1 && [i.ru, i.inci, ...i.aliases].some((t) => normalize(t).includes(nq)))
            .sort((a, b) => Number(normalize(b.ru).startsWith(nq)) - Number(normalize(a.ru).startsWith(nq)) || b.act - a.act)
            .slice(0, 8)
        : [],
    [nq],
  );
  const quick = useMemo(() => {
    const have = new Set(items.map((i) => i.inci));
    return (QUICK[area] ?? QUICK['Лицо']).map((inci) => INGREDIENTS.find((x) => x.inci === inci)).filter((x): x is (typeof INGREDIENTS)[number] => !!x && !have.has(x.inci)).slice(0, 10);
  }, [area, items]);
  // The last review stays on screen while the formula changes (adding its suggestions shouldn't hide the rest).
  const shown = review;
  const stale = !!review?.data && review.sig !== sig;
  const askReview = async () => {
    tap('medium');
    setReview({ sig, busy: true });
    try {
      const data = await aiReview(formula, purpose, list.filter((c) => !c.ok).map((c) => c.text));
      setReview({ sig, data });
    } catch {
      setReview({ sig, error: true });
    }
  };
  const layers = phaseSums(items);

  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.create(240, 'easeInEaseOut', 'opacity'));
  const choose = (k: Kind) => {
    tap();
    animate();
    setKind(k);
  };
  const change = (key: string, delta: number) => {
    tap();
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, pct: Math.max(0, Math.round((i.pct + delta) * 10) / 10) } : i)));
  };
  const setPct = (key: string, text: string) => {
    const v = parseFloat(text.replace(',', '.'));
    if (!Number.isNaN(v)) setItems((prev) => prev.map((i) => (i.key === key ? { ...i, pct: Math.min(100, Math.max(0, v)) } : i)));
  };
  const remove = (key: string) => {
    tap();
    animate();
    setItems((prev) => prev.filter((i) => i.key !== key));
  };
  const add = (inci: string) => {
    const item = newItem(inci);
    tap('medium');
    animate();
    setItems((prev) => [...prev, item]);
    setDropColor(PHASE_COLOR[item.phase]);
    setDrop((d) => d + 1);
  };
  // Keeps the formula at 100%: whatever goes over is taken from the water (or the base with the largest share).
  const fit = (list: Item[], keep: string) => {
    let over = Math.round((total(list) - 100) * 10) / 10;
    if (over <= 0) return list;
    const donors = [...list].filter((i) => i.key !== keep && (i.phase === 'water' || i.phase === 'oil')).sort((a, b) => Number(b.phase === 'water') - Number(a.phase === 'water') || b.pct - a.pct);
    const next = list.map((i) => ({ ...i }));
    for (const d of donors) {
      if (over <= 0) break;
      const row = next.find((i) => i.key === d.key)!;
      const take = Math.min(over, Math.max(0, row.pct - 1));
      row.pct = Math.round((row.pct - take) * 10) / 10;
      over = Math.round((over - take) * 10) / 10;
    }
    return next;
  };
  // "+" next to a technologist suggestion: add it straight into the formula at the suggested share.
  const addSuggested = (name: string, pct?: string) => {
    const hit = identify(name.replace(/\(.*?\)/g, '').split(/[,/]| или /)[0].trim());
    const item = newItem(hit.match === 'exact' || hit.match === 'fuzzy' ? hit.ing.inci : name);
    const v = parseFloat((pct ?? '').replace(',', '.').match(/[\d.]+/)?.[0] ?? '');
    if (v > 0 && v < 100) item.pct = v;
    tap('medium');
    animate();
    setItems((prev) => fit([...prev, item], item.key));
    setDropColor(PHASE_COLOR[item.phase]);
    setDrop((d) => d + 1);
  };
  // "−/+" next to a technologist's "change share" line: set that ingredient to the suggested share.
  const setSuggestedPct = (key: string, to: number) => {
    tap('medium');
    setItems((prev) => fit(prev.map((i) => (i.key === key ? { ...i, pct: to } : i)), key));
  };
  const fillWater = () => {
    tap('success');
    setItems((prev) => {
      const w = prev.find((i) => i.phase === 'water');
      if (!w) return prev;
      const gap = Math.round((100 - total(prev)) * 10) / 10;
      return prev.map((i) => (i.key === w.key ? { ...i, pct: Math.round((i.pct + gap) * 10) / 10 } : i));
    });
    setDropColor(PHASE_COLOR.water);
    setDrop((d) => d + 1);
  };
  const steps = useMemo(() => makeSteps(kind, items, volume), [kind, items, volume]);
  const save = () => {
    setDraft({ kind, volume, items, steps });
    router.push('/create');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow flask={false} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: TAB_SPACE + 10 }} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Text style={styles.h1}>Конструктор</Text>
          {items.length > 0 && <IconButton icon="history" label="Очистить" onPress={() => { animate(); setItems([]); }} />}
        </View>
        <Hero kicker="Конструктор essola" title="Соберите своё средство" text={`${INGREDIENTS.length}+ ингредиентов: посчитаем граммы, опишем эффект, а технолог подскажет, что улучшить.`} tone="rose" style={{ marginTop: 6 }} />

        {(
          <View style={[styles.batch, { marginTop: 14 }]}>
            <Text style={styles.batchLabel} numberOfLines={1}>Объём партии</Text>
            <Press haptic={false} onPress={() => { tap(); setVolume((v) => Math.max(10, v - 10)); }} style={styles.batchBtn} accessibilityLabel="Меньше на 10 г">
              <Icon name="minus" size={16} color={colors.ink} strokeWidth={2.2} />
            </Press>
            <View style={styles.batchBox}>
              <TextInput
                value={String(volume)}
                onChangeText={(t) => {
                  const v = parseInt(t.replace(/\D/g, ''), 10);
                  if (v > 0 && v <= 5000) setVolume(v);
                }}
                keyboardType="number-pad"
                selectTextOnFocus
                style={styles.volInput}
                accessibilityLabel="Объём партии в граммах"
              />
              <Text style={styles.batchUnit}>г</Text>
            </View>
            <Press haptic={false} onPress={() => { tap(); setVolume((v) => Math.min(5000, v + 10)); }} style={styles.batchBtn} accessibilityLabel="Больше на 10 г">
              <Icon name="plus" size={16} color={colors.ink} strokeWidth={2.2} />
            </Press>
          </View>
        )}
        {/* What, where and why in one row: each opens its list, so the page needs no scrolling to set up. */}
        <View style={styles.pickers}>
          <Dropdown label="Что делаем" options={KINDS.map((k) => ({ key: k.key, label: k.label }))} value={kind} onChange={(v) => v && choose(v as Kind)} />
          <Dropdown label="Зона" options={AREAS.map((a) => ({ key: a, label: a }))} value={area} onChange={(v) => v && setArea(v as string)} />
          <Dropdown label="Цель" options={GOALS.map((g) => ({ key: g, label: g }))} value={goal} onChange={(v) => setGoal((v as string) || null)} allowNone placeholder="Любая" />
        </View>

        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Найти ингредиент: масло ши, ниацинамид…" placeholderTextColor={colors.faint} style={styles.searchInput} returnKeyType="search" />
          {!!q && (
            <Press haptic={false} onPress={() => setQ('')} accessibilityLabel="Очистить">
              <Icon name="close" size={16} color={colors.muted} />
            </Press>
          )}
        </View>
        {q.trim() ? (
          <View style={styles.results}>
            {found.map((item) => (
              <Press key={item.inci} haptic={false} onPress={() => { add(item.inci); setQ(''); }} style={styles.pRow}>
                <View style={[styles.pIcon, { backgroundColor: item.fn[0] ? FN_ICON[item.fn[0]].bg : colors.surf }]}>
                  {item.fn[0] && <Icon name={FN_ICON[item.fn[0]].icon} size={16} color={FN_ICON[item.fn[0]].color} strokeWidth={1.9} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pName}>{item.ru}</Text>
                  <Text style={styles.pInci} numberOfLines={1}>{item.note}</Text>
                </View>
                <View style={styles.plusSmall}>
                  <Icon name="plus" size={14} color="#fff" strokeWidth={2.4} />
                </View>
              </Press>
            ))}
            {q.trim().length > 2 && (
              <Press haptic={false} onPress={() => { add(q.trim()); setQ(''); }} style={styles.pCustom}>
                <Icon name="plus" size={15} color={colors.brassText} />
                <Text style={styles.pCustomText}>Добавить «{q.trim()}» как свой</Text>
              </Press>
            )}
          </View>
        ) : (
          <View style={styles.quick}>
            <Text style={styles.quickTitle}>{items.length ? 'Часто добавляют' : 'С чего начать'}</Text>
            <View style={styles.quickWrap}>
              {quick.map((item) => (
                <Press key={item.inci} haptic={false} onPress={() => add(item.inci)} style={styles.quickChip}>
                  <Icon name="plus" size={12} color={colors.violet} strokeWidth={2.4} />
                  <Text style={styles.quickText}>{item.ru}</Text>
                </Press>
              ))}
            </View>
          </View>
        )}

        {(['active', ...PHASE_ORDER.filter((x) => x !== 'active')] as typeof PHASE_ORDER).map((ph) => {
          const rows = items.filter((i) => i.phase === ph);
          if (!rows.length) return null;
          return (
            <FadeIn key={ph}>
              <Card style={styles.phase}>
                <View style={styles.phHead}>
                  <View style={[styles.phIcon, { backgroundColor: PHASE_COLOR[ph] }]}>
                    <Icon name={PHASE_ICON[ph]} size={13} color={colors.ink} strokeWidth={2} />
                  </View>
                  <Text style={styles.phTitle}>{PHASE_LABEL[ph]}</Text>
                </View>
                {rows.map((i, n) => (
                  <View key={i.key} style={[styles.row, n > 0 && styles.rowLine]}>
                    <Press haptic={false} onPress={() => remove(i.key)} hitSlop={6} accessibilityLabel="Убрать">
                      <Icon name="close" size={13} color={colors.faint} />
                    </Press>
                    <Text style={styles.name}>{i.name}</Text>
                    <Press haptic={false} onPress={() => change(i.key, i.pct > 2 ? -1 : -0.1)} style={styles.step} hitSlop={4}>
                      <Icon name="minus" size={13} color={colors.ink2} />
                    </Press>
                    <View style={styles.pctBox}>
                      <PctInput value={i.pct} onCommit={(t) => setPct(i.key, t)} />
                      <Text style={styles.pctSign}>%</Text>
                    </View>
                    <Press haptic={false} onPress={() => change(i.key, i.pct >= 2 ? 1 : 0.1)} style={styles.step} hitSlop={4}>
                      <Icon name="plus" size={13} color={colors.ink2} />
                    </Press>
                    <Text style={styles.g}>{grams(i.pct, volume)} г</Text>
                  </View>
                ))}
              </Card>
            </FadeIn>
          );
        })}

        {items.length > 0 && (
          <View style={styles.stats}>
            <Flask layers={layers} size={44} dropKey={drop} dropColor={dropColor} />
            <View style={styles.stat}>
              <Text style={styles.statL}>Сумма</Text>
              <Text style={[styles.statN, Math.abs(sum - 100) > 0.5 && { color: colors.warn }]}>{pctText(sum)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statL}>Оценка</Text>
              <Text style={[styles.statN, { color: scoreColor(score) }]}>{score}</Text>
            </View>
          </View>
        )}
        {items.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <FormulaBar parts={layers} track="#EEF0F7" />
          </View>
        )}
        {items.length > 0 && (
          <View style={{ marginTop: 10, gap: 6 }}>
            {list.map((c) => (
              <View key={c.text} style={styles.check}>
                <Icon name={c.ok ? 'check' : 'alert'} size={14} color={c.ok ? colors.good : colors.warn} strokeWidth={2} />
                <Text style={[styles.checkText, { color: c.ok ? colors.ink2 : colors.warn }]}>{c.text}</Text>
                {c.fix === 'water' && (
                  <Press onPress={fillWater} style={styles.fix}>
                    <Text style={styles.fixText}>Дополнить водой</Text>
                  </Press>
                )}
              </View>
            ))}
          </View>
        )}

        {items.length > 0 && !shown?.data && <CompositionSummary s={summary} title="Что даст эта формула" />}

        {items.length === 1 && aiEnabled && <Text style={styles.minHint}>Добавьте минимум 2 ингредиента — и технолог сможет оценить формулу.</Text>}

        {items.length > 1 && aiEnabled && (
          <View style={{ marginTop: 12 }}>
            {shown?.data ? (
              <>
                <ReviewCard r={shown.data} items={items} summary={summary} onAdd={addSuggested} onSetPct={setSuggestedPct} onRemove={remove} />
                {stale && (
                  <Press onPress={askReview} style={styles.refresh}>
                    <Icon name="spark" size={15} color={colors.violet} />
                    <Text style={styles.refreshText}>Формула изменилась — обновить оценку</Text>
                  </Press>
                )}
              </>
            ) : (
              <Press onPress={askReview} disabled={shown?.busy} style={styles.reviewBtn}>
                {shown?.busy ? <ActivityIndicator color={colors.onDark} /> : <Icon name="spark" size={17} color={colors.onDark} />}
                <Text style={styles.reviewBtnText}>{shown?.busy ? 'Технолог смотрит формулу…' : `Оценка технолога · ${area.toLowerCase()}`}</Text>
              </Press>
            )}
            {shown?.error && <Text style={styles.reviewErr}>Не получилось связаться. Проверьте интернет и нажмите ещё раз.</Text>}
          </View>
        )}

        {items.length > 1 && (
          <View style={{ marginTop: 12 }}>
            <Press onPress={() => { tap(); setShowSteps(!showSteps); }} style={styles.stepsBtn}>
              <View style={styles.stepsIcon}>
                <Icon name="play" size={15} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepsTitle}>Как приготовить</Text>
                <Text style={styles.stepsSub}>Порядок фаз, температура и граммы для {volume} г</Text>
              </View>
              <View style={{ transform: [{ rotate: showSteps ? '180deg' : '0deg' }] }}>
                <Icon name="chevronDown" size={18} color={colors.muted} />
              </View>
            </Press>
            {showSteps && (
              <Card style={styles.stepsCard}>
                {steps.map((t, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{t}</Text>
                  </View>
                ))}
              </Card>
            )}
          </View>
        )}
        {/* At the very end of the page, after the steps: not pinned over the content. */}
        {items.length > 0 && <Button label="Сохранить как рецепт" icon="bookmark" onPress={save} style={{ marginTop: 16 }} />}
      </ScrollView>
    </View>
  );
}

/** Finds the formula row a technologist's suggestion refers to (by INCI or by name). */
function rowFor(items: Item[], name: string) {
  const clean = name.replace(/\(.*?\)/g, '').split(/[,/]| или /)[0].trim();
  const hit = identify(clean);
  const inci = hit.match === 'exact' || hit.match === 'fuzzy' ? hit.ing.inci.toLowerCase() : null;
  const n = normalize(clean);
  return items.find((i) => (inci && (i.inci ?? '').toLowerCase() === inci) || normalize(i.name) === n || (n.length > 4 && normalize(i.name).includes(n)));
}
const pctOf = (t?: string) => {
  const v = parseFloat((t ?? '').replace(',', '.').match(/[\d.]+/)?.[0] ?? '');
  return v > 0 && v < 100 ? v : null;
};

/** The technologist's verdict; every line has a big button on the left that applies it to the formula. */
function ReviewCard({ r, items, summary, onAdd, onSetPct, onRemove }: { r: Review; items: Item[]; summary: Summary; onAdd: (name: string, pct?: string) => void; onSetPct: (key: string, to: number) => void; onRemove: (key: string) => void }) {
  const adds = (r.add ?? []).map((x) => {
    const row = rowFor(items, x.name);
    const to = pctOf(x.pct);
    return { x, row, to };
  });
  return (
    <FadeIn>
      <Card style={styles.review}>
        <Text style={styles.reviewKicker}>Оценка технолога</Text>
        {!(r.add ?? []).length && !(r.reduce ?? []).length && !(r.remove ?? []).length && (
          <View style={styles.goodBadge}>
            <Icon name="check" size={16} color={colors.good} strokeWidth={2.6} />
            <Text style={styles.goodText}>Хорошая формула — менять ничего не нужно</Text>
          </View>
        )}
        {!!r.verdict && <Text style={styles.reviewLead}>{r.verdict}</Text>}
        {summary.effects.length > 0 && (
          <View style={styles.effects}>
            {summary.effects.map((e) => (
              <View key={e.title} style={styles.effect}>
                <Icon name={e.icon} size={13} color={colors.violet} />
                <Text style={styles.effectText}>{e.title}</Text>
              </View>
            ))}
          </View>
        )}
        {adds.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.reviewGroup}>Добавить</Text>
            {adds.map(({ x, row, to }) => {
              // Already in the formula: offer to raise it to the suggested share instead of adding it again.
              const raise = row && to && to > row.pct;
              const done = row && !raise;
              return (
                <View key={x.name} style={styles.reviewRow}>
                  {done ? (
                    <View style={[styles.reviewIcon, { backgroundColor: '#E5F5EC' }]}>
                      <Icon name="check" size={18} color={colors.good} strokeWidth={2.4} />
                    </View>
                  ) : (
                    <Press onPress={() => (raise ? onSetPct(row!.key, to!) : onAdd(x.name, x.pct))} style={styles.addSug} accessibilityLabel={raise ? 'Увеличить долю' : 'Добавить в формулу'}>
                      <Icon name="plus" size={20} color="#fff" strokeWidth={2.6} />
                    </Press>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewName}>{`${x.name}${x.pct ? ` · ${x.pct}` : ''}`}</Text>
                    <Text style={styles.reviewNote}>{done ? 'Уже в формуле' : raise ? `Уже есть ${pctText(row!.pct)} — нажмите, чтобы поднять до ${pctText(to!)}` : x.why ?? ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {(r.reduce ?? []).length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.reviewGroup}>Изменить долю</Text>
            {(r.reduce ?? []).map((x) => {
              const row = rowFor(items, x.name);
              // No number from the technologist: one tap takes a third off.
              let to = pctOf(x.to) ?? (row ? Math.max(0.1, Math.round(row.pct * 0.67 * 10) / 10) : null);
              // The model sometimes answers with a typical share from other recipes ("water → 85%") when the point
              // is to make room for its additions: then the room is counted from this formula instead.
              const room = adds.reduce((sum, a) => sum + (a.row ? 0 : a.to ?? 0), 0);
              const meansLess = /уменьш|убав|меньше|сниз|за сч[её]т|освобод|место|компенс|баланс|100/i.test(x.why ?? '');
              if (row && to !== null && to > row.pct && (meansLess || to - row.pct > 30)) to = room > 0 && row.pct - room > 0.1 ? Math.round((row.pct - room) * 10) / 10 : null;
              const can = row && to !== null && Math.abs(row.pct - to) > 0.01;
              const up = can && to! > row!.pct;
              return (
                <View key={x.name} style={styles.reviewRow}>
                  {can ? (
                    <Press onPress={() => onSetPct(row!.key, to!)} style={styles.addSug} accessibilityLabel={up ? 'Увеличить долю' : 'Уменьшить долю'}>
                      <Icon name={up ? 'plus' : 'minus'} size={20} color="#fff" strokeWidth={2.6} />
                    </Press>
                  ) : (
                    <View style={[styles.reviewIcon, row && to !== null ? { backgroundColor: '#E5F5EC' } : null]}>
                      <Icon name={row && to !== null ? 'check' : 'minus'} size={18} color={row && to !== null ? colors.good : colors.violet} strokeWidth={2.2} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewName}>{row && to !== null ? `${x.name} · ${pctText(row.pct)} → ${pctText(to)}` : x.name}</Text>
                    {!!x.why && <Text style={styles.reviewNote}>{x.why}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {(r.remove ?? []).length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.reviewGroup}>Убрать</Text>
            {(r.remove ?? []).map((x) => {
              const row = rowFor(items, x.name);
              return (
              <View key={x.name} style={styles.reviewRow}>
                {row ? (
                  <Press onPress={() => onRemove(row.key)} style={[styles.addSug, { backgroundColor: colors.bad }]} accessibilityLabel="Убрать из формулы">
                    <Icon name="close" size={18} color="#fff" strokeWidth={2.6} />
                  </Press>
                ) : (
                  <View style={[styles.reviewIcon, { backgroundColor: '#E5F5EC' }]}>
                    <Icon name="check" size={18} color={colors.good} strokeWidth={2.4} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewName}>{x.name}</Text>
                  <Text style={styles.reviewNote}>{row ? x.why ?? '' : 'Уже убрано'}</Text>
                </View>
              </View>
              );
            })}
          </View>
        )}
        {(r.warn ?? []).map((w) => (
          <View key={w} style={styles.reviewWarn}>
            <Icon name="alert" size={14} color={colors.warn} />
            <Text style={styles.reviewWarnText}>{w}</Text>
          </View>
        ))}
      </Card>
    </FadeIn>
  );
}

/** Edits a share as free text and commits on blur, so "0," can be typed on the way to "0,5". */
function PctInput({ value, onCommit }: { value: number; onCommit: (text: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <TextInput
      value={text ?? pctText(value).replace('%', '')}
      onFocus={() => setText(pctText(value).replace('%', ''))}
      onChangeText={setText}
      onBlur={() => {
        if (text !== null) onCommit(text);
        setText(null);
      }}
      onSubmitEditing={() => {
        if (text !== null) onCommit(text);
        setText(null);
      }}
      keyboardType="decimal-pad"
      returnKeyType="done"
      style={styles.pct}
      selectTextOnFocus
    />
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  h1: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -1.1, color: colors.ink },
  kicker: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted, marginTop: 2, marginBottom: 10 },
  chip: { height: 32, paddingHorizontal: 13, borderRadius: 99, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.olive, borderColor: colors.olive },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  chipTextOn: { color: colors.onDark, fontFamily: fonts.semibold },
  lab: { marginTop: 14, padding: 16 },
  labRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  darkKicker: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.onDarkMuted },
  darkMuted: { fontFamily: fonts.regular, fontSize: 11, color: colors.onDarkMuted },
  sum: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: colors.onDark },
  score: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.brassLight },
  vols: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'flex-start' },
  vol: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  volOn: { backgroundColor: colors.brassLight },
  volText: { fontFamily: fonts.monoMedium, fontSize: 12, color: colors.onDark },
  check: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  checkText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16 },
  fix: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: colors.tint },
  fixText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.violet },
  phase: { marginTop: 10, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 4 },
  phHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  phDot: { width: 8, height: 8, borderRadius: 3 },
  phIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  phTitle: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  rowLine: { borderTopWidth: 1, borderColor: '#EFECF6' },
  name: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  step: { width: 26, height: 26, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', alignItems: 'center', justifyContent: 'center' },
  pct: { width: 44, textAlign: 'center', fontFamily: fonts.monoMedium, fontSize: 13, color: colors.ink, paddingVertical: 2 },
  g: { width: 58, textAlign: 'right', fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.ink2 },
  addBtn: { marginTop: 10, height: 46, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D9D2EC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink2 },
  empty: { marginTop: 14, padding: 18, gap: 10 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.5, color: colors.ink },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2, marginBottom: 4 },
  reviewBtn: { height: 52, borderRadius: 18, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reviewBtnText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onDark },
  reviewErr: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.bad, marginTop: 8, textAlign: 'center' },
  review: { padding: 16, gap: 12 },
  reviewKicker: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.violet },
  goodBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.goodSoft },
  goodText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.good },
  reviewLead: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.ink },
  reviewGroup: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  reviewRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reviewIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  reviewName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  reviewNote: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.ink2, marginTop: 1 },
  reviewWarn: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.warnSoft },
  reviewWarnText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.warn },
  ask: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 8 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2, marginTop: 2 },
  goal: { height: 30, paddingHorizontal: 12, borderRadius: 99, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', justifyContent: 'center' },
  goalOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  goalText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink2 },
  pickers: { flexDirection: 'row', gap: 6, marginTop: 14 },
  search: { marginTop: 16, height: 50, borderRadius: 16, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: '#E6E8F3', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, ...shadow },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  results: { marginTop: 6, paddingHorizontal: 4 },
  plusSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  quick: { marginTop: 12, gap: 8 },
  quickTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 99, backgroundColor: colors.tint },
  quickText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink },
  stats: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 18, backgroundColor: '#F6F7FB' },
  stat: { flex: 1, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#fff' },
  statL: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  statN: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginTop: 1 },
  volInput: { width: 52, fontFamily: fonts.display, fontSize: 18, color: colors.ink, padding: 0, textAlign: 'right' },
  batch: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 8, paddingLeft: 14, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E3E0F2' },
  batchLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  batchBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  batchBox: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, width: 92, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1.5, borderColor: colors.violet, backgroundColor: '#fff', justifyContent: 'center' },
  batchUnit: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  effects: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  effect: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: colors.tint },
  effectText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.violet },
  stepsBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E3E0F2', shadowColor: '#2B2F7A', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  stepsIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  stepsTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  stepsSub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  stepsCard: { marginTop: 8, padding: 16, gap: 12 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontFamily: fonts.semibold, fontSize: 12, color: '#fff' },
  stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  refresh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10, height: 42, borderRadius: 14, backgroundColor: colors.tint },
  refreshText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.violet },
  minHint: { marginTop: 12, fontFamily: fonts.medium, fontSize: 13.5, color: colors.warn, textAlign: 'center' },
  addSug: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  pctBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', borderRadius: 9, paddingRight: 6 },
  pctSign: { fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.muted },
  saveBar: { position: 'absolute', left: space.gutter, right: space.gutter, flexDirection: 'row' },
  pHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter },
  pTitle: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.8, color: colors.ink },
  pSearch: { marginHorizontal: space.gutter, marginTop: 12, height: 48, borderRadius: 16, backgroundColor: colors.cardSolid, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, ...shadow },
  pInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  pCustom: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.brassSoft, marginBottom: 8 },
  pCustomText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.brassText },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderColor: colors.line },
  pName: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink },
  pInci: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginTop: 2 },
  pFn: { fontFamily: fonts.monoMedium, fontSize: 10, color: colors.sageDeep, textTransform: 'uppercase' },
});
