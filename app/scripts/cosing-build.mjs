// CosIng — the European Commission's cosmetic ingredient database (© European Union, reuse with attribution,
// Commission Decision 2011/833/EU). Builds one lookup: INCI name → functions and EU Annex entries.
//   node cosing-build.mjs <outDir>
// Polite: one request at a time with a pause; about 350 requests in all, no retries on rejected queries.
import { mkdirSync, writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (compatible; EssolaBot/1.0; +https://essola.ru)';
const SEARCH = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=285a77fd-1257-4271-8507-f0c6b2961203';
const ANNEX = 'https://api.tech.ec.europa.eu/cosing20/1.0/api/annexes';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = process.argv[2] || 'out';
mkdirSync(out, { recursive: true });

// Only network errors and 5xx are retried: a 4xx is a bad query, and repeating it just hammers the service.
async function page(query, n, size) {
  for (let i = 0; i < 3; i++) {
    try {
      const fd = new FormData();
      fd.append('query', new Blob([JSON.stringify(query)], { type: 'application/json' }));
      const r = await fetch(`${SEARCH}&text=*&pageSize=${size}&pageNumber=${n}`, { method: 'POST', body: fd, headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.json();
      console.error('HTTP', r.status, n);
      if (r.status < 500) return null;
    } catch (e) {
      console.error('error', String(e).slice(0, 80));
    }
    await sleep(4000 * (i + 1));
  }
  return null;
}

async function collect(query, seen) {
  const size = 100;
  for (let n = 1; n <= 100; n++) {
    const j = await page(query, n, size);
    const rows = j?.results ?? [];
    for (const r of rows) seen.set(r.metadata?.substanceId?.[0] || r.reference, r.metadata || {});
    if (rows.length < size) return;
    await sleep(250);
  }
}

// The service returns at most 10 000 results per query, so the inventory is read in ranges of substance id,
// each split in two until it fits (the only partition filter the search accepts, see cosing-probe.yml).
const ING = { terms: { itemType: ['ingredient'] } };
const ranged = (lo, hi) => ({ bool: { must: [ING, { range: { substanceId: { gte: String(lo), lte: String(hi) } } }] } });
const count = async (q) => (await page(q, 1, 1))?.totalResults ?? -1;
const total = await count({ bool: { must: [ING] } });
console.log('total', total);
if (total < 1000) throw new Error('search service is not answering');
const seen = new Map();
let inRanges = 0;
async function range(lo, hi) {
  const n = await count(ranged(lo, hi));
  if (n <= 0) return;
  if (n > 9500 && hi > lo) {
    const mid = Math.floor((lo + hi) / 2);
    await range(lo, mid);
    await range(mid + 1, hi);
    return;
  }
  inRanges += n;
  await collect(ranged(lo, hi), seen);
  console.log('range', lo, hi, n, '→', seen.size);
}
await range(0, 2_000_000);
console.log('inventory', seen.size, 'of', total, '(in id ranges', inRanges, ')');

// Annex tables: reference → conditions (product type, maximum concentration, warnings).
const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
};
const KIND = { II: 'banned', III: 'restricted', IV: 'colorant', V: 'preservative', VI: 'uv' };
const annex = {};
const byName = {};
for (const a of ['II', 'III', 'IV', 'V', 'VI']) {
  const r = await fetch(`${ANNEX}/${a}/export-csv`, { headers: { 'User-Agent': UA } });
  const rows = parseCsv(await r.text());
  const head = rows.findIndex((x) => x[0] === 'Reference Number');
  const cols = rows[head];
  const col = (re) => cols.findIndex((c) => re.test(c));
  const [cRef, cType, cMax, cOther, cWarn] = [col(/^Reference Number/), col(/Product Type/), col(/Maximum concentration/), col(/^Other$/), col(/Wording of conditions/)];
  const cNames = [col(/Common Ingredients Glossary/), col(/Identified INGREDIENTS/), col(/^Chemical name/)].filter((i) => i >= 0);
  let n = 0;
  for (const x of rows.slice(head + 1)) {
    if (!x[cRef]) continue;
    const clip = (i) => (i >= 0 ? String(x[i] || '').replace(/\s+/g, ' ').trim().slice(0, 300) : '');
    const entry = { r: `${a}/${x[cRef].trim()}`, k: KIND[a], p: clip(cType), m: clip(cMax), o: clip(cOther), w: clip(cWarn) };
    annex[entry.r] = entry;
    // Names the row covers (INCI glossary names, identified ingredients): the ingredient lookup is by these.
    for (const ci of cNames)
      for (const nm of String(x[ci] || '').split(/\s*[;,]\s*(?![^()]*\))|\n/)) {
        const key = nm.toLowerCase().replace(/\s+/g, ' ').trim();
        if (key.length > 2 && key.length < 120 && key !== '-') (byName[key] ??= []).push(entry);
      }
    n++;
  }
  console.log('annex', a, n);
  await sleep(500);
}

const index = {};
let withAnnex = 0;
for (const m of seen.values()) {
  const name = String(m.inciName?.[0] || '').trim();
  if (!name) continue;
  const refs = (m.annexNo || []).flatMap((s) => String(s).split(/[,;]\s*/)).map((s) => s.trim()).filter(Boolean);
  const found = [...refs.map((r) => annex[r]).filter(Boolean), ...(byName[name.toLowerCase().replace(/\s+/g, ' ')] || [])];
  const a = [...new Map(found.map((e) => [e.r, Object.fromEntries(Object.entries(e).filter(([, v]) => v))])).values()];
  if (a.length) withAnnex++;
  const entry = { f: (m.functionName || []).map((f) => String(f).toUpperCase()) };
  if (a.length) entry.a = a;
  if ((m.perfuming || [])[0] === 'Y') entry.pf = 1;
  if ((m.status || [])[0] && m.status[0] !== 'Active') entry.s = m.status[0];
  index[name.toLowerCase().replace(/\s+/g, ' ')] = entry;
}
console.log('index', Object.keys(index).length, 'with annex entries', withAnnex);
writeFileSync(`${out}/cosing-index.json`, JSON.stringify(index));
writeFileSync(`${out}/cosing-meta.json`, JSON.stringify({ source: 'CosIng, © European Union', builtAt: new Date().toISOString(), names: Object.keys(index).length, withAnnex }));
