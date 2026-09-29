import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Motif, Recipe, RECIPES } from '../data/recipes';
import { colors, fonts } from '../theme';

function MotifArt({ motif, ink }: { motif: Motif; ink: string }) {
  const line = { stroke: ink, strokeWidth: 1, fill: 'none', opacity: 0.55 };
  switch (motif) {
    case 'drop':
      return (
        <>
          <Path d="M210 30 C 210 30 262 92 262 128 A 52 52 0 0 1 158 128 C 158 92 210 30 210 30 Z" fill="url(#glass)" />
          <Path d="M210 30 C 210 30 262 92 262 128 A 52 52 0 0 1 158 128 C 158 92 210 30 210 30 Z" {...line} />
          <Path d="M186 118 a 24 24 0 0 0 16 30" {...line} opacity={0.9} stroke="#fff" strokeWidth={2} />
        </>
      );
    case 'arch':
      return (
        <>
          <Path d="M160 200 V 95 A 50 50 0 0 1 260 95 V 200" fill="url(#glass)" />
          <Path d="M160 200 V 95 A 50 50 0 0 1 260 95 V 200" {...line} />
          <Path d="M178 200 V 100 A 32 32 0 0 1 242 100 V 200" {...line} />
        </>
      );
    case 'orb':
      return (
        <>
          <Circle cx={212} cy={98} r={62} fill="url(#glass)" />
          <Circle cx={212} cy={98} r={62} {...line} />
          <Circle cx={212} cy={98} r={40} {...line} />
          <Ellipse cx={196} cy={74} rx={14} ry={8} fill="#fff" opacity={0.55} />
        </>
      );
    case 'leaf':
      return (
        <>
          <Path d="M150 170 C 160 90 210 44 280 34 C 276 110 230 160 150 170 Z" fill="url(#glass)" />
          <Path d="M150 170 C 160 90 210 44 280 34 C 276 110 230 160 150 170 Z" {...line} />
          <Path d="M150 170 C 190 120 230 80 280 34" {...line} />
          <Path d="M186 132 L 200 108 M 208 110 L 226 88 M 230 86 L 248 66" {...line} />
        </>
      );
    case 'wave':
      return (
        <>
          <Circle cx={214} cy={96} r={56} fill="url(#glass)" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Path key={i} d={`M120 ${60 + i * 18} q 25 -12 50 0 t 50 0 t 50 0 t 50 0`} {...line} />
          ))}
        </>
      );
    case 'grain':
      return (
        <>
          <Circle cx={214} cy={98} r={58} fill="url(#glass)" />
          {Array.from({ length: 7 }).flatMap((_, r) =>
            Array.from({ length: 9 }).map((__, c) => (
              <Circle key={`${r}-${c}`} cx={150 + c * 16 + (r % 2) * 8} cy={40 + r * 18} r={1.6} fill={ink} opacity={0.4} />
            )),
          )}
        </>
      );
  }
}

export function RecipeCover({
  recipe,
  style,
  big,
  inset = 0,
}: {
  recipe: Recipe;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
  /** extra top offset for the number/category when a toolbar overlays the cover */
  inset?: number;
}) {
  const index = RECIPES.indexOf(recipe) + 1;
  const ink = recipe.tone[1];
  return (
    <View style={[styles.wrap, style]}>
      <LinearGradient colors={[recipe.tone[0], recipe.tone[1]]} start={{ x: 0, y: 0 }} end={{ x: 1.2, y: 1.1 }} style={StyleSheet.absoluteFill} />
      <Svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glass" cx="35%" cy="30%" r="80%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={300} height={200} fill="transparent" />
        <MotifArt motif={recipe.motif} ink={shade(ink)} />
      </Svg>
      <View style={[styles.meta, big && { top: 22 + inset, left: 22 }]}>
        <Text style={[styles.num, big && { fontSize: 34 }]}>№ {String(index).padStart(2, '0')}</Text>
        <Text style={styles.cat}>{recipe.category}</Text>
      </View>
    </View>
  );
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * 0.62).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colors.paper },
  meta: { position: 'absolute', top: 14, left: 16, gap: 2 },
  num: { fontFamily: fonts.serif, fontSize: 24, color: 'rgba(28,28,26,0.78)' },
  cat: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(28,28,26,0.55)' },
});
