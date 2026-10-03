import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { Glow } from './silk';

const native = Platform.OS !== 'web';
const BODY = 150;

/** Launch animation, centred: a ring spins round a flask that fills with aurora liquid, bubbles rise, then the wordmark. */
export function Splash({ onDone }: { onDone: () => void }) {
  const appear = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const bubbles = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);
  const done = useRef(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  });

  useEffect(() => {
    const t = (v: Animated.Value, duration: number, easing = Easing.out(Easing.cubic)) => Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: native });
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: native })).start();
    Animated.loop(Animated.timing(bubbles, { toValue: 1, duration: 1300, easing: Easing.linear, useNativeDriver: native })).start();
    Animated.sequence([
      t(appear, 450),
      t(fill, 1100, Easing.inOut(Easing.cubic)),
      t(word, 500),
      Animated.delay(500),
      Animated.timing(out, { toValue: 0, duration: 420, useNativeDriver: native }),
    ]).start(() => done.current());
    // Safety net: never keep the app behind the intro, even if an animation stalls.
    const t2 = setTimeout(() => done.current(), 5000);
    return () => clearTimeout(t2);
    // Runs once on mount; parent re-renders must not restart the intro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rise = (delay: number, x: number, size: number) => ({
    left: x,
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: Animated.multiply(fill, bubbles.interpolate({ inputRange: [0, delay, Math.min(delay + 0.6, 1), 1], outputRange: [0, 0.9, 0, 0] })),
    transform: [{ translateY: bubbles.interpolate({ inputRange: [0, 1], outputRange: [BODY * 0.85, BODY * 0.35] }) }],
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, { opacity: out }]}>
      <Glow height={900} />
      <Animated.View style={[styles.stage, { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]}>
          <Svg width={250} height={250}>
            <Circle cx={125} cy={125} r={118} stroke={colors.violet} strokeOpacity={0.35} strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" fill="none" />
            <Circle cx={125} cy={7} r={6} fill={colors.violet} />
          </Svg>
        </Animated.View>

        <View style={styles.flask}>
          <View style={styles.neck} />
          <View style={styles.body}>
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: fill.interpolate({ inputRange: [0, 1], outputRange: [BODY, BODY * 0.38] }) }] }]}>
              <LinearGradient colors={['#C9B4FF', '#A6C8FF', '#FFB9A0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
            </Animated.View>
            {[
              [0.05, 46, 10],
              [0.3, 82, 7],
              [0.55, 64, 12],
              [0.75, 100, 6],
            ].map(([d, x, sz]) => (
              <Animated.View key={d} style={[styles.bubble, rise(d, x, sz)]} />
            ))}
            <View style={styles.shine} />
          </View>
        </View>
      </Animated.View>

      <Animated.View style={{ alignItems: 'center', opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <Text style={styles.brand}>
          essola <Text style={styles.brandLab}>lab</Text>
        </Text>
        <Text style={styles.tag}>домашняя лаборатория косметики</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  stage: { width: 250, height: 250, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ring: { position: 'absolute', width: 250, height: 250 },
  flask: { alignItems: 'center', marginTop: 18 },
  neck: { width: 38, height: 38, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.accent, backgroundColor: 'rgba(255,255,255,0.7)', marginBottom: -3, zIndex: 2 },
  body: { width: BODY, height: BODY, borderRadius: BODY / 2, borderWidth: 3, borderColor: colors.accent, backgroundColor: 'rgba(255,255,255,0.75)', overflow: 'hidden' },
  bubble: { position: 'absolute', top: 0, backgroundColor: 'rgba(255,255,255,0.9)' },
  shine: { position: 'absolute', left: 24, top: 22, width: 22, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.65)', transform: [{ rotate: '25deg' }] },
  brand: { fontFamily: fonts.bold, fontSize: 40, letterSpacing: -1.6, color: colors.ink },
  brandLab: { fontFamily: fonts.regular, color: colors.muted },
  tag: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink2, marginTop: 4 },
});
