// CosIng — the European Commission's cosmetic ingredient database (© European Union, reuse with attribution,
// Commission Decision 2011/833/EU). Builds one lookup: INCI name → functions and EU Annex entries.
//   node cosing-build.mjs <outDir>
// Polite: one request at a time with a pause; about 350 requests in all.
import { mkdirSync, writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (compatible; EssolaBot/1.0; +https://essola.ru)';
const SEARCH = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=285a77fd-1257-4271-8507-f0c6b2961203';
const ANNEX = 'https://api.tech.ec.europa.eu/cosing20/1.0/api/annexes';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = process.argv[2] || 'out';
mkdirSync(out, { recursive: true });

async function page(query, n, size) {
  for (let i = 0; i < 5; i++) {
    try {
      const fd = new FormData();
      fd.append('query', new Blob([JSON.stringify(query)], { type: 'application/json' }));
      const r = await fetch(`${SEARCH}&text=*&pageSize=${size}&pageNumber=${n}`, { method: 'POST', body: fd, headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.json();
      console.error('HTTP', r.status, n);
    } catch (e) {
      console.error('error', String(e).slice(0, 80));
    }
    await sleep(3000 * (i + 1));
  }
  return null;
}

// Deep paging can stop early on the search service: if it does, the list is collected again split by first letter.
async function collect(query) {
  const size = 100;
  const seen = new Map();
  for (let n = 1; ; n++) {
    const j = await page(query, n, size);
    const rows = j?.results ?? [];
    for (const r of rows) seen.set(r.metadata?.substanceId?.[0] || r.reference, r.metadata || {});
    if (n === 1) console.log('total', j?.totalResults);
    if (n % 25 === 0) console.log('page', n, 'collected', seen.size);
    if (rows.length < size) return { seen, total: j?.totalResults ?? 0, stoppedAt: n };
    await sleep(250);
  }
}

const ING = { terms: { itemType: ['ingredient'] } };
let { seen, total } = await collect({ bool: { must: [ING] } });
const first = await page({ bool: { must: [ING] } }, 1, 1);
total = first?.totalResults ?? total;
console.log('collected', seen.size, 'of', total);
// The service stops at 10 000 results per query: split the inventory by the first letters of the INCI name.
const filters = (p) => [{ prefix: { inciName: p.toLowerCase() } }, { prefix: { inciName: p } }, { wildcard: { inciName: `${p}*` } }, { wildcard: { inciName: `${p.toLowerCase()}*` } }];
let working = null;
async function part(p) {
  for (const f of working ? [working(p)] : filters(p)) {
    const q = { bool: { must: [ING, f] } };
    const head = await page(q, 1, 1);
    const n = head?.totalResults ?? 0;
    if (!n) continue;
    if (!working) {
      const i = filters(p).findIndex((x) => JSON.stringify(x) === JSON.stringify(f));
      working = (x) => filters(x)[i];
      console.log('partition filter', JSON.stringify(f));
    }
    if (n > 9900 && p.length < 3) {
      for (const c of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -(,']) await part(p + c);
      return;
    }
    const got = await collect(q);
    for (const [k, v] of got.seen) seen.set(k, v);
    console.log('prefix', JSON.stringify(p), n, '→', seen.size);
    return;
  }
}
if (seen.size < total * 0.98) for (const p of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']) await part(p);
console.log('inventory', seen.size, 'of', total);

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
