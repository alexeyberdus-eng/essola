/// <reference types="node" />
// Sanity checks for the INCI analyzer: run with `npm run test:analyzer`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// Real Tesseract output for a photographed label (see src/lib/ocrHtml.ts).
const label = analyze(readFileSync(new URL('./fixture-ocr-label.txt', import.meta.url), 'utf8'));
assert.equal(label.items.length, 16);
assert.equal(label.unknown, 0);
assert.ok(!label.items.some((i) => /france/i.test(i.raw)), 'text after "Made in" must be ignored');

// Russian label read by the rus+eng OCR engine.
const ruLabel = analyze(readFileSync(new URL('./fixture-ocr-label-ru.txt', import.meta.url), 'utf8'));
assert.equal(ruLabel.items.length, 11);
assert.equal(ruLabel.unknown, 0);
assert.ok(!ruLabel.items.some((i) => /срок|изготовитель/i.test(i.raw)), 'text after the list must be ignored');
// Mixed-script OCR slip: Cyrillic look-alikes inside a Latin INCI name.
assert.equal(analyze('Ingredients: Aqua, Butyrospermum РАВКИ (Shea) Butter, Glycerin').items[1].ing.inci, 'Butyrospermum Parkii Butter');

// Garbage read from a Cyrillic label by a Latin-only OCR must not produce a verdict.
const junk = analyze('% 4 4 i ey, A z {1B se gy o p 3 p aH I A y 3 ca 9" ALITA 4, ( E \\ a, S- EJ \\ [, be SS LI 7 KOKTEV/Tb MOJ14HbIi CTEPUIM30BAHCOB, NTA TIATARMA JIETEM CTAPLLE 12 MECALLEB, MONOKO HOPMaNH30BaHHOE');
assert.ok(junk.unreadable, 'OCR junk must be flagged as unreadable');
assert.ok(!cream.unreadable && !shampoo.unreadable && !oil.unreadable && !label.unreadable);
// Russian-language labels are matched by their Russian names.
const ru = analyze('Состав: вода, глицерин, масло ши, ниацинамид, пантенол, отдушка');
assert.ok(!ru.unreadable);
assert.deepEqual(ru.items.map((i) => i.ing.inci), ['Aqua', 'Glycerin', 'Butyrospermum Parkii Butter', 'Niacinamide', 'Panthenol', 'Parfum']);

// Back label without an ingredient list (usage + manufacturer only) — must say "no list".
const noList = analyze(
  'Способ применения: нанесите на влажные волосы, распределите по всей длине, смойте. Избегайте попадания в глаза. ' +
    "Изготовитель: L'Oreal, 14 rue Royale, 75008 Paris, Франция. Импортер в РФ: ООО Лореаль, 115035, Москва, ул. Садовническая, 82. " +
    'Хранить при температуре от +5 до +25. Срок годности 36 месяцев.',
);
assert.equal(noList.recognised, 0, 'no ingredient list → nothing recognised');
assert.ok(noList.unreadable);

// List without a "Состав:" marker, surrounded by usage text — keep only the ingredient run.
const framed = analyze(
  'Подходит для ежедневного ухода, нанесите утром и вечером\nAqua, Glycerin, Niacinamide, Panthenol, Squalane, Tocopherol, Phenoxyethanol\nЛучший результат при регулярном применении, дерматологически протестировано',
);
assert.equal(framed.items[0].ing.inci, 'Aqua');
assert.equal(framed.items.length, 7);
assert.ok(!framed.unreadable);

for (const [i, a] of [cream, shampoo, oil].entries()) console.log(SAMPLES[i].title.padEnd(22), a.scores, a.verdict.title);
console.log('analyzer ok');
