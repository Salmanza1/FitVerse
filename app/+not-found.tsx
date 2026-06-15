import { Stack, router } from 'expo-router';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { useAuth } from '@/features/auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { goToAppHome, resetAppHomeRoute, LAST_TAB_STORAGE_KEY } from '@/lib/navigation';

export default function NotFoundScreen() {
    const { user, recoverSession, signOut } = useAuth();

    const handleGoHome = async () => {
        await resetAppHomeRoute(AsyncStorage);
        goToAppHome();
    };

    const handleRetrySession = async () => {
        const result = await recoverSession();
        if (!result.ok) {
            router.replace('/(auth)');
        }
    };

    return (
        <>
            <Stack.Screen options={{ title: 'FitVerse', headerShown: false }} />
            <View style={styles.container}>
                <Text style={styles.title}>Wrong turn ☘️</Text>
                <Text style={styles.subtitle}>
                    This screen doesn&apos;t exist — often after signup if the app saved an old route.
                </Text>

                <TouchableOpacity style={styles.primaryBtn} onPress={handleGoHome}>
                    <Text style={styles.primaryText}>Go to FitVerse Feed</Text>
                </TouchableOpacity>

                {user && (
                    <TouchableOpacity style={styles.secondaryBtn} onPress={handleRetrySession}>
                        <Text style={styles.secondaryText}>Retry loading my account</Text>
                    </TouchableOpacity>
                )}

                {user ? (
                    <TouchableOpacity style={styles.linkBtn} onPress={handleGoHome}>
                        <Text style={styles.linkText}>You&apos;re signed in — open the app</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.linkBtn}
                        onPress={() => router.replace('/(auth)')}
                    >
                        <Text style={styles.linkText}>Back to login</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={async () => {
                        await AsyncStorage.removeItem(LAST_TAB_STORAGE_KEY);
                        await signOut();
                        router.replace('/(auth)');
                    }}
                >
                    <Text style={[styles.linkText, { color: 'rgba(255,255,255,0.45)' }]}>
                        Sign out & start over
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        backgroundColor: '#0C2340',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 22,
        color: '#A0AEC0',
        textAlign: 'center',
        marginBottom: 28,
        maxWidth: 320,
    },
    primaryBtn: {
        backgroundColor: '#D4AF37',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 14,
        width: '100%',
        maxWidth: 320,
        marginBottom: 12,
    },
    primaryText: {
        color: '#0C2340',
        fontWeight: '800',
        fontSize: 16,
        textAlign: 'center',
    },
    secondaryBtn: {
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.5)',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 14,
        width: '100%',
        maxWidth: 320,
        marginBottom: 16,
    },
    secondaryText: {
        color: '#D4AF37',
        fontWeight: '700',
        fontSize: 15,
        textAlign: 'center',
    },
    linkBtn: {
        paddingVertical: 10,
    },
    linkText: {
        color: '#D4AF37',
        fontSize: 14,
        fontWeight: '600',
    },
});
