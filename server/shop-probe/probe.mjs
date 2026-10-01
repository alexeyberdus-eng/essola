// Diagnostic: opens one Gold Apple and one Letual product page like a phone would and reports where the composition is.
import { chromium, devices } from 'playwright';

const FIND = (await import('fs')).readFileSync(new URL('./find.js', import.meta.url), 'utf8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ru-RU' });

async function probe(name, start, linkRe) {
  const page = await ctx.newPage();
  const apis = [];
  page.on('response', (r) => {
    const u = r.url();
    if (/api|graphql|product/i.test(u) && !/\.(js|css|png|jpg|webp|svg|woff2?)(\?|$)/.test(u)) apis.push(`${r.status()} ${u.slice(0, 160)}`);
  });
  try {
    await page.goto(start, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(6000);
    console.log(`[${name}] start title:`, await page.title(), page.url());
    const hrefs = await page.$$eval('a', (as) => as.map((a) => a.href));
    const link = hrefs.find((h) => linkRe.test(h));
    console.log(`[${name}] product link:`, link);
    if (!link) {
      console.log(`[${name}] body:`, (await page.evaluate(() => document.body.innerText)).slice(0, 600));
      return;
    }
    apis.length = 0;
    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    await page.evaluate(FIND);
    const found = await page.waitForFunction(() => window.__found, null, { timeout: 25000 }).then((h) => h.jsonValue()).catch(() => null);
    console.log(`[${name}] title:`, await page.title());
    console.log(`[${name}] FOUND:`, JSON.stringify(found)?.slice(0, 500));
    const text = await page.evaluate(() => document.body.innerText);
    const i = text.search(/состав/i);
    console.log(`[${name}] text around "состав":`, i >= 0 ? JSON.stringify(text.slice(i, i + 400)) : 'none', 'len', text.length);
    const html = await page.content();
    const j = html.search(/состав/i);
    console.log(`[${name}] html around "состав":`, j >= 0 ? JSON.stringify(html.slice(j - 100, j + 400)) : 'none');
    console.log(`[${name}] api calls:\n` + apis.slice(0, 40).join('\n'));
  } catch (e) {
    console.log(`[${name}] error`, String(e).slice(0, 300));
  }
}

await probe('goldapple', 'https://goldapple.ru/uhod/uhod-za-licom', /goldapple\.ru\/\d{6,}-/);
await probe('letu', 'https://www.letu.ru/browse/uhod-za-kozhei/uhod-za-litsom', /letu\.ru\/product\//);
await browser.close();
