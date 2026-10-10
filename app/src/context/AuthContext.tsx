import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DevSettings, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import type { SkinType } from '../lib/analyze';
import { clearPersonalData, cloud, CloudError, cloudEnabled, getSession, pullData, setSession, setSyncOwner } from '../lib/cloud';
import { readJSON, remove, writeJSON } from '../lib/storage';
import { resetMyId, setMyId } from '../lib/social';
import { signInWithVk as vkLogin } from '../lib/vk';

export type User = {
  id: string;
  email: string | null;
  name: string | null;
  /** Public nickname shown on recipes and comments. */
  nick?: string | null;
  provider: 'apple' | 'email' | 'vk';
  since: string;
  skinType: SkinType | null;
  /** Hair condition, several can apply at once (e.g. dry + coloured). */
  hair: HairType[];
  /** true when the account lives only on this device (no server) */
  local: boolean;
};

type AuthValue = {
  user: User | null;
  ready: boolean;
  appleAvailable: boolean;
  /** needsNick: the account has no public nickname yet */
  signInWithApple: () => Promise<{ needsNick: boolean }>;
  /** null when the person closed the VK window */
  signInWithVk: () => Promise<{ needsNick: boolean } | null>;
  requestEmailCode: (email: string) => Promise<{ demo: boolean }>;
  verifyEmailCode: (email: string, code: string, extra?: { name?: string; nick?: string }) => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'nick' | 'skinType' | 'hair'>>) => Promise<void>;
  signOut: () => Promise<void>;
};

export type HairType = 'normal' | 'dry' | 'oily' | 'colored' | 'damaged' | 'thin' | 'curly';

// The signed-in account as last seen, so the app opens signed in even without internet.
const ACCOUNT_KEY = 'essola.account';
// Accounts from before the server existed lived only on the phone.
const LEGACY_KEY = 'essola.localUser';
const AuthContext = createContext<AuthValue | null>(null);

type Account = { uid: string; provider: User['provider']; email: string | null; name: string | null; nick: string | null; skinType?: SkinType | null; hair?: HairType[]; createdAt: string };

const fromAccount = (a: Account): User => ({
  id: a.uid,
  email: a.email,
  name: a.name,
  nick: a.nick,
  provider: a.provider,
  since: a.createdAt,
  skinType: a.skinType ?? null,
  hair: a.hair ?? [],
  local: false,
});

