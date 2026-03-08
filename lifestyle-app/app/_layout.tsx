import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { initDb } from '@/src/db/client';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Don't throw on font error so the app still loads with system font
  const readyToInit = loaded || !!fontError;

  useEffect(() => {
    if (!readyToInit) return;
    let cancelled = false;
    initDb()
      .then(() => {
        if (!cancelled) {
          setDbReady(true);
          setDbError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setDbError(e instanceof Error ? e.message : String(e));
          setDbReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [readyToInit]);

  useEffect(() => {
    if (readyToInit && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [readyToInit, dbReady]);

  if (!readyToInit || !dbReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (dbError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Database unavailable</Text>
        <Text style={styles.errorText}>{dbError}</Text>
        <Text style={styles.errorHint}>
          Try closing and reopening the app. If using Expo Go, ensure it is up to date.
        </Text>
      </View>
    );
  }

  return <RootLayoutNav />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 12 },
  errorTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  errorText: { color: '#888', textAlign: 'center', marginBottom: 16 },
  errorHint: { fontSize: 12, color: '#666', textAlign: 'center' },
});

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
