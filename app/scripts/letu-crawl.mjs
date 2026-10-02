// Letual catalog collector (done with Letual's permission). Plain Node 20, no browser.
//   node scripts/letu-crawl.mjs list out/ids.json            — walk categories, collect product cards
//   node scripts/letu-crawl.mjs tabs out/ids.json 3 10 out/  — fetch compositions for shard 3 of 10
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

const BASE = 'https://www.letu.ru';
const H = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'Accept-Language': 'ru-RU',
};
const CAP = 10000; // the searcher returns at most this many products per query
const SIZE = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(url, body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: H, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      await sleep(1500 * (i + 1));
    } catch {
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}

const bodyFor = (path, page, size = SIZE) => ({
  locale: 'ru', cityId: '8113', shippingRegionId: '330001', sort: 'default',
  filtersType: { switch: [], range: [], multiselect: [] },
  page: { number: page, size }, requestorInfo: [{ type: 'plp_category', url: path }], noAutocorrect: false, smartSearchMarker: false,
});
const search = (path, page, size) => req(`${BASE}/api/searcher/v1/search?pushSite=storeMobileRU`, bodyFor(path, page, size));
const filters = (path) => req(`${BASE}/api/searcher/v1/filters?pushSite=storeMobileRU`, bodyFor(path, 1, 1));

// Finds the category node for `path` in the filters tree and returns its children paths.
function childrenOf(tree, path) {
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (n.path === path.replace(/^\/browse/, '')) return n.children || [];
      const r = walk(n.children);
      if (r) return r;
    }
    return null;
  };
  return (walk(tree) || []).map((c) => `/browse${c.path}`);
}

async function list(out) {
  const roots = new Set(['/browse/uhod-za-kozhei', '/browse/volosy', '/browse/makiyazh', '/browse/parfyumeriya', '/browse/dlya-muzhchin', '/browse/aptechnaya-kosmetika', '/browse/korejskaya-kosmetika', '/browse/organicheskaya-kosmetika', '/browse/dlya-doma']);
  const f0 = await filters('/browse/uhod-za-kozhei');
  for (const n of f0?.categories || []) roots.add(`/browse${n.path}`);
  const products = new Map();
  const queue = [...roots];
  const done = new Set();
  while (queue.length) {
    const path = queue.shift();
    if (done.has(path)) continue;
    done.add(path);
    const first = await search(path, 1, SIZE);
    const total = first?.totalProducts ?? 0;
    if (!total) continue;
    if (total >= CAP) {
      const f = await filters(path);
      const kids = childrenOf(f?.categories, path);
      if (kids.length) {
        console.log('split', path, total, '→', kids.length);
        queue.push(...kids);
        continue;
      }
    }
    const pages = Math.ceil(Math.min(total, CAP) / SIZE);
    console.log('walk', path, total, pages, 'pages');
    for (let p = 1; p <= pages; p++) {
      const data = p === 1 ? first : await search(path, p, SIZE);
      for (const x of data?.products || []) {
        if (products.has(x.id)) continue;
        products.set(x.id, { id: x.id, t: x.displayName, b: x.brandName || '', cat: x.categoryName || '', path, img: x.images?.[0] || '', url: x.url || '', r: x.rating || 0, n: x.countReview || 0 });
      }
      await sleep(150);
    }
    console.log('  products so far', products.size);
  }
  writeFileSync(out, JSON.stringify([...products.values()]));
  console.log('TOTAL products', products.size);
}

async function tabs(idsFile, shard, of, outDir) {
  const all = JSON.parse(readFileSync(idsFile, 'utf8'));
  const mine = all.filter((_, i) => i % of === shard);
  const res = {};
  let i = 0, got = 0;
  const worker = async () => {
    while (i < mine.length) {
      const p = mine[i++];
      const j = await req(`${BASE}/s/api/product/v2/product-detail/${p.id}/tabs?locale=ru-RU&pushSite=storeMobileRU`);
      const m = JSON.stringify(j || {}).match(/"composition"\s*:\s*"((?:[^"\\]|\\.){10,6000})"/);
      if (m) {
        res[p.id] = JSON.parse(`"${m[1]}"`).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        got++;
      }
      if (i % 500 === 0) console.log(`shard ${shard}: ${i}/${mine.length}, with composition ${got}`);
      await sleep(120);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/tabs-${shard}.json`, JSON.stringify(res));
  console.log(`shard ${shard} done: ${mine.length} products, ${got} with composition`);
}

const [cmd, a, b, c, d] = process.argv.slice(2);
if (cmd === 'list') await list(a);
else if (cmd === 'tabs') await tabs(a, Number(b), Number(c), d);
else console.log('usage: list <out> | tabs <ids> <shard> <of> <outDir>');
