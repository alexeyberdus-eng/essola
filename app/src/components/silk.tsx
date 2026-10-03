import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Accelerometer } from 'expo-sensors';
import { colors, fonts, shadow } from '../theme';

const native = Platform.OS !== 'web';

/** White page with a soft lavender glow in the top corner. */
const AURORA: { c: string; o: number; x: `${number}%`; y: number; r: number; dx: number; dy: number; t: number }[] = [
  { c: '#FFBEA0', o: 0.74, x: '58%', y: -90, r: 200, dx: -150, dy: 120, t: 3600 },
  { c: '#A0C8FF', o: 0.61, x: '-30%', y: 150, r: 210, dx: 160, dy: -110, t: 4300 },
  { c: '#CDB4FF', o: 0.62, x: '55%', y: 420, r: 210, dx: -170, dy: 120, t: 3900 },
  { c: '#AAEBD7', o: 0.61, x: '-22%', y: 680, r: 190, dx: 150, dy: -130, t: 4700 },
];

// Phone tilt shared by every glow: one accelerometer subscription while any glow is on screen.
const tilt = new Animated.ValueXY({ x: 0, y: 0 });
let tiltUsers = 0;
let tiltSub: { remove: () => void } | null = null;
function useTilt() {
  useEffect(() => {
    if (!native) return;
    tiltUsers++;
    if (!tiltSub) {
      Accelerometer.setUpdateInterval(60);
      // How the phone is usually held drifts slowly into a baseline; the glows follow the change from it, amplified,
      // so even a small tilt moves them visibly.
      let bx: number | null = null;
      let by = 0;
      tiltSub = Accelerometer.addListener(({ x, y }) => {
        if (bx === null) [bx, by] = [x, y];
        bx = bx * 0.985 + x * 0.015;
        by = by * 0.985 + y * 0.015;
        const k = (v: number) => Math.max(-1, Math.min(1, v * 3.2));
        Animated.spring(tilt, { toValue: { x: k(x - bx), y: k(y - by) }, speed: 9, bounciness: 3, useNativeDriver: true }).start();
      });
    }
    return () => {
      tiltUsers--;
      if (!tiltUsers && tiltSub) {
        tiltSub.remove();
        tiltSub = null;
      }
    };
  }, []);
}

/** White page with a soft "aurora": four blurred colour washes drifting very slowly. */
export function Glow(_: { height?: number; flask?: boolean }) {
  useTilt();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {AURORA.map((b, i) => (
        <Drift key={i} {...b} i={i} />
      ))}
    </View>
  );
}

function Drift({ c, o, x, y, r, dx, dy, t, i }: (typeof AURORA)[number] & { i: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const swing = (a: Animated.Value, d: number) =>
      Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 1, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: native }), Animated.timing(a, { toValue: 0, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: native })]));
    // Horizontal and vertical swings run at different speeds, so each wash wanders in loops instead of a line.
    const a = swing(v, t);
    const b = swing(w, Math.round(t * 1.37));
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [v, w, t]);
  // Each wash shifts with the tilt by a different depth, so the layers slide past each other.
  const depth = 70 + i * 30;
  const move = { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) }, { translateY: w.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) }, { scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] }) }] };
  const lean = { transform: [{ translateX: tilt.x.interpolate({ inputRange: [-1, 1], outputRange: [depth, -depth] }) }, { translateY: tilt.y.interpolate({ inputRange: [-1, 1], outputRange: [-depth, depth] }) }] };
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y, width: r * 2, height: r * 2 }, lean]}>
    <Animated.View style={[StyleSheet.absoluteFill, move]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={`au${c}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c} stopOpacity={o} />
            <Stop offset="1" stopColor={c} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#au${c})`} />
      </Svg>
    </Animated.View>
    </Animated.View>
  );
}

/** White surface lifted on a layered soft shadow. */
export function Card({ children, style, soft }: { children: ReactNode; style?: StyleProp<ViewStyle>; soft?: boolean }) {
  return <View style={[s.card, soft && s.cardSoft, style]}>{children}</View>;
}

/** Fades and rises into place; `index` staggers siblings. */
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay: Math.min(index, 8) * 60, speed: 14, bounciness: 6, useNativeDriver: native }).start();
  }, [v, index]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Number that counts up from zero when it appears. */
