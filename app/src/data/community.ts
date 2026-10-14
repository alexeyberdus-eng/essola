import type { Bottle } from '../components/silk';
import { Category, Recipe } from './recipes';

export type Author = { name: string; role: string };

export type Comment = {
  id: string;
  recipeId: string;
  parentId: string | null;
  author: string;
  text: string;
  /** minutes since the comment was posted */
  ago: number;
  likes: number;
  mine?: boolean;
};

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const BOTTLE: Record<Category, Bottle> = { Лицо: 'dropper', Тело: 'jar', Волосы: 'tube', Губы: 'tube', Руки: 'jar', Ванна: 'jar' };

export function recipeMeta(recipe: Recipe) {
  const r = rng(recipe.id);
  // Every recipe in the app is written by the essola team.
  const author = { name: '@essola', role: 'essola lab' };
  return { author, bottle: BOTTLE[recipe.category], postedAgo: 60 + Math.floor(r() * 60 * 24 * 6) };
}

/** Recipes start without comments: only real users' comments are shown. */
export const seedFor = (_recipeId: string): Comment[] => [];

export function timeAgo(min: number) {
  if (min < 60) return `${Math.max(1, min)} мин`;
  if (min < 60 * 24) return `${Math.floor(min / 60)} ч`;
  const d = Math.floor(min / 60 / 24);
  return d < 7 ? `${d} д` : `${Math.floor(d / 7)} нед`;
}

/** "5 мин" / "3 д" since an ISO date. */
export const ago = (iso: string) => timeAgo(Math.round((Date.now() - new Date(iso).getTime()) / 60000));

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
