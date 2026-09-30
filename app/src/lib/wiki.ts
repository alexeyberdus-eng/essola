import { Fn, INGREDIENTS, Ingredient } from '../data/ingredients';
import { RECIPES, Recipe } from '../data/recipes';
import { identify } from './analyze';

/** "Сквалан оливковый" → Squalane: try the full name, then drop trailing words. */
function resolve(name: string): string | null {
  const words = name.replace(/\(.*?\)/g, ' ').trim().split(/\s+/);
  for (let n = words.length; n >= 1; n--) {
    const m = identify(words.slice(0, n).join(' '));
    if (m.match === 'exact' || m.match === 'fuzzy') return m.ing.inci;
  }
  return null;
}

/** INCI names used by each recipe, resolved from the Russian ingredient names. */
export const RECIPE_INCI: Map<string, string[]> = new Map(
  RECIPES.map((r) => [
    r.id,
    r.ingredients.map((i) => resolve(i.name)).filter((x): x is string => !!x),
  ]),
);

export function recipesWith(ing: Ingredient): Recipe[] {
  return RECIPES.filter((r) => RECIPE_INCI.get(r.id)?.includes(ing.inci));
}

export const ingredientId = (ing: Ingredient) => String(INGREDIENTS.indexOf(ing));
export const ingredientById = (id: string) => INGREDIENTS[Number(id)];

export const WIKI_GROUPS: { key: 'all' | Fn; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активы' },
  { key: 'humectant', label: 'Увлажнители' },
  { key: 'emollient', label: 'Смягчающие' },
  { key: 'antioxidant', label: 'Антиоксиданты' },
  { key: 'soothing', label: 'Успокаивающие' },
  { key: 'preservative', label: 'Консерванты' },
  { key: 'surfactant', label: 'Очищение' },
  { key: 'fragrance', label: 'Ароматы' },
  { key: 'uv', label: 'УФ-фильтры' },
];
