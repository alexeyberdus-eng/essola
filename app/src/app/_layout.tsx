import { BodoniModa_400Regular } from '@expo-google-fonts/bodoni-moda';
import { CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { MrsSaintDelafield_400Regular } from '@expo-google-fonts/mrs-saint-delafield';
import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold } from '@expo-google-fonts/onest';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LibraryProvider } from '../context/LibraryContext';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { ready } = useAuth();
  const [fontsLoaded] = useFonts({
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    JetBrainsMono_500Medium,
    BodoniModa_400Regular,
    MrsSaintDelafield_400Regular,
  });
  const loaded = fontsLoaded && ready;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="analysis/[id]" />
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LibraryProvider>
          <Root />
        </LibraryProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
