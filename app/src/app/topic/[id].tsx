import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Glow } from '../../components/silk';
import { IconButton, Press, tap } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { comment, forumGet, forumReply, like, social, Social, Topic } from '../../lib/social';
import { CAT_STYLE, FAQ, FAQ_BY_ID, Faq } from '../../data/forum-faq';
import { colors, fonts, space } from '../../theme';
import { ago } from '../../data/community';

/** One forum topic: the question, replies and a reply box. */
export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const faq = FAQ_BY_ID.get(id);
  return faq ? <FaqScreen f={faq} /> : <LiveTopic id={id} />;
}

/** Splits an answer into paragraphs and bullet lines. */
function Rich({ text }: { text: string }) {
  return (
    <View style={{ gap: 10 }}>
      {text.split('\n\n').map((para, i) => {
        const lines = para.split('\n');
        if (lines.every((l) => l.startsWith('•'))) {
          return (
            <View key={i} style={{ gap: 7 }}>
              {lines.map((l, j) => (
                <View key={j} style={styles.bullet}>
                  <View style={styles.dot} />
                  <Text style={[styles.text, { flex: 1 }]}>{l.replace(/^•\s*/, '')}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} style={styles.text}>
            {para}
          </Text>
        );
      })}
    </View>
  );
}

function CatBadge({ cat }: { cat: string }) {
  const st = CAT_STYLE[cat] ?? CAT_STYLE['Общее'];
  return (
    <View style={[styles.badge, { backgroundColor: st.bg }]}>
      <Icon name={st.icon} size={12} color={st.fg} />
      <Text style={[styles.badgeText, { color: st.fg }]}>{cat}</Text>
    </View>
  );
}

/** A pinned question with the technologist's answer; readers' replies are stored as comments. */
function FaqScreen({ f }: { f: Faq }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const key = `faq:${f.id}`;
  const [data, setData] = useState<Social | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    social(key).then(setData).catch(() => {});
  }, [key]);
  const related = FAQ.filter((x) => x.cat === f.cat && x.id !== f.id).slice(0, 3);
  const send = async () => {
    if (!user) return router.push('/auth');
    if (!text.trim() || busy) return;
    tap('medium');
    setBusy(true);
    try {
      setData(await comment(key, user.nick || user.name || 'гость', text.trim()));
      setText('');
    } catch {}
    setBusy(false);
  };
  const useful = async () => {
    tap();
    const on = !data?.liked;
    setData((d) => (d ? { ...d, liked: on, likes: d.likes + (on ? 1 : -1) } : d));
    like(key, on).then(setData).catch(() => {});
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Glow />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 30 }}>
        <View style={{ height: 52, justifyContent: 'center' }}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/forum' as never))} />
        </View>
        <View style={styles.card}>
          <CatBadge cat={f.cat} />
          <Text style={styles.title}>{f.title}</Text>
          <Text style={styles.text}>{f.q}</Text>
          <View style={styles.tagRow}>
            {f.tags.map((t) => (
              <Text key={t} style={styles.tag}>
                #{t}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.answer}>
          <View style={styles.labRow}>
            <View style={styles.labAvatar}>
              <Text style={styles.labLetter}>e</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.labName}>essola lab</Text>
              <Text style={styles.labRole}>технолог · ответ закреплён</Text>
            </View>
            <Icon name="check" size={18} color="#1F8A84" />
          </View>
          <Rich text={f.a} />
          <Press onPress={useful} style={[styles.useful, data?.liked && styles.usefulOn]}>
            <Icon name={data?.liked ? 'heartFill' : 'heart'} size={16} color={data?.liked ? '#fff' : colors.violet} />
            <Text style={[styles.usefulText, data?.liked && { color: '#fff' }]}>Полезно{data?.likes ? ` · ${data.likes}` : ''}</Text>
          </Press>
        </View>

        <Text style={styles.h2}>{data?.comments.length ? `Обсуждение · ${data.comments.length}` : 'Обсуждение'}</Text>
        {!data?.comments.length && <Text style={styles.hint}>Поделитесь опытом или задайте уточняющий вопрос — ответ увидят все.</Text>}
        {data?.comments.map((c) => (
          <View key={c.id} style={styles.post}>
            <View style={styles.meta}>
              <Press haptic={false} onPress={() => router.push(`/user/${c.user}` as never)}>
                <Text style={styles.nick}>@{c.nick}</Text>
              </Press>
              <Text style={styles.time}>{ago(c.at)}</Text>
            </View>
            <Text style={styles.text}>{c.text}</Text>
          </View>
        ))}

        {!!related.length && (
          <>
            <Text style={styles.h2}>Похожие вопросы</Text>
            {related.map((r) => (
              <Press key={r.id} haptic={false} onPress={() => router.push(`/topic/${r.id}` as never)} style={styles.related}>
                <Text style={styles.relatedText}>{r.title}</Text>
                <Icon name="arrowRight" size={16} color={colors.muted} />
              </Press>
            ))}
          </>
        )}
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput value={text} onChangeText={setText} placeholder={user ? 'Ваш комментарий…' : 'Войдите, чтобы ответить'} placeholderTextColor={colors.faint} style={styles.input} multiline maxLength={500} editable={!!user} />
        <Press onPress={send} disabled={busy} style={styles.send} accessibilityLabel="Отправить">
          {busy ? <ActivityIndicator color="#fff" /> : <Icon name={user ? 'send' : 'user'} size={18} color="#fff" />}
        </Press>
      </View>
    </KeyboardAvoidingView>
  );
}

function LiveTopic({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [topic, setTopic] = useState<Topic | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    forumGet(id).then(setTopic).catch(() => setTopic(null));
  }, [id]);

  const send = async () => {
    if (!user) return router.push('/auth');
    if (!text.trim() || busy) return;
    tap('medium');
    setBusy(true);
    try {
      setTopic(await forumReply(id, user.nick || user.name || 'гость', text.trim()));
      setText('');
    } catch {}
    setBusy(false);
  };

  const author = (a: { id: string; nick: string }) => (
    <Press haptic={false} onPress={() => router.push(`/user/${a.id}` as never)}>
      <Text style={styles.nick}>@{a.nick}</Text>
    </Press>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Glow />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 30 }}>
        <View style={{ height: 52, justifyContent: 'center' }}>
          <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/forum' as never))} />
        </View>
        {topic === undefined ? (
          <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} />
        ) : !topic ? (
          <Text style={styles.text}>Тема не найдена.</Text>
        ) : (
          <>
            <View style={styles.card}>
              <CatBadge cat={topic.cat} />
              <Text style={styles.title}>{topic.title}</Text>
              <View style={styles.meta}>
                {author(topic.author)}
                <Text style={styles.time}>{ago(topic.at)}</Text>
              </View>
              {!!topic.text && <Text style={styles.text}>{topic.text}</Text>}
            </View>
            <Text style={styles.h2}>{topic.posts.length ? `Ответы · ${topic.posts.length}` : 'Ответов пока нет — будьте первой'}</Text>
            {topic.posts.map((p) => (
              <View key={p.id} style={styles.post}>
                <View style={styles.meta}>
                  {author(p.author)}
                  <Text style={styles.time}>{ago(p.at)}</Text>
                </View>
                <Text style={styles.text}>{p.text}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      {!!topic && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput value={text} onChangeText={setText} placeholder={user ? 'Ваш ответ…' : 'Войдите, чтобы ответить'} placeholderTextColor={colors.faint} style={styles.input} multiline maxLength={3000} editable={!!user} />
          <Press onPress={send} disabled={busy} style={styles.send} accessibilityLabel="Отправить">
            {busy ? <ActivityIndicator color="#fff" /> : <Icon name={user ? 'send' : 'user'} size={18} color="#fff" />}
          </Press>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#EAE6F7', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 24, borderRadius: 12, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11.5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  answer: { marginTop: 14, padding: 18, borderRadius: 22, backgroundColor: '#F6F7FD', borderWidth: 1, borderColor: '#E3E6F7', gap: 14 },
  labRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  labAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  labLetter: { fontFamily: fonts.display, fontSize: 20, color: '#fff', marginTop: -3 },
  labName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  labRole: { fontFamily: fonts.medium, fontSize: 12, color: colors.violet },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.violet, marginTop: 9 },
  useful: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DCE0F7' },
  usefulOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  usefulText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.violet },
  hint: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  related: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EFEDF6', marginTop: 8 },
  relatedText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  cat: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.violet, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, color: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nick: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  h2: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, marginTop: 22, marginBottom: 6 },
  post: { padding: 14, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EFEDF6', marginTop: 8, gap: 6 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: space.gutter, paddingTop: 10, backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderColor: colors.line },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 11, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: '#FBFAFE' },
  send: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
