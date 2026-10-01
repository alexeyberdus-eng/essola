import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { Unbounded_400Regular, Unbounded_500Medium } from '@expo-google-fonts/unbounded';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold } from '@expo-google-fonts/onest';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
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
    Unbounded_400Regular,
    Unbounded_500Medium,
  });
  const loaded = fontsLoaded && ready;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  const [intro, setIntro] = useState(true);
  if (!loaded) return null;
  return (
    <>
      <StatusBar style="dark" />
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
        <Stack.Screen name="match" />
        <Stack.Screen name="community" />
        <Stack.Screen name="user/[id]" />
      </Stack>
      {intro && <Splash onDone={() => setIntro(false)} />}
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
