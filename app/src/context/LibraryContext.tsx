import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RECIPES } from '../data/recipes';
import { readJSON, writeJSON } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type SavedScan = { id: string; title: string; text: string; overall: number; createdAt: string; barcode?: string; source?: string };

type LibraryValue = {
  liked: Set<string>;
  isLiked: (id: string) => boolean;
  likeCount: (id: string) => number;
  toggleLike: (id: string) => void;
  scans: SavedScan[];
  saveScan: (scan: Omit<SavedScan, 'id' | 'createdAt'>) => SavedScan;
  getScan: (id: string) => SavedScan | undefined;
  removeScan: (id: string) => void;
};

const LibraryContext = createContext<LibraryValue | null>(null);
const BASE = Object.fromEntries(RECIPES.map((r) => [r.id, r.baseLikes]));

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const owner = user?.id ?? 'guest';
  const remote = !!supabase && !!user && !user.local;
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [scans, setScans] = useState<SavedScan[]>([]);
  const scansRef = useRef(scans);
  scansRef.current = scans;

  // Load likes and scan history for whoever is signed in; guest likes are carried into the account.
  useEffect(() => {
    let alive = true;
    (async () => {
      const guest = await readJSON<string[]>('essola.likes.guest', []);
      const own = owner === 'guest' ? guest : await readJSON<string[]>(`essola.likes.${owner}`, []);
      let next = new Set([...own, ...(owner === 'guest' ? [] : guest)]);

      if (remote && supabase) {
        const { data } = await supabase.from('recipe_likes').select('recipe_id');
        const server = new Set((data ?? []).map((r: { recipe_id: string }) => r.recipe_id));
        const missing = [...next].filter((id) => !server.has(id));
        if (missing.length) await supabase.from('recipe_likes').upsert(missing.map((recipe_id) => ({ recipe_id, user_id: owner })));
        next = new Set([...server, ...missing]);
      }
      if (owner !== 'guest' && guest.length) await writeJSON('essola.likes.guest', []);
      const history = await readJSON<SavedScan[]>(`essola.scans.${owner}`, []);
      if (!alive) return;
      setLiked(next);
      setScans(history);
      writeJSON(`essola.likes.${owner}`, [...next]);
    })();
    return () => {
      alive = false;
    };
  }, [owner, remote]);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('recipe_like_counts')
      .select('recipe_id, likes')
      .then(({ data, error }) => {
        if (error || !data) return;
        setCounts(Object.fromEntries(data.map((r: { recipe_id: string; likes: number }) => [r.recipe_id, r.likes])));
      });
  }, [liked.size]);

  const toggleLike = useCallback(
    (id: string) => {
      setLiked((prev) => {
        const next = new Set(prev);
        const adding = !next.has(id);
        adding ? next.add(id) : next.delete(id);
        writeJSON(`essola.likes.${owner}`, [...next]);
        if (remote && supabase) {
          const q = adding
            ? supabase.from('recipe_likes').upsert({ recipe_id: id, user_id: owner })
            : supabase.from('recipe_likes').delete().match({ recipe_id: id, user_id: owner });
          q.then(({ error }) => error && console.warn('like sync failed', error.message));
        }
        return next;
      });
    },
    [owner, remote],
  );

  const likeCount = useCallback(
    (id: string) => {
      const mine = liked.has(id) ? 1 : 0;
      if (counts) return (BASE[id] ?? 0) + Math.max(counts[id] ?? 0, mine);
      return (BASE[id] ?? 0) + mine;
    },
    [liked, counts],
  );

  const saveScan = useCallback(
    (scan: Omit<SavedScan, 'id' | 'createdAt'>) => {
      const entry: SavedScan = { ...scan, id: Date.now().toString(36), createdAt: new Date().toISOString() };
      const next = [entry, ...scansRef.current].slice(0, 40);
      setScans(next);
      writeJSON(`essola.scans.${owner}`, next);
      return entry;
    },
    [owner],
  );

  const removeScan = useCallback(
    (id: string) => {
      const next = scansRef.current.filter((s) => s.id !== id);
      setScans(next);
      writeJSON(`essola.scans.${owner}`, next);
    },
    [owner],
  );

  const value = useMemo<LibraryValue>(
    () => ({
      liked,
      isLiked: (id) => liked.has(id),
      likeCount,
      toggleLike,
      scans,
      saveScan,
      getScan: (id) => scans.find((s) => s.id === id),
      removeScan,
    }),
    [liked, likeCount, toggleLike, scans, saveScan, removeScan],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
