import type { Analysis, AnalyzedItem } from './analyze';
import type { Concern, Profile } from './profile';
import { CONCERN_LABEL } from './profile';

export type Reason = { tone: 'bad' | 'warn' | 'good'; text: string; delta: number };
export type Personal = { score: number; verdict: 'good' | 'caution' | 'avoid'; reasons: Reason[]; label: string };

// Actives that work for each concern, and things that make it worse.
const HELPS: Record<Concern, RegExp> = {
  acne: /salicylic|niacinamide|zinc|azelaic|sulfur|melaleuca|benzoyl|mandelic|capryloyl salicylic|betaine salicylate|retin/i,
  pigment: /ascorb|niacinamide|arbutin|tranexamic|azelaic|kojic|glycyrrhiza|licorice|morus alba|glycolic|lactic|mandelic|acetyl glucosamine|retin/i,
  aging: /retin|peptide|bakuchiol|ascorb|adenosine|ubiquinone|ferulic|resveratrol|tocopherol|ceramide|hyaluron/i,
  dehydration: /hyaluron|glycerin|panthenol|ceramide|urea|polyglutam|betaine|sodium pca|squalane|trehalose|saccharide isomerate|beta-glucan/i,
  redness: /centella|madecassoside|asiaticoside|niacinamide|azelaic|bisabolol|allantoin|panthenol|glycyrrhizate|colloidal oatmeal|avena|beta-glucan|ectoin/i,
  pores: /salicylic|niacinamide|zinc|kaolin|bentonite|capryloyl salicylic|betaine salicylate|retin/i,
  dullness: /ascorb|glycolic|lactic|mandelic|gluconolactone|niacinamide|galactomyces|lactobionic/i,
};
const HURTS: Partial<Record<Concern, (it: AnalyzedItem) => string | null>> = {
  acne: (it) => (it.ing.com >= 3 ? 'может забивать поры' : null),
  pores: (it) => (it.ing.com >= 3 ? 'может забивать поры' : null),
  redness: (it) => (/menthol|camphor|eucalyptus|mentha/i.test(it.ing.inci) || it.ing.flags.includes('drying-alcohol') ? 'может усиливать покраснение' : null),
};

const VEGAN_NO = /lanolin|cera alba|beeswax|^mel$|honey|carmine|collagen|elastin|snail|silk|sericin|keratin|royal jelly|propolis|squalene|milk|lac$/i;

const name = (it: AnalyzedItem) => it.ing.ru || it.raw;
const list = (items: AnalyzedItem[]) => [...new Set(items.map(name))].slice(0, 3).join(', ');

/**
 * Personal score: the general score adjusted for this person's skin, goals, pregnancy, intolerances and preferences.
 * Every adjustment comes with a plain reason so the user sees why.
 */
export function personalize(a: Analysis, p: Profile): Personal | null {
  if (!p.done) return null;
  const items = a.items.filter((it) => it.match === 'exact' || it.match === 'fuzzy');
  const reasons: Reason[] = [];
  const add = (tone: Reason['tone'], text: string, delta: number) => reasons.push({ tone, text, delta });
  const pick = (f: (it: AnalyzedItem) => boolean) => items.filter(f);

  const preg = pick((it) => it.ing.flags.includes('pregnancy'));
  if (p.pregnant && preg.length) add('bad', `Не рекомендуют при беременности и ГВ: ${list(preg)}`, -30);

  const own = pick((it) => p.avoid.some((x) => x.toLowerCase() === it.ing.inci.toLowerCase()));
  if (own.length) add('bad', `Вы отметили, что не переносите: ${list(own)}`, -30);

  if (p.sensitive) {
    const irritants = pick((it) => it.ing.flags.some((f) => f === 'allergen' || f === 'irritant' || f === 'drying-alcohol') || it.ing.fn.includes('fragrance'));
    if (irritants.length) add('warn', `Для чувствительной кожи: ${list(irritants)} могут раздражать`, -Math.min(15, irritants.length * 5));
  }
  if (p.skin === 'dry') {
    const dry = pick((it) => it.ing.flags.includes('drying-alcohol') || it.ing.flags.includes('sulfate'));
    if (dry.length) add('warn', `Для сухой кожи: ${list(dry)} могут сушить`, -8);
  }
  if (p.skin === 'oily' || p.skin === 'combo') {
    const heavy = pick((it) => it.ing.com >= 3);
    if (heavy.length) add('warn', `Для жирной кожи: ${list(heavy)} могут забивать поры`, -Math.min(12, heavy.length * 4));
  }

  for (const c of p.concerns) {
    const good = pick((it) => HELPS[c].test(it.ing.inci));
    if (good.length) add('good', `${CONCERN_LABEL[c]}: помогают ${list(good)}`, Math.min(8, good.length * 4));
    const hurt = HURTS[c];
    if (hurt) {
      const bad = items.filter((it) => hurt(it));
      const said = reasons.some((r) => bad.some((it) => r.text.includes(name(it))) && r.tone !== 'good');
      if (bad.length && c !== 'pores' && !said) add('warn', `${CONCERN_LABEL[c]}: ${list(bad)} — ${hurt(bad[0])}`, -6);
    }
  }

  if (p.hair.some((h) => h === 'dry' || h === 'colored' || h === 'damaged')) {
    const sulf = pick((it) => it.ing.flags.includes('sulfate'));
    if (sulf.length) add('warn', `Для ${p.hair.includes('colored') ? 'окрашенных' : 'сухих'} волос: сульфаты (${list(sulf)}) вымывают цвет и сушат`, -8);
  }

  const prefRules: [Profile['prefs'][number], (it: AnalyzedItem) => boolean, string][] = [
    ['noFragrance', (it) => it.ing.fn.includes('fragrance'), 'Есть отдушка или ароматизаторы'],
    ['noSilicone', (it) => it.ing.flags.includes('silicone'), 'Есть силиконы'],
    ['noSulfate', (it) => it.ing.flags.includes('sulfate'), 'Есть сульфаты'],
    ['noParaben', (it) => it.ing.flags.includes('paraben'), 'Есть парабены'],
    ['vegan', (it) => VEGAN_NO.test(it.ing.inci), 'Не веганское'],
    ['natural', (it) => it.ing.origin === 'synthetic' && it.ing.risk >= 1, 'Есть синтетические компоненты с риском'],
  ];
  for (const [pref, f, text] of prefRules) {
    if (!p.prefs.includes(pref)) continue;
    const hit = pick(f);
    if (hit.length) add('warn', `${text}: ${list(hit)}`, -6);
  }

  const delta = reasons.reduce((s, r) => s + r.delta, 0);
  const score = Math.max(0, Math.min(100, Math.round(a.scores.overall + delta)));
  const verdict: Personal['verdict'] = reasons.some((r) => r.tone === 'bad') ? 'avoid' : reasons.some((r) => r.tone === 'warn') || score < 50 ? 'caution' : 'good';
  const label = verdict === 'avoid' ? 'Вам не подходит' : verdict === 'caution' ? 'Подходит с оговорками' : 'Вам подходит';
  reasons.sort((x, y) => ({ bad: 0, warn: 1, good: 2 })[x.tone] - ({ bad: 0, warn: 1, good: 2 })[y.tone]);
  return { score, verdict, reasons, label };
}
