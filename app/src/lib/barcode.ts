export type Product = { title: string; text: string; source: string };

type OBF = {
  status?: number;
  product?: { product_name?: string; product_name_ru?: string; brands?: string; ingredients_text?: string; ingredients_text_ru?: string; ingredients_text_en?: string };
};

const FIELDS = 'product_name,product_name_ru,brands,ingredients_text,ingredients_text_ru,ingredients_text_en';

async function getJSON<T>(url: string, ms = 8000): Promise<T | null> {
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

/** Looks a barcode up in Open Beauty Facts — the open, free cosmetics database. */
export async function lookupBarcode(code: string): Promise<Product | null> {
  for (const host of ['world.openbeautyfacts.org', 'ru.openbeautyfacts.org']) {
    const data = await getJSON<OBF>(`https://${host}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
    const p = data?.status === 1 ? data.product : undefined;
    if (!p) continue;
    const text = p.ingredients_text_ru || p.ingredients_text_en || p.ingredients_text;
    if (!text || text.trim().length < 5) continue;
    const name = p.product_name_ru || p.product_name || 'Средство';
    const brand = p.brands?.split(',')[0]?.trim();
    return { title: brand ? `${brand} · ${name}` : name, text: `Ingredients: ${text}`, source: 'Open Beauty Facts' };
  }
  return null;
}
