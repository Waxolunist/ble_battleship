import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { TourGuideOverlay, TourGuideProvider } from '@wrack/react-native-tour-guide';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import '@/i18n';
import { useLanguageStore } from '@/store/useLanguageStore';
import { MultiplayerDebugPanel } from '@/components/multiplayer/MultiplayerDebugPanel';
import { SplashOverlay } from '@/components/splash-overlay';

import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useLanguageStore();
  const [fontsLoaded] = useFonts({
    BlackOpsOne: require('../assets/fonts/BlackOpsOne-Regular.ttf'),
  });

  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  const theme =
    colorScheme === 'dark'
      ? DarkTheme
      : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#1a1a1a' } };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TourGuideProvider>
        <ThemeProvider value={theme}>
          <Stack screenOptions={{ contentStyle: { backgroundColor: '#1a1a1a' } }}>
            <Stack.Screen
              name="(tabs)"
              options={{ headerShown: false, contentStyle: { backgroundColor: '#1a1a1a' } }}
            />
            <Stack.Screen
              name="battle"
              options={{ headerShown: false, animation: 'fade_from_bottom' }}
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
        <TourGuideOverlay />
        <MultiplayerDebugPanel />
        {!splashDone && <SplashOverlay ready={fontsLoaded} onFinish={handleSplashFinish} />}
      </TourGuideProvider>
    </GestureHandlerRootView>
  );
}
