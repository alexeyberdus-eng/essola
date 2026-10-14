import { router } from 'expo-router';
import type { Ingredient } from '../data/ingredients';

// «Средства с ингредиентом»: the ingredient page hands the choice over to «База средств» on the «Средства» tab.
export type BaseIngredient = { slug: string; label: string };

/** Same key the CI index uses (scripts/build-ingr.ts). */
export const ingredientSlug = (inci: string) => inci.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

let pending: BaseIngredient | null = null;
const listeners = new Set<(x: BaseIngredient) => void>();

export function openBaseWith(ing: Ingredient) {
  const x = { slug: ingredientSlug(ing.inci), label: ing.ru || ing.inci };
  pending = x;
  listeners.forEach((l) => l(x));
  router.push('/(tabs)/shop' as never);
}
/** The ingredient waiting to be applied (taken once). */
export function takePendingIngredient() {
  const x = pending;
  pending = null;
  return x;
}
export function onBaseIngredient(l: (x: BaseIngredient) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