export function CountUp({ value, style, suffix = '', duration = 900 }: { value: number; style?: StyleProp<TextStyle>; suffix?: string; duration?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const a = new Animated.Value(0);
    const id = a.addListener(({ value: x }) => setShown(Math.round(x)));
    Animated.timing(a, { toValue: value, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [value, duration]);
  return (
    <Text style={style}>
      {shown}
      {suffix}
    </Text>
  );
}

/** Slow breathing loop (scale + opacity) for "alive" elements: scan frame, risk dots. */
export function Breathe({ children, style, amount = 0.06 }: { children: ReactNode; style?: StyleProp<ViewStyle>; amount?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={[style, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + amount] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** Light sweep across a surface — used on "Купить" and gold badges. */
export function Shimmer({ width = 120, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([Animated.delay(1400), Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: native })]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        style,
        { overflow: 'hidden', transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-width, width] }) }] },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width: width * 0.4, height: '100%', transform: [{ skewX: '-20deg' }] }}
      />
    </Animated.View>
  );
}

export type Bottle = 'dropper' | 'jar' | 'tube';

/** Studio-style product shot: warm backdrop, bottle silhouette in the product tone, glossy highlight. */
export function ProductPhoto({ kind, tone, height, radius = 16, style }: { kind: Bottle; tone: [string, string]; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const liquid = tone[1];
  return (
    <View style={[{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: tone[0] }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="bg" cx="30%" cy="20%" rx="90%" ry="90%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor={liquid} stopOpacity="0.25" />
          </RadialGradient>
        </Defs>
        <Rect width="200" height="160" fill="url(#bg)" />
        {kind === 'dropper' && (
          <>
            <Rect x="88" y="20" width="24" height="26" rx="5" fill={colors.ink} />
            <Rect x="96" y="6" width="8" height="16" rx="4" fill={colors.ink} />
            <Rect x="72" y="44" width="56" height="104" rx="14" fill="rgba(255,255,255,0.6)" stroke="rgba(0,0,0,0.08)" />
            <Rect x="72" y="92" width="56" height="56" rx="14" fill={liquid} opacity={0.75} />
            <Rect x="82" y="62" width="36" height="18" rx="3" fill="#fff" opacity={0.92} />
          </>
        )}
        {kind === 'jar' && (
          <>
            <Rect x="60" y="56" width="80" height="18" rx="6" fill={colors.ink} />
            <Rect x="56" y="72" width="88" height="70" rx="16" fill="rgba(255,255,255,0.62)" stroke="rgba(0,0,0,0.08)" />
            <Rect x="56" y="102" width="88" height="40" rx="16" fill={liquid} opacity={0.72} />
            <Rect x="74" y="86" width="52" height="12" rx="3" fill="#fff" opacity={0.92} />
          </>
        )}
        {kind === 'tube' && (
          <>
            <Path d="M78 24h44l-6 112H84Z" fill="rgba(255,255,255,0.62)" stroke="rgba(0,0,0,0.08)" />
            <Rect x="84" y="136" width="32" height="18" rx="4" fill={colors.ink} />
            <Path d="M80 60h40l-3 60H83Z" fill={liquid} opacity={0.72} />
            <Rect x="88" y="36" width="24" height="14" rx="3" fill="#fff" opacity={0.92} />
          </>
        )}
        <Ellipse cx="100" cy="154" rx="46" ry="4" fill="rgba(0,0,0,0.08)" />
      </Svg>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.22)']}
        locations={[0, 0.32, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const AVATAR_TONES = ['#7B5CFA', '#A77BFF', '#C08BF5', '#8C6CFF', '#6A4BF2', '#B08CFF'];
export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: AVATAR_TONES[h % AVATAR_TONES.length], alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.4, color: '#fff' }}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    ...shadow,
  },
  cardSoft: { backgroundColor: colors.surf, borderColor: 'transparent', shadowOpacity: 0, elevation: 0 },
});

/** Text filled with the signature lavender gradient ("lab", "новое?"). */
export function GradText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  if (Platform.OS === 'web') return <Text style={[style, { color: colors.violet }]}>{children}</Text>;
  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient colors={[colors.violet, colors.lilac, colors.orchid]} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/** "essola lab" + tagline. */
export function Brand({ size = 23, tagline = true, light }: { size?: number; tagline?: boolean; light?: boolean }) {
  const t = { fontFamily: fonts.display, fontSize: size, letterSpacing: -size * 0.05, lineHeight: size * 1.15 };
  return (
    <View accessibilityRole="header" accessibilityLabel="essola lab">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={[t, { color: light ? '#fff' : colors.ink }]}>essola </Text>
        <Text style={[t, { fontFamily: fonts.regular, color: light ? 'rgba(255,255,255,0.7)' : colors.muted }]}>lab</Text>
      </View>
      {tagline && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: light ? 'rgba(255,255,255,0.7)' : colors.muted, marginTop: 3 }}>домашняя лаборатория косметики</Text>}
    </View>
  );
}
