import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../components/Icon';
import { Glow } from '../components/silk';
import { Button, IconButton, Press, Seg, tap } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ago, plural } from '../data/community';
import { CAT_STYLE } from '../data/forum-cats';
import { useIsAdmin } from '../lib/admin';
import { ensureRules, useBlocked } from '../lib/moderation';
import { normalize } from '../lib/analyze';
import { FORUM_CATS, forumCreate, forumList, TopicRow } from '../lib/social';
import { colors, fonts, space } from '../theme';

const catStyle = (c: string) => CAT_STYLE[c] ?? CAT_STYLE['Общее'];

type Row = { kind: 'head'; title: string; sub?: string } | { kind: 'topic'; t: TopicRow };

/** Forum: discussions by users and the official @essola account, by category, with search. */
export default function Forum() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [topics, setTopics] = useState<TopicRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);
  const { isBlocked } = useBlocked();

  const load = useCallback(async () => {
    // A few pages at once, so search covers every topic.
    const all: TopicRow[] = [];
    for (let page = 1; page <= 6; page++) {
      const r = await forumList(cat === 'all' ? undefined : cat, page).catch(() => null);
      if (!r) break;
      all.push(...r.items);
      if (all.length >= r.total || !r.items.length) break;
    }
    setTopics(all);
  }, [cat]);

  useEffect(() => {
    load();
  }, [load]);

  const newTopic = () => {
    tap();
    if (!user) return router.push('/auth');
    setComposing(true);
  };

  const rows = useMemo<Row[]>(() => {
    const nq = normalize(q.trim());
    const list = (topics ?? []).filter((t) => !isBlocked(t.author.id) && (!nq || normalize(t.title + ' ' + t.preview).includes(nq)));
    return list.map((t) => ({ kind: 'topic' as const, t }));
  }, [topics, q, isBlocked]);

  const header = (
    <View style={{ marginBottom: 4 }}>
      <View style={styles.top}>
        <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text style={styles.h1}>Форум</Text>
        <Press onPress={newTopic} style={styles.newBtn} accessibilityLabel="Новая тема">
          <Icon name="plus" size={18} color="#fff" />
        </Press>
      </View>

      <LinearGradient colors={['#8A74F2', '#A98BF5', '#E6A3D8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroKicker}>@essola · клуб домашней косметики</Text>
        <Text style={styles.heroTitle}>Спросите технолога и тех, кто уже варит кремы</Text>
        <View style={styles.stats}>
          <Stat n={topics?.length ?? 0} label="тем" />
          <Stat n={(topics ?? []).reduce((a, t) => a + t.replies, 0)} label="ответов" />
          <Stat n={FORUM_CATS.length} label="разделов" />
        </View>
        <View style={styles.search}>
          <Icon name="search" size={17} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Найти вопрос: консервант, ретинол, перхоть…" placeholderTextColor={colors.faint} style={styles.searchInput} returnKeyType="search" />
          {!!q && (
            <Press haptic={false} onPress={() => setQ('')} accessibilityLabel="Очистить">
              <Icon name="close" size={16} color={colors.muted} />
            </Press>
          )}
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter, marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
        <Chip on={cat === 'all'} label="Все темы" icon="home" fg={colors.ink} bg="#F3F4F8" onPress={() => setCat('all')} />
        {FORUM_CATS.map((c) => {
          const st = catStyle(c);
          return <Chip key={c} on={cat === c} label={c} icon={st.icon} fg={st.fg} bg={st.bg} onPress={() => setCat(c)} />;
        })}
      </ScrollView>

      {!composing && (
        <Press onPress={newTopic} style={styles.ask}>
          <View style={styles.askIcon}>
            <Icon name="comment" size={18} color={colors.violet} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.askTitle}>Задать свой вопрос</Text>
            <Text style={styles.askSub}>Про рецепт, ингредиент или уход — ответят участницы и технолог</Text>
          </View>
          <Icon name="arrowRight" size={18} color={colors.muted} />
        </Press>
      )}
      {composing && <Composer nick={user?.nick || user?.name || 'гость'} onClose={() => setComposing(false)} onDone={(id) => { setComposing(false); router.push(`/topic/${id}` as never); load(); }} />}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Glow />
      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'topic' ? r.t.id : `h${i}`)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          topics === null ? (
            <ActivityIndicator color={colors.violet} style={{ marginTop: 30 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Ничего не нашлось. Задайте этот вопрос сами — нажмите «Задать свой вопрос».</Text>
            </View>
          )
        }
        renderItem={({ item }) =>
          item.kind === 'head' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{item.title}</Text>
              {!!item.sub && <Text style={styles.sectionSub}>{item.sub}</Text>}
            </View>
          ) : (
            <TopicCard t={item.t} />
          )
        }
      />
    </KeyboardAvoidingView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

function Chip({ on, label, count, icon, fg, bg, onPress }: { on: boolean; label: string; count?: number; icon: IconName; fg: string; bg: string; onPress: () => void }) {
  return (
    <Press
      onPress={() => {
        tap();
        onPress();
      }}
      style={[styles.chip, { backgroundColor: on ? fg : bg }]}
    >
      <Icon name={icon} size={15} color={on ? '#fff' : fg} />
      <Text style={[styles.chipText, { color: on ? '#fff' : fg }]}>{label}</Text>
      {!!count && <Text style={[styles.chipCount, { color: on ? 'rgba(255,255,255,0.75)' : fg }]}>{count}</Text>}
    </Press>
  );
}

function Avatar({ nick, size = 30 }: { nick: string; size?: number }) {
  const hues = ['#3F4BC9', '#B5527A', '#1F8A84', '#9A6A12', '#4D7A2A', '#7A4BC9'];
  const c = hues[[...nick].reduce((a, ch) => a + ch.charCodeAt(0), 0) % hues.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.42, color: '#fff' }}>{(nick[0] || '?').toUpperCase()}</Text>
    </View>
  );
}

