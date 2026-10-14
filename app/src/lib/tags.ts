import type { Analysis, AnalyzedItem } from './analyze';

// Product tags computed once when the catalog is built (scripts/build-letu.ts) and filtered on the server
// for «Подбор средств». One letter per tag, stored as a string in the catalog card (`m`).

/** What a product helps with: letter → label and the actives that count. */
export const GOAL_TAGS = {
  A: { label: 'Высыпания', re: /salicylic|niacinamide|zinc|azelaic|sulfur|melaleuca|benzoyl|mandelic|capryloyl salicylic|betaine salicylate|retin/i },
  P: { label: 'Пигментация', re: /ascorb|niacinamide|arbutin|tranexamic|azelaic|kojic|glycyrrhiza|morus alba|glycolic|lactic|mandelic|acetyl glucosamine|resorcinol|thiamidol|retin/i },
  W: { label: 'Морщины, упругость', re: /retin|peptide|bakuchiol|ascorb|adenosine|ubiquinone|ferulic|resveratrol|ceramide|collagen/i },
  H: { label: 'Увлажнение', re: /hyaluron|glycerin|panthenol|urea|polyglutam|betaine|sodium pca|trehalose|saccharide isomerate|beta-glucan|aloe/i },
  R: { label: 'Покраснение, чувствительность', re: /centella|madecassoside|asiaticoside|bisabolol|allantoin|panthenol|glycyrrhizate|colloidal oatmeal|avena|beta-glucan|ectoin|chamomilla|calendula/i },
  O: { label: 'Поры, жирность', re: /salicylic|niacinamide|zinc|kaolin|bentonite|charcoal|capryloyl salicylic|betaine salicylate|hamamelis/i },
  D: { label: 'Сияние, тусклость', re: /ascorb|glycolic|lactic|mandelic|gluconolactone|niacinamide|galactomyces|lactobionic|papain/i },
  B: { label: 'Барьер, сухость', re: /ceramide|cholesterol|squalane|butyrospermum|phytosphingosine|fatty acid|linoleic|shea/i },
  S: { label: 'Рост и укрепление волос', re: /caffeine|rosmarinus|urtica|biotin|peptide|serenoa|arginine|niacinamide|capixyl|procapil/i },
  G: { label: 'Блеск и гладкость волос', re: /argania|camellia|keratin|silk|amodimethicone|dimethicone|behentrimonium|polyquaternium|hydrolyzed/i },
  C: { label: 'Перхоть, кожа головы', re: /piroctone|climbazole|zinc pyrithione|ketoconazole|selenium|salicylic|melaleuca|sulfur/i },
} as const;

/** What a product is free from / safe for: letter → label. */
export const FREE_TAGS = {
  s: 'Без силиконов',
  u: 'Без сульфатов',
  p: 'Без парабенов',
  f: 'Без отдушек',
  a: 'Без сушащего спирта',
  c: 'Не забивает поры',
  k: 'Для чувствительной кожи',
  g: 'Можно при беременности',
  v: 'Веган',
} as const;

const VEGAN_NO = /lanolin|cera alba|beeswax|^mel$|honey|carmine|collagen|elastin|snail|silk|sericin|keratin|royal jelly|propolis|squalene|milk|lac$/i;

export function productTags(a: Pick<Analysis, 'items'>) {
  const items = a.items.filter((it) => it.match === 'exact' || it.match === 'fuzzy');
  if (items.length < 3) return '';
  const has = (f: (it: AnalyzedItem) => boolean) => items.some(f);
  // Goals count only when the active is not buried at the very end of a long list.
  const head = items.slice(0, Math.max(12, Math.ceil(items.length * 0.75)));
  let out = '';
  for (const [k, g] of Object.entries(GOAL_TAGS)) if (head.some((it) => g.re.test(it.ing.inci))) out += k;
  if (!has((it) => it.ing.flags.includes('silicone'))) out += 's';
  if (!has((it) => it.ing.flags.includes('sulfate'))) out += 'u';
  if (!has((it) => it.ing.flags.includes('paraben'))) out += 'p';
  if (!has((it) => it.ing.fn.includes('fragrance'))) out += 'f';
  if (!has((it) => it.ing.flags.includes('drying-alcohol'))) out += 'a';
  if (!has((it) => it.ing.com >= 3)) out += 'c';
  if (!has((it) => it.ing.flags.some((f) => f === 'allergen' || f === 'irritant' || f === 'drying-alcohol') || it.ing.fn.includes('fragrance'))) out += 'k';
  if (!has((it) => it.ing.flags.includes('pregnancy'))) out += 'g';
  if (!has((it) => VEGAN_NO.test(it.ing.inci))) out += 'v';
  return out;
}
