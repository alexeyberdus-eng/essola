// «Средства с ингредиентом»: for every ingredient our analyzer knows, the products of the base that contain it.
//   npx tsx scripts/build-ingr.ts <prevDir> <outDir>
// <prevDir> holds letu-index.json, inci-index.json and the composition shards letu-x/*.json, inci-x/*.json
// downloaded from the bucket. Writes <outDir>/ingr/<slug>.json (product keys, most popular first) and ingr/index.json.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { analyze } from '../src/lib/analyze';

const [prev = '../out/prev', out = '../out/build'] = process.argv.slice(2);
const CAP = 20000;
type Card = { k: string; p?: number; s?: number; z?: 1 };

const rank = new Map<string, number>();
for (const f of ['letu-index.json', 'inci-index.json']) {
  if (!existsSync(`${prev}/${f}`)) continue;
  for (const x of JSON.parse(readFileSync(`${prev}/${f}`, 'utf8')) as Card[]) if (!x.z) rank.set(x.k, (x.p || 0) * 1000 + (x.s || 0));
}
console.log('products in the base', rank.size);

export const slugOf = (inci: string) => inci.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const lists = new Map<string, { inci: string; keys: string[] }>();
let done = 0;
for (const dir of ['letu-x', 'inci-x']) {
  if (!existsSync(`${prev}/${dir}`)) continue;
  for (const f of readdirSync(`${prev}/${dir}`)) {
    let shard: Record<string, string>;
    try {
      shard = JSON.parse(readFileSync(`${prev}/${dir}/${f}`, 'utf8'));
    } catch {
      continue;
    }
    for (const [k, text] of Object.entries(shard)) {
      if (!rank.has(k) || !text) continue;
      const seen = new Set<string>();
      for (const it of analyze(text).items) {
        if (it.match === 'unknown' || it.match === 'guess') continue;
        const slug = slugOf(it.ing.inci);
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        const l = lists.get(slug) ?? { inci: it.ing.inci, keys: [] };
        l.keys.push(k);
        lists.set(slug, l);
      }
      if (++done % 20000 === 0) console.log('compositions', done, 'ingredients', lists.size);
    }
  }
}
console.log('compositions', done, 'ingredients', lists.size);

mkdirSync(`${out}/ingr`, { recursive: true });
const index: { slug: string; inci: string; n: number }[] = [];
for (const [slug, { inci, keys }] of lists) {
  if (keys.length < 3) continue;
  keys.sort((a, b) => (rank.get(b) || 0) - (rank.get(a) || 0));
  writeFileSync(`${out}/ingr/${slug}.json`, JSON.stringify(keys.slice(0, CAP)));
  index.push({ slug, inci, n: keys.length });
}
index.sort((a, b) => b.n - a.n);
writeFileSync(`${out}/ingr-index.json`, JSON.stringify(index));
console.log('files', index.length, 'top', index.slice(0, 8).map((x) => `${x.inci} ${x.n}`).join(', '));
