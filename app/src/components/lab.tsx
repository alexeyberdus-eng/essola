import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { requireOptionalNativeModule } from 'expo';
import { Accelerometer } from 'expo-sensors';
import { ComponentType, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient as SvgGradient, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fonts, PHASE_COLOR } from '../theme';

const native = Platform.OS !== 'web';

/* ------------------------------------------------------------------ */
/* Tilt: one shared accelerometer stream drives glass sheen and liquid. */

const tiltX = new Animated.Value(0);
const tiltY = new Animated.Value(0);
let listeners = 0;
let sub: { remove: () => void } | null = null;

function startTilt() {
  listeners += 1;
  if (sub || !native) return;
  let sx = 0;
  let sy = 0;
  try {
    Accelerometer.setUpdateInterval(60);
    sub = Accelerometer.addListener(({ x, y }) => {
      // Low-pass filter keeps the motion silky instead of jittery.
      sx += (Math.max(-1, Math.min(1, x)) - sx) * 0.18;
      sy += (Math.max(-1, Math.min(1, y + 0.6)) - sy) * 0.18;
      tiltX.setValue(sx);
      tiltY.setValue(sy);
    });
  } catch {
    sub = null;
  }
}
function stopTilt() {
  listeners -= 1;
  if (listeners <= 0 && sub) {
    sub.remove();
    sub = null;
    listeners = 0;
  }
}

/** Phone roll/pitch in -1…1 as animated values (0 on web). */
export function useTilt() {
  useEffect(() => {
    startTilt();
    return stopTilt;
  }, []);
  return { x: tiltX, y: tiltY };
}

/* ------------------------------------------------------------------ */
/* Lab paper background: mm grid, measuring scale, crosshairs, a faint flask. */

