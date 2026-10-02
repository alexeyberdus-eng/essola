import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { RecipeCard } from '../components/RecipeCard';
import { Glow } from '../components/silk';
import { Button, IconButton, Press, Seg, tap } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ago, plural } from '../data/community';
import { COMMUNITY_RECIPES, Recipe } from '../data/recipes';
import { FORUM_CATS, forumCreate, forumList, recentRecipes, TopicRow } from '../lib/social';
import { colors, fonts, space } from '../theme';

type Tab = 'topics' | 'recipes';

/** Forum: discussion topics by category plus fresh recipes published by essola users. */
export default function Forum() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('topics');
  const [cat, setCat] = useState('all');
  const [topics, setTopics] = useState<TopicRow[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    if (tab === 'topics') {
      setTopics((await forumList(cat === 'all' ? undefined : cat).catch(() => ({ items: [] as TopicRow[] }))).items);
    } else {
      const list = await recentRecipes().catch(() => []);
      setRecipes(
        list.map(({ recipe, user: u }) => {
          const r: Recipe = { ...recipe, own: false, author: { id: u.id, nick: u.nick } };
          COMMUNITY_RECIPES.set(r.id, r);
          return r;
        }),
      );
    }
  }, [tab, cat]);

  useEffect(() => {
    load();
  }, [load]);

  const newTopic = () => {
    tap();
    if (!user) return router.push('/auth');
    setComposing(true);
  };

  const header = (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.top}>
        <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text style={styles.h1}>Форум</Text>
        <Press onPress={newTopic} style={styles.newBtn} accessibilityLabel="Новая тема">
          <Icon name="plus" size={18} color="#fff" />
        </Press>
      </View>
      <View style={styles.seg}>
        {(
          [
            ['topics', 'Темы'],
            ['recipes', 'Рецепты участниц'],
          ] as const
        ).map(([k, l]) => (
          <Press key={k} haptic={false} onPress={() => { tap(); setTab(k); }} style={[styles.segItem, tab === k && styles.segItemOn]}>
            <Text style={[styles.segText, tab === k && { color: colors.ink }]}>{l}</Text>
          </Press>
        ))}
      </View>
      {tab === 'topics' && (
        <View style={{ marginTop: 12 }}>
          <Seg small inset={space.gutter} options={[{ key: 'all', label: 'Все' }, ...FORUM_CATS.map((c) => ({ key: c, label: c }))]} value={cat} onChange={(k) => { tap(); setCat(k); }} />
        </View>
      )}
      {composing && <Composer nick={user?.nick || user?.name || 'гость'} onClose={() => setComposing(false)} onDone={(id) => { setComposing(false); router.push(`/topic/${id}` as never); load(); }} />}
    </View>
  );

  const empty = (text: string) => (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );

  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Glow />
      {tab === 'topics' ? (
        <FlatList
          data={topics ?? []}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}
          refreshControl={refresh}
          ListHeaderComponent={header}
          ListEmptyComponent={topics === null ? <ActivityIndicator color={colors.violet} style={{ marginTop: 30 }} /> : empty('Тем пока нет. Задайте первый вопрос — про рецепт, ингредиент или уход. Нажмите «+» вверху.')}
          renderItem={({ item }) => (
            <Press haptic={false} onPress={() => router.push(`/topic/${item.id}` as never)} style={styles.topic}>
              <Text style={styles.topicCat}>{item.cat}</Text>
              <Text style={styles.topicTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {!!item.preview && (
                <Text style={styles.topicPreview} numberOfLines={2}>
                  {item.preview}
                </Text>
              )}
              <View style={styles.topicMeta}>
                <Text style={styles.metaText}>@{item.author.nick}</Text>
                <View style={styles.metaRight}>
                  <Icon name="comment" size={14} color={colors.muted} />
                  <Text style={styles.metaText}>
                    {item.replies} {plural(item.replies, 'ответ', 'ответа', 'ответов')} · {ago(item.last)}
                  </Text>
                </View>
              </View>
            </Press>
          )}
        />
      ) : (
        <FlatList
          data={recipes ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}
          refreshControl={refresh}
          ListHeaderComponent={header}
          ListEmptyComponent={recipes === null ? <ActivityIndicator color={colors.violet} style={{ marginTop: 30 }} /> : empty('Здесь появятся рецепты участниц. Соберите формулу в конструкторе и сохраните её — она попадёт сюда.')}
          renderItem={({ item, index }) => <RecipeCard recipe={item} index={index} />}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function Composer({ nick, onClose, onDone }: { nick: string; onClose: () => void; onDone: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [cat, setCat] = useState(FORUM_CATS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    if (title.trim().length < 4) return setError('Заголовок — хотя бы 4 символа');
    setBusy(true);
    setError('');
    try {
      onDone(await forumCreate(nick, title.trim(), text.trim(), cat));
    } catch {
      setError('Не получилось отправить — проверьте интернет');
      setBusy(false);
    }
  };
  return (
    <View style={styles.composer}>
      <View style={styles.compHead}>
        <Text style={styles.compTitle}>Новая тема</Text>
        <IconButton icon="close" label="Закрыть" onPress={onClose} />
      </View>
      <Seg small options={FORUM_CATS.map((c) => ({ key: c, label: c }))} value={cat} onChange={setCat} />
      <TextInput value={title} onChangeText={setTitle} placeholder="Заголовок: о чём хотите спросить?" placeholderTextColor={colors.faint} style={styles.input} maxLength={120} />
      <TextInput value={text} onChangeText={setText} placeholder="Подробности: рецепт, тип кожи, что уже пробовали…" placeholderTextColor={colors.faint} style={[styles.input, styles.area]} multiline maxLength={4000} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button label={busy ? 'Публикуем…' : 'Опубликовать'} icon="send" onPress={send} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52 },
  h1: { flex: 1, fontFamily: fonts.display, fontSize: 28, letterSpacing: -1, color: colors.ink },
  newBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', height: 44, borderRadius: 15, backgroundColor: '#F3F1F8', padding: 4, marginTop: 8 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  segItemOn: { backgroundColor: '#fff' },
  segText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  topic: { padding: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: '#EAE6F7', marginTop: 10, gap: 4 },
  topicCat: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.violet, textTransform: 'uppercase', letterSpacing: 0.5 },
  topicTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, color: colors.ink },
  topicPreview: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  topicMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  empty: { marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: '#F4F0FF' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  composer: { marginTop: 14, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6F7', gap: 10 },
  compHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  input: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: '#FBFAFE' },
  area: { minHeight: 110, textAlignVertical: 'top' },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.bad },
});
