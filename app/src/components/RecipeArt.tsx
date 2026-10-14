import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { Category, Recipe } from '../data/recipes';

// Bright aurora pairs per category: backdrop gradient and the liquid colour inside the bottle.
const PALETTE: Record<Category, { bg: [string, string]; liquid: string; leaf: string }> = {
  Лицо: { bg: ['#FFE1D3', '#EBDDFF'], liquid: '#FFA98A', leaf: '#7BC8A4' },
  Волосы: { bg: ['#D9E8FF', '#D5F5EA'], liquid: '#7FB0FF', leaf: '#5DBB94' },
  Губы: { bg: ['#FFDDE8', '#FFE6D6'], liquid: '#F27A9B', leaf: '#8CCB9E' },
  Руки: { bg: ['#E8DEFF', '#DCEBFF'], liquid: '#A88BFF', leaf: '#6EC3A0' },
  Тело: { bg: ['#D8F6EA', '#FFEBD9'], liquid: '#5ECFA6', leaf: '#F2A07B' },
  Ванна: { bg: ['#DCEBFF', '#EEDDFF'], liquid: '#8FB8FF', leaf: '#B79BFF' },
};

/** Small illustrated product tile for a recipe: bottle by category, sprig and bubbles; the user's photo if there is one. */
export function RecipeArt({ recipe, size = 78 }: { recipe: Recipe; size?: number }) {
  const p = PALETTE[recipe.category] ?? PALETTE['Лицо'];
  if (recipe.photo) {
    return <Image source={{ uri: recipe.photo }} style={{ width: size, height: size, borderRadius: size * 0.28 }} resizeMode="cover" />;
  }
  return (
    <LinearGradient colors={p.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.tile, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Svg width={size} height={size} viewBox="0 0 80 80">
        <Circle cx="62" cy="16" r="12" fill="#fff" opacity={0.55} />
        <Path d="M14 62c4-14 12-22 22-26-6 8-9 15-10 24" fill="none" stroke={p.leaf} strokeWidth={2} strokeLinecap="round" />
        <Path d="M20 50c-6-2-9-7-8-12 5 0 9 4 8 12Z" fill={p.leaf} opacity={0.85} />
        <Path d="M27 42c-1-6 2-10 7-11 1 5-2 9-7 11Z" fill={p.leaf} opacity={0.7} />
        <Bottle category={recipe.category} liquid={p.liquid} />
        <Circle cx="18" cy="20" r="3" fill="#fff" opacity={0.8} />
        <Circle cx="26" cy="13" r="1.8" fill="#fff" opacity={0.7} />
        <Ellipse cx="46" cy="73" rx="16" ry="2.2" fill="#15172B" opacity={0.08} />
      </Svg>
    </LinearGradient>
  );
}

function Bottle({ category, liquid }: { category: Category; liquid: string }) {
  const glass = 'rgba(255,255,255,0.78)';
  const cap = '#2A2D4A';
  switch (category) {
    case 'Волосы':
      return (
        <>
          <Rect x="44" y="12" width="4" height="10" rx="1.5" fill={cap} />
          <Rect x="40" y="10" width="14" height="4" rx="2" fill={cap} />
          <Rect x="40" y="21" width="12" height="7" rx="2" fill={cap} />
          <Rect x="35" y="27" width="22" height="45" rx="7" fill={glass} />
          <Rect x="35" y="46" width="22" height="26" rx="7" fill={liquid} opacity={0.85} />
          <Rect x="39" y="33" width="14" height="8" rx="2" fill="#fff" />
        </>
      );
    case 'Губы':
      return (
        <>
          <Rect x="38" y="20" width="14" height="12" rx="5" fill={liquid} />
          <Rect x="36" y="30" width="18" height="10" rx="2" fill="#D9DCEB" />
          <Rect x="35" y="39" width="20" height="33" rx="5" fill={cap} />
          <Rect x="39" y="47" width="12" height="6" rx="1.5" fill="#fff" opacity={0.9} />
        </>
      );
    case 'Руки':
    case 'Тело':
      return (
        <>
          <Rect x="30" y="36" width="34" height="8" rx="3" fill={cap} />
          <Rect x="28" y="43" width="38" height="29" rx="9" fill={glass} />
          <Rect x="28" y="56" width="38" height="16" rx="8" fill={liquid} opacity={0.85} />
          <Rect x="36" y="48" width="22" height="6" rx="1.5" fill="#fff" />
        </>
      );
    case 'Ванна':
      return (
        <>
          <Circle cx="47" cy="52" r="18" fill={liquid} opacity={0.9} />
          <Path d="M31 50c6 3 26 3 32 0" stroke="#fff" strokeWidth={2} fill="none" opacity={0.8} />
          <Circle cx="41" cy="44" r="3" fill="#fff" opacity={0.7} />
          <Circle cx="62" cy="30" r="4" fill="#fff" opacity={0.85} />
          <Circle cx="55" cy="24" r="2.4" fill="#fff" opacity={0.8} />
        </>
      );
    default:
      return (
        <>
          <Rect x="44" y="9" width="6" height="9" rx="3" fill={cap} />
          <Rect x="41" y="17" width="12" height="9" rx="2.5" fill={cap} />
          <Rect x="36" y="25" width="22" height="47" rx="8" fill={glass} />
          <Rect x="36" y="48" width="22" height="24" rx="8" fill={liquid} opacity={0.85} />
          <Rect x="40" y="32" width="14" height="8" rx="2" fill="#fff" />
        </>
      );
  }
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

export const CATEGORY_COLOR = (c: Category) => (PALETTE[c] ?? PALETTE['Лицо']).liquid;
