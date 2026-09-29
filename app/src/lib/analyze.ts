import { FLAG_LABEL, Flag, Fn, INGREDIENTS, Ingredient, Origin } from '../data/ingredients';

export type SkinType = 'normal' | 'dry' | 'oily' | 'combo' | 'sensitive';

export type Match = 'exact' | 'fuzzy' | 'guess' | 'unknown';

export type AnalyzedItem = {
  position: number;
  raw: string;
  ing: Ingredient;
  match: Match;
};

export type Scores = {
  overall: number;
  natural: number;
  safety: number;
  efficacy: number;
  pores: number;
};

export type Analysis = {
  items: AnalyzedItem[];
  scores: Scores;
  verdict: { title: string; text: string };
  freeFrom: string[];
  stars: AnalyzedItem[];
  concerns: AnalyzedItem[];
  personal: string[];
  unknown: number;
};

const ORIGIN_SCORE: Record<Origin, number> = { natural: 1, mineral: 0.85, identical: 0.6, synthetic: 0.1 };
const RISK_PENALTY = [0, 3, 9, 18];

export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim();
}

const INDEX = new Map<string, Ingredient>();
for (const ing of INGREDIENTS) {
  for (const key of [ing.inci, ing.ru, ...ing.aliases]) {
    const k = normalize(key);
    if (k && !INDEX.has(k)) INDEX.set(k, ing);
  }
}
const KEYS = [...INDEX.keys()];

const START = /(ingredients|ingr[eé]dients|inci|composition|zutaten|состав|ингредиенты)\s*[:：\-–]/i;
const STOP =
  /(made in|manufactured|distributed|best before|exp\.?|lot\b|batch|изготовитель|произведено|срок годности|хранить|годен до|условия хранения|способ применения|www\.|http)/i;

/** Pulls the ingredient list out of free OCR text and splits it into entries. */
export function splitIngredients(text: string): string[] {
  let body = text.replace(/\r/g, '');
  const start = body.match(START);
  if (start?.index !== undefined) body = body.slice(start.index + start[0].length);
  const stop = body.match(STOP);
  if (stop?.index !== undefined && stop.index > 10) body = body.slice(0, stop.index);

  body = body
    .replace(/-\s*\n\s*/g, '') // words hyphenated across OCR lines
    .replace(/\n+/g, ' ')
    .replace(/\[\+\/-\]|\+\/-|may contain|peut contenir|может содержать/gi, ',')
    .replace(/\s+/g, ' ');

  return body
    .split(/\s*[,;•·●|]\s*|\.\s+(?=[A-ZА-Я])/)
    .map((t) =>
      t
        .replace(/^[\s.:*\-–]+|[\s.:*]+$/g, '')
        .replace(/\*+/g, '')
        .replace(/\b\d+([.,]\d+)?\s?%/g, '')
        .replace(/^(and|и)\s+/i, '')
        .trim(),
    )
    .filter((t) => t.length > 1 && t.length < 90 && /[a-zа-я]/i.test(t));
}

function levenshtein(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function lookup(key: string): { ing: Ingredient; match: Match } | null {
  if (!key) return null;
  const exact = INDEX.get(key);
  if (exact) return { ing: exact, match: 'exact' };
  if (key.length < 5) return null;
  const max = Math.max(1, Math.floor(key.length * 0.12));
  let best: string | null = null;
  let bestDist = max + 1;
  for (const k of KEYS) {
    const dist = levenshtein(key, k, max);
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
      if (dist === 1) break;
    }
  }
  return best ? { ing: INDEX.get(best)!, match: 'fuzzy' } : null;
}

