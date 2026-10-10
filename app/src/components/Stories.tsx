import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { BUILTIN_STORIES, Story } from '../data/stories';
import { useIsAdmin } from '../lib/admin';
import { ServerStory, storiesList, storyAdd, storyImage, storyRemove } from '../lib/social';
import { readJSON, writeJSON } from '../lib/storage';
import { colors, fonts, space } from '../theme';
import { Icon } from './Icon';
import { Press, tap } from './ui';

const SEEN = 'essola.stories.seen';
const SLIDE_MS = 6000;

/** A posted story becomes one slide; its image is loaded when it is opened. */
const fromServer = (s: ServerStory): Story => ({ id: `s:${s.id}`, title: s.title, cover: null, server: s.id, slides: [{ title: s.title, text: s.text, image: null }] });

/** Round story bubbles on the home screen (seen ones turn grey) and a full-screen viewer. */
export function Stories() {
  const { user } = useAuth();
  const admin = useIsAdmin();
  const [server, setServer] = useState<Story[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    storiesList().then((l) => setServer(l.map(fromServer)));
  }, []);
  useEffect(() => {
    load();
    readJSON<string[]>(SEEN, []).then(setSeen);
  }, [load]);

  const all = [...server, ...BUILTIN_STORIES];
  // Unseen first, in their order; seen ones move to the end like in Instagram.
  const ordered = [...all.filter((s) => !seen.includes(s.id)), ...all.filter((s) => seen.includes(s.id))];

  const markSeen = (id: string) => {
    setSeen((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      writeJSON(SEEN, next);
      return next;
    });
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.gutter, marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 12 }}>
        {admin && (
          <Press onPress={() => setAdding(true)} style={styles.item} accessibilityLabel="Добавить историю">
            <View style={[styles.ring, { backgroundColor: '#ECEEF6' }]}>
              <View style={[styles.inner, { alignItems: 'center', justifyContent: 'center' }]}>
                <Icon name="plus" size={24} color={colors.violet} strokeWidth={2} />
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              Добавить
            </Text>
          </Press>
        )}
        {ordered.map((s) => {
          const was = seen.includes(s.id);
          return (
            <Press key={s.id} haptic={false} onPress={() => { tap(); setOpen(all.indexOf(s)); }} style={styles.item}>
              {was ? (
                <View style={[styles.ring, { backgroundColor: '#D9DBE4' }]}>
                  <Bubble s={s} />
                </View>
              ) : (
                <LinearGradient colors={['#5B4BD6', '#E0466E', '#FFB547']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.ring}>
                  <Bubble s={s} />
                </LinearGradient>
              )}
              <Text style={[styles.label, was && { color: colors.muted }]} numberOfLines={1}>
                {s.title}
              </Text>
            </Press>
          );
        })}
      </ScrollView>
      {open !== null && (
        <Viewer
          stories={all}
          start={open}
          onSeen={markSeen}
          onClose={() => setOpen(null)}
          onRemove={
            admin && user?.email
              ? async (s) => {
                  if (!s.server) return;
                  await storyRemove(user.email!, s.server).catch(() => {});
                  setOpen(null);
                  load();
                }
              : undefined
          }
        />
      )}
      {adding && (
        <AddStory
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </View>
  );
}

function Bubble({ s }: { s: Story }) {
  return (
    <View style={styles.inner}>
      {s.cover ? (
        <Image source={s.cover} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, color: '#fff', marginTop: -3 }}>e</Text>
        </View>
      )}
    </View>
  );
}

