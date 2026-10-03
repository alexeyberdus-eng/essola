import type { IconName } from '../components/Icon';
import type { Fn, Ingredient } from '../data/ingredients';

export type Effect = { icon: IconName; title: string; text: string };
export type Summary = { kind: string; lead: string; effects: Effect[]; use: string[] };

type Rule = { key: string; icon: IconName; title: string; verb: string; match: (i: Ingredient) => boolean };

const has = (i: Ingredient, ...fns: Fn[]) => fns.some((f) => i.fn.includes(f));
const re = (i: Ingredient, r: RegExp) => r.test(i.inci);

// Order matters only for ties; weight decides which effects are shown.
const RULES: Rule[] = [
  { key: 'clean', icon: 'drop', title: 'Очищение', verb: 'очищают кожу и смывают загрязнения', match: (i) => has(i, 'surfactant') },
  { key: 'spf', icon: 'shield', title: 'Защита от солнца', verb: 'защищают от UV-лучей', match: (i) => has(i, 'uv') },
  { key: 'renew', icon: 'spark', title: 'Обновление кожи', verb: 'отшелушивают и выравнивают рельеф', match: (i) => has(i, 'exfoliant') || re(i, /Glycolic|Lactic|Salicylic|Mandelic|Gluconolactone/) },
  { key: 'age', icon: 'bolt', title: 'Антивозрастной уход', verb: 'стимулируют обновление и упругость', match: (i) => re(i, /Retin|Bakuchiol|Peptide|Adenosine/) },
  { key: 'tone', icon: 'spark', title: 'Ровный тон и поры', verb: 'выравнивают тон и сужают поры', match: (i) => re(i, /Niacinamide|Ascorb|Arbutin|Tranexamic|Azelaic|Licorice|Glycyrrhiza/) },
  { key: 'acne', icon: 'shield', title: 'Против воспалений', verb: 'снимают воспаления и регулируют жирность', match: (i) => re(i, /Zinc|Salicylic|Melaleuca|Tea Tree|Azelaic|Sulfur/) },
  { key: 'hydra', icon: 'drop', title: 'Увлажнение', verb: 'притягивают и удерживают влагу', match: (i) => has(i, 'humectant') },
  { key: 'barrier', icon: 'shield', title: 'Барьер и питание', verb: 'питают и восстанавливают защитный барьер', match: (i) => re(i, /Ceramide|Cholesterol|Squalane|Butter|Phytosphingosine/) || (has(i, 'emollient') && i.origin === 'natural') },
  { key: 'soft', icon: 'leaf', title: 'Смягчение', verb: 'делают кожу мягкой и гладкой', match: (i) => has(i, 'emollient', 'film') && i.origin !== 'natural' && !re(i, /Squalane|Butter/) },
  { key: 'calm', icon: 'leaf', title: 'Успокаивает', verb: 'снимают раздражение и покраснения', match: (i) => has(i, 'soothing') },
  { key: 'antiox', icon: 'shield', title: 'Антиоксиданты', verb: 'защищают кожу и формулу от окисления', match: (i) => has(i, 'antioxidant') },
  { key: 'plant', icon: 'leaf', title: 'Растительные экстракты', verb: 'добавляют мягкий уход и тонус', match: (i) => has(i, 'extract') },
];

const nameOf = (i: Ingredient) => (i.ru || i.inci).replace(/\s*\(.*?\)/, '');

function list(names: string[]) {
  const u = [...new Set(names)].slice(0, 2);
  return u.length > 1 ? `${u[0]} и ${u[1].toLowerCase()}` : u[0];
}

/** Products that aren't skin care at all are recognised by their signature ingredients. */
function specialKind(items: Ingredient[]): { type: string; use: string[] } | null {
  const top = items.slice(0, 4).map((i) => i.inci.toLowerCase());
  const all = items.map((i) => i.inci.toLowerCase());
  const any = (re: RegExp, list = all) => list.some((x) => re.test(x));
  if (any(/^acetone$|^ethyl acetate$/, top.slice(0, 2)) && !any(/nitrocellulose/))
    return { type: 'Жидкость для снятия лака', use: ['Ногти: ватным диском, затем вымыть руки и нанести крем', 'Пользуйтесь в проветриваемом помещении'] };
  if (any(/nitrocellulose|tosylamide|trimellitic anhydride/))
    return { type: 'Лак для ногтей', use: ['Ногти: 2 тонких слоя, затем закрепитель'] };
  if (any(/phenylenediamine|toluene-2,5-diamine|^resorcinol$|aminophenol/) || (any(/^ammonia$|ethanolamine/) && any(/hydrogen peroxide/)))
    return { type: 'Краска для волос', use: ['Волосы: по инструкции производителя, перчатки обязательны', 'За 48 часов — тест на сгибе локтя'] };
  if (any(/sodium fluoride|monofluorophosphate|stannous fluoride|hydroxyapatite/) || (any(/hydrated silica/, top) && any(/sorbitol|xylitol/)))
    return { type: 'Зубная паста', use: ['Зубы: 2 раза в день по 2 минуты, не глотать'] };
  if (any(/aluminum chlorohydrate|aluminium chlorohydrate|aluminum zirconium|potassium alum|zinc ricinoleate|triethyl citrate/))
    return { type: 'Дезодорант', use: ['Подмышки: на чистую сухую кожу, не сразу после бритья'] };
  if (any(/thioglycol/))
    return { type: 'Средство для депиляции или завивки', use: ['Строго по инструкции и времени на упаковке, не на раздражённую кожу'] };
  if (any(/dihydroxyacetone|erythrulose/))
    return { type: 'Автозагар', use: ['Тело: на отшелушенную кожу ровным слоем, вымыть руки после нанесения'] };
  if (any(/^alcohol denat|^alcohol$/, top.slice(0, 1)) && any(/^parfum$|^fragrance$/, top.slice(0, 3)))
    return { type: 'Парфюм', use: ['На запястья и шею, не на раздражённую кожу и не перед солнцем'] };
  if (any(/behentrimonium|cetrimonium|stearamidopropyl dimethylamine/, top) && !any(/sulfate|glucoside|betaine|isethionate/, top))
    return { type: 'Бальзам или маска для волос', use: ['Волосы: на длину после шампуня, 2–5 минут, смыть'] };
  return null;
}