export function LabBackground({ flask = true, drift = true }: { flask?: boolean; drift?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!drift) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, drift]);
  const ticks = useMemo(() => Array.from({ length: 70 }, (_, i) => i), []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* living tints: sage top-right, stone left, brass bottom */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) }] }]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="t1" cx="100%" cy="0%" rx="70%" ry="38%">
              <Stop offset="0" stopColor={colors.sage} stopOpacity="0.26" />
              <Stop offset="1" stopColor={colors.sage} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="t2" cx="0%" cy="48%" rx="65%" ry="40%">
              <Stop offset="0" stopColor={colors.trav} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.trav} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="t3" cx="95%" cy="100%" rx="70%" ry="32%">
              <Stop offset="0" stopColor={colors.brassLight} stopOpacity="0.26" />
              <Stop offset="1" stopColor={colors.brassLight} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="-40" y="-40" width="130%" height="130%" fill="url(#t1)" />
          <Rect x="-40" y="-40" width="130%" height="130%" fill="url(#t2)" />
          <Rect x="-40" y="-40" width="130%" height="130%" fill="url(#t3)" />
        </Svg>
      </Animated.View>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="mm" width="12" height="12" patternUnits="userSpaceOnUse">
            <Path d="M12 0H0V12" fill="none" stroke="rgba(120,110,85,0.07)" strokeWidth="1" />
          </Pattern>
          <Pattern id="cm" width="60" height="60" patternUnits="userSpaceOnUse">
            <Path d="M60 0H0V60" fill="none" stroke="rgba(120,110,85,0.09)" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#mm)" />
        <Rect width="100%" height="100%" fill="url(#cm)" />
      </Svg>
      {/* measuring scale on the right edge */}
      <View style={s.scale}>
        <Svg width={34} height={70 * 12 + 120}>
          {ticks.map((i) => {
            const y = 110 + i * 12;
            const major = i % 5 === 0;
            return (
              <G key={i}>
                <Line x1={major ? 20 : 26} x2={34} y1={y} y2={y} stroke="rgba(80,75,55,0.26)" strokeWidth={1} />
                {major && (
                  <SvgText x={16} y={y + 3} fontSize={7} fill="rgba(80,75,55,0.4)" textAnchor="end" fontFamily={fonts.mono}>
                    {(70 - i) * 5}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
      </View>
      <Cross style={{ left: 12, top: 54 }} />
      <Cross style={{ right: 12, top: 54 }} />
      {flask && (
        <View style={s.flaskLine}>
          <Svg width={150} height={196} viewBox="0 0 200 260">
            <G fill="none" stroke="rgba(95,112,88,0.16)" strokeWidth={1.4}>
              <Path d="M78 10h44M84 10v70L28 214a18 18 0 0 0 16 26h112a18 18 0 0 0 16-26L116 80V10" />
              <Path d="M50 172h100" strokeDasharray="3 4" />
              {[100, 120, 140, 160, 190, 210].map((y, i) => (
                <Line key={y} x1={i % 2 ? 128 : 122} x2={140} y1={y} y2={y} />
              ))}
            </G>
            <SvgText x={146} y={164} fontSize={10} fill="rgba(95,112,88,0.3)" fontFamily={fonts.mono}>
              250 ml
            </SvgText>
          </Svg>
        </View>
      )}
    </View>
  );
}

function Cross({ style }: { style: ViewStyle }) {
  return (
    <View style={[{ position: 'absolute' }, style]}>
      <Svg width={22} height={22}>
        <Circle cx={11} cy={11} r={5.5} fill="none" stroke="rgba(80,75,55,0.25)" />
        <Line x1={0} x2={22} y1={11} y2={11} stroke="rgba(80,75,55,0.25)" />
        <Line x1={11} x2={11} y1={0} y2={22} stroke="rgba(80,75,55,0.25)" />
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Glass: iOS 26 Liquid Glass when Expo Go has it, frosted blur otherwise. */

type GlassProps = { children?: ReactNode; style?: StyleProp<ViewStyle>; tint?: string; intensity?: number; interactive?: boolean };
let LiquidGlass: ComponentType<Record<string, unknown>> | null | undefined;
function liquidGlass() {
  if (LiquidGlass !== undefined) return LiquidGlass;
  LiquidGlass = null;
  if (Platform.OS !== 'ios') return null;
  try {
    const mod = requireOptionalNativeModule<{ isLiquidGlassAvailable?: boolean; isGlassEffectAPIAvailable?: boolean }>('ExpoGlassEffect');
    if (mod?.isLiquidGlassAvailable && mod.isGlassEffectAPIAvailable !== false) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      LiquidGlass = require('expo-glass-effect').GlassView;
    }
  } catch {
    LiquidGlass = null;
  }
  return LiquidGlass;
}

export function Glass({ children, style, tint = 'rgba(255,255,255,0.9)', intensity = 40, interactive }: GlassProps) {
  const LG = liquidGlass();
  const flat = StyleSheet.flatten(style) ?? {};
  const r = (flat.borderRadius as number) ?? 0;
  if (LG) {
    return (
      <LG style={[style, { overflow: 'hidden' }]} glassEffectStyle="regular" tintColor={tint} isInteractive={interactive} colorScheme="light">
        {children}
      </LG>
    );
  }
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {Platform.OS === 'web' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.9)' }]} />
      ) : (
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, borderRadius: r }]} />
      {children}
    </View>
  );
}

/** Moving highlight on glass/dark surfaces — follows the phone's tilt. */
export function Sheen({ radius = 20, strength = 0.5 }: { radius?: number; strength?: number }) {
  const { x } = useTilt();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <Animated.View style={[s.sheen, { transform: [{ translateX: x.interpolate({ inputRange: [-1, 1], outputRange: [-220, 260] }) }, { rotate: '18deg' }] }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', `rgba(255,255,255,${strength})`, 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Dark olive block: the anchor surface for the most important content. */

export function DarkBlock({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.dark, style]}>
      <LinearGradient colors={['#7C6CF2', '#4A55D6', '#3340B8']} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
      <Sheen radius={22} strength={0.08} />
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Living liquid in a test tube: fills up, tilts with the phone, bubbles rise. */

export function Tube({ value, height = 88, width = 26, delay = 0 }: { value: number; height?: number; width?: number; delay?: number }) {
  const fill = useRef(new Animated.Value(0)).current;
  const { x } = useTilt();
  useEffect(() => {
    Animated.spring(fill, { toValue: value / 100, delay, speed: 4, bounciness: 7, useNativeDriver: native }).start();
  }, [value, delay, fill]);
  const inner = height - 4;
  return (
    <View style={[s.tube, { width, height, borderBottomLeftRadius: width / 2, borderBottomRightRadius: width / 2 }]}>
      <Animated.View
        style={[
          s.liquid,
          {
            height: inner * 1.6,
            top: 0,
            left: -width,
            right: -width,
            transform: [
              { translateY: fill.interpolate({ inputRange: [0, 1], outputRange: [inner + 4, 2] }) },
              { rotate: x.interpolate({ inputRange: [-1, 1], outputRange: ['28deg', '-28deg'] }) },
            ],
          },
        ]}
      >
        <LinearGradient colors={['#A9B899', colors.sageDeep]} style={StyleSheet.absoluteFill} />
        <View style={s.meniscus} />
      </Animated.View>
      <Bubbles count={3} height={height} width={width} />
      {[0.25, 0.5, 0.75].map((f) => (
        <View key={f} style={[s.tick, { top: height * f }]} />
      ))}
      <View style={s.glassLine} />
    </View>
  );
}

function Bubbles({ count, height, width }: { count: number; height: number; width: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Bubble key={i} i={i} height={height} width={width} />
      ))}
    </>
  );
}
function Bubble({ i, height, width }: { i: number; height: number; width: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([Animated.delay(900 * i + 400), Animated.timing(v, { toValue: 1, duration: 2600 + i * 500, easing: Easing.out(Easing.quad), useNativeDriver: native })]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, i]);
  const size = 3 + (i % 2) * 2;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: width * (0.3 + 0.2 * (i % 3)),
        bottom: 6,
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: 'rgba(255,255,255,0.75)',
        opacity: v.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.55] }) }],
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Ring gauge that fills from 0 on appear. */

