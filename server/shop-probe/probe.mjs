// Diagnostic: which request brings Letual's composition when the user opens the tab.
import { chromium, devices } from 'playwright';
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const j = await (await fetch('https://www.letu.ru/s/api/product/v3/product-detail/3288?locale=ru-RU&pushSite=storeMobileRU', { headers: UA })).json();
const sku = j.skuList?.[0] || {};
console.log('sku keys:', Object.keys(sku).join(','));
console.log('topSpecs:', JSON.stringify(j.topSpecs).slice(0, 400));

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ru-RU' });
const page = await ctx.newPage();
const calls = [];
page.on('response', async (r) => {
  const u = r.url();
  if (!/letu\.ru\/(s\/)?api/.test(u) || /collect|sentry|envelope/.test(u)) return;
  let hit = '';
  try { const t = await r.text(); const i = t.search(/aqua|glycerin|состав/i); if (i >= 0) hit = ' HIT ' + JSON.stringify(t.slice(Math.max(0, i - 60), i + 200)); } catch {}
  calls.push(`${r.status()} ${u.slice(0, 180)}${hit}`);
});
await page.goto('https://www.letu.ru/product/l-oreal-paris-tonalnyi-krem-alliance-perfect-sovershennoe-sliyanie-vyravnivayushchii-i-uvlazhnyayushchii/3288', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(5000);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(700); }
const labels = await page.$$eval('button, [role=tab], a, div, span, h2, h3', (els) => [...new Set(els.map((e) => (e.textContent || '').trim()).filter((t) => t.length < 30 && /состав|описан|о товаре|характер|подробн/i.test(t)))].slice(0, 20));
console.log('labels:', JSON.stringify(labels));
for (const l of labels) {
  try { await page.getByText(l, { exact: true }).first().click({ timeout: 2000 }); await page.waitForTimeout(1500); } catch {}
}
await page.waitForTimeout(3000);
const text = await page.evaluate(() => document.body.innerText);
const i = text.search(/aqua|glycerin/i);
console.log('text hit:', i >= 0 ? JSON.stringify(text.slice(Math.max(0, i - 200), i + 300)) : 'none', 'len', text.length);
console.log('calls:\n' + calls.join('\n'));
await browser.close();
