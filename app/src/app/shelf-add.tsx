import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glow } from '../components/silk';
import { Button, IconButton, Press, tap } from '../components/ui';
import { useUserContent } from '../context/UserContentContext';
import { colors, fonts, shadow, space } from '../theme';

const KINDS = ['Крем', 'Сыворотка', 'Тоник', 'Очищение', 'SPF', 'Маска', 'Масло'];
const PAO = [3, 6, 12, 24];
const OPENED = [
  [0, 'Сегодня'],
  [7, 'Неделю назад'],
  [30, 'Месяц назад'],
  [90, '3 месяца назад'],
] as const;
const ACTIVES = [
  ['Retinol', 'Ретинол'],
  ['Ascorbic Acid', 'Витамин C'],
  ['Glycolic Acid', 'Кислоты AHA'],
  ['Salicylic Acid', 'Кислота BHA'],
  ['Benzoyl Peroxide', 'Бензоилпероксид'],
  ['Niacinamide', 'Ниацинамид'],
] as const;

export default function ShelfAdd() {
  const insets = useSafeAreaInsets();
  const { addToShelf } = useUserContent();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('Крем');
  const [pao, setPao] = useState(12);
  const [opened, setOpened] = useState(0);
  const [actives, setActives] = useState<string[]>([]);

  const save = () => {
    if (!name.trim()) return;
    tap('success');
    addToShelf({ name: name.trim(), kind, pao, openedAt: new Date(Date.now() - opened * 86400000).toISOString(), actives });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow flask={false} />
      <View style={styles.nav}>
        <IconButton icon="close" label="Закрыть" onPress={() => router.back()} />
        <Text style={styles.navTitle}>На полку</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: insets.bottom + 100, gap: 18 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>Проще всего — отсканировать штрихкод и нажать «На мою полку» в разборе. Или добавьте вручную:</Text>
        <Field label="Название">
          <TextInput value={name} onChangeText={setName} placeholder="Например, The Ordinary Retinol 0,5%" placeholderTextColor={colors.faint} style={styles.input} autoFocus />
        </Field>
        <Field label="Что это">
          <Chips options={KINDS.map((k) => [k, k] as const)} isOn={(k) => k === kind} onPress={setKind} />
        </Field>
        <Field label="Когда открыли">
          <Chips options={OPENED} isOn={(d) => d === opened} onPress={setOpened} />
        </Field>
        <Field label="Срок после вскрытия (значок баночки)">
          <Chips options={PAO.map((m) => [m, `${m}M`] as const)} isOn={(m) => m === pao} onPress={setPao} />
        </Field>
        <Field label="Активы — для проверки совместимости">
          <Chips options={ACTIVES} isOn={(a) => actives.includes(a)} onPress={(a) => setActives((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))} />
        </Field>
      </ScrollView>
      <View style={[styles.sticky, { paddingBottom: insets.bottom + 14 }]}>
        <Button label="Добавить на полку" icon="shelf" onPress={save} disabled={!name.trim()} />
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Chips<T extends string | number>({ options, isOn, onPress }: { options: readonly (readonly [T, string])[]; isOn: (t: T) => boolean; onPress: (t: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(([k, l]) => (
        <Press key={String(k)} haptic={false} onPress={() => { tap(); onPress(k); }} style={[styles.chip, isOn(k) && styles.chipOn]}>
          <Text style={[styles.chipText, isOn(k) && { color: colors.onDark }]}>{l}</Text>
        </Press>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingTop: 16 },
  navTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  label: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted },
  input: { minHeight: 48, borderRadius: 14, backgroundColor: colors.cardSolid, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, ...shadow },
  chip: { height: 34, paddingHorizontal: 13, borderRadius: 99, backgroundColor: '#F3F1F8', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.olive },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: 12, backgroundColor: 'rgba(255,255,255,0.94)' },
});
