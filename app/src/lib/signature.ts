import type { Analysis } from './analyze';

// A composition "fingerprint" for finding analogs: the first meaningful ingredients, each as a short hash
// of its INCI name. The catalog build (scripts/build-letu.ts) and the app compute it the same way.
const SKIP_FN = new Set(['preservative', 'ph', 'chelator', 'fragrance', 'colorant']);
const SKIP_INCI = new Set(['aqua', 'parfum']);

/** djb2 → base36: short, stable, identical in Node and in the app. */
export function inciHash(inci: string) {
  let h = 5381;
  const s = inci.toLowerCase();
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return (h % 1679616).toString(36);
}

export function signature(a: Pick<Analysis, 'items'>, max = 16) {
  const out: string[] = [];
  for (const it of a.items) {
    if (it.match !== 'exact' && it.match !== 'fuzzy') continue;
    if (SKIP_INCI.has(it.ing.inci.toLowerCase()) || it.ing.fn.every((f) => SKIP_FN.has(f))) continue;
    const h = inciHash(it.ing.inci);
    if (!out.includes(h)) out.push(h);
    if (out.length >= max) break;
  }
  return out.join('.');
}