function Viewer({ stories, start, onClose, onSeen, onRemove }: { stories: Story[]; start: number; onClose: () => void; onSeen: (id: string) => void; onRemove?: (s: Story) => void }) {
  const insets = useSafeAreaInsets();
  const [si, setSi] = useState(start);
  const [k, setK] = useState(0);
  const [img, setImg] = useState<Record<string, string | null>>({});
  const progress = useRef(new Animated.Value(0)).current;
  const story = stories[si];
  const slide = story?.slides[k];

  useEffect(() => {
    if (story) onSeen(story.id);
    if (story?.server && img[story.server] === undefined) storyImage(story.server).then((d) => setImg((m) => ({ ...m, [story.server!]: d })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [si]);

  const next = useCallback(() => {
    if (!story) return;
    if (k + 1 < story.slides.length) setK(k + 1);
    else if (si + 1 < stories.length) {
      setSi(si + 1);
      setK(0);
    } else onClose();
  }, [k, si, story, stories.length, onClose]);
  const prev = () => {
    if (k > 0) setK(k - 1);
    else if (si > 0) {
      setSi(si - 1);
      setK(0);
    }
  };

  // The slide timer runs from where it stopped: holding a finger on the story pauses it, like in Instagram.
  const [held, setHeld] = useState(false);
  const run = useCallback(
    (from: number) => {
      const a = Animated.timing(progress, { toValue: 1, duration: Math.max(1, SLIDE_MS * (1 - from)), easing: Easing.linear, useNativeDriver: false });
      a.start(({ finished }) => finished && next());
    },
    [progress, next],
  );
  useEffect(() => {
    progress.setValue(0);
    run(0);
    return () => progress.stopAnimation();
  }, [si, k, progress, run]);
  const hold = () => {
    setHeld(true);
    progress.stopAnimation();
  };
  const release = () => {
    setHeld(false);
    progress.stopAnimation((v) => run(v));
  };

  if (!story || !slide) return null;
  const picture = story.server ? img[story.server] : slide.image;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <LinearGradient colors={['#5B47C9', '#8A74F2', '#C9A2F5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <View style={[styles.bars, held && { opacity: 0 }]}>
          {story.slides.map((_, i) => (
            <View key={i} style={styles.bar}>
              <Animated.View style={[styles.barFill, { width: i < k ? '100%' : i > k ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
            </View>
          ))}
        </View>
        <View style={styles.head}>
          <View style={styles.headAv}>
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: '#fff', marginTop: -2 }}>e</Text>
          </View>
          <Text style={styles.headName}>@essola</Text>
          <View style={{ flex: 1 }} />
          {onRemove && story.server && (
            <Press onPress={() => Alert.alert('Удалить историю?', '', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: () => onRemove(story) }])} style={styles.close}>
              <Icon name="trash" size={18} color="#fff" />
            </Press>
          )}
          <Press onPress={onClose} style={styles.close} accessibilityLabel="Закрыть">
            <Icon name="close" size={20} color="#fff" />
          </Press>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{slide.title}</Text>
          {!!slide.text && <Text style={styles.text}>{slide.text}</Text>}
          <View style={styles.shot}>
            {picture ? (
              <Image source={typeof picture === 'string' ? { uri: picture } : picture} style={StyleSheet.absoluteFill} contentFit={story.server ? 'cover' : 'contain'} contentPosition="top" />
            ) : (
              <ActivityIndicator color="#fff" style={{ marginTop: 60 }} />
            )}
          </View>
        </View>

        {!!story.cta && k === story.slides.length - 1 && (
          <Press
            onPress={() => {
              onClose();
              router.push(story.cta!.href as never);
            }}
            style={[styles.cta, { marginBottom: insets.bottom + 18 }]}
          >
            <Text style={styles.ctaText}>{story.cta.label}</Text>
            <Icon name="arrowRight" size={16} color={colors.ink} />
          </Press>
        )}
        {/* Tap zones: left third goes back, the rest goes forward; press and hold anywhere pauses. */}
        <View style={[StyleSheet.absoluteFill, { top: insets.top + 70, bottom: story.cta ? 110 : 0, flexDirection: 'row' }]} pointerEvents="box-none">
          <Pressable style={{ flex: 1 }} onPress={prev} onPressIn={hold} onPressOut={release} onLongPress={() => {}} delayLongPress={220} />
          <Pressable style={{ flex: 2 }} onPress={next} onPressIn={hold} onPressOut={release} onLongPress={() => {}} delayLongPress={220} />
        </View>
      </LinearGradient>
    </Modal>
  );
}

/** Admin: post a story — a picture plus a title and a line of text. */
function AddStory({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [uri, setUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled && r.assets[0]) setUri(r.assets[0].uri);
  };
  const send = async () => {
    if (!uri || !title.trim() || !user?.email) return;
    setBusy(true);
    try {
      const ctx = ImageManipulator.manipulate(uri);
      ctx.resize({ width: 900 });
      const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      await storyAdd(user.email, title.trim(), text.trim(), saved.base64!);
      onDone();
    } catch {
      Alert.alert('Не получилось опубликовать', 'Проверьте интернет или выберите картинку поменьше.');
      setBusy(false);
    }
  };
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingTop: 20, paddingBottom: insets.bottom + 30, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.addTitle}>Новая история</Text>
          <Press onPress={onClose} accessibilityLabel="Закрыть">
            <Icon name="close" size={22} />
          </Press>
        </View>
        <Press onPress={pick} style={styles.pick}>
          {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="image" size={30} color={colors.violet} />}
          {!uri && <Text style={styles.pickText}>Выбрать картинку</Text>}
        </Press>
        <TextInput value={title} onChangeText={setTitle} placeholder="Заголовок (под кружком)" placeholderTextColor={colors.faint} style={styles.input} maxLength={40} />
        <TextInput value={text} onChangeText={setText} placeholder="Текст истории" placeholderTextColor={colors.faint} style={[styles.input, { minHeight: 90 }]} multiline maxLength={300} />
        <Press onPress={send} disabled={busy || !uri || !title.trim()} style={[styles.publish, (!uri || !title.trim()) && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishText}>Опубликовать для всех</Text>}
        </Press>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  item: { width: 72, alignItems: 'center', gap: 6 },
  ring: { width: 70, height: 70, borderRadius: 35, padding: 3, alignItems: 'center', justifyContent: 'center' },
  inner: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 2.5, borderColor: '#fff' },
  label: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.ink },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 12 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginTop: 12 },
  headAv: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headName: { fontFamily: fonts.semibold, fontSize: 14, color: '#fff' },
  close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 33, letterSpacing: -0.8, color: '#fff' },
  text: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: 'rgba(255,255,255,0.86)', marginTop: 10 },
  shot: { flex: 1, marginTop: 20, marginBottom: 20, borderRadius: 26, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  cta: { marginHorizontal: 22, height: 52, borderRadius: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink },
  addTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  pick: { height: 260, borderRadius: 20, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 8 },
  pickText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.violet },
  input: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: '#FBFAFE', textAlignVertical: 'top' },
  publish: { height: 50, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  publishText: { fontFamily: fonts.semibold, fontSize: 15, color: '#fff' },
});
