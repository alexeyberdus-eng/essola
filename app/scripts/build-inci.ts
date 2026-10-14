// Turns the collected INKEEDecoder catalog (collected with the site owner's permission) into what our function serves,
// in the same layout as the Letual base: inci-index.json (cards) + x/<hhh>.json (compositions by key hash).
// Run: npx tsx scripts/build-inci.ts <fetchedDir> <outDir> [prevDir]
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { analyze } from '../src/lib/analyze';
import { signature } from '../src/lib/signature';
import { productTags } from '../src/lib/tags';

// No shop categories here: the kind of product is read from its English name.
const CATS: [string, RegExp][] = [
  ['sunscreens', /\bspf\b|sunscreen|sun (cream|lotion|fluid|stick|milk)|uv (fluid|defen)/i],
  ['shampoos', /shampoo/i],
  ['conditioners', /conditioner/i],
  ['hair-masks', /hair (mask|oil|serum|treatment|cream)|scalp/i],
  ['eye-creams', /\beye\b/i],
  ['lip-balms', /\blip\b/i],
  ['hand-creams', /\bhand\b|\bnail\b|\bfoot\b/i],
  ['deodorants', /deodorant|antiperspirant/i],
  ['face-cleansers', /cleans|wash|micellar|makeup remover|cleansing/i],
  ['toners', /toner|essence|mist/i],
  ['serums', /serum|ampoule|booster|concentrate/i],
  ['face-masks', /mask|peel/i],
  ['shower-gels', /shower|body wash|bath/i],
  ['body-lotions', /body/i],
  ['makeup', /foundation|concealer|mascara|lipstick|blush|primer|powder|bronzer|eyeliner|palette|tint/i],
  ['face-creams', /cream|moistur|gel|lotion|balm|emulsion/i],
];
const catOf = (t: string) => CATS.find(([, re]) => re.test(t))?.[0] ?? 'other';
const shardOf = (key: string) => createHash('sha1').update(key).digest('hex').slice(0, 3);

type Raw = { b: string; t: string; i: string; x: string };
type Card = { k: string; t: string; b: string; i: string; u: string; c: string; s: number; n: number; p: number; g?: string; m?: string };

const [fetchedDir, outDir, prevDir] = process.argv.slice(2);
const raw: Record<string, Raw> = {};
for (const f of readdirSync(fetchedDir).filter((f) => /^inci-\d+\.json$/.test(f))) Object.assign(raw, JSON.parse(readFileSync(`${fetchedDir}/${f}`, 'utf8')));
console.log('fetched products', Object.keys(raw).length);

const index: Card[] = [];
const shards: Record<string, Record<string, string>> = {};
for (const [slug, r] of Object.entries(raw)) {
  if (!r.t || !r.x || r.x.length < 20) continue;
  const a = analyze(r.x);
  if (a.unreadable || a.items.length < 3) continue;
  const k = `inci:${slug}`;
  index.push({ k, t: r.t.slice(0, 140), b: r.b.slice(0, 60), i: r.i, u: '', c: catOf(r.t), s: a.scores.overall, n: a.items.length, p: 0, g: signature(a), m: productTags(a) });
  (shards[shardOf(k)] ??= {})[k] = r.x.slice(0, 3000);
}
// Keep what an earlier run collected.
if (prevDir && existsSync(`${prevDir}/inci-index.json`)) {
  const have = new Set(index.map((x) => x.k));
  const prev = JSON.parse(readFileSync(`${prevDir}/inci-index.json`, 'utf8')) as Card[];
  let kept = 0;
  for (const x of prev) {
    if (have.has(x.k) || !existsSync(`${prevDir}/x/${shardOf(x.k)}.json`)) continue;
    index.push(x);
    kept++;
    shards[shardOf(x.k)] ??= {};
  }
  for (const h of Object.keys(shards)) {
    const f = `${prevDir}/x/${h}.json`;
    if (existsSync(f)) shards[h] = { ...(JSON.parse(readFileSync(f, 'utf8')) as Record<string, string>), ...shards[h] };
  }
  console.log('kept from the existing base', kept);
}
mkdirSync(`${outDir}/x`, { recursive: true });
writeFileSync(`${outDir}/inci-index.json`, JSON.stringify(index));
for (const [h, m] of Object.entries(shards)) writeFileSync(`${outDir}/x/${h}.json`, JSON.stringify(m));
const by: Record<string, number> = {};
for (const x of index) by[x.c] = (by[x.c] || 0) + 1;
console.log('inci items', index.length, 'shards', Object.keys(shards).length, JSON.stringify(by));
