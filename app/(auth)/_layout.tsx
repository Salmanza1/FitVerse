import { Stack, Redirect } from 'expo-router';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useAuth } from '@/features/auth/AuthContext';
import { webScreen } from '@/constants/webLayout';
import { VisualSystem } from '@/constants/VisualSystem';

export default function AuthLayout() {
    const colorScheme = useColorScheme();
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

    const CustomLightTheme = {
        ...DefaultTheme,
        colors: {
            ...DefaultTheme.colors,
            background: VisualSystem.colors.bgMid, // ndNavy
            card: '#152B4D',       // ndAccentNavy
            text: '#F5F5F5',
            border: 'rgba(212, 175, 55, 0.2)',
            notification: '#D4AF37',
        },
    };

    return (
        <ThemeProvider value={DarkTheme}>
            <Stack screenOptions={{ contentStyle: { backgroundColor: VisualSystem.colors.bgMid } }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="signup" options={{ headerShown: false }} />
            </Stack>
        </ThemeProvider>
    );
}
