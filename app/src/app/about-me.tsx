import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Glow } from '../components/silk';
import { Button, IconButton, Press, tap } from '../components/ui';
import { INGREDIENTS } from '../data/ingredients';
import { normalize } from '../lib/analyze';
import { CONCERN_LABEL, Concern, HAIR_LABEL, Hair, Pref, PREF_LABEL, Profile, SKIN_LABEL, Skin, useProfile } from '../lib/profile';
import { colors, fonts, space } from '../theme';

/** "Tell us about yourself": skin, goals, hair, pregnancy, intolerances and preferences in one calm page. */
export default function AboutMe() {
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useProfile();
  const [draft, setDraft] = useState<Profile>(profile);
  const [q, setQ] = useState('');
  const set = (patch: Partial<Profile>) => {
    tap();
    setDraft((d) => ({ ...d, ...patch }));
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const nq = normalize(q);
  const found = useMemo(
    () => (nq.length < 2 ? [] : INGREDIENTS.filter((i) => [i.ru, i.inci, ...i.aliases].some((t) => normalize(t).includes(nq))).slice(0, 6)),
    [nq],
  );

  const save = () => {
    tap('success');
    setProfile({ ...draft, done: true });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Расскажите о себе</Text>
            <Text style={styles.sub}>Оценки составов, подбор и советы технолога будут учитывать именно вас. Всё хранится только на телефоне.</Text>
          </View>
          <IconButton icon="close" label="Закрыть" onPress={() => router.back()} />
        </View>

        <Section icon="drop" title="Кожа">
          <Chips options={Object.entries(SKIN_LABEL) as [Skin, string][]} on={(k) => draft.skin === k} onPress={(k) => set({ skin: draft.skin === k ? null : k })} />
          <Row label="Чувствительная, легко краснеет" value={draft.sensitive} onChange={(v) => set({ sensitive: v })} />
        </Section>

        <Section icon="spark" title="Что хочется улучшить" hint="можно несколько">
          <Chips options={Object.entries(CONCERN_LABEL) as [Concern, string][]} on={(k) => draft.concerns.includes(k)} onPress={(k) => set({ concerns: toggle(draft.concerns, k) })} />
        </Section>

        <Section icon="leaf" title="Волосы" hint="можно несколько">
          <Chips options={Object.entries(HAIR_LABEL) as [Hair, string][]} on={(k) => draft.hair.includes(k)} onPress={(k) => set({ hair: toggle(draft.hair, k) })} />
        </Section>

        <Section icon="heart" title="Особое время">
          <Row label="Беременность или грудное вскармливание" value={draft.pregnant} onChange={(v) => set({ pregnant: v })} />
          <Text style={styles.small}>Предупредим о ретиноидах, высоких концентрациях салициловой кислоты и других компонентах, которые в это время не рекомендуют.</Text>
        </Section>

        <Section icon="alert" title="Не переношу" hint="аллергия или раздражение">
          {draft.avoid.length > 0 && (
            <View style={styles.chips}>
              {draft.avoid.map((inci) => {
                const ing = INGREDIENTS.find((i) => i.inci === inci);
                return (
                  <Press key={inci} onPress={() => set({ avoid: draft.avoid.filter((x) => x !== inci) })} style={[styles.chip, styles.chipBad]}>
                    <Text style={[styles.chipText, { color: colors.bad }]}>{ing?.ru ?? inci}</Text>
                    <Icon name="close" size={12} color={colors.bad} />
                  </Press>
                );
              })}
            </View>
          )}
          <View style={styles.search}>
            <Icon name="search" size={17} color={colors.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Найти ингредиент: кокосовое масло, отдушка…" placeholderTextColor={colors.faint} style={styles.input} />
          </View>
          {found.map((i) => (
            <Press
              key={i.inci}
              onPress={() => {
                set({ avoid: draft.avoid.includes(i.inci) ? draft.avoid : [...draft.avoid, i.inci] });
                setQ('');
              }}
              style={styles.found}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.foundName}>{i.ru}</Text>
                <Text style={styles.foundInci}>{i.inci}</Text>
              </View>
              <Icon name="plus" size={16} color={colors.violet} />
            </Press>
          ))}
        </Section>

        <Section icon="shield" title="Предпочтения">
          <Chips options={Object.entries(PREF_LABEL) as [Pref, string][]} on={(k) => draft.prefs.includes(k)} onPress={(k) => set({ prefs: toggle(draft.prefs, k) })} />
        </Section>
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Button label="Сохранить" icon="check" onPress={save} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function Section({ icon, title, hint, children }: { icon: 'drop' | 'spark' | 'leaf' | 'heart' | 'alert' | 'shield'; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sHead}>
        <View style={styles.sIcon}>
          <Icon name={icon} size={16} color={colors.violet} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sTitle}>{title}</Text>
          {hint && <Text style={styles.sHint}>{hint}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

function Chips<K extends string>({ options, on, onPress }: { options: [K, string][]; on: (k: K) => boolean; onPress: (k: K) => void }) {
  return (
    <View style={styles.chips}>
      {options.map(([k, l]) => (
        <Press key={k} haptic={false} onPress={() => onPress(k)} style={[styles.chip, on(k) && styles.chipOn]}>
          <Text style={[styles.chipText, on(k) && styles.chipTextOn]}>{l}</Text>
        </Press>
      ))}
    </View>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.violet, false: '#DADCE8' }} thumbColor="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 8 },
  h1: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -1, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2, marginTop: 6 },
  section: { marginTop: 14, padding: 16, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: colors.line, gap: 12 },
  sHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  sTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  sHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 99, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1' },
  chipOn: { backgroundColor: colors.ink },
  chipBad: { backgroundColor: colors.badSoft },
  chipText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink2 },
  chipTextOn: { color: colors.onDark, fontFamily: fonts.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  search: { height: 46, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1F1', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  input: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 14.5, color: colors.ink },
  found: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.line },
  foundName: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  foundInci: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted },
  bar: { position: 'absolute', left: space.gutter, right: space.gutter, bottom: 0, flexDirection: 'row' },
});
