import type { Bottle } from '../components/silk';
import { Category, Recipe, RECIPES } from './recipes';

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

const AUTHORS: Author[] = [
  { name: 'Мария Климова', role: 'технолог' },
  { name: 'Essola Lab', role: 'редакция' },
  { name: 'Ольга Сафина', role: 'косметолог' },
  { name: 'Дарья Лис', role: 'автор рецептов' },
];

const PEOPLE = ['Анна', 'Катя М.', 'Лиза', 'Ирина', 'Полина', 'Настя', 'Вика', 'Юля', 'Света', 'Женя', 'Алина', 'Маша', 'Оля', 'Даша', 'Карина', 'Тоня'];

const TOP = [
  'Сделала вчера — текстура огонь, кожа мягкая уже утром 🔥',
  'А сколько хранится, если без консерванта?',
  'Заменила {ing} на то, что было дома — всё получилось, спасибо!',
  'Можно ли использовать при чувствительной коже?',
  'Где вы покупаете {ing}? В аптеке не нашла',
  'Второй месяц пользуюсь, результат вижу, рецепт в закладки ✨',
  'У меня расслоилось через пару дней, что я сделала не так?',
  'Подойдёт ли для подростковой кожи?',
  'Какой объём баночки брать под эту порцию?',
  'Добавила пару капель эфирного масла — аромат 👌',
];

const REPLIES = [
  'Тоже интересно!',
  'Храните в холодильнике и работайте в стерильной посуде — неделя максимум.',
  'Я брала на маркетплейсе, ищите по INCI-названию',
  'Сделайте тест на сгибе локтя, сутки наблюдайте',
  'Скорее всего не хватило эмульгатора или перегрели фазы',
  'Да, у меня такая же, всё отлично',
  'Спасибо, попробую!',
  '+1, тоже так делала',
  'Лучше без эфирных масел, если кожа реактивная',
  'Возьмите баночку 50 мл с дозатором — меньше контакта с воздухом',
  'Технолог выше ответила, почитайте 👆',
  'У меня получилось со второго раза 😅',
];

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
  const author = recipe.editorial ? { name: 'essola lab', role: 'редакция' } : AUTHORS[Math.floor(r() * AUTHORS.length)];
  return { author, bottle: BOTTLE[recipe.category], postedAgo: 60 + Math.floor(r() * 60 * 24 * 6) };
}

/** Deterministic demo discussion for a recipe: 3–7 threads, some with long reply chains. */
function seedComments(recipe: Recipe): Comment[] {
  if (recipe.editorial) return [];
  const r = rng('c:' + recipe.id);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const ing = () => pick(recipe.ingredients).name.toLowerCase();
  const out: Comment[] = [];
  const threads = 3 + Math.floor(r() * 5);
  for (let t = 0; t < threads; t++) {
    const id = `${recipe.id}:${t}`;
    const ago = 30 + Math.floor(r() * 60 * 24 * 5);
    out.push({ id, recipeId: recipe.id, parentId: null, author: pick(PEOPLE), text: pick(TOP).replace('{ing}', ing()), ago, likes: Math.floor(r() * 180) });
    const replies = r() < 0.35 ? 0 : Math.floor(r() * 15);
    for (let k = 0; k < replies; k++) {
      out.push({
        id: `${id}:${k}`,
        recipeId: recipe.id,
        parentId: id,
        author: k === 0 && r() < 0.5 ? recipeMeta(recipe).author.name : pick(PEOPLE),
        text: pick(REPLIES),
        ago: Math.max(1, ago - 5 - k * Math.floor(20 + r() * 90)),
        likes: Math.floor(r() * 40),
      });
    }
  }
  return out;
}

const SEED = new Map(RECIPES.map((r) => [r.id, seedComments(r)]));
export const seedFor = (recipeId: string) => SEED.get(recipeId) ?? [];

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
