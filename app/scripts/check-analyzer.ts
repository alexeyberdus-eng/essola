/// <reference types="node" />
// Sanity checks for the INCI analyzer: run with `npm run test:analyzer`.
import assert from 'node:assert/strict';
import { analyze, SAMPLES, splitIngredients } from '../src/lib/analyze';

const [cream, shampoo, oil] = SAMPLES.map((s) => analyze(s.text));

assert.equal(cream.unknown, 0, 'cream sample should be fully recognised');
assert.ok(cream.scores.overall > shampoo.scores.overall, 'clean cream should beat sulfate shampoo');
assert.ok(shampoo.freeFrom.every((f) => f !== 'Без сульфатов'));
assert.ok(shampoo.concerns.some((c) => c.ing.inci === 'Methylisothiazolinone'));
assert.ok(oil.scores.natural > 80, 'plant oil blend should be highly natural');

// OCR noise: line breaks, hyphenation, typos, brackets, percentages.
const noisy = analyze('Состав:\nAqua (Water), Glyc-\nerin, Niacinamid 5%, Butyrospermum\nParkii (Shea) Butter, Phenoxyethanol.\nMade in France');
assert.deepEqual(
  noisy.items.map((i) => i.ing.inci),
  ['Aqua', 'Glycerin', 'Niacinamide', 'Butyrospermum Parkii Butter', 'Phenoxyethanol'],
);
assert.equal(splitIngredients('Ingredients: Alcohol Denat., Parfum').length, 2);
assert.equal(analyze('').scores.overall, 0);

for (const [i, a] of [cream, shampoo, oil].entries()) console.log(SAMPLES[i].title.padEnd(22), a.scores, a.verdict.title);
console.log('analyzer ok');
