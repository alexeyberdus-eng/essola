import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Burst } from '../../components/RecipeRow';
import { Avatar, FadeIn } from '../../components/silk';
import { IconButton, Press, tap } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { Thread, useCommunity } from '../../context/CommunityContext';
import { Comment, plural, timeAgo } from '../../data/community';
import { getRecipe } from '../../data/recipes';
import { colors, fonts, space } from '../../theme';

type ReplyTarget = { threadId: string; author: string } | null;

function CommentLike({ comment }: { comment: Comment }) {
  const { isLiked, toggleLike } = useCommunity();
  const liked = isLiked(comment.id);
  const pop = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const onPress = () => {
    tap(liked ? 'light' : 'medium');
    pop.setValue(0.5);
    Animated.spring(pop, { toValue: 1, friction: 3, tension: 200, useNativeDriver: Platform.OS !== 'web' }).start();
    if (!liked) {
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 480, useNativeDriver: Platform.OS !== 'web' }).start();
    }
    toggleLike(comment.id);
  };
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.likeBtn} accessibilityRole="button" accessibilityLabel={liked ? 'Убрать отметку' : 'Нравится'}>
      <Burst trigger={burst} size={14} />
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Icon name={liked ? 'heartFill' : 'heart'} size={14} color={liked ? colors.bad : colors.faint} />
      </Animated.View>
    </Pressable>
  );
}

function CommentRow({ c, onReply, small }: { c: Comment; onReply: () => void; small?: boolean }) {
  const { likes } = useCommunity();
  const n = likes(c);
  return (
    <View style={[styles.row, small && styles.rowSmall]}>
      <Avatar name={c.author} size={small ? 26 : 34} />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>
          <Text style={styles.name}>{c.author} </Text>
          {c.text}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{c.mine && c.ago < 1 ? 'сейчас' : timeAgo(c.ago)}</Text>
          {n > 0 && (
            <Text style={styles.metaText}>
              {n} {plural(n, 'отметка', 'отметки', 'отметок')}
            </Text>
          )}
          <Press haptic={false} onPress={onReply} hitSlop={8}>
            <Text style={styles.reply}>Ответить</Text>
          </Press>
        </View>
      </View>
      <CommentLike comment={c} />
    </View>
  );
}

function ThreadView({ t, onReply }: { t: Thread; onReply: (target: ReplyTarget) => void }) {
  // Replies are collapsed behind "Показать N ответов" — own fresh replies stay visible.
  const [open, setOpen] = useState(false);
  const hidden = t.replies.length;
  return (
    <View style={styles.thread}>
      <CommentRow c={t} onReply={() => onReply({ threadId: t.id, author: t.author })} />
      {hidden > 0 && (
        <View style={styles.replies}>
          {open && t.replies.map((r) => <CommentRow key={r.id} c={r} small onReply={() => onReply({ threadId: t.id, author: r.author })} />)}
          <Press haptic={false} onPress={() => setOpen((o) => !o)} style={styles.toggle}>
            <View style={styles.dash} />
            <Text style={styles.toggleText}>
              {open ? 'Скрыть ответы' : `Показать ${hidden} ${plural(hidden, 'ответ', 'ответа', 'ответов')}`}
            </Text>
          </Press>
        </View>
      )}
    </View>
  );
}

export default function CommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = getRecipe(id);
  const insets = useSafeAreaInsets();
  const { threads, count, add } = useCommunity();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [target, setTarget] = useState<ReplyTarget>(null);
  const input = useRef<TextInput>(null);
  const list = useRef<FlatList<Thread>>(null);

  if (!recipe) return null;
  const data = threads(recipe.id);
  const n = count(recipe.id);

  const reply = (t: ReplyTarget) => {
    setTarget(t);
    if (t) setText(`@${t.author} `);
    setTimeout(() => input.current?.focus(), 50);
  };

  const send = () => {
    if (!text.trim()) return;
    tap('success');
    add(recipe.id, text, target?.threadId ?? null);
    setText('');
    setTarget(null);
    if (!target) list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.navTitle}>Комментарии</Text>
          <Text style={styles.navSub}>
            {recipe.title} · {n}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={list}
        data={data}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: space.gutter, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <FadeIn index={index}>
            <ThreadView t={item} onReply={reply} />
          </FadeIn>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Будьте первым — поделитесь опытом с этим рецептом.</Text>}
      />

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {target && (
          <View style={styles.replying}>
            <Text style={styles.replyingText}>Ответ для {target.author}</Text>
            <Press
              haptic={false}
              onPress={() => {
                setTarget(null);
                setText('');
              }}
              hitSlop={10}
            >
              <Icon name="close" size={14} color={colors.muted} />
            </Press>
          </View>
        )}
        <View style={styles.inputRow}>
          <Avatar name={user?.name || user?.email || 'Вы'} size={32} />
          <TextInput
            ref={input}
            value={text}
            onChangeText={setText}
            placeholder={target ? `Ответьте ${target.author}…` : 'Добавьте комментарий…'}
            placeholderTextColor={colors.faint}
            style={styles.input}
            multiline
          />
          <Press haptic={false} onPress={send} disabled={!text.trim()}>
            <Text style={[styles.post, !text.trim() && { opacity: 0.4 }]}>Опубликовать</Text>
          </Press>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.line },
  navTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  navSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  thread: { marginBottom: 18 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rowSmall: { marginTop: 14 },
  name: { fontFamily: fonts.semibold, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 5, flexWrap: 'wrap' },
  metaText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  reply: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  likeBtn: { width: 24, alignItems: 'center', paddingTop: 4 },
  replies: { marginLeft: 46 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  dash: { width: 24, height: 1, backgroundColor: colors.faint },
  toggleText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', paddingVertical: 40 },
  composer: { borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, paddingHorizontal: space.gutter, paddingTop: 10 },
  replying: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surf, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  replyingText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minHeight: 40, maxHeight: 110, borderRadius: 20, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontFamily: fonts.regular, fontSize: 14.5, color: colors.ink },
  post: { fontFamily: fonts.semibold, fontSize: 14, color: colors.honeyText },
});
