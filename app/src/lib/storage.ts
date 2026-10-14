import AsyncStorage from '@react-native-async-storage/async-storage';

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Listeners told about every write (the account sync uses it to know what changed).
const writeListeners: ((key: string) => void)[] = [];
export function onStorageWrite(f: (key: string) => void) {
  writeListeners.push(f);
}

export async function writeJSON(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    writeListeners.forEach((f) => f(key));
  } catch {
    // Storage is a convenience layer; the UI keeps working from memory.
  }
}

export async function remove(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}
