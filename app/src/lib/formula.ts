import { Recipe } from '../data/recipes';

/** Share of each ingredient in the batch when every amount is in g or ml (ml ≈ g for cosmetics). */
export function percentages(recipe: Recipe): number[] | null {
  const values = recipe.ingredients.map((i) => {
    const m = i.amount.trim().match(/^(\d+(?:[.,]\d+)?)\s*(г|мл)$/);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  });
  if (values.some((v) => v === null)) return null;
  const total = (values as number[]).reduce((a, b) => a + b, 0);
  return total ? (values as number[]).map((v) => (v / total) * 100) : null;
}

export const formatPercent = (p: number) => `${p < 1 ? p.toFixed(1) : p.toFixed(p < 10 ? 1 : 0)}%`.replace('.', ',');

/** Minutes mentioned in a step ("на 15 минут", "2–3 минуты") — used to offer a timer. */
export function stepMinutes(step: string): number | null {
  const m = step.match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(?:мин|минут)/);
  if (!m) return null;
  return parseInt(m[2] ?? m[1], 10);
}
