import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ago } from '../data/community';
import { comment, rate, social, Social, socialEnabled } from '../lib/social';
import { ensureRules, moderate, postError, useBlocked } from '../lib/moderation';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';
import { Press, tap } from './ui';

function Stars({ value, size = 18, onPick }: { value: number; size?: number; onPick?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: onPick ? 6 : 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= Math.round(value);
        const star = <Text style={{ fontSize: size, lineHeight: size + 4, color: on ? '#F5A623' : '#D9DBE6' }}>★</Text>;
        return onPick ? (
          <Press key={n} haptic={false} onPress={() => onPick(n)} hitSlop={4} accessibilityLabel={`${n} из 5`}>
            {star}
          </Press>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

/** Users' star ratings and short reviews of one product, shared through our community storage. */
export function ProductReviews({ id }: { id: string }) {
  const { user } = useAuth();
  const key = `product:${id}`;
  const [data, setData] = useState<Social | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { isBlocked } = useBlocked();
  useEffect(() => {
    if (socialEnabled) social(key).then(setData).catch(() => {});
  }, [key]);
  if (!socialEnabled) return null;
  const r = data?.rating;

  const pick = async (n: number) => {
    if (!user) return router.push('/auth');
    tap('light');
    setData((d) => (d ? { ...d, rating: { avg: r?.count ? r.avg : n, count: r?.count || 1, mine: n } } : d));
    rate(key, n).then(setData).catch(() => {});
  };
  const send = async () => {
    if (!user) return router.push('/auth');
    if (!text.trim() || busy) return;
    if (!(await ensureRules())) return;
    tap('medium');
    setBusy(true);
    try {
      setData(await comment(key, user.nick || user.name || 'гость', text.trim()));
      setText('');
    } catch (e) {
      postError(e);
    }
    setBusy(false);
  };

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Отзывы</Text>
          <Text style={styles.sub}>{r?.count ? `${r.count} ${r.count === 1 ? 'оценка' : r.count < 5 ? 'оценки' : 'оценок'}` : 'Оценок пока нет — будьте первой'}</Text>
        </View>
        {!!r?.count && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.avg}>{r.avg.toFixed(1)}</Text>
            <Stars value={r.avg} size={13} />
          </View>
        )}
      </View>
      <View style={styles.mine}>
        <Text style={styles.mineText}>{r?.mine ? 'Ваша оценка' : 'Пользовались? Оцените'}</Text>
        <Stars value={r?.mine ?? 0} size={26} onPick={pick} />
      </View>
      {data?.comments
        .filter((c) => !isBlocked(c.user))
        .slice()
        .reverse()
        .slice(0, 20)
        .map((c) => (
          <View key={c.id} style={styles.comment}>
            <View style={styles.meta}>
              <Text style={styles.nick}>@{c.nick}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.time}>{ago(c.at)}</Text>
                <Press haptic={false} onPress={() => moderate({ kind: 'review', target: `${key}/${c.id}`, author: { id: c.user, nick: c.nick }, text: c.text })} accessibilityLabel="Ещё">
                  <Icon name="more" size={16} color={colors.muted} />
                </Press>
              </View>
            </View>
            <Text style={styles.text}>{c.text}</Text>
          </View>
        ))}
      <View style={styles.bar}>
        <TextInput value={text} onChangeText={setText} placeholder={user ? 'Как средство подошло вам?' : 'Войдите, чтобы оставить отзыв'} placeholderTextColor={colors.faint} style={styles.input} multiline maxLength={500} editable={!!user} />
        <Press onPress={send} disabled={busy} style={styles.send} accessibilityLabel="Отправить отзыв">
          {busy ? <ActivityIndicator color="#fff" /> : <Icon name={user ? 'send' : 'user'} size={17} color="#fff" />}
        </Press>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 22, padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ECEAF5', gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  avg: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.ink },
  mine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 16, backgroundColor: '#F6F7FD' },
  mineText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  comment: { gap: 4, paddingTop: 10, borderTopWidth: 1, borderColor: colors.line },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  nick: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 11, fontFamily: fonts.regular, fontSize: 14.5, color: colors.ink, backgroundColor: '#FBFAFE' },
  send: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
