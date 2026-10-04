import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

/** Soft pastel tones for banners and buttons: lavender, blush, mist. */
export const SOFT = {
  base: ['#F6F1FF', '#FCEFF6', '#EEF6FF'] as const,
  blobs: ['#D9CCFF', '#FFD3E6', '#CFE6FF'] as const,
  button: ['#9C8BF5', '#C79BEA', '#E8A9CF'] as const,
};

/** A pastel banner whose colour clouds drift slowly — calm, light, never loud. */
export function SoftHero({ kicker, title, text, style }: { kicker: string; title: string; text?: string; style?: ViewStyle }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  // Each cloud swings on its own path; sin/cos-like out-and-back keeps the loop seamless.
  const swing = (dx: number, dy: number, s = 0.12) => ({
    transform: [
      { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dx, 0] }) },
      { translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dy, 0] }) },
      { scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1 + s, 1] }) },
    ],
  });
  return (
    <View style={[styles.hero, style]}>
      <LinearGradient colors={SOFT.base} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.blob, { left: -40, top: -50, width: 190, height: 190 }, swing(60, 30)]}>
        <LinearGradient colors={[SOFT.blobs[0], 'rgba(217,204,255,0)']} style={styles.fill} />
      </Animated.View>
      <Animated.View style={[styles.blob, { right: -50, top: -30, width: 210, height: 210 }, swing(-50, 40, 0.18)]}>
        <LinearGradient colors={[SOFT.blobs[1], 'rgba(255,211,230,0)']} style={styles.fill} />
      </Animated.View>
      <Animated.View style={[styles.blob, { left: 60, bottom: -90, width: 220, height: 220 }, swing(40, -30)]}>
        <LinearGradient colors={[SOFT.blobs[2], 'rgba(207,230,255,0)']} style={styles.fill} />
      </Animated.View>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
      {!!text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 16, borderRadius: 28, padding: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  blob: { position: 'absolute', borderRadius: 999, overflow: 'hidden', opacity: 0.9 },
  fill: { flex: 1, borderRadius: 999 },
  kicker: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#8A79D8' },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.8, color: colors.ink, marginTop: 8, maxWidth: 290 },
  text: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: '#57506F', marginTop: 6, maxWidth: 300 },
});
