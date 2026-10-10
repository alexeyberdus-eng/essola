// INKEEDecoder (incidecoder.com) catalog, collected with the site owner's permission.
//   node inci-crawl.mjs pages                         → prints the number of list pages (last line)
//   node inci-crawl.mjs list <from> <to> <out.json>   → product slugs from list pages [from, to)
//   node inci-crawl.mjs fetch <idsDir> <shard> <of> <outDir>  → brand, name, photo and ingredients for one shard
// Polite by design: a couple of requests at a time with pauses, retries on errors.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://incidecoder.com';
const UA = 'Mozilla/5.0 (compatible; EssolaBot/1.0; +https://essola.ru)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(path) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(BASE + path, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
      if (i === 0) console.error('HTTP', r.status, path);
    } catch {}
    await sleep(2000 * (i + 1));
  }
  return null;
}

const slugsOf = (html) => [...new Set([...(html || '').matchAll(/href="\/products\/([a-z0-9-]+)"/g)].map((m) => m[1]).filter((s) => !['new', 'create', 'all'].includes(s)))];

async function pages() {
  // The list has no "last page" link: find it by halving the range.
  let lo = 1;
  let hi = 20000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const n = slugsOf(await page(`/products/all?offset=${mid}`)).length;
    console.error('offset', mid, n);
    if (n) lo = mid;
    else hi = mid;
    await sleep(300);
  }
  console.log(lo + 1);
}

async function list(from, to, out) {
  const all = new Set();
  for (let p = from; p < to; p++) {
    for (const s of slugsOf(await page(p === 0 ? '/products/all' : `/products/all?offset=${p}`))) all.add(s);
    if (p % 100 === 0) {
      console.log('page', p, 'slugs', all.size);
      writeFileSync(out, JSON.stringify([...all]));
    }
    await sleep(250);
  }
  writeFileSync(out, JSON.stringify([...all]));
  console.log('pages', from, '-', to, 'slugs', all.size);
}

const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

function parse(html) {
  const brand = text(html.match(/id="product-brand-title"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '').replace(/^#/, '');
  const title = text(html.match(/id="product-title"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '');
  const img = html.match(/id="product-main-image"[\s\S]{0,400}?src="([^"]+)"/)?.[1] ?? '';
  const block = html.split('id="showmore-section-ingredlist-short"')[1]?.split('id="showmore-section-ingredlist-long"')[0] ?? '';
  const ingredients = [...block.matchAll(/class="ingred-link[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => text(m[1])).filter(Boolean);
  return { b: brand, t: title, i: img, x: [...new Set(ingredients)].join(', ') };
}

async function fetchShard(idsDir, shard, of, outDir) {
  const seen = new Set();
  const all = readdirSync(idsDir)
    .filter((f) => /^ids-\d+\.json$/.test(f))
    .flatMap((f) => JSON.parse(readFileSync(`${idsDir}/${f}`, 'utf8')))
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
  const known = new Set(process.env.KNOWN_IDS && existsSync(process.env.KNOWN_IDS) ? readFileSync(process.env.KNOWN_IDS, 'utf8').split('\n').filter(Boolean) : []);
  const mine = all.filter((s) => !known.has(s)).filter((_, i) => i % of === shard);
  console.log(`shard ${shard}: ${mine.length} products to fetch, ${known.size} already in the base`);
  mkdirSync(outDir, { recursive: true });
  const res = {};
  let i = 0;
  let got = 0;
  const save = () => writeFileSync(`${outDir}/inci-${shard}.json`, JSON.stringify(res));
  const worker = async () => {
    while (i < mine.length) {
      const slug = mine[i++];
      const html = await page(`/products/${slug}`);
      if (html) {
        const p = parse(html);
        if (p.t && p.x) {
          res[slug] = p;
          got++;
        }
      }
      if (i % 500 === 0) {
        console.log(`shard ${shard}: ${i}/${mine.length}, with composition ${got}`);
        save();
      }
      await sleep(200);
    }
  };
  await Promise.all([worker(), worker()]);
  save();
  console.log(`shard ${shard} done: ${mine.length} products, ${got} with composition`);
}

const [cmd, a, b, c, d] = process.argv.slice(2);
if (cmd === 'pages') await pages();
else if (cmd === 'list') await list(Number(a), Number(b), c);
else if (cmd === 'fetch') await fetchShard(a, Number(b), Number(c), d);
else console.error('usage: pages | list <from> <to> <out> | fetch <idsDir> <shard> <of> <outDir>');