function guess(raw: string, key: string): Ingredient {
  const make = (fn: Fn[], origin: Origin, risk: Ingredient['risk'], note: string, extra: Partial<Ingredient> = {}): Ingredient => ({
    inci: raw,
    ru: '',
    fn,
    origin,
    risk,
    note,
    act: 0,
    com: 0,
    flags: [],
    aliases: [],
    ...extra,
  });
  if (/paraben/.test(key)) return make(['preservative'], 'synthetic', 2, 'Консервант из группы парабенов.', { flags: ['paraben'] });
  if (/sulfate$/.test(key) && /(lauryl|laureth|myreth|coco)/.test(key))
    return make(['surfactant'], 'synthetic', 2, 'Сульфатный ПАВ — может сушить кожу.', { flags: ['sulfate'] });
  if (/(siloxane|methicone|silane|silicone)/.test(key)) return make(['film'], 'synthetic', 1, 'Силикон: гладкость и защитная плёнка.', { flags: ['silicone'] });
  if (/^(peg|ppg)\s?\d|eth \d+$|^polysorbate/.test(key)) return make(['emulsifier'], 'synthetic', 1, 'Этоксилированный компонент (ПЭГ).', { flags: ['peg'] });
  if (/^ci \d{5}/.test(key)) {
    const mineral = /^ci 77/.test(key);
    return make(['colorant'], mineral ? 'mineral' : 'synthetic', mineral ? 0 : 1, mineral ? 'Минеральный пигмент.' : 'Синтетический краситель.');
  }
  if (/peptide/.test(key)) return make(['active'], 'synthetic', 0, 'Сигнальный пептид.', { act: 2 });
  if (/ceramide/.test(key)) return make(['active', 'emollient'], 'identical', 0, 'Липид кожного барьера.', { act: 2 });
  if (/(ferment|filtrate|lysate)/.test(key)) return make(['active'], 'natural', 0, 'Ферментированный компонент, питает микробиом.', { act: 1 });
  if (/(extract|экстракт|leaf|root|flower|fruit|seed powder)/.test(key)) return make(['extract'], 'natural', 0, 'Растительный экстракт.', { act: 0.5 });
  if (/(butter|seed oil|kernel oil|fruit oil| oil$|масло)/.test(key)) return make(['emollient'], 'natural', 0, 'Растительное масло.', { com: 1 });
  if (/( water$|hydrosol|гидролат|distillate)/.test(key)) return make(['base'], 'natural', 0, 'Растительная водная основа.');
  if (/glucoside$/.test(key)) return make(['surfactant'], 'identical', 0, 'Мягкий ПАВ из сахаров.');
  if (/(polyquaternium|quaternium)/.test(key)) return make(['film'], 'synthetic', 1, 'Кондиционирующий полимер.');
  if (/(acrylate|polymer|crosspolymer|nylon|polyethylene)/.test(key)) return make(['thickener'], 'synthetic', 0, 'Синтетический полимер для текстуры.');
  if (/(ate|ide)$/.test(key) && /(sodium|potassium|magnesium|calcium|zinc)/.test(key)) return make(['ph'], 'mineral', 0, 'Минеральная соль.');
  if (/acid$/.test(key)) return make(['ph'], 'identical', 0, 'Органическая кислота.');
  return make([], 'synthetic', 1, 'Компонента пока нет в базе Essola.');
}

export function identify(raw: string): { ing: Ingredient; match: Match } {
  const full = normalize(raw);
  const outer = normalize(raw.replace(/\(.*?\)/g, ' '));
  const inner = raw.match(/\((.*?)\)/)?.[1];
  // "Butyrospermum Parkii (Shea) Butter": try full, without brackets, then bracketed synonym.
  const hit = lookup(full) ?? lookup(outer) ?? (inner ? lookup(normalize(inner)) : null);
  if (hit) return hit;
  const g = guess(raw, outer || full);
  return { ing: g, match: g.fn.length ? 'guess' : 'unknown' };
}

const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, n)));

