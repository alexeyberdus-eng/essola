import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold } from '@expo-google-fonts/onest';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { prefetchBase } from '../components/ProductBase';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Splash } from '../components/Splash';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { CommunityProvider } from '../context/CommunityContext';
import { LibraryProvider } from '../context/LibraryContext';
import { UserContentProvider } from '../context/UserContentContext';
import { ProfileProvider } from '../lib/profile';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Wake the product base on the server while the app starts, so the list opens without waiting.
prefetchBase();

function Root() {
  const { ready } = useAuth();
  const [fontsLoaded] = useFonts({
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  // Never keep people behind the intro: after 6 s the app opens even if a font or the account is still loading.
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 6000);
    return () => clearTimeout(t);
  }, []);
  const loaded = (fontsLoaded && ready) || late;

  // The native splash is blank; our animation starts at once and the app appears under it as soon as it is ready.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const [intro, setIntro] = useState(true);
  return (
    <>
      <StatusBar style="dark" />
      {loaded && (
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/[id]" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="article/[id]" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="knowledge" />
        <Stack.Screen name="create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="shelf-add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="analysis/[id]" />
        <Stack.Screen name="comments/[id]" />
        <Stack.Screen name="ingredient/[id]" />
        <Stack.Screen name="cook/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
        <Stack.Screen name="about-me" options={{ presentation: 'modal' }} />
        <Stack.Screen name="club" options={{ presentation: 'modal' }} />
        <Stack.Screen name="match" />
        <Stack.Screen name="community" />
        <Stack.Screen name="user/[id]" />
      </Stack>
      )}
      {intro && <Splash onDone={() => setIntro(false)} ready={loaded} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProfileProvider>
        <LibraryProvider>
          <CommunityProvider>
            <UserContentProvider>
              <Root />
            </UserContentProvider>
          </CommunityProvider>
        </LibraryProvider>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
