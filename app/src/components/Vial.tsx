import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import { Recipe } from '../data/recipes';
import { colors } from '../theme';

/** Fill level of the vial: a stable per-recipe value so every formula looks different. */
function level(recipe: Recipe) {
  let h = 0;
  for (const ch of recipe.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return 0.42 + (h % 44) / 100;
}

/** Test-tube glyph: liquid in the product's own tone, graduation marks on the glass. */
export function Vial({ recipe, height = 46 }: { recipe: Recipe; height?: number }) {
  const width = (height * 26) / 46;
  const top = 6 + 38 * (1 - level(recipe));
  const clip = `vial-${recipe.id}`;
  return (
    <Svg width={width} height={height} viewBox="0 0 26 46">
      <Defs>
        <ClipPath id={clip}>
          <Path d="M6 6h14v30a7 7 0 0 1-14 0V6Z" />
        </ClipPath>
      </Defs>
      <Rect x={5} y={2} width={16} height={4} rx={1.5} fill={colors.ink} />
      <Path d="M6 6h14v30a7 7 0 0 1-14 0V6Z" fill="#fff" />
      <Rect x={6} y={top} width={14} height={46} fill={recipe.tone[1]} clipPath={`url(#${clip})`} />
      <Path d="M6 6h14v30a7 7 0 0 1-14 0V6Z" fill="none" stroke={colors.ink} strokeWidth={1.4} />
      <Path d="M9 14h4M9 20h3M9 26h4" stroke={colors.ink} strokeWidth={1} opacity={0.45} />
    </Svg>
  );
}