const ACircle = Animated.createAnimatedComponent(Circle);
export function Ring({ value, size = 104, stroke = 8, color = 'brass', track = 'rgba(138,154,123,0.18)', children, delay = 0 }: { value: number; size?: number; stroke?: number; color?: 'brass' | string; track?: string; children?: ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: value, duration: 1300, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, v, delay]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="brassRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.brassLight} />
            <Stop offset="0.55" stopColor={colors.brassDeep} />
            <Stop offset="1" stopColor="#E7D3A6" />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color === 'brass' ? 'url(#brassRing)' : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={v.interpolate({ inputRange: [0, 100], outputRange: [c, 0] })}
        />
      </Svg>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Rolling digits: numbers flow on a drum like iOS clocks instead of jumping. */

export function RollingNumber({ value, style, suffix }: { value: number; style: StyleProp<TextStyle>; suffix?: string }) {
  // Margins belong to the whole number, not to every digit on the drum.
  const { margin, marginTop, marginBottom, marginLeft, marginRight, marginVertical, marginHorizontal, ...text } = StyleSheet.flatten(style) ?? {};
  const lh = (text.lineHeight as number) ?? ((text.fontSize as number) ?? 20) * 1.15;
  const digits = String(Math.max(0, Math.round(value))).split('');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', margin, marginTop, marginBottom, marginLeft, marginRight, marginVertical, marginHorizontal }}>
      {digits.map((d, i) => (
        <Digit key={digits.length - i} d={Number(d)} lh={lh} style={text} delay={i * 60} />
      ))}
      {suffix ? <Text style={text}>{suffix}</Text> : null}
    </View>
  );
}
function Digit({ d, lh, style, delay }: { d: number; lh: number; style: StyleProp<TextStyle>; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: d, delay, speed: 6, bounciness: 5, useNativeDriver: native }).start();
  }, [d, v, delay]);
  return (
    <View style={{ height: lh, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 9], outputRange: [0, -9 * lh] }) }] }}>
        {Array.from({ length: 10 }, (_, n) => (
          <Text key={n} style={[style, { height: lh, lineHeight: lh }]}>
            {n}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Formula bar: phases as coloured segments that pour in from the left. */

export type PhaseKey = keyof typeof PHASE_COLOR;
export function FormulaBar({ parts, height = 6, delay = 0, track }: { parts: [PhaseKey, number][]; height?: number; delay?: number; track?: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, delay]);
  const total = parts.reduce((a, [, n]) => a + n, 0) || 1;
  return (
    <View style={{ height, borderRadius: height, overflow: 'hidden', backgroundColor: track ?? 'rgba(138,154,123,0.14)' }}>
      <Animated.View style={{ flexDirection: 'row', gap: 2, height, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}>
        {parts.map(([k, n], i) => (
          <View key={i} style={{ flex: n / total, backgroundColor: PHASE_COLOR[k] }} />
        ))}
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Light wave for a successful scan: rings expand and fade. */

export function LightWave({ trigger, color = colors.brassLight, size = 220 }: { trigger: number; color?: string; size?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!trigger) return;
    a.setValue(0);
    b.setValue(0);
    Animated.parallel([
      Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      Animated.timing(b, { toValue: 1, duration: 1200, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
    ]).start();
  }, [trigger, a, b]);
  const ring = (v: Animated.Value) => ({
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: color,
    opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.9, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.6] }) }],
  });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.View style={ring(a)} />
      <Animated.View style={ring(b)} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Glass flask: drag to turn it, phases fill in layers, a drop falls on each addition. */

export function Flask({ layers, size = 150, dropKey = 0, dropColor = colors.sageDeep }: { layers: [PhaseKey, number][]; size?: number; dropKey?: number; dropColor?: string }) {
  const turn = useRef(new Animated.Value(0)).current;
  const [t, setT] = useState(0);
  const drop = useRef(new Animated.Value(0)).current;
  const idle = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const id = turn.addListener(({ value }) => setT(value));
    // Gentle idle sway so the flask always feels alive.
    idle.current = Animated.loop(
      Animated.sequence([
        Animated.timing(turn, { toValue: 0.35, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(turn, { toValue: -0.35, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    idle.current.start();
    return () => {
      turn.removeListener(id);
      idle.current?.stop();
    };
  }, [turn]);

  useEffect(() => {
    if (!dropKey) return;
    drop.setValue(0);
    Animated.timing(drop, { toValue: 1, duration: 650, easing: Easing.in(Easing.quad), useNativeDriver: native }).start();
  }, [dropKey, drop]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
        onPanResponderGrant: () => idle.current?.stop(),
        onPanResponderMove: (_, g) => turn.setValue(Math.max(-1, Math.min(1, g.dx / 90))),
        onPanResponderRelease: () => {
          Animated.spring(turn, { toValue: 0, speed: 3, bounciness: 12, useNativeDriver: false }).start(() => idle.current?.start());
        },
      }),
    [turn],
  );

  const total = 100;
  let top = 232;
  const layerRects = layers.map(([k, pct], i) => {
    const h = (pct / total) * 150;
    top -= h;
    return (
      <G key={i}>
        <Rect x={0} y={top} width={200} height={h + 1} fill={PHASE_COLOR[k]} opacity={0.92} />
        <Rect x={0} y={top} width={200} height={2} fill="rgba(255,255,255,0.5)" />
      </G>
    );
  });
  const lx = 100 + t * 34;
  const sq = 1 - Math.abs(t) * 0.45;
  const h = size * 1.3;
  return (
    <View {...pan.panHandlers} style={{ width: size, height: h }}>
      <Svg width={size} height={h} viewBox="0 0 200 260">
        <Defs>
          <ClipPath id="flaskClip">
            <Path d="M84 10v70L28 214a18 18 0 0 0 16 26h112a18 18 0 0 0 16-26L116 80V10Z" />
          </ClipPath>
          <RadialGradient id="flaskGlass" cx={`${50 - t * 25}%`} cy="60%" rx="70%" ry="70%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.1" />
          </RadialGradient>
        </Defs>
        <Path d="M20 246 a80 7 0 1 0 160 0 a80 7 0 1 0 -160 0" fill="rgba(40,40,20,0.14)" />
        <G clipPath="url(#flaskClip)">
          <Rect width={200} height={260} fill="url(#flaskGlass)" />
          {layerRects}
          <Path d={`M${60 + t * 50} 120 Q ${50 + t * 50} 180 ${54 + t * 50} 226`} stroke="rgba(255,255,255,0.85)" strokeWidth={7} fill="none" strokeLinecap="round" />
          <Rect x={lx - 30 * sq} y={150} width={60 * sq} height={30} rx={4} fill="#F7F3EA" opacity={0.95 - Math.abs(t) * 0.3} />
          <SvgText x={lx} y={169} textAnchor="middle" fontSize={10 * sq} fill={colors.olive} opacity={1 - Math.abs(t) * 0.4} fontFamily={fonts.monoMedium}>
            ESSOLA
          </SvgText>
        </G>
        <Path d="M84 10v70L28 214a18 18 0 0 0 16 26h112a18 18 0 0 0 16-26L116 80V10" fill="none" stroke="rgba(50,50,30,0.45)" strokeWidth={2} />
        <Rect x={78} y={4} width={44} height={10} rx={3} fill={colors.olive} />
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: size / 2 - 6,
          top: 0,
          width: 12,
          height: 16,
          borderRadius: 8,
          borderTopLeftRadius: 2,
          backgroundColor: dropColor,
          opacity: drop.interpolate({ inputRange: [0, 0.05, 0.9, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-10, (top / 260) * h] }) }, { rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Pressable surface that tilts slightly under the finger — 3D feel. */

export function Tilt3D({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const rx = useRef(new Animated.Value(0)).current;
  const ry = useRef(new Animated.Value(0)).current;
  const [box, setBox] = useState({ w: 1, h: 1 });
  const reset = () => {
    Animated.spring(rx, { toValue: 0, useNativeDriver: native, speed: 20, bounciness: 8 }).start();
    Animated.spring(ry, { toValue: 0, useNativeDriver: native, speed: 20, bounciness: 8 }).start();
  };
  return (
    <Animated.View
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onTouchStart={(e) => {
        const { locationX, locationY } = e.nativeEvent;
        Animated.spring(rx, { toValue: (locationY / box.h - 0.5) * -8, useNativeDriver: native, speed: 30 }).start();
        Animated.spring(ry, { toValue: (locationX / box.w - 0.5) * 8, useNativeDriver: native, speed: 30 }).start();
      }}
      onTouchEnd={reset}
      onTouchCancel={reset}
      style={[
        style,
        {
          transform: [
            { perspective: 700 },
            { rotateX: rx.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] }) },
            { rotateY: ry.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  scale: { position: 'absolute', right: 2, top: 0 },
  flaskLine: { position: 'absolute', right: -18, top: 470, transform: [{ rotate: '8deg' }] },
  sheen: { position: 'absolute', top: -60, bottom: -60, width: 90 },
  dark: {
    borderRadius: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#14160F', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 14 } },
      android: { elevation: 8 },
      default: { boxShadow: '0 24px 44px -20px rgba(20,20,10,.6)' },
    }),
  },
  tube: { borderWidth: 1.4, borderColor: 'rgba(90,90,70,0.32)', borderTopLeftRadius: 5, borderTopRightRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.45)' },
  liquid: { position: 'absolute' },
  meniscus: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.75)' },
  tick: { position: 'absolute', right: 0, width: 6, height: 1, backgroundColor: 'rgba(60,60,40,0.3)' },
  glassLine: { position: 'absolute', left: 4, top: 5, bottom: 10, width: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)' },
});
