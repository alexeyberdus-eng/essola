import { INGREDIENTS } from '../data/ingredients';
import { grams, Item, Kind } from './builder';

// Step-by-step making order for a builder formula, from the phases and roles of its ingredients.

const byInci = new Map(INGREDIENTS.map((i) => [i.inci.toLowerCase(), i]));
const fnOf = (it: Item) => byInci.get((it.inci || '').toLowerCase())?.fn ?? [];
// Things that must not be heated: added to the cooled mix at 40 °C or below.
const COLD = /hyaluron|ascorb|retin|peptide|bakuchiol|tocopherol|panthenol|niacinamide|allantoin|extract|ferment|oil$|parfum|centella|madecassoside|urea|lactic|glycolic|salicylic|azelaic|tranexamic|arbutin|caffeine|ceramide/i;
const ESSENTIAL = /(leaf|peel|flower|bark|seed|herb) oil$|^parfum|эфирн/i;

const list = (xs: Item[], volume: number) => xs.map((i) => `${i.name} — ${grams(i.pct, volume)} г`).join(', ');

export function makeSteps(kind: Kind, items: Item[], volume: number): string[] {
  if (!items.length) return [];
  const pres = items.filter((i) => i.phase === 'preservative');
  const essential = items.filter((i) => ESSENTIAL.test(`${i.inci} ${i.name}`));
  const rest = items.filter((i) => !pres.includes(i) && !essential.includes(i));
  const humectant = (i: Item) => fnOf(i).includes('humectant') && !COLD.test(i.inci);
  const thick = (i: Item) => fnOf(i).includes('thickener') && !fnOf(i).includes('emollient');
  const waterPhase = rest.filter((i) => i.phase === 'water' || (i.phase === 'active' && humectant(i)));
  const oilPhase = rest.filter((i) => i.phase === 'oil' || (i.phase === 'emulsifier' && !thick(i)));
  const gums = rest.filter((i) => i.phase === 'emulsifier' && thick(i));
  const cold = rest.filter((i) => !waterPhase.includes(i) && !oilPhase.includes(i) && !gums.includes(i));
  const steps: string[] = ['Продезинфицируйте посуду, лопатку и тару спиртом 70%, дайте высохнуть. Взвешивайте на весах с точностью 0,01 г.'];

  const finish = () => {
    if (cold.length) steps.push(`При 40 °C и ниже введите по одному, перемешивая после каждого: ${list(cold, volume)}.`);
    if (essential.length) steps.push(`Добавьте ароматические компоненты в остывшую смесь: ${list(essential, volume)}.`);
    if (pres.length) steps.push(`Введите консервант: ${list(pres, volume)}. Перемешайте 1–2 минуты.`);
  };

  if (kind === 'oil' || (!waterPhase.length && !oilPhase.some((i) => fnOf(i).includes('thickener')) && !gums.length)) {
    const solid = oilPhase.filter((i) => /butter|cera|wax|воск|ши|какао/i.test(`${i.inci} ${i.name}`));
    const liquid = oilPhase.filter((i) => !solid.includes(i));
    if (solid.length) steps.push(`Растопите на водяной бане твёрдые компоненты: ${list(solid, volume)}.`);
    if (liquid.length) steps.push(`${solid.length ? 'Снимите с огня и добавьте' : 'Смешайте в стеклянном стакане'} масла: ${list(liquid, volume)}.`);
    finish();
    steps.push('Перелейте во флакон из тёмного стекла и подпишите дату приготовления.');
    return steps;
  }
  if (kind === 'balm' || !waterPhase.length) {
    const solid = oilPhase.filter((i) => /butter|cera|wax|воск|ши|какао|alcohol/i.test(`${i.inci} ${i.name}`));
    const liquid = oilPhase.filter((i) => !solid.includes(i));
    if (solid.length) steps.push(`Растопите на водяной бане до 70 °C: ${list(solid, volume)}.`);
    if (liquid.length) steps.push(`Снимите с огня и вмешайте жидкие масла: ${list(liquid, volume)}.`);
    steps.push('Остудите до 45 °C, помешивая.');
    finish();
    steps.push('Разлейте в баночки или тубы и оставьте застывать при комнатной температуре 2–3 часа.');
    return steps;
  }
  const emulsion = kind === 'cream' || oilPhase.length > 0;
  if (gums.length) steps.push(`Распределите загуститель в части глицерина или пропандиола, чтобы не было комков: ${list(gums, volume)}.`);
  steps.push(`Водная фаза: ${list(waterPhase, volume)}.${gums.length ? ' Влейте её к загустителю и перемешайте до гладкого геля.' : ''}${emulsion ? ' Нагрейте до 70–75 °C.' : ''}`);
  if (emulsion && oilPhase.length) {
    steps.push(`Масляная фаза: ${list(oilPhase, volume)}. Нагрейте до 70–75 °C, пока всё не расплавится.`);
    steps.push('Влейте масляную фазу в водную и взбивайте мини-миксером 2–3 минуты до однородной эмульсии.');
    steps.push('Помешивайте, пока эмульсия не остынет до 40 °C.');
  }
  finish();
  steps.push(`Проверьте pH: для кожи нужно 4,5–5,5. Перелейте в продезинфицированную тару${emulsion ? ' и оставьте на сутки: эмульсия загустеет' : ''}.`);
  return steps;
}
