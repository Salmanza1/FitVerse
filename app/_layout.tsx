import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AppState, View, ActivityIndicator, Platform, Appearance } from 'react-native';
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
import { getLocalDateString } from '@/features/utils/DateUtils';

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Platform.OS === 'web' ? WEB_BG : 'transparent',
    card: WEB_BG,
  },
};

const queryClient = new QueryClient();

export {
  ErrorBoundary,
} from 'expo-router';
import * as Notifications from 'expo-notifications';
import { VisualSystem } from '@/constants/VisualSystem';

/**
 * Without a handler, expo-notifications drops anything that arrives while the
 * app is open. The rest timer fires exactly then as often as not, so the alert
 * has to be allowed through rather than silently swallowed.
 */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const unstable_settings = {
  initialRouteName: '(auth)',
};

/**
 * The app ships a single light theme, so pin the interface style instead of
 * following the device. On a phone in dark mode the native views — the tab
 * bar most visibly — render their dark appearance for a frame before our
 * light styling applies, which reads as a grey flash with white icons on
 * every tab change.
 *
 * app.json also sets userInterfaceStyle to "light", but that writes
 * UIUserInterfaceStyle into Info.plist and only takes effect in a new native
 * build; this covers the build already installed.
 */
Appearance.setColorScheme('light');

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
  const sessionStartDate = useRef(getLocalDateString());
  // Ensure we only restore the last route once per session
  const hasRestoredRoute = useRef(false);

  // ── Midnight Reset ─────────────────────────────────────────────────────────
  // Only redirects to home if the CALENDAR DAY has changed since app opened.
  // Prevents accidental redirects on every app foreground event.
  useEffect(() => {
    if (!user) return;
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        const today = getLocalDateString();
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
