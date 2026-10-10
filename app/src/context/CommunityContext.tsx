import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Comment, seedFor } from '../data/community';
import { readJSON, writeJSON } from '../lib/storage';
import { useAuth } from './AuthContext';

export type Thread = Comment & { replies: Comment[] };

type Stored = { id: string; recipeId: string; parentId: string | null; text: string; at: number; author: string };

type CommunityValue = {
  threads: (recipeId: string) => Thread[];
  count: (recipeId: string) => number;
  best: (recipeId: string) => Thread | undefined;
  isLiked: (commentId: string) => boolean;
  likes: (c: Comment) => number;
  toggleLike: (commentId: string) => void;
  add: (recipeId: string, text: string, parentId: string | null) => void;
  mineCount: number;
};

const Ctx = createContext<CommunityValue | null>(null);
const KEY_COMMENTS = 'essola.comments';
const KEY_LIKES = 'essola.commentLikes';

export function CommunityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<Stored[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    readJSON<Stored[]>(KEY_COMMENTS, []).then(setMine);
    readJSON<string[]>(KEY_LIKES, []).then((l) => setLiked(new Set(l)));
  }, []);

  const all = useCallback(
    (recipeId: string): Comment[] => [
      ...seedFor(recipeId),
      ...mine
        .filter((m) => m.recipeId === recipeId)
        .map((m) => ({ id: m.id, recipeId, parentId: m.parentId, author: m.author, text: m.text, ago: Math.max(0, Math.round((Date.now() - m.at) / 60000)), likes: 0, mine: true })),
    ],
    [mine],
  );

  const threads = useCallback(
    (recipeId: string): Thread[] => {
      const list = all(recipeId);
      const tops = list.filter((c) => !c.parentId);
      return tops
        .map((t) => ({ ...t, replies: list.filter((c) => c.parentId === t.id).sort((a, b) => b.ago - a.ago) }))
        // Own fresh comments first (like Instagram), then the most liked.
        .sort((a, b) => Number(!!b.mine) - Number(!!a.mine) || b.likes - a.likes);
    },
    [all],
  );

  const likes = useCallback((c: Comment) => c.likes + (liked.has(c.id) ? 1 : 0), [liked]);

  const toggleLike = useCallback((id: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      writeJSON(KEY_LIKES, [...next]);
      return next;
    });
  }, []);

  const add = useCallback(
    (recipeId: string, text: string, parentId: string | null) => {
      const author = user?.name || user?.email?.split('@')[0] || 'Вы';
      const entry: Stored = { id: `me:${Date.now().toString(36)}`, recipeId, parentId, text: text.trim(), at: Date.now(), author };
      setMine((prev) => {
        const next = [...prev, entry];
        writeJSON(KEY_COMMENTS, next);
        return next;
      });
    },
    [user],
  );

  const value = useMemo<CommunityValue>(
    () => ({
      threads,
      count: (id) => all(id).length,
      best: (id) => threads(id).filter((t) => !t.mine).sort((a, b) => b.likes - a.likes)[0],
      isLiked: (id) => liked.has(id),
      likes,
      toggleLike,
      add,
      mineCount: mine.length,
    }),
    [threads, all, liked, likes, toggleLike, add, mine.length],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommunity() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCommunity must be used inside CommunityProvider');
  return ctx;
}
