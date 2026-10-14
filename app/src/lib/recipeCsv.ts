import type { Category, Motif, Recipe } from '../data/recipes';

/**
 * Recipes as a table, one recipe per row — the format of our editorial base and of the user's CSV import.
 * Columns (first row, in any order; Russian or English names):
 *   Название | Подзаголовок | Категория | Тип кожи | Минут | Выход | Срок | Ингредиенты | Шаги | Совет | О рецепте | Польза | Применение | Осторожно
 * Lists inside a cell are separated by "|": ingredients as "Масло жожоба — 9 мл | Сквалан — 10 мл",
 * steps and benefits as "Первый шаг | Второй шаг". Delimiter between columns: ";", "," or tab (detected).
 */
export const CSV_COLUMNS = ['Название', 'Подзаголовок', 'Категория', 'Тип кожи', 'Минут', 'Выход', 'Срок', 'Ингредиенты', 'Шаги', 'Совет', 'О рецепте', 'Польза', 'Применение', 'Осторожно'];

const ALIASES: Record<string, string> = {
  title: 'Название', name: 'Название', subtitle: 'Подзаголовок', category: 'Категория', skin: 'Тип кожи', minutes: 'Минут', time: 'Минут',
  yield: 'Выход', shelflife: 'Срок', ingredients: 'Ингредиенты', steps: 'Шаги', tip: 'Совет', about: 'О рецепте', benefits: 'Польза', usage: 'Применение', caution: 'Осторожно',
};

const CATS: Category[] = ['Лицо', 'Тело', 'Волосы', 'Губы', 'Руки', 'Ванна'];
const TONES: Record<Category, [string, string][]> = {
  Лицо: [['#F3E3C3', '#E2B866'], ['#E8E2FF', '#9C86F5'], ['#FCE3E8', '#E98AA2'], ['#DDF1EA', '#6FC2A1']],
  Тело: [['#FBE3D6', '#E99A73'], ['#E3EEFF', '#7FA6F0'], ['#F2E6D8', '#C79A6B']],
  Волосы: [['#E4F2E8', '#7BBE93'], ['#F0E6FF', '#A48BEA'], ['#FFF0D9', '#E7B05C']],
  Губы: [['#FFE1E6', '#EE8399'], ['#F8E5DC', '#D99A82']],
  Руки: [['#EAF1DF', '#9DBB6E'], ['#F5E9F7', '#C58FD0']],
  Ванна: [['#E0F1F6', '#6DB7CF'], ['#F3E8FF', '#B391EE']],
};
const MOTIFS: Motif[] = ['drop', 'arch', 'orb', 'leaf', 'wave', 'grain'];

/** Splits CSV text into rows of cells; supports quotes, doubled quotes and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const first = clean.split(/\r?\n/, 1)[0] ?? '';
  const delim = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const list = (s?: string) => (s ?? '').split('|').map((x) => x.trim()).filter(Boolean);

function slug(s: string) {
  const map: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  return s.toLowerCase().split('').map((c) => map[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

/** One table row (column name → value) → recipe; null when the essentials are missing. */
export function recipeFromRow(v: Record<string, string>, opts: { idPrefix: string; index: number; editorial?: boolean }): Recipe | null {
  const title = v['Название']?.trim();
  const ingredients = list(v['Ингредиенты']).map((x) => {
    const [name, amount] = x.split(/\s+[—–-]\s+|:\s*/);
    return { name: name.trim(), amount: (amount ?? '').trim() || 'по вкусу' };
  });
  const steps = list(v['Шаги']);
  if (!title || ingredients.length < 2 || !steps.length) return null;
  const category = (CATS.find((c) => c.toLowerCase() === v['Категория']?.trim().toLowerCase()) ?? 'Лицо') as Category;
  const tones = TONES[category];
  const water = ingredients.some((i) => /вод|гидролат|отвар|настой|алоэ|сок/i.test(i.name));
  const emuls = ingredients.some((i) => /эмульгатор|olivem|оливем|цетеар|воск эмульс/i.test(i.name));
  return {
    id: `${opts.idPrefix}-${slug(title)}-${opts.index}`,
    title,
    subtitle: v['Подзаголовок']?.trim() || '',
    category,
    skin: (v['Тип кожи'] ?? '').split(/[,|]/).map((x) => x.trim()).filter(Boolean).map((x) => x.charAt(0).toUpperCase() + x.slice(1)),
    minutes: Number(String(v['Минут'] ?? '').replace(/\D/g, '')) || 15,
    level: water && emuls ? 2 : 1,
    yield: v['Выход']?.trim() || '',
    shelfLife: v['Срок']?.trim() || '',
    ingredients,
    steps,
    tip: v['Совет']?.trim() || '',
    caution: v['Осторожно']?.trim() || undefined,
    about: v['О рецепте']?.trim() || undefined,
    benefits: list(v['Польза']),
    usage: v['Применение']?.trim() || undefined,
    tone: tones[opts.index % tones.length],
    motif: MOTIFS[opts.index % MOTIFS.length],
    baseLikes: 0,
    editorial: opts.editorial,
  };
}

/** Whole CSV → recipes, with the row numbers that could not be read. */
export function parseRecipesCsv(text: string, opts: { idPrefix: string; editorial?: boolean }) {
  const rows = parseCsv(text);
  const head = (rows.shift() ?? []).map((h) => {
    const k = h.trim();
    return ALIASES[k.toLowerCase().replace(/\s+/g, '')] ?? CSV_COLUMNS.find((c) => c.toLowerCase() === k.toLowerCase()) ?? k;
  });
  const recipes: Recipe[] = [];
  const skipped: number[] = [];
  rows.forEach((r, i) => {
    const v = Object.fromEntries(head.map((h, j) => [h, r[j] ?? '']));
    const recipe = recipeFromRow(v, { idPrefix: opts.idPrefix, index: i, editorial: opts.editorial });
    if (recipe) recipes.push(recipe);
    else skipped.push(i + 2);
  });
  return { recipes, skipped };
}
