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
export function opinion(a: Analysis): { title: string; paragraphs: string[] } {
  const known = a.items.filter((it) => it.match === 'exact' || it.match === 'fuzzy');
  const has = (re: RegExp) => known.some((it) => re.test(it.ing.inci));
  const fn = (f: string) => known.filter((it) => it.ing.fn.includes(f as never));

  const surf = fn('surfactant').length > 0;
  const emuls = fn('emulsifier').length > 0;
  const water = has(/^aqua$|water|juice|hydrosol|flower water/i);
  const kind = surf ? 'очищающее средство' : has(/zinc oxide|titanium dioxide|octocrylene|avobenzone|methoxydibenzoylmethane|tinosorb|triazine|homosalate/i) && fn('uv').length >= 1 ? 'солнцезащитное средство' : emuls ? 'крем или лосьон' : water ? 'лёгкое водное средство (тоник, сыворотка или гель)' : 'безводное средство на маслах (бальзам или масло)';

  const actives = known.filter((it) => it.ing.act >= 2).slice(0, 6);
  const base = known.slice(0, 5).filter((it) => it.ing.risk === 0 && !it.ing.fn.includes('base')).slice(0, 2);
  const allergens = known.filter((it) => it.ing.flags.includes('allergen') || it.ing.fn.includes('fragrance')).slice(0, 3);
  // An ingredient named once: fragrance is both risky and an allergen, so it goes to allergens only.
  const risky = known.filter((it) => it.ing.risk >= 2 && !allergens.includes(it)).slice(0, 3);
  const clog = known.filter((it) => it.ing.com >= 3).slice(0, 3);
  const drying = known.filter((it) => it.ing.flags.includes('drying-alcohol') || it.ing.flags.includes('sulfate')).slice(0, 2);

  const p: string[] = [];
  const score = a.scores.overall;
  p.push(
    `По составу это ${kind}. ${score >= 75 ? 'Формула продуманная и в целом безопасная.' : score >= 55 ? 'Формула рабочая, но с оговорками.' : 'Состав спорный — есть компоненты, к которым стоит присмотреться.'}`,
  );

  if (actives.length) p.push(`Сильная сторона — ${join(names(actives).slice(0, 4))}. ${actives[0].ing.ru}: ${actives[0].ing.note.charAt(0).toLowerCase()}${actives[0].ing.note.slice(1)}`);
  else if (base.length) p.push(`Активов с доказанным действием немного — средство работает в основном за счёт базы: ${join(base.map(name))}.`);
  else p.push('Выраженных активов нет — это скорее базовый уход, чем средство с целевым эффектом.');

  const watch: string[] = [];
  const say = (xs: AnalyzedItem[], one: string, many: string) => {
    const n = names(xs);
    if (n.length) watch.push(`${join(n)} — ${n.length > 1 ? many : one}`);
  };
  say(risky, 'спорный компонент', 'спорные компоненты');
  say(allergens, 'возможный аллерген', 'возможные аллергены');
  say(drying, 'может сушить', 'могут сушить');
  say(clog, 'может забивать поры', 'могут забивать поры');
  if (watch.length) p.push(`Обратите внимание: ${watch.join('; ')}.`);

  const suits: string[] = [];
  if (!clog.length && !surf) suits.push('жирной', 'проблемной');
  if (!drying.length && (emuls || fn('emollient').length > 2)) suits.push('сухой');
  if (!allergens.length && !risky.length) suits.push('чувствительной');
  p.push(suits.length ? `Подойдёт ${join(suits)} коже${suits.length < 4 ? '; остальным — смотрите по ощущениям' : ''}.` : 'Лучше подойдёт нормальной, нечувствительной коже.');

  const tips: string[] = [];
  if (has(/glycolic|lactic|mandelic|salicylic|gluconolactone|lactobionic/i)) tips.push('кислоты повышают чувствительность к солнцу — днём обязателен SPF');
  if (has(/retin/i)) tips.push('ретиноиды наносите вечером, начинайте с 2–3 раз в неделю');
  if (has(/ascorbic acid/i)) tips.push('витамин C лучше утром под SPF');
  if (surf) tips.push('не держите на коже долго — нанесите и смойте');
  if (tips.length) p.push(`Как применять: ${tips.join('; ')}.`);

  return { title: score >= 75 ? 'Хороший выбор' : score >= 55 ? 'Можно, но с оговорками' : 'Стоит подумать', paragraphs: p };
}
