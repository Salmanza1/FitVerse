import { Stack, Redirect, ThemeProvider, DefaultTheme } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/features/auth/AuthContext';
import { webScreen } from '@/constants/webLayout';
import { VisualSystem } from '@/constants/VisualSystem';

const AuthTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: VisualSystem.colors.bgBase,
        card: VisualSystem.colors.bgMid,
        text: VisualSystem.colors.textPrimary,
        border: VisualSystem.colors.borderSubtle,
        notification: VisualSystem.colors.gold,
        primary: VisualSystem.colors.gold,
    },
};

export default function AuthLayout() {
    const { user, isInitialCheck, isAuthLoading } = useAuth();

    if (isInitialCheck || isAuthLoading) {
        return (
            <View style={[webScreen, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={VisualSystem.colors.gold} />
            </View>
        );
    }

    if (user) {
        return <Redirect href="/(tabs)" />;
    }

    return (
        <ThemeProvider value={AuthTheme}>
            <Stack
                screenOptions={{
                    contentStyle: { backgroundColor: VisualSystem.colors.bgMid },
                    gestureEnabled: false,
                }}
            >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="signup" options={{ headerShown: false }} />
            </Stack>
        </ThemeProvider>
    );
}
