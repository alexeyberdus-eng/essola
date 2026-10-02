import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glow } from '../components/silk';
import { Button, IconButton, tap } from '../components/ui';
import type { Recipe } from '../data/recipes';
import { useIsAdmin } from '../lib/admin';
import { useAuth } from '../context/AuthContext';
import { refreshExtraRecipes } from '../lib/editorial';
import { editorialAdd } from '../lib/social';
import { CSV_COLUMNS, parseRecipesCsv } from '../lib/recipeCsv';
import { colors, fonts, space } from '../theme';

const EXAMPLE = `${CSV_COLUMNS.join(';')}
Мой тоник;Тоник с розой;Лицо;Сухая, Нормальная;10;100 мл;1 месяц;Гидролат розы — 90 г | Глицерин — 3 г | Консервант Cosgard — 0,6 г;Смешайте всё | Перелейте во флакон;Храните в прохладе;Мягкий тоник для ежедневного ухода;Увлажняет | Освежает;Утром и вечером;`;

/** Imports the user's recipes from a CSV/Excel table into «Мои рецепты». */
export default function ImportRecipes() {
  const insets = useSafeAreaInsets();
  const [found, setFound] = useState<{ recipes: Recipe[]; skipped: number[]; name: string } | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(0);
  const admin = useIsAdmin();

  const pick = async () => {
    tap();
    setNote('');
    setDone(0);
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const text = await new File(res.assets[0].uri).text();
      const parsed = parseRecipesCsv(text, { idPrefix: `csv${Date.now().toString(36)}`, editorial: true });
      setFound({ ...parsed, name: res.assets[0].name });
      if (!parsed.recipes.length) setNote('Не нашли ни одного рецепта. Проверьте, что первая строка — названия колонок, а ингредиенты и шаги разделены «|».');
    } catch {
      setNote('Не получилось прочитать файл. Сохраните таблицу как CSV (UTF-8) и попробуйте ещё раз.');
    }
  };

  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  // Published for everyone as editorial recipes; also kept in the admin's own list.
  const save = async () => {
    if (!found || !user?.email) return;
    setBusy(true);
    try {
      await editorialAdd(user.email, found.recipes.map((r) => ({ ...r, editorial: true })));
      refreshExtraRecipes();
      tap('success');
      setDone(found.recipes.length);
      setFound(null);
    } catch {
      setNote('Не получилось опубликовать — проверьте интернет и что вы вошли под почтой администратора.');
    }
    setBusy(false);
  };


  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}>
        <View style={{ height: 52, justifyContent: 'center' }}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
        {!admin ? (
          <Text style={styles.sub}>Этот раздел доступен только администратору essola.</Text>
        ) : (
        <>
        <Text style={styles.h1}>Рецепты из таблицы</Text>
        <Text style={styles.sub}>Загрузите CSV из Excel, Google Таблиц или Numbers — рецепты появятся в ленте у всех пользователей с подписью «Редакция essola».</Text>

        <View style={styles.card}>
          <Text style={styles.h2}>Как оформить таблицу</Text>
          <Text style={styles.text}>Первая строка — названия колонок:</Text>
          <Text style={styles.mono}>{CSV_COLUMNS.join(' · ')}</Text>
          <Text style={styles.text}>Одна строка — один рецепт. Списки внутри ячейки разделяйте вертикальной чертой «|»:</Text>
          <Text style={styles.mono}>Масло жожоба — 9 мл | Сквалан — 10 мл</Text>
          <Text style={styles.text}>Обязательны название, минимум 2 ингредиента и шаги. Категории: Лицо, Тело, Волосы, Губы, Руки, Ванна.</Text>
          <Button
            label="Скопировать шаблон"
            icon="book"
            variant="outline"
            onPress={async () => {
              await Clipboard.setStringAsync(EXAMPLE);
              tap('success');
              setNote('Шаблон скопирован — вставьте его в таблицу и сохраните как CSV.');
            }}
          />
        </View>

        <Button label="Выбрать файл CSV" icon="plus" onPress={pick} style={{ marginTop: 16 }} />
        {!!note && <Text style={styles.note}>{note}</Text>}
        {!!done && <Text style={[styles.note, { color: colors.good }]}>Готово: опубликовали {done} — они уже в ленте рецептов.</Text>}

        {found && found.recipes.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.h2}>
              {found.name}: {found.recipes.length} рецептов
            </Text>
            {found.recipes.slice(0, 8).map((r) => (
              <Text key={r.id} style={styles.text}>
                • {r.title} — {r.category}, {r.ingredients.length} ингр.
              </Text>
            ))}
            {found.recipes.length > 8 && <Text style={styles.text}>и ещё {found.recipes.length - 8}…</Text>}
            {found.skipped.length > 0 && <Text style={[styles.text, { color: colors.warn }]}>Пропустили строки: {found.skipped.slice(0, 10).join(', ')} — не хватает названия, ингредиентов или шагов.</Text>}
            <Button label={busy ? 'Публикуем…' : `Опубликовать для всех: ${found.recipes.length}`} icon="check" onPress={save} disabled={busy} />
          </View>
        )}
        </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -1, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2, marginTop: 6 },
  card: { marginTop: 16, padding: 16, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#EAE6F7', gap: 8 },
  h2: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.violet, backgroundColor: '#F4F0FF', padding: 10, borderRadius: 12 },
  note: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.ink2, marginTop: 12 },
});
