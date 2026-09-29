import AsyncStorage from '@react-native-async-storage/async-storage';

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJSON(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience layer; the UI keeps working from memory.
  }
}

export async function remove(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}
