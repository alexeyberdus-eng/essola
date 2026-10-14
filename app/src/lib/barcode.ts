export type Product = { title: string; text: string; source: string };
export type Lookup = { product: Product | null; name: string | null };

type OFF = {
  status?: number;
  product?: {
    product_name?: string;
    product_name_ru?: string;
    generic_name_ru?: string;
    brands?: string;
    ingredients_text?: string;
    ingredients_text_ru?: string;
    ingredients_text_en?: string;
  };
};

const FIELDS = 'product_name,product_name_ru,generic_name_ru,brands,ingredients_text,ingredients_text_ru,ingredients_text_en';

// Open databases, most relevant first: cosmetics, then general products and food (many creams/shampoos end up there).
const SOURCES = [
  ['world.openbeautyfacts.org', 'Open Beauty Facts'],
  ['ru.openbeautyfacts.org', 'Open Beauty Facts'],
  ['world.openproductsfacts.org', 'Open Products Facts'],
  ['world.openfoodfacts.org', 'Open Food Facts'],
] as const;

async function getJSON<T>(url: string, ms = 7000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Essola/1.0 (cosmetics composition app)' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Barcodes are scanned as EAN-13/UPC; try the common alternative forms too. */
function variants(code: string) {
  const c = code.replace(/\D/g, '');
  const out = new Set([c]);
  if (c.length === 12) out.add('0' + c);
  if (c.length === 13 && c.startsWith('0')) out.add(c.slice(1));
  return [...out];
}

/**
 * Looks a barcode up in open product databases. Returns the composition when one is known,
 * otherwise at least the product name (so the user only has to photograph the ingredient list).
 */
export async function lookupBarcode(code: string): Promise<Lookup> {
  let name: string | null = null;
  const codes = variants(code);
  const results = await Promise.all(
    SOURCES.flatMap(([host, source]) =>
      codes.map(async (c) => ({ source, data: await getJSON<OFF>(`https://${host}/api/v2/product/${encodeURIComponent(c)}.json?fields=${FIELDS}`) })),
    ),
  );
  for (const { source, data } of results) {
    const p = data?.status === 1 ? data.product : undefined;
    if (!p) continue;
    const brand = p.brands?.split(',')[0]?.trim();
    const title = p.product_name_ru || p.product_name || p.generic_name_ru;
    if (title && !name) name = brand && !title.includes(brand) ? `${brand} · ${title}` : title;
    const text = p.ingredients_text_ru || p.ingredients_text_en || p.ingredients_text;
    if (text && text.trim().length > 10) return { product: { title: name ?? title ?? 'Средство', text: `Ingredients: ${text}`, source }, name };
  }
  if (!name) {
    // Name-only fallback: a free barcode directory (no ingredients, but tells the user what was scanned).
    const upc = await getJSON<{ items?: { title?: string; brand?: string }[] }>(`https://api.upcitemdb.com/prod/trial/lookup?upc=${codes[0]}`);
    const it = upc?.items?.[0];
    if (it?.title) name = it.brand && !it.title.includes(it.brand) ? `${it.brand} · ${it.title}` : it.title;
  }
  return { product: null, name };
}
