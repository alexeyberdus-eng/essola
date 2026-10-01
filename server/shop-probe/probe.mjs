// Diagnostic: opens shop pages like a phone would and reports where the composition lives.
import { chromium, devices } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ru-RU' });
const around = (s, re, n = 500) => {
  const out = [];
  let m;
  const r = new RegExp(re, 'gi');
  while ((m = r.exec(s)) && out.length < 4) out.push(JSON.stringify(s.slice(Math.max(0, m.index - 80), m.index + n)));
  return out.join('\n   ') || 'none';
};

async function letu() {
  const page = await ctx.newPage();
  await page.goto('https://www.letu.ru/browse/uhod-za-kozhei/uhod-za-litsom/kremy-dlya-litsa', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(6000);
  const hrefs = await page.$$eval('a', (as) => as.map((a) => a.href));
  const link = hrefs.find((h) => /letu\.ru\/product\/.*krem/.test(h)) || hrefs.find((h) => /letu\.ru\/product\//.test(h));
  console.log('[letu] link', link);
  const id = link.match(/\/product\/[^/]+\/(\d+)/)[1];
  await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  for (const api of [`/s/api/product/v3/product-detail/${id}?locale=ru-RU&pushSite=storeMobileRU`, `/s/api/product/v1/key-features/${id}?pushSite=storeMobileRU`]) {
    const body = await page.evaluate((u) => fetch(u).then((r) => r.text()), api);
    console.log('[letu] api', api, 'len', body.length);
    console.log('   ', around(body, 'состав|ingredient|composition|sostav'));
  }
  // plain server-side fetch, no browser
  const res = await fetch(`https://www.letu.ru/s/api/product/v3/product-detail/${id}?locale=ru-RU&pushSite=storeMobileRU`, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } });
  const t = await res.text();
  console.log('[letu] node fetch', res.status, t.length, around(t, 'состав', 200));
}

async function goldapple() {
  const page = await ctx.newPage();
  const apis = [];
  page.on('response', (r) => /front\/api/.test(r.url()) && apis.push(`${r.status()} ${r.url().slice(0, 200)}`));
  await page.goto('https://goldapple.ru/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(5000);
    console.log('[ga] t', (i + 1) * 5, await page.title());
    if (!/checking/i.test(await page.title())) break;
  }
  const hrefs = await page.$$eval('a', (as) => as.map((a) => a.href));
  const link = hrefs.find((h) => /goldapple\.ru\/\d{6,}-/.test(h));
  console.log('[ga] link', link);
  if (!link) return console.log('[ga] body', (await page.evaluate(() => document.body.innerText)).slice(0, 300));
  await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(8000);
  const html = await page.content();
  console.log('[ga] title', await page.title());
  console.log('[ga] html', around(html, 'состав'));
  console.log('[ga] apis\n' + apis.join('\n'));
}

await letu().catch((e) => console.log('[letu] error', String(e).slice(0, 300)));
await goldapple().catch((e) => console.log('[ga] error', String(e).slice(0, 300)));
await browser.close();