/**
 * Explains in plain words what a set of ingredients does together.
 * `items` go in formula order (first = highest share); `kind` overrides the guessed product type.
 */
export function summarize(items: Ingredient[], kind?: string): Summary {
  const w = (idx: number) => 1 / Math.sqrt(idx + 1);
  const scored = RULES.map((r) => {
    const hits = items.map((i, idx) => ({ i, idx })).filter(({ i }) => r.match(i));
    const weight = hits.reduce((a, { i, idx }) => a + w(idx) * (1 + (i.act ?? 0)), 0);
    return { r, hits, weight };
  })
    .filter((s) => s.hits.length)
    .sort((a, b) => b.weight - a.weight);

  const effects: Effect[] = scored.slice(0, 4).map(({ r, hits }) => {
    const names = hits.map((h) => nameOf(h.i));
    const who = list(names);
    const many = new Set(names).size > 1;
    return { icon: r.icon, title: r.title, text: `${who} ${many ? r.verb : r.verb.replace(/ют(?=\s|$)/g, 'ет').replace(/ят(?=\s|$)/g, 'ит')}` };
  });

  const water = items.some((i) => has(i, 'base') && /Aqua|Water|Juice/.test(i.inci));
  const emuls = items.some((i) => has(i, 'emulsifier'));
  const oils = items.filter((i) => has(i, 'emollient')).length;
  const keys = new Set(scored.map((s) => s.r.key));
  const guessed = keys.has('clean')
    ? 'Очищающее средство'
    : keys.has('spf')
      ? 'Солнцезащитное средство'
      : !water && oils >= 2
        ? 'Масляное средство'
        : water && emuls
          ? 'Крем-эмульсия'
          : water
            ? 'Тоник или сыворотка'
            : 'Уходовое средство';
  const special = specialKind(items);
  const type = kind ?? special?.type ?? guessed;
  if (special && !kind) {
    const top = effects.slice(0, 2).map((e) => e.title.toLowerCase());
    return { kind: type, lead: `${type}${top.length ? `: ${top.join(', ')}` : ''}.`, effects, use: special.use };
  }

  const skin = keys.has('acne') || keys.has('tone') ? 'жирной и комбинированной кожи' : keys.has('calm') ? 'чувствительной кожи' : keys.has('barrier') || oils >= 2 ? 'сухой кожи' : 'любого типа кожи';
  const top = effects.slice(0, 2).map((e) => e.title.toLowerCase());
  const free: string[] = [];
  if (!items.some((i) => has(i, 'fragrance'))) free.push('без отдушек');
  if (!items.some((i) => i.flags.includes('drying-alcohol'))) free.push('без спирта');
  const lead = effects.length
    ? `${type} для ${skin}: ${top.join(', ')}${free.length ? `. ${free.join(' и ').replace(/^./, (c) => c.toUpperCase())}` : ''}.`
    : 'Состав почти без активных компонентов — работает как базовый уход.';

  const use: string[] = [];
  if (keys.has('clean')) use.push('Лицо или тело: на влажную кожу, вспенить и смыть');
  else if (keys.has('spf')) use.push('Утром, последним шагом ухода, обновлять каждые 2–3 часа на солнце');
  else if (type === 'Масляное средство') use.push('Лицо, тело, волосы: 2–3 капли на влажную кожу или кончики');
  else if (type === 'Тоник или сыворотка') use.push('Лицо и шея: после умывания, перед кремом');
  else use.push('Лицо и шея: на чистую кожу утром и вечером');
  if (keys.has('renew') || keys.has('age')) use.push('Вечером, 2–3 раза в неделю; утром обязателен SPF');
  if (keys.has('acne')) use.push('Точечно или на зоны с воспалениями');
  return { kind: type, lead, effects, use };
}
