import React, { useEffect } from 'react';
import { usePathname, Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/features/auth/AuthContext';
import { LAST_TAB_STORAGE_KEY } from '@/lib/navigation';
import { VisualSystem } from '@/constants/VisualSystem';
import { webScreen } from '@/constants/webLayout';
import { Tabs } from '@/components/bottom-tabs';

/**
 * Tab icons.
 *
 * The native tab bar takes an SF Symbol or an image — not a React component —
 * so the vector-icon set used elsewhere can't be reused here. iOS gets
 * symbols; Android needs PNG assets, which the project doesn't ship yet.
 */
const ICONS = {
    index: 'person.2.fill',
    dining: 'fork.knife',
    gym: 'figure.strengthtraining.traditional',
    leaderboard: 'trophy.fill',
    profile: 'person.crop.circle.fill',
} as const;

function icon(name: keyof typeof ICONS) {
    // Always returns the symbol: the native side ignores sfSymbol off Apple
    // platforms, and the type requires an icon rather than undefined.
    return () => ({ sfSymbol: ICONS[name] });
}

function TabRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname && pathname.startsWith('/')) {
      const tabRoute = pathname === '/' ? '/(tabs)' : `/(tabs)${pathname}`;
      AsyncStorage.setItem(LAST_TAB_STORAGE_KEY, tabRoute);
    }
  }, [pathname]);
  return null;
}

export default function TabLayout() {
  const { user, isInitialCheck, isAuthLoading } = useAuth();

  if (isInitialCheck || isAuthLoading) {
    return (
      <View style={[webScreen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={VisualSystem.colors.gold} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <View style={webScreen}>
      <TabRouteTracker />

      <Tabs
        // The system draws the bar; these tint its contents.
        tabBarActiveTintColor={VisualSystem.colors.goldVivid}
        tabBarInactiveTintColor={VisualSystem.colors.textSecondary}
        screenOptions={{
          // Liquid Glass samples whatever sits behind it. Without an explicit
          // scene background the container shows its default for a frame while
          // a tab mounts, and the bar mirrors that as a grey flash. Painting
          // every scene the page colour means there is never a frame to catch.
          sceneStyle: { backgroundColor: VisualSystem.colors.bgBase },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Feed', tabBarIcon: icon('index') }} />
        <Tabs.Screen name="dining" options={{ title: 'Nutrition', tabBarIcon: icon('dining') }} />
        <Tabs.Screen name="gym" options={{ title: 'Workout', tabBarIcon: icon('gym') }} />
        <Tabs.Screen
          name="leaderboard"
          options={{ title: 'Leaderboard', tabBarIcon: icon('leaderboard') }}
        />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('profile') }} />
      </Tabs>
    </View>
  );
}
