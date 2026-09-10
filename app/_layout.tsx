import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AppState, View, ActivityIndicator, Platform } from 'react-native';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { router } from 'expo-router';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotreDameFactLoading } from '@/components/ui/NotreDameFactLoading';
import { PersonalizingAccountLoading } from '@/components/ui/PersonalizingAccountLoading';
import { ModernAppBackground } from '@/components/ui/ModernAppBackground';
import { AppWebFrame } from '@/components/ui/AppWebFrame';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sanitizeStoredRoute, resetAppHomeRoute, LAST_TAB_STORAGE_KEY } from '@/lib/navigation';
import { WEB_BG, webRoot, webStackContent } from '@/constants/webLayout';

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Platform.OS === 'web' ? WEB_BG : 'transparent',
    card: WEB_BG,
  },
};

const queryClient = new QueryClient();

export {
  ErrorBoundary,
} from 'expo-router';
import { VisualSystem } from '@/constants/VisualSystem';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return (
      <View style={[webRoot, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={VisualSystem.colors.gold} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const {
    user,
    isLoading: authLoading,
    isAuthLoading,
    isInitialCheck,
    isPersonalizing,
    personalizationSnapshot,
    completePersonalization,
  } = useAuth();

  const isLoading = authLoading;
  usePushNotifications();

  // Store the date when this session/app-open started
  const sessionStartDate = useRef(new Date().toISOString().split('T')[0]);
  // Ensure we only restore the last route once per session
  const hasRestoredRoute = useRef(false);

  // ── Midnight Reset ─────────────────────────────────────────────────────────
  // Only redirects to home if the CALENDAR DAY has changed since app opened.
  // Prevents accidental redirects on every app foreground event.
  useEffect(() => {
    if (!user) return;
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        const today = new Date().toISOString().split('T')[0];
        if (today !== sessionStartDate.current) {
          sessionStartDate.current = today;
          // New calendar day — reset to home so macros & stats refresh
          router.replace('/(tabs)');
          resetAppHomeRoute(AsyncStorage);
        }
      }
    });
    return () => subscription.remove();
  }, [user]);

  // ── Auth routing (critical for web — wrong stack = blank screen) ───────────
  useEffect(() => {
    if (isInitialCheck || isAuthLoading || isPersonalizing) return;

    if (!user) {
      hasRestoredRoute.current = false;
      router.replace('/(auth)');
      return;
    }

    if (!hasRestoredRoute.current) {
      hasRestoredRoute.current = true;
      AsyncStorage.getItem(LAST_TAB_STORAGE_KEY).then((lastTab) => {
        const safeRoute = sanitizeStoredRoute(lastTab);
        if (safeRoute !== lastTab) {
          resetAppHomeRoute(AsyncStorage);
        }
        setTimeout(() => {
          router.replace(safeRoute as '/(tabs)');
        }, Platform.OS === 'web' ? 0 : 150);
      });
    }
  }, [isLoading, isInitialCheck, isAuthLoading, isPersonalizing, user]);

  if (isPersonalizing && personalizationSnapshot) {
    return (
      <View style={webRoot}>
        <PersonalizingAccountLoading
          snapshot={personalizationSnapshot}
          onComplete={completePersonalization}
        />
      </View>
    );
  }

  if (isInitialCheck || isAuthLoading) {
    return (
      <View style={webRoot}>
        <NotreDameFactLoading
          headline={isAuthLoading ? 'Creating your account…' : 'Welcome to FitVerse'}
        />
      </View>
    );
  }

  return (
    <ThemeProvider value={AppTheme}>
      <View style={webRoot}>
        <View style={styles.backgroundLayer} pointerEvents="none">
          <ModernAppBackground />
        </View>
        <View style={styles.contentLayer}>
          <AppWebFrame>
            <Stack screenOptions={{ contentStyle: webStackContent, headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="profile" />
            </Stack>
          </AppWebFrame>
        </View>
      </View>
    </ThemeProvider>
  );
}

const styles = {
  backgroundLayer: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 } as const),
  },
  contentLayer: {
    flex: 1,
    zIndex: 1,
    ...(Platform.OS === 'web' ? { position: 'relative' as const, minHeight: '100vh' as unknown as number } : {}),
  },
};