export function analyze(text: string, skin?: SkinType | null): Analysis {
  const seen = new Set<string>();
  const items: AnalyzedItem[] = [];
  for (const raw of splitIngredients(text)) {
    const { ing, match } = identify(raw);
    const id = match === 'unknown' ? normalize(raw) : ing.inci;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ position: items.length, raw, ing, match });
  }

  const n = items.length;
  const weight = (i: number) => 1 / Math.sqrt(i + 1);
  const known = items.filter((it) => it.match !== 'unknown');

  let wSum = 0;
  let natSum = 0;
  let penalty = 0;
  let actSum = 0;
  let pores = 0;
  for (const it of items) {
    const w = weight(it.position) * (it.match === 'unknown' ? 0.5 : 1);
    // Water is neutral: it should not make a sulfate shampoo look "natural".
    if (it.ing.inci !== 'Aqua') {
      wSum += w;
      natSum += w * ORIGIN_SCORE[it.ing.origin];
    }
    const early = it.position < 5;
    penalty += RISK_PENALTY[it.ing.risk] * (early ? 1 : 0.7);
    if (it.ing.flags.includes('drying-alcohol') && early) penalty += 8;
    actSum += it.ing.act * (it.position < Math.max(6, n * 0.5) ? 1 : 0.55);
    const c = it.ing.com * (it.position < 8 ? 1 : 0.5);
    pores = Math.max(pores, c);
  }
  const heavy = items.filter((it) => it.ing.com >= 3).length;

  const scores: Scores = {
    natural: wSum ? clamp((natSum / wSum) * 100) : 0,
    safety: n ? clamp(100 - penalty) : 0,
    efficacy: n ? clamp(100 * (1 - Math.exp(-actSum / 4.5))) : 0,
    pores: n ? clamp(100 - pores * 15 - Math.max(0, heavy - 1) * 5) : 0,
    overall: 0,
  };
  scores.overall = n ? clamp(scores.safety * 0.32 + scores.efficacy * 0.24 + scores.natural * 0.24 + scores.pores * 0.2) : 0;

  const has = (f: Flag) => items.some((it) => it.ing.flags.includes(f));
  const freeFrom: string[] = [];
  if (n) {
    if (!has('paraben')) freeFrom.push('Без парабенов');
    if (!has('sulfate')) freeFrom.push('Без сульфатов');
    if (!has('silicone')) freeFrom.push('Без силиконов');
    if (!items.some((it) => it.ing.inci === 'Parfum')) freeFrom.push('Без отдушек');
    if (!has('formaldehyde')) freeFrom.push('Без формальдегидов');
    if (!has('drying-alcohol')) freeFrom.push('Без спирта');
  }

  const stars = known.filter((it) => it.ing.act >= 2).slice(0, 6);
  const concerns = items.filter((it) => it.ing.risk >= 2 || (it.ing.risk >= 1 && it.ing.flags.length > 0));

  const personal: string[] = [];
  if (skin === 'oily' || skin === 'combo') {
    const clog = items.filter((it) => it.ing.com >= 3).map((it) => it.ing.ru || it.raw);
    if (clog.length) personal.push(`Для склонной к жирности кожи: ${clog.slice(0, 3).join(', ')} могут забивать поры.`);
  }
  if (skin === 'sensitive') {
    const irr = items.filter((it) => it.ing.flags.some((f) => f === 'allergen' || f === 'irritant')).map((it) => it.ing.ru || it.raw);
    if (irr.length) personal.push(`Для чувствительной кожи: ${irr.slice(0, 3).join(', ')} — потенциальные раздражители. Сделайте тест на сгибе локтя.`);
  }
  if (skin === 'dry' && has('drying-alcohol')) personal.push('Для сухой кожи: спирт в составе может усиливать стянутость.');
  if (skin === 'dry' && items.some((it) => it.ing.flags.includes('sulfate'))) personal.push('Для сухой кожи: сульфаты смывают защитные липиды.');
  if (has('pregnancy')) {
    const list = items.filter((it) => it.ing.flags.includes('pregnancy')).map((it) => it.ing.ru || it.raw);
    personal.push(`${FLAG_LABEL.pregnancy}: ${list.join(', ')}.`);
  }
  if (skin && !personal.length && n) personal.push('Критичных компонентов для вашего типа кожи не найдено.');

  return {
    items,
    scores,
    verdict: verdictFor(scores.overall, n),
    freeFrom,
    stars,
    concerns,
    personal,
    unknown: items.filter((it) => it.match === 'unknown').length,
  };
}

function verdictFor(score: number, n: number) {
  if (!n) return { title: 'Состав не найден', text: 'Попробуйте сфотографировать список ингредиентов ближе и при хорошем свете.' };
  if (score >= 82) return { title: 'Чистый состав', text: 'Бережная формула с работающими компонентами. Можно смело пробовать.' };
  if (score >= 68) return { title: 'Хороший состав', text: 'В целом сбалансированная формула — отметьте пару нюансов ниже.' };
  if (score >= 50) return { title: 'Компромисс', text: 'Есть полезные компоненты, но и спорные тоже. Решайте по задаче и типу кожи.' };
  return { title: 'С осторожностью', text: 'Много компонентов с повышенным риском раздражения или малой пользой.' };
}

export const SAMPLES = [
  {
    title: 'Увлажняющий крем',
    text: 'Ingredients: Aqua, Glycerin, Caprylic/Capric Triglyceride, Butyrospermum Parkii (Shea) Butter, Cetearyl Alcohol, Niacinamide, Squalane, Sodium Hyaluronate, Ceramide NP, Panthenol, Cetearyl Olivate, Sorbitan Olivate, Tocopherol, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
  },
  {
    title: 'Масс-маркет шампунь',
    text: 'INGREDIENTS: AQUA, SODIUM LAURETH SULFATE, COCAMIDOPROPYL BETAINE, SODIUM CHLORIDE, DIMETHICONE, PARFUM, GLYCOL DISTEARATE, CITRIC ACID, SODIUM BENZOATE, POLYQUATERNIUM-10, METHYLCHLOROISOTHIAZOLINONE, METHYLISOTHIAZOLINONE, LINALOOL, LIMONENE, HEXYL CINNAMAL.',
  },
  {
    title: 'Масло для лица',
    text: 'Состав: Squalane, Simmondsia Chinensis Seed Oil, Rosa Canina Fruit Oil, Argania Spinosa Kernel Oil, Bakuchiol, Tocopherol, Citrus Aurantium Amara Flower Oil.',
  },
];
