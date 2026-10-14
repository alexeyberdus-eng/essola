import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../components/Icon';
import { Glow } from '../components/silk';
import { IconButton, Press } from '../components/ui';
import { ago } from '../data/community';
import { useNotices } from '../lib/notices';
import { Notice } from '../lib/social';
import { colors, fonts, space } from '../theme';

const KIND: Record<Notice['type'], { icon: IconName; verb: string }> = {
  reply: { icon: 'comment', verb: 'ответил(а) вам' },
  topic: { icon: 'comment', verb: 'ответил(а) в вашей теме' },
  mention: { icon: 'user', verb: 'упомянул(а) вас' },
  like: { icon: 'heart', verb: 'оценил(а) ваш пост' },
};

/** Replies, mentions and likes in the forum. */
export default function Notifications() {
  const insets = useSafeAreaInsets();
  const { items, markSeen } = useNotices();
  useEffect(() => {
    markSeen();
  }, [markSeen, items.length]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}
        ListHeaderComponent={
          <View style={styles.top}>
            <IconButton icon="arrowLeft" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
            <Text style={styles.h1}>Уведомления</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="bell" size={28} color={colors.violet} />
            <Text style={styles.emptyText}>Здесь появятся ответы на ваши сообщения и темы, упоминания вашего ника и лайки в форуме.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const k = KIND[item.type] ?? KIND.reply;
          return (
            <Press haptic={false} onPress={() => router.push(`/topic/${item.tid}` as never)} style={styles.row}>
              <View style={styles.icon}>
                <Icon name={k.icon} size={17} color={colors.violet} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.line}>
                  <Text style={styles.from}>@{item.from}</Text> {k.verb}
                </Text>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                {!!item.text && (
                  <Text style={styles.text} numberOfLines={2}>
                    {item.text}
                  </Text>
                )}
              </View>
              <Text style={styles.time}>{ago(item.at)}</Text>
            </Press>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, marginBottom: 8 },
  h1: { fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.8, color: colors.ink },
  row: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EFEDF6', marginTop: 8 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  line: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink2 },
  from: { fontFamily: fonts.semibold, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  time: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.faint },
  empty: { marginTop: 30, alignItems: 'center', gap: 12, padding: 20, borderRadius: 22, backgroundColor: '#F6F7FD' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2, textAlign: 'center' },
});
