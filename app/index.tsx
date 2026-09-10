import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/features/auth/AuthContext';
import { webRoot } from '@/constants/webLayout';
import { VisualSystem } from '@/constants/VisualSystem';

/** Root URL `/` — send users to login or the main app. */
export default function RootIndex() {
    const { user, isInitialCheck, isAuthLoading } = useAuth();

    if (isInitialCheck || isAuthLoading) {
        return (
            <View style={[webRoot, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={VisualSystem.colors.gold} />
            </View>
        );
    }

    if (user) {
        return <Redirect href="/(tabs)" />;
    }

    return <Redirect href="/(auth)" />;
}
