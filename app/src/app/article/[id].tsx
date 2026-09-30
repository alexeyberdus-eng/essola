import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '../../components/lab';
import { FadeIn, Glow } from '../../components/silk';
import { IconButton } from '../../components/ui';
import { ARTICLES } from '../../data/articles';
import { colors, fonts, space } from '../../theme';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const a = ARTICLES.find((x) => x.id === id);
  const y = useRef(new Animated.Value(0)).current;
  if (!a) return null;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/wiki'));
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow flask={false} />
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 40 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <FadeIn>
          <Text style={styles.kicker}>
            {a.cat} · {a.minutes} мин чтения
          </Text>
          <Text style={styles.title}>{a.title}</Text>
          <Text style={styles.lead}>{a.lead}</Text>
        </FadeIn>
        {a.sections.map((s, i) => (
          <FadeIn key={s.h} index={i + 1} style={styles.section}>
            <View style={styles.sHead}>
              <Text style={styles.num}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={styles.h}>{s.h}</Text>
            </View>
            <Text style={styles.p}>{s.p}</Text>
          </FadeIn>
        ))}
        <Text style={styles.foot}>Материал информационный и не заменяет консультацию дерматолога.</Text>
      </Animated.ScrollView>
      <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: y.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
          <Glass style={StyleSheet.absoluteFill} tint="rgba(242,238,230,0.6)" />
        </Animated.View>
        <IconButton icon="arrowLeft" label="Назад" onPress={back} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.gutter, paddingBottom: 10 },
  kicker: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.brassText },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -1.2, color: colors.ink, marginTop: 8 },
  lead: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink2, marginTop: 12 },
  section: { marginTop: 26 },
  sHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  num: { fontFamily: fonts.monoMedium, fontSize: 12, color: colors.brass },
  h: { flex: 1, fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.5, color: colors.ink },
  p: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.ink2, marginTop: 8 },
  foot: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.faint, marginTop: 32 },
});
