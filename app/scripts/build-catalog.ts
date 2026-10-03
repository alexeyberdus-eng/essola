// Builds the product catalog served by our function from the full Open Beauty Facts export (all products,
// not only popular ones), scored with our own analyzer; unreadable lists are dropped. Products that users
// resolved from shop links (shop.json in our bucket) are merged in.
// Run in CI: `npx tsx scripts/build-catalog.ts out.json [shop.json]`.
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { Readable } from 'stream';
import { createGunzip } from 'zlib';
import { analyze } from '../src/lib/analyze';

const DUMP = 'https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz';
// Our feed categories, matched against OBF category tags in this order.
const CATS: [string, RegExp][] = [
  ['sunscreens', /sun|solaire|spf/],
  ['serums', /serum/],
  ['eye-creams', /eye/],
  ['face-cleansers', /cleans|nettoy|micellar|demaquill|make-up-remov/],
  ['face-masks', /face-mask|masques-visage|sheet-mask/],
  ['toners', /toner|tonic|lotion-tonique/],
  ['face-creams', /face|visage|day-cream|night-cream|moisturi/],
  ['shampoos', /shampoo|shampoing/],
  ['conditioners', /conditioner|apres-shampoing/],
  ['hair-masks', /hair/],
  ['shower-gels', /shower|douche|bath|bain|soap|savon/],
  ['body-lotions', /body|corps/],
  ['hand-creams', /hand|mains/],
  ['lip-balms', /lip|levres/],
  ['deodorants', /deodorant/],
  ['toothpastes', /toothpaste|dentifrice|oral|mouth/],
];

type Item = { k: string; t: string; b: string; i: string; x: string; c: string; s: number; n: number; p: number };

function categoryOf(tags: string) {
  const t = tags.toLowerCase();
  for (const [c, re] of CATS) if (re.test(t)) return c;
  return 'other';
}

const why: Record<string, number> = { noTitle: 0, noText: 0, unreadable: 0, few: 0, dup: 0, rescued: 0 };
/** `texts`: the list in every language the dump has; the first one our analyzer reads well is kept. */
function add(out: Map<string, Item>, code: string, title: string, brand: string, image: string, texts: string | string[], tags: string, pop: number) {
  title = title.trim();
  const list = (Array.isArray(texts) ? texts : [texts]).map((t) => t.trim()).filter((t) => t.length >= 20);
  if (!code || !title) return void why.noTitle++;
  if (out.has(code)) return void why.dup++;
  if (!list.length) return void why.noText++;
  let text = '';
  let a: ReturnType<typeof analyze> | null = null;
  for (const [i, t] of list.entries()) {
    const r = analyze(t);
    if (!r.unreadable && r.items.length >= 4) {
      [text, a] = [t, r];
      if (i > 0) why.rescued++;
      break;
    }
  }
  if (!a) return void (analyze(list[0]).unreadable ? why.unreadable++ : why.few++);
  out.set(code, { k: code, t: title.slice(0, 120), b: brand.split(',')[0].trim().slice(0, 60), i: image, x: text.slice(0, 1800), c: categoryOf(tags), s: a.scores.overall, n: a.items.length, p: pop });
}

async function main() {
  const out = new Map<string, Item>();
  const res = await fetch(DUMP, { headers: { 'User-Agent': 'Essola/1.0 (cosmetics composition app; catalog build)' } });
  if (!res.ok || !res.body) throw new Error(`dump ${res.status}`);
  const lines = createInterface({ input: Readable.fromWeb(res.body as never).pipe(createGunzip()), crlfDelay: Infinity });
  let head: Record<string, number> | null = null;
  let langCols: string[] = [];
  let rows = 0;
  for await (const line of lines) {
    const f = line.split('\t');
    if (!head) {
      head = Object.fromEntries(f.map((h, i) => [h, i]));
      langCols = f.filter((h) => /^ingredients_text_[a-z]{2}$/.test(h) && h !== 'ingredients_text_en');
      console.log('ingredient languages:', langCols.join(' ') || 'none');
      console.log('columns:', f.length, ['code', 'product_name', 'brands', 'ingredients_text', 'categories_tags', 'image_small_url', 'unique_scans_n', 'popularity_key'].map((c) => `${c}:${c in head!}`).join(' '));
      continue;
    }
    rows++;
    const g = (c: string) => (head![c] === undefined ? '' : f[head![c]] ?? '');
    const code = g('code');
    const image = g('image_small_url') || g('image_url') || '';
    // The list as written on the pack first, then its English and other translations the community added.
    const texts = [g('ingredients_text'), g('ingredients_text_en'), ...langCols.map((c) => f[head![c]] ?? '')];
    const name = g('product_name') || g('product_name_en') || g('generic_name') || g('abbreviated_product_name');
    add(out, code, name, g('brands'), image.replace(/\.(200|400)\.jpg$/, '.100.jpg'), texts, `${g('categories_tags')} ${g('categories')} ${g('main_category')}`, Number(g('unique_scans_n') || g('popularity_key') || 0));
    if (rows % 20000 === 0) console.log('rows', rows, 'kept', out.size);
  }
  console.log('dump rows', rows, 'kept', out.size, JSON.stringify(why));

  // Products users resolved from shop links.
  const shopFile = process.argv[3];
  if (shopFile && existsSync(shopFile)) {
    const shop = JSON.parse(readFileSync(shopFile, 'utf8')) as { k: string; t: string; i?: string; x: string; c?: string }[];
    for (const p of shop) add(out, p.k, p.t, '', p.i || '', p.x, p.c || '', 1000);
    console.log('shop items', shop.length, 'total', out.size);
  }

  const items = [...out.values()].sort((a, b) => b.p - a.p || b.n - a.n);
  writeFileSync(process.argv[2] || 'catalog.json', JSON.stringify(items));
  const by: Record<string, number> = {};
  for (const x of items) by[x.c] = (by[x.c] || 0) + 1;
  console.log('catalog items:', items.length, JSON.stringify(by));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
