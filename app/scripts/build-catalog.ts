// Builds the product catalog served by our function: popular products from Open Beauty Facts per category,
// scored with our own analyzer, unreadable lists dropped. Run in CI: `npx tsx scripts/build-catalog.ts out.json`.
import { writeFileSync } from 'fs';
import { analyze } from '../src/lib/analyze';

const CATS = ['face-creams', 'serums', 'face-cleansers', 'shampoos', 'conditioners', 'body-lotions', 'sunscreens', 'lip-balms', 'hand-creams', 'face-masks', 'toners', 'shower-gels', 'eye-creams', 'hair-masks', 'deodorants'];
const FIELDS = 'code,product_name,product_name_ru,brands,ingredients_text,ingredients_text_ru,ingredients_text_en,image_front_thumb_url,image_thumb_url,image_small_url,unique_scans_n';
const PAGES = Number(process.env.PAGES || 4);

type P = Record<string, string | number | undefined>;
type Item = { k: string; t: string; b: string; i: string; x: string; c: string; s: number; n: number; p: number };

async function page(cat: string, n: number): Promise<P[]> {
  const url = `https://world.openbeautyfacts.org/cgi/search.pl?tagtype_0=categories&tag_contains_0=contains&tag_0=${cat}&action=process&json=1&page=${n}&page_size=100&sort_by=unique_scans_n&fields=${FIELDS}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Essola/1.0 (cosmetics composition app; catalog build)' } });
      if (res.ok) return ((await res.json()) as { products?: P[] }).products ?? [];
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return [];
}

async function main() {
  const out = new Map<string, Item>();
  for (const cat of CATS) {
    for (let n = 1; n <= PAGES; n++) {
      const list = await page(cat, n);
      if (!list.length) break;
      for (const p of list) {
        const code = String(p.code || '');
        const title = String(p.product_name_ru || p.product_name || '').trim();
        const text = String(p.ingredients_text_ru || p.ingredients_text_en || p.ingredients_text || '').trim();
        if (!code || !title || text.length < 20 || out.has(code)) continue;
        const a = analyze(text);
        if (a.unreadable || a.items.length < 4) continue;
        out.set(code, {
          k: code,
          t: title.slice(0, 120),
          b: String(p.brands || '').split(',')[0].trim().slice(0, 60),
          i: String(p.image_front_thumb_url || p.image_thumb_url || p.image_small_url || ''),
          x: text.slice(0, 2500),
          c: cat,
          s: a.scores.overall,
          n: a.items.length,
          p: Number(p.unique_scans_n || 0),
        });
      }
      console.log(cat, n, out.size);
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  const items = [...out.values()].sort((a, b) => b.p - a.p);
  writeFileSync(process.argv[2] || 'catalog.json', JSON.stringify(items));
  console.log('catalog items:', items.length);
}

main();
