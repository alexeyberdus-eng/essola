import { INGREDIENTS } from '../data/ingredients';
import { RECIPES, Recipe } from '../data/recipes';
import { Analysis } from './analyze';
import { RECIPE_INCI } from './wiki';

const BY_INCI = new Map(INGREDIENTS.map((i) => [i.inci, i]));

export type Similar = { recipe: Recipe; score: number; matched: string[]; missing: string[] };

/**
 * Compares a scanned product with every recipe: key actives weigh 50%, the base (first six
 * ingredients) 25%, and the overall mix of ingredient roles 25%.
 */
export function similarRecipes(analysis: Analysis, limit = 5): Similar[] {
  const known = analysis.items.filter((it) => it.match === 'exact' || it.match === 'fuzzy');
  const actives = known.filter((it) => it.ing.act >= 1);
  const actWeight = actives.reduce((s, it) => s + it.ing.act, 0);
  const base = known.slice(0, 6).map((it) => it.ing.inci);
  const roles = (list: string[]) => {
    const m = new Map<string, number>();
    for (const inci of list) {
      const fn = BY_INCI.get(inci)?.fn[0];
      if (fn) m.set(fn, (m.get(fn) ?? 0) + 1);
    }
    return m;
  };
  const productRoles = roles(known.map((it) => it.ing.inci));

  return RECIPES.map((recipe) => {
    const set = new Set(RECIPE_INCI.get(recipe.id) ?? []);
    const hit = actives.filter((it) => set.has(it.ing.inci));
    const activeScore = actWeight ? hit.reduce((s, it) => s + it.ing.act, 0) / actWeight : 0.4;
    const baseScore = base.length ? base.filter((i) => set.has(i)).length / Math.min(base.length, Math.max(set.size, 1)) : 0;
    const rr = roles([...set]);
    let dot = 0, a = 0, b = 0;
    for (const k of new Set([...productRoles.keys(), ...rr.keys()])) {
      const x = productRoles.get(k) ?? 0;
      const y = rr.get(k) ?? 0;
      dot += x * y;
      a += x * x;
      b += y * y;
    }
    const roleScore = a && b ? dot / Math.sqrt(a * b) : 0;
    const score = Math.round(100 * Math.min(1, 0.5 * activeScore + 0.25 * Math.min(1, baseScore) + 0.25 * roleScore));
    return {
      recipe,
      score,
      matched: [...new Set(known.filter((it) => it.ing.inci !== 'Aqua' && set.has(it.ing.inci)).map((it) => it.ing.ru))].slice(0, 4),
      missing: actives.filter((it) => !set.has(it.ing.inci)).map((it) => it.ing.ru).slice(0, 3),
    };
  })
    .filter((s) => s.score >= 15 && s.matched.length > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

/** Search query for stores built from the product's key actives. */
export function storeQuery(analysis: Analysis) {
  const names = analysis.items.filter((it) => it.ing.act >= 2).slice(0, 2).map((it) => it.ing.ru.toLowerCase());
  if (names.length) return names.join(' ');
  const has = (fn: string) => analysis.items.some((it) => it.ing.fn[0] === fn);
  if (has('surfactant')) return 'шампунь без сульфатов';
  if (has('emollient')) return 'увлажняющий крем';
  return 'уходовая косметика';
}

export const STORES = [
  { name: 'Золотое Яблоко', url: (q: string) => `https://goldapple.ru/catalogsearch/result?q=${encodeURIComponent(q)}` },
  { name: 'Ozon', url: (q: string) => `https://www.ozon.ru/search/?text=${encodeURIComponent(q)}` },
  { name: 'Wildberries', url: (q: string) => `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(q)}` },
];
