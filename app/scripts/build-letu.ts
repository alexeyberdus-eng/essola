// Turns the collected Letual catalog into what our function serves:
//   letu-index.json — compact cards (no compositions) for lists, sorting and search;
//   x/<hhh>.json    — compositions, sharded by key hash, loaded only for the cards on screen.
// Run: npx tsx scripts/build-letu.ts <idsDir> <tabsDir> <outDir>
import { createHash } from 'crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { analyze } from '../src/lib/analyze';

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

const [idsDir, tabsDir, outDir] = process.argv.slice(2);
const seen = new Set<string>();
const cards = readdirSync(idsDir)
  .filter((f) => /^ids-\d+\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(`${idsDir}/${f}`, 'utf8')) as Card[])
  .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
const comp: Record<string, string> = {};
for (const f of readdirSync(tabsDir).filter((f) => /^tabs-\d+\.json$/.test(f))) Object.assign(comp, JSON.parse(readFileSync(`${tabsDir}/${f}`, 'utf8')));
console.log('cards', cards.length, 'with composition', Object.keys(comp).length);

const index: { k: string; t: string; b: string; i: string; u: string; c: string; s: number; n: number; p: number }[] = [];
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
index.sort((a, b) => b.p - a.p);
mkdirSync(`${outDir}/x`, { recursive: true });
writeFileSync(`${outDir}/letu-index.json`, JSON.stringify(index));
for (const [h, m] of Object.entries(shards)) writeFileSync(`${outDir}/x/${h}.json`, JSON.stringify(m));
const by: Record<string, number> = {};
for (const x of index) by[x.c] = (by[x.c] || 0) + 1;
console.log('letual items', index.length, 'shards', Object.keys(shards).length, JSON.stringify(by));
