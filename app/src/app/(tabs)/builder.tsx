import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, LayoutAnimation, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { DarkBlock, Flask, FormulaBar } from '../../components/lab';
import { Card, FadeIn, Glow } from '../../components/silk';
import { CompositionSummary } from '../../components/Summary';
import { useAiSummary } from '../../lib/ai';
import { summarize } from '../../lib/effects';
import { Button, IconButton, Press, tap } from '../../components/ui';
import { FN_LABEL, INGREDIENTS } from '../../data/ingredients';
import { normalize } from '../../lib/analyze';
import { checks, grams, Item, Kind, KINDS, newItem, PHASE_LABEL, PHASE_ORDER, phaseSums, pctText, predict, preset, setDraft, total } from '../../lib/builder';
import { colors, fonts, PHASE_COLOR, shadow, space, TAB_SPACE } from '../../theme';

const VOLUMES = [30, 50, 100, 200];
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
  const [items, setItems] = useState<Item[]>(() => preset('cream'));
  const [volume, setVolume] = useState(50);
  const [picker, setPicker] = useState(false);
  const [drop, setDrop] = useState(0);
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
  // AI text after the user pauses editing, so sliders don't fire a request per step.
  const summary = useAiSummary(items.map((i) => `${i.inci || i.name} ${i.pct}%`), local.kind, local, 1200);
  const layers = phaseSums(items);

  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.create(240, 'easeInEaseOut', 'opacity'));
  const choose = (k: Kind) => {
    tap();
    animate();
    setKind(k);
    setItems(preset(k));
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
    setPicker(false);
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
  const save = () => {
    setDraft({ kind, volume, items });
    router.push('/create');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow flask={false} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: TAB_SPACE + 70 }} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Text style={styles.h1}>Конструктор</Text>
          <IconButton icon="history" label="Сбросить" onPress={() => choose(kind)} />
        </View>
        <Text style={styles.kicker}>Новая формула · {KINDS.find((k) => k.key === kind)?.label}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 6 }}>
          {KINDS.map((k) => (
            <Press key={k.key} haptic={false} onPress={() => choose(k.key)} style={[styles.chip, kind === k.key && styles.chipOn]}>
              <Text style={[styles.chipText, kind === k.key && styles.chipTextOn]}>{k.label}</Text>
            </Press>
          ))}
        </ScrollView>

        <DarkBlock style={styles.lab}>
          <View style={styles.labRow}>
            <Flask layers={layers} size={118} dropKey={drop} dropColor={dropColor} />
            <View style={{ flex: 1, gap: 10 }}>
              <View>
                <Text style={styles.darkKicker}>Сумма</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  <Text style={styles.sum}>{pctText(sum)}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.darkKicker}>Прогноз Essola</Text>
                <Text style={styles.score}>{score}/100</Text>
              </View>
              <View style={styles.vols}>
                {VOLUMES.map((v) => (
                  <Press key={v} haptic={false} onPress={() => { tap(); setVolume(v); }} style={[styles.vol, volume === v && styles.volOn]}>
                    <Text style={[styles.volText, volume === v && { color: colors.olive }]}>{v}</Text>
                  </Press>
                ))}
              </View>
              <Text style={styles.darkMuted}>мл в партии · ↔ крутите колбу</Text>
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <FormulaBar parts={layers} track="rgba(255,255,255,0.08)" />
          </View>
          <View style={{ marginTop: 12, gap: 6 }}>
            {list.map((c) => (
              <View key={c.text} style={styles.check}>
                <Icon name={c.ok ? 'check' : 'alert'} size={14} color={c.ok ? '#B9C9A6' : colors.brassLight} strokeWidth={2} />
                <Text style={[styles.checkText, { color: c.ok ? '#C9D6B8' : colors.brassLight }]}>{c.text}</Text>
                {c.fix === 'water' && (
                  <Press onPress={fillWater} style={styles.fix}>
                    <Text style={styles.fixText}>Дополнить водой</Text>
                  </Press>
                )}
              </View>
            ))}
          </View>
        </DarkBlock>

        <CompositionSummary s={summary} title="Что даст эта формула" />

        {PHASE_ORDER.map((ph) => {
          const rows = items.filter((i) => i.phase === ph);
          if (!rows.length) return null;
          return (
            <FadeIn key={ph}>
              <Card style={styles.phase}>
                <View style={styles.phHead}>
                  <View style={[styles.phDot, { backgroundColor: PHASE_COLOR[ph] }]} />
                  <Text style={styles.phTitle}>{PHASE_LABEL[ph]}</Text>
                </View>
                {rows.map((i, n) => (
                  <View key={i.key} style={[styles.row, n > 0 && styles.rowLine]}>
                    <Press haptic={false} onPress={() => remove(i.key)} hitSlop={6} accessibilityLabel="Убрать">
                      <Icon name="close" size={13} color={colors.faint} />
                    </Press>
                    <Text style={styles.name} numberOfLines={1}>
                      {i.name}
                    </Text>
                    <Press haptic={false} onPress={() => change(i.key, i.pct > 2 ? -1 : -0.1)} style={styles.step} hitSlop={4}>
                      <Icon name="minus" size={13} color={colors.ink2} />
                    </Press>
                    <PctInput value={i.pct} onCommit={(t) => setPct(i.key, t)} />
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

        <Press onPress={() => setPicker(true)} style={styles.addBtn}>
          <Icon name="plus" size={16} color={colors.ink2} strokeWidth={2} />
          <Text style={styles.addText}>Добавить ингредиент</Text>
        </Press>
      </ScrollView>

      <View style={[styles.saveBar, { bottom: TAB_SPACE - 36 }]}>
        <Button label="Сохранить как рецепт" icon="bookmark" onPress={save} style={{ flex: 1 }} />
      </View>

      <Picker visible={picker} onClose={() => setPicker(false)} onPick={add} />
    </View>
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

function Picker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (inci: string) => void }) {
  const [q, setQ] = useState('');
  const nq = normalize(q);
  const list = useMemo(
    () =>
      INGREDIENTS.filter((i) => i.risk <= 1 && (!nq || [i.ru, i.inci, ...i.aliases].some((t) => normalize(t).includes(nq))))
        .sort((a, b) => b.act - a.act)
        .slice(0, 80),
    [nq],
  );
  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 18 }}>
        <View style={styles.pHead}>
          <Text style={styles.pTitle}>Ингредиент</Text>
          <IconButton icon="close" label="Закрыть" onPress={onClose} />
        </View>
        <View style={styles.pSearch}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Название или INCI" placeholderTextColor={colors.faint} style={styles.pInput} autoFocus />
        </View>
        <FlatList
          data={list}
          keyExtractor={(i) => i.inci}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.gutter, paddingBottom: 60 }}
          ListHeaderComponent={
            q.trim().length > 2 ? (
              <Press haptic={false} onPress={() => onPick(q.trim())} style={styles.pCustom}>
                <Icon name="plus" size={15} color={colors.brassText} />
                <Text style={styles.pCustomText}>Добавить «{q.trim()}» как свой</Text>
              </Press>
            ) : null
          }
          renderItem={({ item }) => (
            <Press haptic={false} onPress={() => onPick(item.inci)} style={styles.pRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pName}>{item.ru}</Text>
                <Text style={styles.pInci}>{item.inci}</Text>
              </View>
              <Text style={styles.pFn}>{item.fn[0] ? FN_LABEL[item.fn[0]] : ''}</Text>
            </Press>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
  h1: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -1.1, color: colors.ink },
  kicker: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted, marginTop: 2, marginBottom: 10 },
  chip: { height: 32, paddingHorizontal: 13, borderRadius: 99, backgroundColor: '#F3F1F8', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.olive },
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
  fix: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: colors.brassLight },
  fixText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.olive },
  phase: { marginTop: 10, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 4 },
  phHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  phDot: { width: 8, height: 8, borderRadius: 3 },
  phTitle: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  rowLine: { borderTopWidth: 1, borderColor: '#EFECF6' },
  name: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  step: { width: 26, height: 26, borderRadius: 9, backgroundColor: '#F3F1F8', alignItems: 'center', justifyContent: 'center' },
  pct: { width: 44, textAlign: 'center', fontFamily: fonts.monoMedium, fontSize: 13, color: colors.ink, paddingVertical: 2 },
  g: { width: 58, textAlign: 'right', fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.ink2 },
  addBtn: { marginTop: 10, height: 46, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D9D2EC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink2 },
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
