import AsyncStorage from '@react-native-async-storage/async-storage';
import { onStorageWrite } from './storage';

// Accounts and the person's data on our Yandex Cloud function (personal data stays in Russia).
// The phone keeps working from its own storage; signed in, the synced keys are copied to the account and back.

const url = process.env.EXPO_PUBLIC_SCAN_URL;
const key = process.env.EXPO_PUBLIC_SCAN_KEY ?? '';
export const cloudEnabled = !!url;

const SESSION = 'essola.session';
/** What follows the person between phones. Caches (product base pages, AI texts) stay local. */
const SYNCED = /^essola\.(scans\.|likes\.|shelf|myRecipes|following|barcodes|profile|blocked|rulesAccepted|comments|commentLikes)/;

let session: string | null = null;
let loaded = false;
export async function getSession() {
  if (!loaded) {
    session = await AsyncStorage.getItem(SESSION).catch(() => null);
    loaded = true;
  }
  return session;
}
export async function setSession(token: string | null) {
  session = token;
  loaded = true;
  if (token) await AsyncStorage.setItem(SESSION, token).catch(() => {});
  else await AsyncStorage.removeItem(SESSION).catch(() => {});
}

export class CloudError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export async function cloud<T>(mode: string, body: object = {}, timeout = 15000): Promise<T> {
  if (!url) throw new CloudError(0, 'offline');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Key': key },
    body: JSON.stringify({ mode, session: await getSession(), ...body }),
    signal: AbortSignal.timeout(timeout),
  }).catch(() => null);
  if (!res) throw new CloudError(0, 'network');
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new CloudError(res.status, (json as { error?: string }).error ?? `http_${res.status}`);
  return json as T;
}

// Scans and likes are kept per person on the phone (essola.scans.<id>): only the signed-in account's own lists
// go to its cloud copy, never another account's or a guest's left on the same phone.
let owner: string | null = null;
export function setSyncOwner(id: string | null) {
  owner = id;
}
const mine = (k: string) => {
  const m = k.match(/^essola\.(scans|likes)\.(.+)$/);
  return !m || m[2] === owner;
};

async function localData() {
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => SYNCED.test(k) && mine(k));
  const pairs = await AsyncStorage.multiGet(keys).catch(() => [] as readonly [string, string | null][]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of pairs) {
    if (v == null) continue;
    try {
      out[k] = JSON.parse(v);
    } catch {}
  }
  return out;
}

/** Lists are joined without duplicates (by id when items have one); objects take the phone's fields over the account's. */
function merge(local: unknown, remote: unknown): unknown {
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  if (Array.isArray(local) && Array.isArray(remote)) {
    const id = (x: unknown) => (x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : JSON.stringify(x));
    const seen = new Set(local.map(id));
    return [...local, ...remote.filter((x) => !seen.has(id(x)))];
  }
  if (local && remote && typeof local === 'object' && typeof remote === 'object') return { ...(remote as object), ...(local as object) };
  return local;
}

let pushing = false;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Sends the synced keys to the account (a few seconds after the last change). */
export async function pushData() {
  if (!(await getSession()) || pushing) {
    dirty = true;
    return;
  }
  pushing = true;
  dirty = false;
  try {
    await cloud('data.put', { data: await localData() }, 30000);
  } catch {
    dirty = true;
  } finally {
    pushing = false;
  }
}

onStorageWrite((k) => {
  if (!SYNCED.test(k) || !session) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    pushData();
  }, 4000);
});

/** After signing in: the account's data is merged into the phone's. Returns true when something new arrived. */
export async function pullData(): Promise<boolean> {
  const { data } = await cloud<{ data: Record<string, unknown> }>('data.get', {}, 30000);
  const local = await localData();
  const writes: [string, string][] = [];
  for (const [k, v] of Object.entries(data ?? {})) {
    if (!SYNCED.test(k) || !mine(k)) continue;
    const next = merge(local[k], v);
    if (JSON.stringify(next) !== JSON.stringify(local[k])) writes.push([k, JSON.stringify(next)]);
  }
  if (writes.length) await AsyncStorage.multiSet(writes).catch(() => {});
  await pushData();
  return writes.length > 0;
}

/**
 * Signing out: the last changes go to the account, then everything personal leaves the phone (it comes back with
 * the next sign-in), so the next person on this phone starts clean and gets nothing of this account.
 */
export async function clearPersonalData() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (session) await pushData().catch(() => {});
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => SYNCED.test(k) || k === 'essola.uid');
  await AsyncStorage.multiRemove(keys).catch(() => {});
  dirty = false;
  owner = null;
}

/** Retries a sync that failed while offline. */
export function flushIfDirty() {
  if (dirty) pushData();
}
