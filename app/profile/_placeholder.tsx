import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { Tokens } from '@/constants/Tokens';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { VisualSystem } from '@/constants/VisualSystem';

export default function PlaceholderScreen({ title }: { title: string }) {
    return (
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Stack.Screen
                options={{
                    title: title,
                    headerStyle: { backgroundColor: VisualSystem.colors.bgMid },
                    headerTintColor: Tokens.colors.textPrimary,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
                            <FontAwesome name="chevron-left" size={20} color={Tokens.colors.textPrimary} />
                        </TouchableOpacity>
                    )
                }}
            />
            <View style={styles.content}>
                <FontAwesome name="info-circle" size={64} color={Tokens.colors.accentGold} style={{ marginBottom: 16 }} />
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>This is a placeholder for the {title} screen.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Tokens.colors.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Tokens.spacing.xl,
    },
    title: {
        fontSize: Tokens.typography.xl,
        fontWeight: '700',
        color: Tokens.colors.textPrimary,
        marginBottom: Tokens.spacing.md,
    },
    subtitle: {
        fontSize: Tokens.typography.md,
        color: Tokens.colors.textMuted,
        textAlign: 'center',
    }
});
