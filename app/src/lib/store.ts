import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Where buying points with ЮKassa may be shown. Payments come only in a store-reviewed app version: builds from
// 1.1.0 on (the version is in the native app, an over-the-air update cannot change it). Never on iPhone (Apple
// sells digital goods only through its own purchases) and never in the Google Play build (Google Play billing),
// whose version name ends with «-gp». Expo Go (testing) may buy.
function nativeVersion(): string | null {
  try {
    // Builds before 1.1.0 have no expo-application inside: the require throws there, and buying stays hidden.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-application') as typeof import('expo-application')).nativeApplicationVersion;
  } catch {
    return null;
  }
}

export function canBuyPoints(): boolean {
  if (Platform.OS !== 'android') return false;
  if (Constants.executionEnvironment === 'storeClient') return true;
  const v = nativeVersion();
  if (!v || /-gp$/.test(v)) return false;
  const [major, minor] = v.split('.').map((x) => parseInt(x, 10) || 0);
  return major > 1 || (major === 1 && minor >= 1);
}
