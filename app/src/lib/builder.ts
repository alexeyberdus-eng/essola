import type { PhaseKey } from '../components/lab';
import { INGREDIENTS } from '../data/ingredients';
import { analyze } from './analyze';
import { phaseOf } from './phases';

export type Item = { key: string; name: string; inci: string; pct: number; phase: PhaseKey };
export type Kind = 'cream' | 'toner' | 'serum' | 'oil' | 'balm';

export const KINDS: { key: Kind; label: string }[] = [
  { key: 'cream', label: 'Крем-эмульсия' },
  { key: 'toner', label: 'Тоник' },
  { key: 'serum', label: 'Сыворотка' },
  { key: 'oil', label: 'Масло' },
  { key: 'balm', label: 'Бальзам' },
];

export const PHASE_LABEL: Record<PhaseKey, string> = {
  water: 'Водная фаза',
  oil: 'Масляная фаза',
  emulsifier: 'Эмульгаторы и загустители',
  active: 'Активы · до 40 °C',
  preservative: 'Консервант',
};
export const PHASE_ORDER: PhaseKey[] = ['water', 'oil', 'emulsifier', 'active', 'preservative'];

let seq = 0;
const it = (name: string, inci: string, pct: number, phase: PhaseKey): Item => ({ key: `i${++seq}`, name, inci, pct, phase });
const COSGARD = (pct = 1) => it('Косгард', 'Benzyl Alcohol, Dehydroacetic Acid', pct, 'preservative');

export function preset(kind: Kind): Item[] {
  switch (kind) {
    case 'cream':
      return [
        it('Вода дистиллированная', 'Aqua', 72.5, 'water'),
        it('Глицерин', 'Glycerin', 3, 'water'),
        it('Сквалан', 'Squalane', 8, 'oil'),
        it('Масло ши', 'Butyrospermum Parkii Butter', 5, 'oil'),
        it('Olivem 1000', 'Cetearyl Olivate, Sorbitan Olivate', 5, 'emulsifier'),
        it('Ниацинамид', 'Niacinamide', 3, 'active'),
        it('Пантенол', 'Panthenol', 2, 'active'),
        it('Витамин E', 'Tocopherol', 0.5, 'active'),
        COSGARD(),
      ];
    case 'toner':
      return [
        it('Гидролат розы', 'Rosa Damascena Flower Water', 60, 'water'),
        it('Вода дистиллированная', 'Aqua', 31, 'water'),
        it('Глицерин', 'Glycerin', 3, 'water'),
        it('Пантенол', 'Panthenol', 2, 'active'),
        it('Ниацинамид', 'Niacinamide', 2, 'active'),
        it('Аллантоин', 'Allantoin', 0.5, 'active'),
        it('Бетаин', 'Betaine', 0.5, 'active'),
        COSGARD(),
      ];
    case 'serum':
      return [
        it('Вода дистиллированная', 'Aqua', 84.3, 'water'),
        it('Глицерин', 'Glycerin', 5, 'water'),
        it('Ксантановая камедь', 'Xanthan Gum', 0.4, 'emulsifier'),
        it('Ниацинамид', 'Niacinamide', 5, 'active'),
        it('Гиалуронат натрия', 'Sodium Hyaluronate', 0.3, 'active'),
        it('Пантенол', 'Panthenol', 2, 'active'),
        it('Цинк PCA', 'Zinc PCA', 1, 'active'),
        COSGARD(),
      ];
    case 'oil':
      return [
        it('Сквалан', 'Squalane', 45, 'oil'),
        it('Масло жожоба', 'Simmondsia Chinensis Seed Oil', 30, 'oil'),
        it('Масло шиповника', 'Rosa Canina Fruit Oil', 20, 'oil'),
        it('Масло арганы', 'Argania Spinosa Kernel Oil', 4.5, 'oil'),
        it('Витамин E', 'Tocopherol', 0.5, 'active'),
      ];
    case 'balm':
      return [
        it('Масло ши', 'Butyrospermum Parkii Butter', 40, 'oil'),
        it('Масло сладкого миндаля', 'Prunus Amygdalus Dulcis Oil', 30, 'oil'),
        it('Пчелиный воск', 'Cera Alba', 25, 'emulsifier'),
        it('Масло касторовое', 'Ricinus Communis Seed Oil', 4.5, 'oil'),
        it('Витамин E', 'Tocopherol', 0.5, 'active'),
      ];
  }
}

