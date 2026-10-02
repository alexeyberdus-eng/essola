// Finds Letual's listing/search API used by category and search pages (with Letual's permission).
import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ru-RU' });
async function watch(name, url, scroll = true) {
  const page = await ctx.newPage();
  const seen = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!/letu\.ru\/(s\/)?api/.test(u) || /collect|sentry|envelope|tm\/|recom|personal-prices|mindbox|unleash|content-delivery|geo|cart|user|wishlist|questionnaire|ugc|promotion|delivery|rrs/.test(u)) return;
    let info = '';
    try {
      const j = await r.json();
      const keys = Object.keys(j || {}).slice(0, 15).join(',');
      const s = JSON.stringify(j);
      const total = (s.match(/"(?:total|totalCount|totalResults|count|numFound)"\s*:\s*(\d+)/) || [])[1];
      info = ` keys=[${keys}] total=${total} len=${s.length} sample=${s.slice(0, 300)}`;
    } catch {}
    seen.push(`${r.status()} ${r.request().method()} ${u.slice(0, 220)}${info}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(6000);
  if (scroll) for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(800); }
  await page.waitForTimeout(2000);
  console.log(`\n===== ${name} ${url}\n` + seen.join('\n'));
  await page.close();
}
await watch('category', 'https://www.letu.ru/browse/uhod-za-kozhei/uhod-za-litsom');
await watch('search', 'https://www.letu.ru/s/search?q=%D0%BA%D1%80%D0%B5%D0%BC');
await watch('catalog-root', 'https://www.letu.ru/browse/uhod-za-kozhei', false);
await browser.close();
