import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readJSON, writeJSON } from './storage';

export type Skin = 'normal' | 'dry' | 'oily' | 'combo';
export type Concern = 'acne' | 'pigment' | 'aging' | 'dehydration' | 'redness' | 'pores' | 'dullness';
export type Hair = 'normal' | 'dry' | 'oily' | 'colored' | 'damaged' | 'thin' | 'curly' | 'dandruff';
export type Pref = 'noFragrance' | 'vegan' | 'noSilicone' | 'noSulfate' | 'noParaben' | 'natural';

/** Everything the user told us about herself; drives the personal score everywhere. */
export type Profile = {
  done: boolean;
  skin: Skin | null;
  sensitive: boolean;
  concerns: Concern[];
  hair: Hair[];
  pregnant: boolean;
  /** INCI names the user doesn't tolerate. */
  avoid: string[];
  prefs: Pref[];
};

export const EMPTY_PROFILE: Profile = { done: false, skin: null, sensitive: false, concerns: [], hair: [], pregnant: false, avoid: [], prefs: [] };

export const SKIN_LABEL: Record<Skin, string> = { normal: 'Нормальная', dry: 'Сухая', oily: 'Жирная', combo: 'Комбинированная' };
export const CONCERN_LABEL: Record<Concern, string> = {
  acne: 'Высыпания',
  pigment: 'Пигментация',
  aging: 'Морщины, упругость',
  dehydration: 'Обезвоженность',
  redness: 'Покраснение, розацеа',
  pores: 'Расширенные поры',
  dullness: 'Тусклый тон',
};
export const HAIR_LABEL: Record<Hair, string> = {
  normal: 'Нормальные',
  dry: 'Сухие',
  oily: 'Жирные у корней',
  colored: 'Окрашенные',
  damaged: 'Повреждённые',
  thin: 'Тонкие',
  curly: 'Кудрявые',
  dandruff: 'Перхоть, зуд',
};
export const PREF_LABEL: Record<Pref, string> = {
  noFragrance: 'Без отдушек',
  vegan: 'Веган',
  noSilicone: 'Без силиконов',
  noSulfate: 'Без сульфатов',
  noParaben: 'Без парабенов',
  natural: 'Максимально натуральное',
};

type Value = { profile: Profile; setProfile: (patch: Partial<Profile>) => void; reset: () => void };
const Ctx = createContext<Value | null>(null);
const KEY = 'essola.profile';

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, set] = useState<Profile>(EMPTY_PROFILE);
  useEffect(() => {
    readJSON<Profile | null>(KEY, null).then((p) => p && set({ ...EMPTY_PROFILE, ...p }));
  }, []);
  const setProfile = useCallback((patch: Partial<Profile>) => {
    set((prev) => {
      const next = { ...prev, ...patch };
      writeJSON(KEY, next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    set(EMPTY_PROFILE);
    writeJSON(KEY, EMPTY_PROFILE);
  }, []);
  const value = useMemo(() => ({ profile, setProfile, reset }), [profile, setProfile, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfile outside ProfileProvider');
  return v;
}

/** One line for the profile card: "Сухая, чувствительная · высыпания · беременность". */
export function profileSummary(p: Profile) {
  const parts = [
    [p.skin ? SKIN_LABEL[p.skin] : null, p.sensitive ? 'чувствительная' : null].filter(Boolean).join(', '),
    p.concerns.map((c) => CONCERN_LABEL[c].toLowerCase()).join(', '),
    p.pregnant ? 'беременность или ГВ' : '',
  ].filter(Boolean);
  return parts.join(' · ');
}
