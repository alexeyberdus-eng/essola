import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Recipe, setUserRecipes } from '../data/recipes';
import { readJSON, writeJSON } from '../lib/storage';

export type ShelfItem = {
  id: string;
  name: string;
  kind: string;
  /** ISO date the jar was opened */
  openedAt: string;
  /** "period after opening" in months */
  pao: number;
  /** INCI names of notable actives — used for conflict warnings */
  actives: string[];
  scanId?: string;
  recipeId?: string;
};

export type Conflict = { a: ShelfItem; b: ShelfItem; text: string };

type Value = {
  myRecipes: Recipe[];
  addRecipe: (r: Recipe) => void;
  removeRecipe: (id: string) => void;
  shelf: ShelfItem[];
  addToShelf: (item: Omit<ShelfItem, 'id'>) => ShelfItem;
  removeFromShelf: (id: string) => void;
  conflicts: Conflict[];
  barcodes: Record<string, { title: string; text: string }>;
  rememberBarcode: (code: string, title: string, text: string) => void;
};

const Ctx = createContext<Value | null>(null);

const RULES: { a: RegExp; b: RegExp; text: string }[] = [
  { a: /retin/i, b: /glycolic|lactic|salicylic|mandelic/i, text: 'Ретинол и кислоты вместе сильно раздражают кожу. Разнесите по разным вечерам.' },
  { a: /retin/i, b: /ascorbic/i, text: 'Не наносите вместе: утром — витамин C, вечером — ретинол.' },
  { a: /retin/i, b: /benzoyl/i, text: 'Бензоилпероксид разрушает ретинол. Используйте в разное время суток.' },
  { a: /ascorbic/i, b: /glycolic|lactic|salicylic|mandelic/i, text: 'Витамин C и кислоты вместе могут щипать. Лучше в разные дни.' },
];

export function daysLeft(item: ShelfItem) {
  const end = new Date(item.openedAt).getTime() + item.pao * 30.4 * 86400000;
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

export function UserContentProvider({ children }: { children: ReactNode }) {
  const [myRecipes, setMy] = useState<Recipe[]>([]);
  const [shelf, setShelf] = useState<ShelfItem[]>([]);
  const [barcodes, setBarcodes] = useState<Value['barcodes']>({});

  useEffect(() => {
    (async () => {
      const [r, s, b] = await Promise.all([
        readJSON<Recipe[]>('essola.myRecipes', []),
        readJSON<ShelfItem[]>('essola.shelf', []),
        readJSON<Value['barcodes']>('essola.barcodes', {}),
      ]);
      setUserRecipes(r);
      setMy(r);
      setShelf(s);
      setBarcodes(b);
    })();
  }, []);

  const addRecipe = useCallback((r: Recipe) => {
    setMy((prev) => {
      const next = [r, ...prev.filter((x) => x.id !== r.id)];
      setUserRecipes(next);
      writeJSON('essola.myRecipes', next);
      return next;
    });
  }, []);

  const removeRecipe = useCallback((id: string) => {
    setMy((prev) => {
      const next = prev.filter((x) => x.id !== id);
      setUserRecipes(next);
      writeJSON('essola.myRecipes', next);
      return next;
    });
  }, []);

  const addToShelf = useCallback((item: Omit<ShelfItem, 'id'>) => {
    const entry = { ...item, id: Date.now().toString(36) };
    setShelf((prev) => {
      const next = [entry, ...prev];
      writeJSON('essola.shelf', next);
      return next;
    });
    return entry;
  }, []);

  const removeFromShelf = useCallback((id: string) => {
    setShelf((prev) => {
      const next = prev.filter((x) => x.id !== id);
      writeJSON('essola.shelf', next);
      return next;
    });
  }, []);

  const rememberBarcode = useCallback((code: string, title: string, text: string) => {
    setBarcodes((prev) => {
      const next = { ...prev, [code]: { title, text } };
      writeJSON('essola.barcodes', next);
      return next;
    });
  }, []);

  const conflicts = useMemo(() => {
    const out: Conflict[] = [];
    for (let i = 0; i < shelf.length; i++)
      for (let j = i + 1; j < shelf.length; j++) {
        const x = shelf[i].actives.join(' ');
        const y = shelf[j].actives.join(' ');
        const rule = RULES.find((r) => (r.a.test(x) && r.b.test(y)) || (r.a.test(y) && r.b.test(x)));
        if (rule) out.push({ a: shelf[i], b: shelf[j], text: rule.text });
      }
    return out;
  }, [shelf]);

  const value = useMemo(
    () => ({ myRecipes, addRecipe, removeRecipe, shelf, addToShelf, removeFromShelf, conflicts, barcodes, rememberBarcode }),
    [myRecipes, addRecipe, removeRecipe, shelf, addToShelf, removeFromShelf, conflicts, barcodes, rememberBarcode],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUserContent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUserContent must be used inside UserContentProvider');
  return ctx;
}
