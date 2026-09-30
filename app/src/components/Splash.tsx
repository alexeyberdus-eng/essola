import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';
import { Brand, Glow } from './silk';

const native = Platform.OS !== 'web';

/** Launch animation: "essola lab" appears, a pipette slides in and releases a drop. */
export function Splash({ onDone }: { onDone: () => void }) {
  const brand = useRef(new Animated.Value(0)).current;
  const pipette = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);
  const done = useRef(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  });

  useEffect(() => {
    const t = (v: Animated.Value, duration: number, easing = Easing.out(Easing.cubic)) => Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: native });
    Animated.sequence([
      t(brand, 650),
      t(pipette, 500),
      Animated.delay(120),
      t(drop, 520, Easing.in(Easing.quad)),
      t(ripple, 600),
      Animated.delay(150),
      Animated.timing(out, { toValue: 0, duration: 380, useNativeDriver: native }),
    ]).start(() => done.current());
    // Safety net: never keep the app behind the intro, even if an animation stalls.
    const t2 = setTimeout(() => done.current(), 4500);
    return () => clearTimeout(t2);
    // Runs once on mount; parent re-renders must not restart the intro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, { opacity: out }]}>
      <Glow height={900} />
      <Animated.View style={{ opacity: pipette, transform: [{ translateY: pipette.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }] }}>
        <Svg width={46} height={120} viewBox="0 0 46 120">
          <Defs>
            <SvgGradient id="pg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.violet} />
              <Stop offset="1" stopColor={colors.orchid} />
            </SvgGradient>
          </Defs>
          <Rect x="9" y="0" width="28" height="36" rx="12" fill={colors.ink} />
          <Rect x="15" y="34" width="16" height="58" rx="5" fill="rgba(123,92,250,0.12)" stroke={colors.ink} strokeWidth="2" />
          <Rect x="17" y="60" width="12" height="30" rx="3" fill="url(#pg)" />
          <Path d="M17 92 L23 112 L29 92 Z" fill="rgba(123,92,250,0.12)" stroke={colors.ink} strokeWidth="2" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.drop,
          {
            opacity: drop.interpolate({ inputRange: [0, 0.05, 0.95, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [0, 64] }) }, { rotate: '45deg' }],
          },
        ]}
      >
        <LinearGradient colors={[colors.violet, colors.orchid]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.rippleBox}>
        {[0, 1].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.ripple,
              {
                opacity: ripple.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.8 - i * 0.3, 0] }),
                transform: [{ scaleX: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6 + i * 0.8] }) }, { scaleY: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6 + i * 0.8] }) }],
              },
            ]}
          />
        ))}
      </View>
      <Animated.View style={{ marginTop: 12, opacity: brand, transform: [{ translateY: brand.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: brand.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
        <View style={{ alignItems: 'center' }}>
          <Brand size={34} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  drop: { width: 14, height: 14, borderRadius: 7, borderTopLeftRadius: 1, overflow: 'hidden', marginTop: -6 },
  rippleBox: { height: 30, width: 60, alignItems: 'center', justifyContent: 'center', marginTop: 48 },
  ripple: { position: 'absolute', width: 40, height: 12, borderRadius: 20, borderWidth: 2, borderColor: colors.lilac },
});