const RELOAD = () => {
  Updates.reloadAsync().catch(() => DevSettings.reload());
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    (async () => {
      const cached = await readJSON<User | null>(ACCOUNT_KEY, null);
      const signedIn = !!cached && !!(await getSession());
      if (signedIn) {
        setUser(cached);
        setMyId(cached!.id);
        setSyncOwner(cached!.id);
      }
      setReady(true);
      // Refresh from the server in the background; a revoked session signs out.
      if (signedIn) {
        cloud<{ account: Account }>('me.get', {}, 8000)
          .then(({ account }) => {
            const u = fromAccount(account);
            setUser(u);
            writeJSON(ACCOUNT_KEY, u);
          })
          .catch(async (e) => {
            if (e instanceof CloudError && e.status === 401) {
              await setSession(null);
              await remove(ACCOUNT_KEY);
              await clearPersonalData();
              resetMyId();
              setUser(null);
            }
          });
      }
    })();
  }, []);

  /** A new session: remember it, carry over what the phone had, bring the account's data here. */
  const opened = useCallback(async (session: string, account: Account) => {
    await setSession(session);
    const u = fromAccount(account);
    // Scans and likes saved under an older, phone-only account move to the real one.
    const legacy = await readJSON<{ id: string } | null>(LEGACY_KEY, null);
    for (const old of [legacy?.id, 'guest'].filter(Boolean) as string[]) {
      if (old === u.id) continue;
      for (const k of ['scans', 'likes']) {
        const from = await readJSON<unknown[]>(`essola.${k}.${old}`, []);
        if (!from.length) continue;
        const to = await readJSON<unknown[]>(`essola.${k}.${u.id}`, []);
        await writeJSON(`essola.${k}.${u.id}`, [...to, ...from.filter((x) => !to.some((y) => JSON.stringify(y) === JSON.stringify(x)))]);
      }
    }
    if (legacy) await remove(LEGACY_KEY);
    await writeJSON(ACCOUNT_KEY, u);
    setMyId(u.id);
    setSyncOwner(u.id);
    setUser(u);
    // Another phone's data arrived: restart once so every screen reads it.
    const restored = await pullData().catch(() => false);
    if (restored) setTimeout(RELOAD, 300);
  }, []);

  const signInWithApple = useCallback(async () => {
    // Apple receives the hashed nonce; the identity token it signs is checked by our server.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!cred.identityToken) throw new Error('Apple не вернул токен. Попробуйте ещё раз.');
    const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ') || undefined;
    const r = await cloud<{ session: string; account: Account }>('auth.apple', { token: cred.identityToken, name, consent: true }).catch(fail);
    await opened(r.session, r.account);
    return { needsNick: !r.account.nick };
  }, [opened]);

  const signInWithVk = useCallback(async () => {
    const vk = await vkLogin();
    if (!vk) return null;
    const r = await cloud<{ session: string; account: Account }>('auth.vk', { token: vk.accessToken, consent: true }).catch(fail);
    await opened(r.session, r.account);
    return { needsNick: !r.account.nick };
  }, [opened]);

  const requestEmailCode = useCallback(async (email: string) => {
    if (!cloudEnabled) return { demo: true };
    await cloud('auth.email.start', { email }).catch((e) => {
      if (e instanceof CloudError && e.code === 'too_often') throw new Error('Код уже отправлен — подождите минуту и попробуйте снова');
      if (e instanceof CloudError && e.code === 'mail_unavailable') throw new Error('Вход по почте временно недоступен. Войдите через Apple или VK');
      fail(e);
    });
    return { demo: false };
  }, []);

  const verifyEmailCode = useCallback(
    async (email: string, code: string, extra?: { name?: string; nick?: string }) => {
      if (!/^\d{6}$/.test(code)) throw new Error('Код состоит из 6 цифр');
      const r = await cloud<{ session: string; account: Account }>('auth.email.verify', { email, code, name: extra?.name, consent: true }).catch((e) => {
        if (e instanceof CloudError && (e.code === 'wrong_code' || e.code === 'expired')) throw new Error(e.code === 'wrong_code' ? 'Неверный код' : 'Код устарел — запросите новый');
        return fail(e);
      });
      await opened(r.session, r.account);
      if (extra?.nick || (extra?.name && !r.account.name)) {
        const saved = await cloud<{ account: Account }>('me.save', { patch: { nick: extra?.nick, name: extra?.name ?? r.account.name } }).catch(() => null);
        if (saved) {
          setUser(fromAccount(saved.account));
          writeJSON(ACCOUNT_KEY, fromAccount(saved.account));
        }
      }
    },
    [opened],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, 'name' | 'nick' | 'skinType' | 'hair'>>) => {
      if (!user) return;
      const next = { ...user, ...patch };
      setUser(next);
      await writeJSON(ACCOUNT_KEY, next);
      await cloud('me.save', { patch }).catch(() => {});
    },
    [user],
  );

  const signOut = useCallback(async () => {
    // Personal data goes to the account first and then leaves the phone: the next person here starts clean.
    await clearPersonalData();
    await cloud('auth.logout').catch(() => {});
    await setSession(null);
    await remove(ACCOUNT_KEY);
    resetMyId();
    setUser(null);
    setTimeout(RELOAD, 300);
  }, []);

  const value = useMemo(
    () => ({ user, ready, appleAvailable, signInWithApple, signInWithVk, requestEmailCode, verifyEmailCode, updateProfile, signOut }),
    [user, ready, appleAvailable, signInWithApple, signInWithVk, requestEmailCode, verifyEmailCode, updateProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Turns server and network errors into a plain message. */
function fail(e: unknown): never {
  if (e instanceof CloudError && (e.code === 'network' || e.code === 'offline')) throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
  if (e instanceof CloudError && e.code === 'bad_token') throw new Error('Не получилось подтвердить вход. Попробуйте ещё раз.');
  throw e instanceof Error ? e : new Error('Что-то пошло не так');
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
