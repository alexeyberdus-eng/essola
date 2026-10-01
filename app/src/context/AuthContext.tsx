import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { SkinType } from '../lib/analyze';
import { readJSON, remove, writeJSON } from '../lib/storage';
import { supabase } from '../lib/supabase';

export type User = {
  id: string;
  email: string | null;
  name: string | null;
  provider: 'apple' | 'email';
  since: string;
  skinType: SkinType | null;
  /** Hair condition, several can apply at once (e.g. dry + coloured). */
  hair: HairType[];
  /** true when the account lives only on this device (backend not configured) */
  local: boolean;
};

type AuthValue = {
  user: User | null;
  ready: boolean;
  appleAvailable: boolean;
  signInWithApple: () => Promise<void>;
  requestEmailCode: (email: string) => Promise<{ demo: boolean }>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'skinType' | 'hair'>>) => Promise<void>;
  signOut: () => Promise<void>;
};

export type HairType = 'normal' | 'dry' | 'oily' | 'colored' | 'damaged' | 'thin' | 'curly';

const LOCAL_KEY = 'essola.localUser';
const AuthContext = createContext<AuthValue | null>(null);

type SupabaseUser = NonNullable<Awaited<ReturnType<NonNullable<typeof supabase>['auth']['getUser']>>['data']['user']>;

function fromSupabase(u: SupabaseUser): User {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const provider = u.app_metadata?.provider === 'apple' ? 'apple' : 'email';
  return {
    id: u.id,
    email: u.email ?? null,
    name: (meta.full_name as string) || (meta.name as string) || null,
    provider,
    since: u.created_at,
    skinType: (meta.skin_type as SkinType) ?? null,
    hair: (meta.hair_type as HairType[]) ?? [],
    local: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});

    if (!supabase) {
      readJSON<User | null>(LOCAL_KEY, null).then((u) => {
        setUser(u ? { ...u, hair: u.hair ?? [] } : null);
        setReady(true);
      });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? fromSupabase(data.session.user) : null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? fromSupabase(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const saveLocal = useCallback(async (u: User) => {
    setUser(u);
    await writeJSON(LOCAL_KEY, u);
  }, []);

  const signInWithApple = useCallback(async () => {
    // Apple receives the hashed nonce, Supabase gets the raw one to verify the token.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ') || null;

    if (supabase) {
      if (!cred.identityToken) throw new Error('Apple не вернул токен. Попробуйте ещё раз.');
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: rawNonce });
      if (error) throw error;
      // Apple shares the name only on the very first sign-in, so persist it right away.
      if (fullName) await supabase.auth.updateUser({ data: { full_name: fullName } });
      return;
    }
    const prev = await readJSON<User | null>(LOCAL_KEY, null);
    await saveLocal({
      id: `apple:${cred.user}`,
      email: cred.email ?? prev?.email ?? null,
      name: fullName ?? prev?.name ?? null,
      provider: 'apple',
      since: prev?.since ?? new Date().toISOString(),
      skinType: prev?.skinType ?? null,
      hair: prev?.hair ?? [],
      local: true,
    });
  }, [saveLocal]);

  const requestEmailCode = useCallback(async (email: string) => {
    if (!supabase) return { demo: true };
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
    return { demo: false };
  }, []);

  const verifyEmailCode = useCallback(
    async (email: string, code: string) => {
      if (supabase) {
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error) throw new Error('Неверный или просроченный код');
        return;
      }
      if (!/^\d{6}$/.test(code)) throw new Error('Код состоит из 6 цифр');
      await saveLocal({
        id: `email:${email.toLowerCase()}`,
        email,
        name: null,
        provider: 'email',
        since: new Date().toISOString(),
        skinType: null,
        hair: [],
        local: true,
      });
    },
    [saveLocal],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, 'name' | 'skinType' | 'hair'>>) => {
      if (!user) return;
      const next = { ...user, ...patch };
      setUser(next);
      if (supabase && !user.local) {
        const data: Record<string, unknown> = {};
        if ('name' in patch) data.full_name = patch.name;
        if ('skinType' in patch) data.skin_type = patch.skinType;
        if ('hair' in patch) data.hair_type = patch.hair;
        await supabase.auth.updateUser({ data });
      } else {
        await writeJSON(LOCAL_KEY, next);
      }
    },
    [user],
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    await remove(LOCAL_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, appleAvailable, signInWithApple, requestEmailCode, verifyEmailCode, updateProfile, signOut }),
    [user, ready, appleAvailable, signInWithApple, requestEmailCode, verifyEmailCode, updateProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
