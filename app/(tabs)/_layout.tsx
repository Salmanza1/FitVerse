import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, usePathname, Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/features/auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { LAST_TAB_STORAGE_KEY } from '@/lib/navigation';
import { VisualSystem } from '@/constants/VisualSystem';
import { WEB_BG, webScreen } from '@/constants/webLayout';
import { LiquidGlassTabBar } from '@/components/ui/LiquidGlassTabBar';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  focused?: boolean;
}) {
  return (
    <FontAwesome
      size={props.focused ? 22 : 20}
      style={{ marginBottom: -2 }}
      name={props.name}
      color={props.color}
    />
  );
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
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="users" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="dining"
          options={{
            title: 'Nutrition',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="cutlery" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="gym"
          options={{
            title: 'Workout',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="bolt" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: 'Leaderboard',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="trophy" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="user" color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