/** Typical starting share when an ingredient is added from the base. */
export function newItem(inciOrName: string): Item {
  const ing = INGREDIENTS.find((i) => i.inci === inciOrName);
  const name = ing?.ru || inciOrName;
  const phase = phaseOf(ing?.fn, name);
  const pct = phase === 'water' ? 10 : phase === 'oil' ? 5 : phase === 'emulsifier' ? 3 : phase === 'preservative' ? 1 : 2;
  return it(name, ing?.inci ?? inciOrName, pct, phase);
}

export const total = (items: Item[]) => Math.round(items.reduce((a, b) => a + b.pct, 0) * 10) / 10;

export function phaseSums(items: Item[]): [PhaseKey, number][] {
  return PHASE_ORDER.map((k) => [k, items.filter((i) => i.phase === k).reduce((a, b) => a + b.pct, 0)] as [PhaseKey, number]).filter(([, v]) => v > 0);
}

export type Check = { ok: boolean; text: string; fix?: 'water' };

const LIMITS: [RegExp, number, string][] = [
  [/Niacinamide/, 5, 'Ниацинамид выше 5% чаще раздражает — хватит 2–5%'],
  [/Salicylic/, 2, 'Салициловая кислота дома — не выше 2%'],
  [/Glycolic|Lactic|Mandelic/, 10, 'Кислоты AHA дома — не выше 10%'],
  [/Phenoxyethanol/, 1, 'Феноксиэтанол разрешён до 1%'],
];

export function checks(items: Item[]): Check[] {
  const out: Check[] = [];
  const sum = total(items);
  const has = (p: string) => items.some((i) => i.phase === p && i.pct > 0);
  if (Math.abs(sum - 100) < 0.05) out.push({ ok: true, text: 'Сумма 100% — формула сбалансирована' });
  else if (sum < 100) out.push({ ok: false, text: `Добавьте ${(100 - sum).toFixed(1).replace('.', ',')}% до 100%`, fix: has('water') ? 'water' : undefined });
  else out.push({ ok: false, text: `Перебор на ${(sum - 100).toFixed(1).replace('.', ',')}% — уменьшите доли` });

  if (has('water') && !has('preservative')) out.push({ ok: false, text: 'В формуле есть вода — нужен консервант (0,5–1%)' });
  if (has('water') && has('oil') && !has('emulsifier')) out.push({ ok: false, text: 'Вода и масла без эмульгатора расслоятся' });
  if (!has('water') && has('oil')) out.push({ ok: true, text: 'Безводная формула — консервант не нужен, достаточно витамина E' });

  for (const [re, max, text] of LIMITS) {
    const hit = items.find((i) => re.test(i.inci) && i.pct > max);
    if (hit && text) out.push({ ok: false, text });
  }
  const acids = items.some((i) => /Glycolic|Lactic Acid|Salicylic|Mandelic/.test(i.inci));
  if (acids) out.push({ ok: true, text: 'pH 3,5–4,0 — рабочий диапазон для кислот' });
  else if (items.some((i) => /Niacinamide/.test(i.inci))) out.push({ ok: true, text: 'pH 5,0–6,0 — подходит ниацинамиду' });
  else if (has('water')) out.push({ ok: true, text: 'Держите pH 5,0–5,5, как у кожи' });
  return out;
}

/** Predicted Essola score: the formula is read like a label, ingredients by descending share. */
export function predict(items: Item[]) {
  const inci = [...items].sort((a, b) => b.pct - a.pct).map((i) => i.inci).join(', ');
  return analyze(`Ingredients: ${inci}`);
}

export const grams = (pct: number, volume: number) => ((pct * volume) / 100).toFixed(pct * volume < 1000 ? 2 : 1).replace('.', ',');
export const pctText = (p: number) => `${String(Math.round(p * 10) / 10).replace('.', ',')}%`;

/* Draft handed from the constructor to the recipe template screen. */
export type Draft = { kind: Kind; volume: number; items: Item[] };
let draft: Draft | null = null;
export const setDraft = (d: Draft | null) => {
  draft = d;
};
export const takeDraft = () => draft;
