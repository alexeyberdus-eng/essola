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
export async function aiScan(dataUrl: string): Promise<string[]> {
  const { ingredients } = await call<{ ingredients?: string[] }>({ mode: 'scan', image: dataUrl });
  return ingredients ?? [];
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
