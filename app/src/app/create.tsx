import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { saveMe } from '../lib/social';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Glow } from '../components/silk';
import { Button, IconButton, Press, tap } from '../components/ui';
import { useUserContent } from '../context/UserContentContext';
import { CATEGORIES, Category, LEVELS, Recipe } from '../data/recipes';
import { grams, KINDS, takeDraft, setDraft } from '../lib/builder';
import { colors, fonts, shadow, space } from '../theme';

const SKINS = ['Сухая', 'Нормальная', 'Жирная', 'Комбинированная', 'Чувствительная'];
type Row = { name: string; amount: string };

export default function CreateRecipe() {
  const insets = useSafeAreaInsets();
  const { addRecipe } = useUserContent();
  const { user } = useAuth();
  const [draft] = useState(() => takeDraft());
  const [photo, setPhoto] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState(draft ? KINDS.find((k) => k.key === draft.kind)?.label ?? '' : '');
  const [category, setCategory] = useState<Category>(draft?.kind === 'balm' ? 'Губы' : 'Лицо');
  const [skin, setSkin] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(draft?.kind === 'cream' ? '40' : '15');
  const [level, setLevel] = useState<1 | 2 | 3>(draft?.kind === 'cream' ? 3 : 1);
  const [rows, setRows] = useState<Row[]>(() =>
    draft ? draft.items.map((i) => ({ name: i.name, amount: `${grams(i.pct, draft.volume)} г` })) : [{ name: '', amount: '' }],
  );
  const [steps, setSteps] = useState<string[]>(draft?.steps?.length ? draft.steps : ['']);
  const [tip, setTip] = useState('');
  const [shelf, setShelf] = useState(draft?.items.some((i) => i.phase === 'water') ? '2 месяца с консервантом' : '6 месяцев');

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  const ready = title.trim() && rows.some((r) => r.name.trim()) && steps.some((s) => s.trim());
  const save = () => {
    if (!ready) return;
    tap('success');
    const recipe: Recipe = {
      id: `my-${Date.now().toString(36)}`,
      title: title.trim(),
      subtitle: subtitle.trim() || 'Моя формула',
      category,
      skin: skin.length ? skin : ['Нормальная'],
      minutes: parseInt(minutes, 10) || 15,
      level,
      yield: draft ? `${draft.volume} мл` : '—',
      shelfLife: shelf,
      ingredients: rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), amount: r.amount.trim() || '—' })),
      steps: steps.map((s) => s.trim()).filter(Boolean),
      tip: tip.trim() || 'Сделайте патч-тест на сгибе локтя перед первым применением.',
      tone: ['#E3E4D6', '#8A9A7B'],
      motif: 'drop',
      baseLikes: 0,
      own: true,
      photo,
      createdAt: new Date().toISOString(),
    };
    addRecipe(recipe);
    // Share it with the community under the user's nickname.
    saveMe(user?.nick || 'essola_user', user?.name);
    setDraft(null);
    router.replace(`/recipe/${recipe.id}`);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow flask={false} />
      <View style={styles.nav}>
        <IconButton icon="close" label="Закрыть" onPress={() => router.back()} />
        <Text style={styles.navTitle}>Свой рецепт</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        <Press haptic={false} onPress={pick} style={styles.photo}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Icon name="camera" size={26} color={colors.sageDeep} />
              <Text style={styles.photoText}>Добавить фото результата</Text>
              <Text style={styles.hint}>по желанию</Text>
            </View>
          )}
        </Press>

        <Field label="Название">
          <TextInput value={title} onChangeText={setTitle} placeholder="Например, «Облако»" placeholderTextColor={colors.faint} style={styles.input} />
        </Field>
        <Field label="Коротко о рецепте">
          <TextInput value={subtitle} onChangeText={setSubtitle} placeholder="Лёгкий крем с ниацинамидом для жирной кожи" placeholderTextColor={colors.faint} style={styles.input} />
        </Field>

        <Field label="Категория">
          <Chips options={CATEGORIES} isOn={(c) => c === category} onPress={(c) => setCategory(c)} />
        </Field>
        <Field label="Тип кожи">
          <Chips options={SKINS} isOn={(s) => skin.includes(s)} onPress={(s) => setSkin((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))} />
        </Field>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Время, мин" style={{ width: 110 }}>
            <TextInput value={minutes} onChangeText={setMinutes} keyboardType="number-pad" style={styles.input} />
          </Field>
          <Field label="Сложность" style={{ flex: 1 }}>
            <Chips options={[1, 2, 3] as const} label={(l) => LEVELS[l]} isOn={(l) => l === level} onPress={(l) => setLevel(l)} />
          </Field>
        </View>

        <Field label={`Ингредиенты${draft ? ` · ${draft.volume} мл` : ''}`}>
          {rows.map((r, i) => (
            <View key={i} style={styles.ingRow}>
              <TextInput
                value={r.name}
                onChangeText={(t) => setRows((p) => p.map((x, j) => (j === i ? { ...x, name: t } : x)))}
                placeholder="Ингредиент"
                placeholderTextColor={colors.faint}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                value={r.amount}
                onChangeText={(t) => setRows((p) => p.map((x, j) => (j === i ? { ...x, amount: t } : x)))}
                placeholder="10 г"
                placeholderTextColor={colors.faint}
                style={[styles.input, { width: 92 }]}
              />
            </View>
          ))}
          <AddLine label="Ещё ингредиент" onPress={() => setRows((p) => [...p, { name: '', amount: '' }])} />
        </Field>

        <Field label="Шаги">
          {steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNo}>{i + 1}</Text>
              <TextInput
                value={s}
                onChangeText={(t) => setSteps((p) => p.map((x, j) => (j === i ? t : x)))}
                placeholder={i === 0 ? 'Нагрейте водную и масляную фазы до 70 °C…' : 'Следующий шаг'}
                placeholderTextColor={colors.faint}
                style={[styles.input, { flex: 1, minHeight: 46 }]}
                multiline
              />
            </View>
          ))}
          <AddLine label="Ещё шаг" onPress={() => setSteps((p) => [...p, ''])} />
        </Field>

        <Field label="Совет технолога">
          <TextInput value={tip} onChangeText={setTip} placeholder="Как наносить и что учесть" placeholderTextColor={colors.faint} style={[styles.input, { minHeight: 64 }]} multiline />
        </Field>
        <Field label="Хранение">
          <TextInput value={shelf} onChangeText={setShelf} style={styles.input} />
        </Field>
      </ScrollView>
      <View style={[styles.sticky, { paddingBottom: insets.bottom + 14 }]}>
        <Button label="Сохранить рецепт" icon="check" onPress={save} disabled={!ready} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ marginTop: 16, gap: 8 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Chips<T extends string | number>({ options, isOn, onPress, label }: { options: readonly T[]; isOn: (t: T) => boolean; onPress: (t: T) => void; label?: (t: T) => string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => (
        <Press key={String(o)} haptic={false} onPress={() => { tap(); onPress(o); }} style={[styles.chip, isOn(o) && styles.chipOn]}>
          <Text style={[styles.chipText, isOn(o) && { color: colors.onDark }]}>{label ? label(o) : String(o)}</Text>
        </Press>
      ))}
    </View>
  );
}

function AddLine({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press haptic={false} onPress={onPress} style={styles.addLine}>
      <Icon name="plus" size={14} color={colors.ink2} strokeWidth={2} />
      <Text style={styles.addText}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingTop: 16 },
  navTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  photo: { height: 170, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D9D2EC', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' },
  photoText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink2 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  label: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.muted },
  input: { minHeight: 46, borderRadius: 14, backgroundColor: colors.cardSolid, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', ...shadow },
  chip: { height: 34, paddingHorizontal: 13, borderRadius: 99, backgroundColor: '#F3F1F8', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.olive },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  ingRow: { flexDirection: 'row', gap: 8 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.olive, color: colors.brassLight, textAlign: 'center', lineHeight: 24, fontFamily: fonts.monoMedium, fontSize: 12, marginTop: 11, overflow: 'hidden' },
  addLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink2 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: 12, backgroundColor: 'rgba(255,255,255,0.94)' },
});
