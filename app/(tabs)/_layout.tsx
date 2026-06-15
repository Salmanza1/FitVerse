import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, usePathname, Redirect } from 'expo-router';
import { View, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '@/features/auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { BlurView } from 'expo-blur';
import { LAST_TAB_STORAGE_KEY } from '@/lib/navigation';
import { VisualSystem } from '@/constants/VisualSystem';
import { WEB_BG, webScreen } from '@/constants/webLayout';

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

function ModernTabBarBackground() {
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={72}
        tint="dark"
        style={[StyleSheet.absoluteFill, styles.tabBarBlur]}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? styles.tabBarWeb : styles.tabBarAndroid]} />;
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
        <ActivityIndicator size="large" color="#D4AF37" />
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
        screenOptions={{
          tabBarActiveTintColor: VisualSystem.colors.gold,
          tabBarInactiveTintColor: VisualSystem.colors.textTertiary,
          tabBarBackground: () => <ModernTabBarBackground />,
          sceneStyle: { backgroundColor: WEB_BG },
          tabBarStyle: {
            position: 'absolute',
            bottom: Platform.OS === 'web' ? 12 : 22,
            left: Platform.OS === 'web' ? 12 : 18,
            right: Platform.OS === 'web' ? 12 : 18,
            maxWidth: Platform.OS === 'web' ? 520 : undefined,
            alignSelf: Platform.OS === 'web' ? 'center' : undefined,
            marginHorizontal: Platform.OS === 'web' ? 'auto' : undefined,
            backgroundColor:
              Platform.OS === 'ios' ? 'transparent' : 'rgba(10, 28, 52, 0.96)',
            borderRadius: VisualSystem.radius.pill,
            height: 68,
            paddingBottom: 0,
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: VisualSystem.colors.borderGold,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
            elevation: 12,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.3,
            marginBottom: 8,
          },
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

const styles = StyleSheet.create({
  tabBarBlur: {
    borderRadius: VisualSystem.radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 28, 52, 0.55)',
  },
  tabBarAndroid: {
    borderRadius: VisualSystem.radius.pill,
    backgroundColor: 'rgba(10, 28, 52, 0.94)',
  },
  tabBarWeb: {
    borderRadius: VisualSystem.radius.pill,
    backgroundColor: 'rgba(10, 28, 52, 0.98)',
    borderWidth: 1,
    borderColor: VisualSystem.colors.borderGold,
  },
});
