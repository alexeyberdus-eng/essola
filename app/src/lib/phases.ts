import type { PhaseKey } from '../components/lab';
import { Fn } from '../data/ingredients';
import { Recipe } from '../data/recipes';
import { resolveIngredient } from './wiki';

/** Rough amount in grams: "12 мл", "0,5 г", "2 капли", "1 ч. л." — ml ≈ g for cosmetics. */
export function amountGrams(amount: string): number {
  const a = amount.replace(',', '.').toLowerCase();
  const n = parseFloat(a.match(/\d+(\.\d+)?/)?.[0] ?? '0');
  if (/кап/.test(a)) return n * 0.04;
  if (/ст\.?\s*л/.test(a)) return n * 15;
  if (/ч\.?\s*л/.test(a)) return n * 5;
  if (/щепот/.test(a)) return 0.3;
  return n;
}

export function phaseOf(fn: Fn[] | undefined, name = ''): PhaseKey {
  const f = fn ?? [];
  if (/вода|гидролат|отвар|настой|сок|алоэ/i.test(name) || f[0] === 'base') return 'water';
  if (f.includes('preservative')) return 'preservative';
  if (f[0] === 'emulsifier' || f[0] === 'thickener' || /воск|эмульг|olivem|ксантан|агар/i.test(name)) return 'emulsifier';
  if (f[0] === 'emollient' || /масло|баттер|сквалан/i.test(name)) return 'oil';
  return 'active';
}

const cache = new Map<string, [PhaseKey, number][]>();

/** Share of each phase in a recipe, for the coloured formula bar. */
export function recipePhases(recipe: Recipe): [PhaseKey, number][] {
  const hit = cache.get(recipe.id);
  if (hit) return hit;
  const sums: Record<PhaseKey, number> = { water: 0, oil: 0, emulsifier: 0, active: 0, preservative: 0 };
  for (const i of recipe.ingredients) {
    sums[phaseOf(resolveIngredient(i.name)?.fn, i.name)] += amountGrams(i.amount);
  }
  const order: PhaseKey[] = ['water', 'oil', 'emulsifier', 'active', 'preservative'];
  const parts = order.filter((k) => sums[k] > 0).map((k) => [k, Math.max(sums[k], 0.6)] as [PhaseKey, number]);
  const out = parts.length ? parts : ([['active', 1]] as [PhaseKey, number][]);
  cache.set(recipe.id, out);
  return out;
}
