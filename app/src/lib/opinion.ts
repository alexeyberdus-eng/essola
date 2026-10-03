import type { Analysis, AnalyzedItem } from './analyze';

// Lowercase only the first letter of a plain word ("Глицерин" → "глицерин"), keep acronyms ("Керамид AP"); group ceramides.
const name = (it: AnalyzedItem) => {
  const n = it.ing.ru || it.raw;
  if (/^(церамид|керамид)/i.test(n)) return 'церамиды';
  return /^[А-ЯЁA-Z][а-яёa-z]/.test(n) ? n.charAt(0).toLowerCase() + n.slice(1) : n;
};
const names = (xs: AnalyzedItem[]) => [...new Set(xs.map(name))];
const join = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} и ${xs[xs.length - 1]}`);

/**
 * A short technologist-style verdict written from our own base, no AI calls:
 * what the product is, its strong sides, what to watch, who it suits and how to use it.
 */
export type Opinion = { title: string; strong: string; weak: string | null; watch: string | null; suits: string | null; tips: string[] };

/**
 * A technologist-style verdict written from our own base, no AI calls: strong sides, what to watch,
 * who it suits and how to use it. `special` = a product that isn't skin care (nail polish remover, toothpaste…).
 */
export function opinion(a: Analysis, special?: string | null): Opinion {
  const known = a.items.filter((it) => it.match === 'exact' || it.match === 'fuzzy');
  const has = (re: RegExp) => known.some((it) => re.test(it.ing.inci));
  const fn = (f: string) => known.filter((it) => it.ing.fn.includes(f as never));

  const surf = fn('surfactant').length > 0;
  const emuls = fn('emulsifier').length > 0;

  const actives = known.filter((it) => it.ing.act >= 2).slice(0, 6);
  const base = known.slice(0, 5).filter((it) => it.ing.risk === 0 && !it.ing.fn.includes('base')).slice(0, 2);
  const allergens = known.filter((it) => it.ing.flags.includes('allergen') || it.ing.fn.includes('fragrance')).slice(0, 3);
  // An ingredient named once: fragrance is both risky and an allergen, so it goes to allergens only.
  const risky = known.filter((it) => it.ing.risk >= 2 && !allergens.includes(it)).slice(0, 3);
  const clog = known.filter((it) => it.ing.com >= 3).slice(0, 3);
  const drying = known.filter((it) => it.ing.flags.includes('drying-alcohol') || it.ing.flags.includes('sulfate')).slice(0, 2);
  const score = a.scores.overall;

  const strong = special
    ? `Это ${special.toLowerCase()}, а не уход за кожей: оценка показывает, насколько безопасны сами компоненты.`
    : actives.length
      ? `${join(names(actives).slice(0, 4)).replace(/^./, (c) => c.toUpperCase())}. ${actives[0].ing.ru}: ${actives[0].ing.note.charAt(0).toLowerCase()}${actives[0].ing.note.slice(1)}`
      : base.length
        ? `Активов с доказанным действием немного — средство работает в основном за счёт базы: ${join(base.map(name))}.`
        : 'Выраженных активов нет — это скорее базовый уход, чем средство с целевым эффектом.';

  // Each ingredient is named once with all its reasons («спирт — может сушить, возможный аллерген»);
  // ingredients with the same reasons are listed together.
  const reasons = new Map<string, string[]>();
  const add = (xs: AnalyzedItem[], why: string) => {
    for (const n of names(xs)) reasons.set(n, [...new Set([...(reasons.get(n) ?? []), why])]);
  };
  add(risky, 'спорный компонент');
  add(allergens, 'возможный аллерген');
  add(drying, 'может сушить');
  if (!special) add(clog, 'может забивать поры');
  const groups = new Map<string, string[]>();
  for (const [n, why] of reasons) groups.set(why.join(', '), [...(groups.get(why.join(', ')) ?? []), n]);
  const plural: Record<string, string> = { 'спорный компонент': 'спорные компоненты', 'возможный аллерген': 'возможные аллергены', 'может сушить': 'могут сушить', 'может забивать поры': 'могут забивать поры' };
  const watchList = [...groups].map(([why, ns]) => `${join(ns)} — ${ns.length > 1 ? why.split(', ').map((w) => plural[w] ?? w).join(', ') : why}`);
  const watch = watchList.length ? `${watchList.join('; ').replace(/^./, (c) => c.toUpperCase())}.` : null;

  // Weak side: what limits the effect, from the order of the list (earlier = more of it).
  const pos = (it: AnalyzedItem) => a.items.indexOf(it);
  const preservative = known.find((it) => it.ing.fn.includes('preservative'));
  const weakList: string[] = [];
  if (!special) {
    if (!actives.length) weakList.push('Нет активов с доказанным действием — заметного целевого эффекта ждать не стоит');
    else if (preservative && actives.every((it) => pos(it) > pos(preservative))) weakList.push('Активы стоят после консерванта — их, скорее всего, меньше 1%, эффект будет мягким');
    if (drying.some((it) => pos(it) < 5)) weakList.push('Спирт или сульфаты в начале состава — при ежедневном применении может сушить');
    if (allergens.length >= 2 || known.some((it) => it.ing.fn.includes('fragrance') && pos(it) < 8)) weakList.push('Отдушка и аллергены не дают пользы коже, но добавляют риск раздражения');
    if (clog.some((it) => pos(it) < 6) && !surf) weakList.push('Комедогенные компоненты в начале списка — не лучший выбор для жирной кожи');
  }
  const weak = weakList.length ? `${weakList.slice(0, 2).join('. ')}.` : null;

  let suits: string | null = null;
  if (!special) {
    const s: string[] = [];
    if (!clog.length && !surf) s.push('жирной', 'проблемной');
    if (!drying.length && (emuls || fn('emollient').length > 2)) s.push('сухой');
    if (!allergens.length && !risky.length) s.push('чувствительной');
    suits = s.length ? `${join(s).replace(/^./, (c) => c.toUpperCase())} коже${s.length < 4 ? '; остальным — смотрите по ощущениям' : ''}.` : 'Лучше нормальной, нечувствительной коже.';
  }

  const tips: string[] = [];
  if (has(/glycolic|lactic|mandelic|salicylic|gluconolactone|lactobionic/i)) tips.push('Кислоты повышают чувствительность к солнцу — днём обязателен SPF');
  if (has(/retin/i)) tips.push('Ретиноиды наносите вечером, начинайте с 2–3 раз в неделю');
  if (has(/ascorbic acid/i)) tips.push('Витамин C лучше утром под SPF');
  if (surf && !special) tips.push('Не держите на коже долго — нанесите и смойте');

  return { title: score >= 75 ? 'Хороший выбор' : score >= 55 ? 'Можно, но с оговорками' : 'Стоит подумать', strong, weak, watch, suits, tips };
}
