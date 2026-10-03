import { useEffect, useState } from 'react';
import type { Summary } from './effects';
import { readJSON, writeJSON } from './storage';

// Our Yandex Cloud function (server/yandex-scan). Without it the app uses its local engines.
const url = process.env.EXPO_PUBLIC_SCAN_URL;
const key = process.env.EXPO_PUBLIC_SCAN_KEY ?? '';
export const aiEnabled = !!url;

async function call<T>(body: object): Promise<T> {
  const res = await fetch(url!, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Key': key }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`AI_${res.status}`);
  return (await res.json()) as T;
}

/** Photo (data URL) → ingredient list read by the vision model. */
export async function aiScan(dataUrl: string, barcode?: string | null, title?: string | null): Promise<{ ingredients: string[]; notCosmetic?: string }> {
  const { ingredients, notCosmetic } = await call<{ ingredients?: string[]; notCosmetic?: string }>({ mode: 'scan', image: dataUrl, barcode: barcode ?? undefined, title: title ?? undefined });
  return { ingredients: ingredients ?? [], notCosmetic };
}

/** Front of the pack (data URL) → brand and name, to find the product in our base. One short answer, few tokens. */
export async function aiLabel(dataUrl: string): Promise<{ brand: string; name: string; kind: string; notCosmetic?: string; item?: CatalogItem; ingredients?: string[] }> {
  const r = await call<{ brand?: string; name?: string; kind?: string; notCosmetic?: string; item?: CatalogItem; ingredients?: string[] }>({ mode: 'label', image: dataUrl });
  return { brand: r.brand ?? '', name: r.name ?? '', kind: r.kind ?? '', notCosmetic: r.notCosmetic, item: r.item, ingredients: r.ingredients };
}

/** «Честный знак»: GTIN from the DataMatrix code → the National Catalog card (composition if filled in), else our base or the web. */
export async function nkLookup(gtin: string): Promise<{ found: boolean; title?: string; brand?: string; ingredients?: string[]; item?: CatalogItem; reason?: string }> {
  return call({ mode: 'nk', gtin });
}

type AiText = { lead?: string; effects?: { title: string; text: string }[]; use?: string[] };

/**
 * "What this composition gives", written by the AI. Shows the local rule-based summary immediately
 * and swaps in the AI text when it arrives. Results are cached per composition.
 */
export function useAiSummary(names: string[], kind: string | undefined, local: Summary, delay = 0): Summary {
  const sig = `${kind ?? ''}|${names.join(',')}`;
  const [ai, setAi] = useState<{ sig: string; data: AiText } | null>(null);
  useEffect(() => {
    if (!aiEnabled || names.length < 2) return;
    let alive = true;
    const cacheKey = `ai:${sig.length > 180 ? hash(sig) : sig}`;
    const t = setTimeout(async () => {
      const cached = await readJSON<AiText | null>(cacheKey, null);
      if (cached) return alive && setAi({ sig, data: cached });
      try {
        const data = await call<AiText>({ mode: 'describe', ingredients: names, kind });
        if (!data.lead) return;
        writeJSON(cacheKey, data);
        if (alive) setAi({ sig, data });
      } catch {
        // keep the local summary
      }
    }, delay);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // sig captures names + kind
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, delay]);
  if (!ai || ai.sig !== sig) return local;
  const { lead, effects, use } = ai.data;
  return {
    kind: local.kind,
    lead: lead ?? local.lead,
    effects: effects?.length ? effects.slice(0, 4).map((e, i) => ({ icon: local.effects[i]?.icon ?? 'spark', title: e.title, text: e.text })) : local.effects,
    use: use?.length ? use : local.use,
  };
}

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Calls the server once per input and keeps the answer on the device. */
async function cached<T>(tag: string, body: object): Promise<T> {
  const k = `ai:${tag}:${hash(JSON.stringify(body))}`;
  const hit = await readJSON<T | null>(k, null);
  if (hit) return hit;
  const data = await call<T>(body);
  writeJSON(k, data);
  return data;
}

export type Review = {
  verdict?: string;
  add?: { name: string; pct?: string; why?: string }[];
  reduce?: { name: string; to?: string; why?: string }[];
  remove?: { name: string; why?: string }[];
  warn?: string[];
};
/** Technologist's advice on a builder formula ("Aqua 70%", …). */
export const aiReview = (items: string[], kind: string, notes: string[]) => cached<Review>('review5', { mode: 'review', items, kind, notes });

export type Analog = { title: string; url: string; match: number; common: string[]; note: string };
/** Gold Apple products with a similar composition, with an estimated match %. */
export const aiAnalogs = async (ingredients: string[], keys: string[], kind: string) =>
  (await cached<{ items?: Analog[] }>('analogs', { mode: 'analogs', ingredients, keys, kind })).items ?? [];

export type CachedProduct = { title?: string | null; ingredients: string[]; source?: string; image?: string | null; url?: string };

/** Shared product base on our server: barcode → composition someone already scanned. */
export async function productByBarcode(barcode: string): Promise<CachedProduct | null> {
  if (!aiEnabled) return null;
  try {
    const { product } = await call<{ product: CachedProduct | null }>({ mode: 'product', barcode });
    return product?.ingredients?.length ? product : null;
  } catch {
    return null;
  }
}

/** Gold Apple / Letual product link → composition read from that page (cached for everyone). */
export async function productByLink(url: string): Promise<{ product: CachedProduct | null; error?: string }> {
  return call<{ product: CachedProduct | null; error?: string }>({ mode: 'url', url });
}

export const SHOP_LINK = /https?:\/\/(?:www\.)?letu\.ru\/\S+/i;

/** Saves a composition read from a shop page into the shared base. */
/** Unknown barcode → product name found on the web (marketplaces, shops, barcode catalogs). */
export async function barcodeWeb(barcode: string): Promise<{ name: string | null; titles: string[] } | null> {
  if (!aiEnabled) return null;
  try {
    return await call<{ name: string | null; titles: string[] }>({ mode: 'barcode.web', barcode });
  } catch {
    return null;
  }
}
/** Links a scanned barcode to a composition so the next scan of it, by anyone, is instant. */
export const saveBarcode = (barcode: string, title: string, ingredients: string[]) => (aiEnabled ? call({ mode: 'barcode.save', barcode, title, ingredients }).catch(() => {}) : Promise.resolve());
export const saveProduct = (url: string, title: string, ingredients: string[]) => call({ mode: 'save', url, title, ingredients }).catch(() => {});

/** Products in our shared base whose title matches the query. */
export async function searchProducts(q: string): Promise<CachedProduct[]> {
  if (!aiEnabled) return [];
  try {
    return (await call<{ items: CachedProduct[] }>({ mode: 'search', q })).items ?? [];
  } catch {
    return [];
  }
}

export type CatalogItem = { k: string; t: string; b: string; i: string; x: string; c: string; s: number; n: number; u?: string; /** composition not published */ z?: 1; /** goal and free-from tags, see lib/tags.ts */ m?: string; /** Letual rating 0–5 */ r?: number; p?: number };
/** «Подбор средств»: products from our base by category, goals (any) and free-from tags (all). */
export async function matchProducts(opts: { cats: string[]; goals: string; free: string; sort: 'score' | 'rating' | 'popular'; page: number }): Promise<{ items: CatalogItem[]; total: number; untagged?: boolean } | null> {
  if (!aiEnabled) return null;
  try {
    return await call<{ items: CatalogItem[]; total: number; untagged?: boolean }>({ mode: 'match', ...opts, size: 40 });
  } catch {
    return null;
  }
}
export type SimilarItem = CatalogItem & { match: number; common: string[] };
/** Products from our base with the most similar composition fingerprint (see lib/signature.ts). */
export async function catalogSimilar(g: string): Promise<SimilarItem[] | null> {
  if (!aiEnabled) return null;
  try {
    return (await call<{ items: SimilarItem[] }>({ mode: 'similar', g })).items ?? [];
  } catch {
    return null;
  }
}
/** A page of our pre-scored catalog (built weekly from Open Beauty Facts); null when the server can't be reached. */
export async function catalogPage(q: string, cat: string | undefined, sort: string, page: number): Promise<{ items: CatalogItem[]; total: number } | null> {
  if (!aiEnabled) return null;
  try {
    return await call<{ items: CatalogItem[]; total: number }>({ mode: 'catalog', q, cat, sort, page, size: 40 });
  } catch {
    return null;
  }
}