function TopicCard({ t }: { t: TopicRow }) {
  const st = catStyle(t.cat);
  return (
    <Press haptic={false} onPress={() => router.push(`/topic/${t.id}` as never)} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Icon name={st.icon} size={12} color={st.fg} />
          <Text style={[styles.badgeText, { color: st.fg }]}>{t.cat}</Text>
        </View>
        <Text style={styles.metaText}>{ago(t.last)}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {t.title}
      </Text>
      {!!t.preview && (
        <Text style={styles.cardText} numberOfLines={2}>
          {t.preview}
        </Text>
      )}
      <View style={styles.cardFoot}>
        <View style={styles.row}>
          {t.author.id === 'essola' ? (
            <View style={styles.labAvatar}>
              <Text style={styles.labLetter}>e</Text>
            </View>
          ) : (
            <Avatar nick={t.author.nick} size={22} />
          )}
          <Text style={[styles.metaText, t.author.id === 'essola' && { color: colors.ink, fontFamily: fonts.semibold }]}>@{t.author.nick}</Text>
        </View>
        <View style={styles.row}>
          {!!t.likes && (
            <>
              <Icon name="heart" size={14} color={colors.muted} />
              <Text style={styles.metaText}>{t.likes}</Text>
            </>
          )}
          <Icon name="comment" size={14} color={colors.muted} />
          <Text style={styles.metaText}>
            {t.replies} {plural(t.replies, 'ответ', 'ответа', 'ответов')}
          </Text>
        </View>
      </View>
    </Press>
  );
}

function Composer({ nick, onClose, onDone }: { nick: string; onClose: () => void; onDone: (id: string) => void }) {
  const admin = useIsAdmin();
  const { user } = useAuth();
  const [official, setOfficial] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [cat, setCat] = useState(FORUM_CATS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    if (title.trim().length < 4) return setError('Заголовок — хотя бы 4 символа');
    if (!(await ensureRules())) return;
    setBusy(true);
    setError('');
    try {
      onDone(await forumCreate(nick, title.trim(), text.trim(), cat, official && admin && user?.email ? { email: user.email } : null));
    } catch (e) {
      setError(String(e).includes('400') ? 'В тексте есть недопустимые слова — перефразируйте' : 'Не получилось отправить — проверьте интернет');
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
      {admin && (
        <Press haptic={false} onPress={() => setOfficial(!official)} style={[styles.offBtn, official && { backgroundColor: colors.accent }]}>
          <Text style={[styles.offText, official && { color: '#fff' }]}>{official ? 'Публикуется от @essola' : 'Опубликовать от @essola'}</Text>
        </Press>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button label={busy ? 'Публикуем…' : 'Опубликовать'} icon="send" onPress={send} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52 },
  h1: { flex: 1, fontFamily: fonts.display, fontSize: 28, letterSpacing: -1, color: colors.ink },
  newBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: 10, borderRadius: 26, padding: 18, gap: 10 },
  heroKicker: { fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' },
  heroTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.5, color: '#fff' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 2 },
  stat: { flex: 1, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  statN: { fontFamily: fonts.display, fontSize: 20, color: '#fff' },
  statL: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: 'rgba(255,255,255,0.8)' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 15, backgroundColor: '#fff', paddingHorizontal: 13, marginTop: 4 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18 },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5 },
  chipCount: { fontFamily: fonts.medium, fontSize: 12 },
  ask: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 20, backgroundColor: '#F6F7FD', borderWidth: 1, borderColor: '#E6E8F6' },
  askIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  askTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  askSub: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 1 },
  section: { marginTop: 22, marginBottom: 2 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.4, color: colors.ink },
  sectionSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  card: { padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ECEAF5', marginTop: 10, gap: 8, shadowColor: '#2F3AB0', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 24, borderRadius: 12 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11.5 },
  solved: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  solvedText: { fontFamily: fonts.medium, fontSize: 11.5, color: '#1F8A84' },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16.5, lineHeight: 22, color: colors.ink },
  cardText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  answer: { padding: 12, borderRadius: 16, backgroundColor: '#F6F7FD', borderLeftWidth: 3, borderLeftColor: colors.violet, gap: 6 },
  labRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  labAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  labLetter: { fontFamily: fonts.display, fontSize: 13, color: '#fff', marginTop: -2 },
  labName: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink },
  labRole: { fontFamily: fonts.medium, fontSize: 11, color: colors.violet, backgroundColor: '#E8EBFF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  answerText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19.5, color: colors.ink2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  offBtn: { alignSelf: 'flex-start', height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.tint, justifyContent: 'center' },
  offText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  empty: { marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: '#F4F0FF' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  composer: { marginTop: 14, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6F7', gap: 10 },
  compHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  input: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: '#FBFAFE' },
  area: { minHeight: 110, textAlignVertical: 'top' },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.bad },
});
