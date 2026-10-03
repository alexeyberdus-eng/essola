// Turns the collected Letual catalog into what our function serves:
//   letu-index.json — compact cards (no compositions) for lists, sorting and search;
//   x/<hhh>.json    — compositions, sharded by key hash, loaded only for the cards on screen.
// Run: npx tsx scripts/build-letu.ts <idsDir> <tabsDir> <outDir> [prevDir]
// prevDir (optional): the base already in the bucket (letu-index.json + x/*.json); its items are kept and merged.
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { analyze } from '../src/lib/analyze';
import { signature } from '../src/lib/signature';

const BASE = 'https://www.letu.ru';
const CATS: [string, RegExp][] = [
  ['perfume', /parfyum/],
  ['makeup', /makiyazh/],
  ['sunscreens', /solncezashch|spf|zagar/],
  ['shampoos', /shampun/],
  ['conditioners', /balzam|kondicion|opolask/],
  ['hair-masks', /volos/],
  ['serums', /syvorot/],
  ['eye-creams', /glaz/],
  ['face-cleansers', /ochishch|umyvan|demakiyazh|micel/],
  ['face-masks', /mask/],
  ['toners', /tonik|toner/],
  ['lip-balms', /gub/],
  ['face-creams', /lits/],
  ['deodorants', /dezodor|antiperspir/],
  ['shower-gels', /dush|vann|mylo/],
  ['hand-creams', /ruk|nogt|stop/],
  ['toothpastes', /zub|polost/],
  ['body-lotions', /tel/],
];
const catOf = (path: string) => CATS.find(([, re]) => re.test(path))?.[0] ?? 'other';
export const shardOf = (key: string) => createHash('sha1').update(key).digest('hex').slice(0, 3);

type Card = { id: string; t: string; b: string; cat: string; path: string; img: string; url: string; r: number; n: number };

const [idsDir, tabsDir, outDir, prevDir] = process.argv.slice(2);
const seen = new Set<string>();
const cards = readdirSync(idsDir)
  .filter((f) => /^ids-\d+\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(`${idsDir}/${f}`, 'utf8')) as Card[])
  .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
const comp: Record<string, string> = {};
for (const f of readdirSync(tabsDir).filter((f) => /^tabs-\d+\.json$/.test(f))) Object.assign(comp, JSON.parse(readFileSync(`${tabsDir}/${f}`, 'utf8')));
console.log('cards', cards.length, 'with composition', Object.keys(comp).length);

const index: { k: string; t: string; b: string; i: string; u: string; c: string; s: number; n: number; p: number; g?: string; z?: 1 }[] = [];
const shards: Record<string, Record<string, string>> = {};
for (const c of cards) {
  const text = comp[c.id];
  if (!text || text.length < 20) continue;
  const a = analyze(text);
  if (a.unreadable || a.items.length < 3) continue;
  const k = `letu:${c.id}`;
  index.push({ k, t: c.t.slice(0, 140), b: c.b.slice(0, 60), i: c.img ? (c.img.startsWith('http') ? c.img : BASE + c.img) : '', u: c.url ? BASE + c.url : '', c: catOf(c.path), s: a.scores.overall, n: a.items.length, p: c.n });
  (shards[shardOf(k)] ??= {})[k] = text.slice(0, 3000);
}
// Keep what is already in the base: earlier sections and products not collected this time.
if (prevDir && existsSync(`${prevDir}/letu-index.json`)) {
  const have = new Set(index.map((x) => x.k));
  const prev = JSON.parse(readFileSync(`${prevDir}/letu-index.json`, 'utf8')) as typeof index;
  let kept = 0;
  let lost = 0;
  for (const x of prev) {
    if (have.has(x.k)) continue;
    // A card without a composition is kept as is (it has no shard), unless this run found its composition.
    if (x.z) {
      index.push(x);
      kept++;
      continue;
    }
    const h = shardOf(x.k);
    // A card whose composition file is missing is dropped, so the next run fetches it again.
    if (!existsSync(`${prevDir}/x/${h}.json`)) {
      lost++;
      continue;
    }
    index.push(x);
    kept++;
    if (!shards[h]) shards[h] = {};
  }
  if (lost) console.log('dropped (composition file missing), will be fetched again', lost);
  for (const h of Object.keys(shards)) {
    const f = `${prevDir}/x/${h}.json`;
    if (existsSync(f)) shards[h] = { ...(JSON.parse(readFileSync(f, 'utf8')) as Record<string, string>), ...shards[h] };
  }
  console.log('kept from the existing base', kept);
}
// Products whose composition Letual doesn't publish (or we couldn't read): still listed with name, photo and link,
// marked z:1 so the app shows "состав недоступен". A later run that finds the composition replaces the card.
{
  const have = new Set(index.map((x) => x.k));
  let none = 0;
  for (const c of cards) {
    const k = `letu:${c.id}`;
    if (have.has(k)) continue;
    have.add(k);
    index.push({ k, t: c.t.slice(0, 140), b: c.b.slice(0, 60), i: c.img ? (c.img.startsWith('http') ? c.img : BASE + c.img) : '', u: c.url ? BASE + c.url : '', c: catOf(c.path), s: 0, n: 0, p: c.n, z: 1 });
    none++;
  }
  console.log('without composition (listed with a link)', none);
}
// Composition fingerprints for "analogs by composition" (recomputed for every card, old ones included).
{
  const texts: Record<string, string> = Object.assign({}, ...Object.values(shards));
  let withSig = 0;
  for (const x of index) {
    const t = texts[x.k];
    if (!t) continue;
    x.g = signature(analyze(t));
    if (x.g) withSig++;
  }
  console.log('fingerprints', withSig);
}
index.sort((a, b) => b.p - a.p);
mkdirSync(`${outDir}/x`, { recursive: true });
writeFileSync(`${outDir}/letu-index.json`, JSON.stringify(index));
for (const [h, m] of Object.entries(shards)) writeFileSync(`${outDir}/x/${h}.json`, JSON.stringify(m));
// The same base as a table for the owner (Excel opens it: UTF-8 with BOM, ";" between columns).
const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const allText: Record<string, string> = Object.assign({}, ...Object.values(shards));
const rows = index.map((x) => [x.t, x.b, x.c, x.z ? '' : x.s, x.n, x.p, x.u, x.i, allText[x.k] ?? 'состав недоступен'].map(cell).join(';'));
writeFileSync(`${outDir}/letu.csv`, '\uFEFF' + ['Название;Бренд;Категория;Оценка;Ингредиентов;Отзывов;Ссылка;Фото;Состав', ...rows].join('\r\n'));
const by: Record<string, number> = {};
for (const x of index) by[x.c] = (by[x.c] || 0) + 1;
console.log('letual items', index.length, 'shards', Object.keys(shards).length, JSON.stringify(by));
