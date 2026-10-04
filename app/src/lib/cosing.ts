import { useEffect, useState } from 'react';
import { readJSON, writeJSON } from './storage';

// CosIng — the European Commission's cosmetic ingredient database (© European Union), served by our function:
// what an ingredient does and whether EU rules ban or limit it. Used for ingredients our own base doesn't describe.
const url = process.env.EXPO_PUBLIC_SCAN_URL;
const key = process.env.EXPO_PUBLIC_SCAN_KEY ?? '';

export type EuAnnex = { r: string; k: 'banned' | 'restricted' | 'colorant' | 'preservative' | 'uv'; p?: string; m?: string; o?: string; w?: string };
export type EuEntry = { f: string[]; a?: EuAnnex[]; pf?: 1; s?: string };

const FUNC: Record<string, string> = {
  ABRASIVE: 'абразив', ABSORBENT: 'абсорбент', ANTICAKING: 'против слёживания', ANTICORROSIVE: 'антикоррозийное', ANTIDANDRUFF: 'против перхоти',
  ANTIFOAMING: 'пеногаситель', ANTIMICROBIAL: 'антимикробное', ANTIOXIDANT: 'антиоксидант', ANTIPERSPIRANT: 'антиперспирант', ANTIPLAQUE: 'против налёта',
  ANTISEBORRHOEIC: 'против себореи', ANTISTATIC: 'антистатик', ASTRINGENT: 'вяжущее', BINDING: 'связующее', BLEACHING: 'осветляющее', BUFFERING: 'буфер pH',
  BULKING: 'наполнитель', CHELATING: 'хелатор', CLEANSING: 'очищающее', 'COSMETIC COLORANT': 'краситель', DENATURANT: 'денатурант', DEODORANT: 'дезодорирующее',
  DEPILATORY: 'депилирующее', DETANGLING: 'облегчает расчёсывание', EMOLLIENT: 'смягчающее', EMULSIFYING: 'эмульгатор', 'EMULSION STABILISING': 'стабилизатор эмульсии',
  'FILM FORMING': 'плёнкообразователь', 'FOAM BOOSTING': 'усилитель пены', FOAMING: 'пенообразователь', 'GEL FORMING': 'гелеобразователь', 'HAIR CONDITIONING': 'кондиционирует волосы',
  'HAIR DYEING': 'краситель для волос', 'HAIR FIXING': 'фиксирует волосы', 'HAIR WAVING OR STRAIGHTENING': 'завивка/выпрямление', HUMECTANT: 'увлажнитель', HYDROTROPE: 'гидротроп',
  KERATOLYTIC: 'отшелушивающее', 'LIGHT STABILIZER': 'светостабилизатор', MASKING: 'маскирует запах', MOISTURISING: 'увлажняющее', 'NAIL CONDITIONING': 'уход за ногтями',
  OPACIFYING: 'замутнитель', 'ORAL CARE': 'уход за полостью рта', OXIDISING: 'окислитель', PEARLESCENT: 'перламутр', PERFUMING: 'отдушка', 'PH ADJUSTERS': 'регулятор pH',
  PLASTICISER: 'пластификатор', PRESERVATIVE: 'консервант', PROPELLANT: 'пропеллент', REDUCING: 'восстановитель', REFATTING: 'восполняет липиды', REFRESHING: 'освежающее',
  'SKIN CONDITIONING': 'ухаживает за кожей', 'SKIN CONDITIONING - EMOLLIENT': 'смягчающее', 'SKIN CONDITIONING - HUMECTANT': 'увлажнитель', 'SKIN CONDITIONING - MISCELLANEOUS': 'ухаживает за кожей',
  'SKIN CONDITIONING - OCCLUSIVE': 'окклюзив', 'SKIN PROTECTING': 'защищает кожу', SMOOTHING: 'разглаживающее', SOLVENT: 'растворитель', SOOTHING: 'успокаивающее', STABILISING: 'стабилизатор',
  SURFACTANT: 'ПАВ', 'SURFACTANT - CLEANSING': 'моющее ПАВ', 'SURFACTANT - EMULSIFYING': 'эмульгатор', 'SURFACTANT - FOAM BOOSTING': 'усилитель пены', 'SURFACTANT - HYDROTROPE': 'гидротроп',
  'SURFACTANT - SOLUBILIZING': 'солюбилизатор', 'SURFACTANT - DISPERSING NON-SURFACTANT': 'диспергатор', TANNING: 'автозагар', TONIC: 'тонизирующее', 'UV ABSORBER': 'УФ-поглотитель',
  'UV FILTER': 'УФ-фильтр', 'VISCOSITY CONTROLLING': 'регулятор вязкости', FLAVOURING: 'ароматизатор', 'ANTI-SEBUM': 'против жирности', DISPERSING: 'диспергатор',
};
export const euFunction = (f: string) => FUNC[f] ?? f.toLowerCase();

const KIND: Record<EuAnnex['k'], string> = {
  banned: 'запрещено в косметике ЕС',
  restricted: 'в ЕС разрешено с ограничениями',
  colorant: 'разрешённый в ЕС краситель',
  preservative: 'разрешённый в ЕС консервант',
  uv: 'разрешённый в ЕС УФ-фильтр',
};

/** One short line for the ingredient row: the strictest EU rule, with its limit when there is one. */
export function euLine(e?: EuEntry | null): { text: string; tone: 'bad' | 'warn' | 'neutral' } | null {
  const a = e?.a;
  if (!a?.length) return null;
  const banned = a.find((x) => x.k === 'banned');
  if (banned) return { text: KIND.banned, tone: 'bad' };
  const r = a.find((x) => x.k === 'restricted') ?? a[0];
  const max = r.m ? `, не более ${r.m.replace(/\s*%/g, '%')}` : '';
  return { text: `${KIND[r.k]}${max}`, tone: r.k === 'restricted' ? 'warn' : 'neutral' };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** EU facts for a list of ingredient names (cached on the phone per composition). */
export function useCosing(names: string[]): Record<string, EuEntry> {
  const sig = names.map(norm).join('|');
  const [data, setData] = useState<{ sig: string; items: Record<string, EuEntry> } | null>(null);
  useEffect(() => {
    if (!url || !names.length) return;
    let alive = true;
    const k = `cosing:${hash(sig)}`;
    (async () => {
      const hit = await readJSON<Record<string, EuEntry> | null>(k, null);
      if (hit) return alive && setData({ sig, items: hit });
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Key': key }, body: JSON.stringify({ mode: 'cosing', names }) });
        if (!res.ok) return;
        const { items } = (await res.json()) as { items: Record<string, EuEntry> };
        const byNorm = Object.fromEntries(Object.entries(items ?? {}).map(([n, v]) => [norm(n), v]));
        writeJSON(k, byNorm);
        if (alive) setData({ sig, items: byNorm });
      } catch {}
    })();
    return () => {
      alive = false;
    };
    // sig captures names
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return data?.sig === sig ? data.items : {};
}
export const cosingFor = (items: Record<string, EuEntry>, name: string) => items[norm(name)];

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
