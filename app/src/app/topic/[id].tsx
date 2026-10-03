import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Glow } from '../../components/silk';
import { IconButton, Press, tap } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { ago } from '../../data/community';
import { CAT_STYLE } from '../../data/forum-cats';
import { useIsAdmin } from '../../lib/admin';
import { ForumAuthor, forumGet, forumLike, ForumPost, forumReply, myId, Topic } from '../../lib/social';
import { colors, fonts, space } from '../../theme';

/** Paragraphs and "•" bullet lines of a post. */
function Rich({ text }: { text: string }) {
  return (
    <View style={{ gap: 8 }}>
      {text.split('\n\n').map((para, i) => {
        const lines = para.split('\n');
        if (lines.length > 1 && lines.every((l) => l.startsWith('•'))) {
          return (
            <View key={i} style={{ gap: 6 }}>
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

function Avatar({ a, size = 30 }: { a: ForumAuthor; size?: number }) {
  if (a.id === 'essola')
    return (
      <View style={[styles.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink }]}>
        <Text style={{ fontFamily: fonts.display, fontSize: size * 0.5, color: '#fff', marginTop: -2 }}>e</Text>
      </View>
    );
  const hues = ['#3F4BC9', '#B5527A', '#1F8A84', '#9A6A12', '#4D7A2A', '#7A4BC9'];
  const c = hues[[...a.nick].reduce((s, ch) => s + ch.charCodeAt(0), 0) % hues.length];
  return (
    <View style={[styles.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: c }]}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.42, color: '#fff' }}>{(a.nick[0] || '?').toUpperCase()}</Text>
    </View>
  );
}

function Name({ a }: { a: ForumAuthor }) {
  return (
    <Press haptic={false} onPress={() => a.id !== 'essola' && router.push(`/user/${a.id}` as never)} style={styles.nameRow}>
      <Text style={styles.nick}>@{a.nick}</Text>
      {a.id === 'essola' && (
        <View style={styles.official}>
          <Icon name="check" size={10} color="#fff" strokeWidth={3} />
        </View>
      )}
    </Press>
  );
}

type Node = { p: ForumPost; depth: number };
/** Posts as a tree: replies under the post they answer, nesting capped so text stays readable. */
function thread(posts: ForumPost[]): Node[] {
  const kids = new Map<string | null, ForumPost[]>();
  const ids = new Set(posts.map((p) => p.id));
  for (const p of posts) {
    const parent = p.parent && ids.has(p.parent) ? p.parent : null;
    kids.set(parent, [...(kids.get(parent) ?? []), p]);
  }
  const out: Node[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const p of kids.get(parent) ?? []) {
      out.push({ p, depth: Math.min(depth, 3) });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** A forum topic: the question, threaded replies with likes, and a reply box. */
export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const admin = useIsAdmin();
  const [me, setMe] = useState('');
  const [topic, setTopic] = useState<Topic | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState<ForumPost | null>(null);
  const [official, setOfficial] = useState(false);

  useEffect(() => {
    myId().then(setMe);
    forumGet(id).then(setTopic).catch(() => setTopic(null));
  }, [id]);

  const nodes = useMemo(() => (topic ? thread(topic.posts) : []), [topic]);
  const nick = user?.nick || user?.name || 'гость';

  const send = async () => {
    if (!user) return router.push('/auth');
    if (!text.trim() || busy) return;
    tap('medium');
    setBusy(true);
    try {
      setTopic(await forumReply(id, nick, text.trim(), to?.id ?? null, official && admin && user.email ? { email: user.email } : null));
      setText('');
      setTo(null);
    } catch {}
    setBusy(false);
  };

  const like = (pid: string | null, on: boolean) => {
    if (!user) return router.push('/auth');
    tap('light');
    setTopic((t) => {
      if (!t) return t;
      const flip = (l?: string[]) => (on ? [...(l ?? []).filter((x) => x !== me), me] : (l ?? []).filter((x) => x !== me));
      return pid ? { ...t, posts: t.posts.map((p) => (p.id === pid ? { ...p, likes: flip(p.likes) } : p)) } : { ...t, likes: flip(t.likes) };
    });
    forumLike(id, pid, on, nick).then(setTopic).catch(() => {});
  };

  const st = topic ? CAT_STYLE[topic.cat] ?? CAT_STYLE['Общее'] : null;
  const topicLiked = !!topic?.likes?.includes(me);

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
              {st && (
                <View style={[styles.badge, { backgroundColor: st.bg }]}>
                  <Icon name={st.icon} size={12} color={st.fg} />
                  <Text style={[styles.badgeText, { color: st.fg }]}>{topic.cat}</Text>
                </View>
              )}
              <Text style={styles.title}>{topic.title}</Text>
              <View style={styles.meta}>
                <View style={styles.who}>
                  <Avatar a={topic.author} size={26} />
                  <Name a={topic.author} />
                </View>
                <Text style={styles.time}>{ago(topic.at)}</Text>
              </View>
              {!!topic.text && <Rich text={topic.text} />}
              <View style={styles.actions}>
                <Press haptic={false} onPress={() => like(null, !topicLiked)} style={styles.act}>
                  <Icon name={topicLiked ? 'heartFill' : 'heart'} size={16} color={topicLiked ? '#E0466E' : colors.muted} />
                  <Text style={styles.actText}>{topic.likes?.length || ''}</Text>
                </Press>
                <Press haptic={false} onPress={() => setTo(null)} style={styles.act}>
                  <Icon name="comment" size={16} color={colors.muted} />
                  <Text style={styles.actText}>{topic.posts.length || ''}</Text>
                </Press>
              </View>
            </View>

            <Text style={styles.h2}>{topic.posts.length ? 'Обсуждение' : 'Ответов пока нет — будьте первой'}</Text>
            {nodes.map(({ p, depth }) => {
              const liked = !!p.likes?.includes(me);
              return (
                <View key={p.id} style={[styles.post, { marginLeft: depth * 16 }, depth > 0 && styles.child, p.author.id === 'essola' && styles.postOfficial]}>
                  <View style={styles.meta}>
                    <View style={styles.who}>
                      <Avatar a={p.author} size={24} />
                      <Name a={p.author} />
                    </View>
                    <Text style={styles.time}>{ago(p.at)}</Text>
                  </View>
                  <Rich text={p.text} />
                  <View style={styles.actions}>
                    <Press haptic={false} onPress={() => like(p.id, !liked)} style={styles.act}>
                      <Icon name={liked ? 'heartFill' : 'heart'} size={15} color={liked ? '#E0466E' : colors.muted} />
                      <Text style={styles.actText}>{p.likes?.length || ''}</Text>
                    </Press>
                    <Press
                      haptic={false}
                      onPress={() => {
                        tap();
                        setTo(p);
                        if (!text.startsWith(`@${p.author.nick}`)) setText(`@${p.author.nick} ${text}`);
                      }}
                      style={styles.act}
                    >
                      <Text style={styles.replyText}>Ответить</Text>
                    </Press>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
      {!!topic && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
          {(to || admin) && (
            <View style={styles.barTop}>
              {to ? (
                <Press haptic={false} onPress={() => setTo(null)} style={styles.toChip}>
                  <Text style={styles.toText}>Ответ @{to.author.nick}</Text>
                  <Icon name="close" size={12} color={colors.violet} />
                </Press>
              ) : (
                <View />
              )}
              {admin && (
                <Press haptic={false} onPress={() => setOfficial(!official)} style={[styles.toChip, official && { backgroundColor: colors.ink }]}>
                  <Text style={[styles.toText, official && { color: '#fff' }]}>от @essola</Text>
                </Press>
              )}
            </View>
          )}
          <View style={styles.barRow}>
            <TextInput value={text} onChangeText={setText} placeholder={user ? 'Ваш ответ…' : 'Войдите, чтобы ответить'} placeholderTextColor={colors.faint} style={styles.input} multiline maxLength={3000} editable={!!user} />
            <Press onPress={send} disabled={busy} style={styles.send} accessibilityLabel="Отправить">
              {busy ? <ActivityIndicator color="#fff" /> : <Icon name={user ? 'send' : 'user'} size={18} color="#fff" />}
            </Press>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#EAE6F7', gap: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 24, borderRadius: 12, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11.5 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, color: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  av: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nick: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  official: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.violet, marginTop: 9 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 2 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28 },
  actText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  replyText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  h2: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, marginTop: 22, marginBottom: 6 },
  post: { padding: 14, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EFEDF6', marginTop: 8, gap: 8 },
  child: { borderLeftWidth: 3, borderLeftColor: '#E3E6F7' },
  postOfficial: { backgroundColor: '#F6F7FD', borderColor: '#E3E6F7' },
  bar: { paddingHorizontal: space.gutter, paddingTop: 10, backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderColor: colors.line, gap: 8 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between' },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  toChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.tint },
  toText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.violet },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 11, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: '#FBFAFE' },
  send: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
