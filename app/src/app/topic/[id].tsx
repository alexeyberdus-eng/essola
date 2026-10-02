import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Glow } from '../../components/silk';
import { IconButton, Press, tap } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { forumGet, forumReply, Topic } from '../../lib/social';
import { colors, fonts, space } from '../../theme';
import { ago } from '../../data/community';

/** One forum topic: the question, replies and a reply box. */
export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
              <Text style={styles.cat}>{topic.cat}</Text>
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
