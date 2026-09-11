import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, usePathname, Redirect } from 'expo-router';
import { View, ActivityIndicator, type ColorValue } from 'react-native';
import { useAuth } from '@/features/auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { LAST_TAB_STORAGE_KEY } from '@/lib/navigation';
import { VisualSystem } from '@/constants/VisualSystem';
import { WEB_BG, webScreen } from '@/constants/webLayout';
import { LiquidGlassTabBar } from '@/components/ui/LiquidGlassTabBar';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: ColorValue;
  size?: number;
}) {
  // One size for every tab: growing the active icon fights the color change
  // that already signals selection, and makes the row sit unevenly.
  return <Ionicons size={props.size ?? 25} name={props.name} color={props.color as string} />;
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
        tabBar={(props) => <LiquidGlassTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: VisualSystem.colors.gold,
          tabBarInactiveTintColor: VisualSystem.colors.textTertiary,
          sceneStyle: { backgroundColor: WEB_BG },
          headerShown: false,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="dining"
          options={{
            title: 'Nutrition',
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon name={focused ? 'restaurant' : 'restaurant-outline'} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="gym"
          options={{
            title: 'Workout',
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon name={focused ? 'barbell' : 'barbell-outline'} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: 'Leaderboard',
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon name={focused ? 'trophy' : 'trophy-outline'} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon name={focused ? 'person-circle' : 'person-circle-outline'} color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
