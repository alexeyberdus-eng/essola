// Captures the request body of Letual's searcher API and checks paging from plain Node (with Letual's permission).
import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ru-RU' });
const page = await ctx.newPage();
let body = null, url = null, headers = null;
page.on('request', (r) => {
  if (/api\/searcher\/v1\/search/.test(r.url()) && !body) { body = r.postData(); url = r.url(); headers = r.headers(); }
});
await page.goto('https://www.letu.ru/browse/uhod-za-kozhei', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(6000);
console.log('URL', url);
console.log('BODY', body);
console.log('HEADERS', JSON.stringify(Object.fromEntries(Object.entries(headers || {}).filter(([k]) => !/cookie/i.test(k)))));
await browser.close();
if (!body) process.exit(0);
const b = JSON.parse(body);
const UA = { 'User-Agent': headers['user-agent'], 'Content-Type': 'application/json', Accept: 'application/json' };
const api = url.replace(/&_dynSessConf=[^&]+/, '');
// plain fetch, page 1 and a later page
for (const mod of [{}, { offset: 48 }, { page: 2 }, { from: 48 }]) {
  const nb = JSON.parse(JSON.stringify(b));
  Object.assign(nb, mod);
  const r = await fetch(api, { method: 'POST', headers: UA, body: JSON.stringify(nb) });
  const t = await r.text();
  let j = {}; try { j = JSON.parse(t); } catch {}
  console.log('TRY', JSON.stringify(mod), r.status, 'totalProducts', j.totalProducts, 'n', j.products?.length, 'first', j.products?.[0]?.id, j.products?.[0]?.displayName);
}
const p0 = (await (await fetch(api, { method: 'POST', headers: UA, body })).json()).products?.[0];
console.log('PRODUCT KEYS', p0 && Object.keys(p0).join(','));
console.log('PRODUCT SAMPLE', JSON.stringify(p0).slice(0, 1200));
// whole catalog count: try empty filter
const all = JSON.parse(body);
for (const k of Object.keys(all)) if (/filter|navigation|category|N$/i.test(k)) console.log('FILTER FIELD', k, JSON.stringify(all[k]).slice(0, 200));
