import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { FitVerseTheme } from '@/constants/FitVerseTheme';

const TABS = [
    { icon: 'users' as const, label: 'Feed', route: '/(tabs)' },
    { icon: 'cutlery' as const, label: 'Nutrition', route: '/(tabs)/dining' },
    { icon: 'bolt' as const, label: 'Workout', route: '/(tabs)/gym' },
    { icon: 'trophy' as const, label: 'Community', route: '/(tabs)/leaderboard' },
];

export function QuickNavRow() {
    return (
        <View style={styles.row}>
            {TABS.map((tab) => (
                <Pressable
                    key={tab.route}
                    style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(tab.route as '/(tabs)');
                    }}
                >
                    <FontAwesome name={tab.icon} size={16} color={FitVerseTheme.colors.accentGold} />
                    <Text style={styles.label}>{tab.label}</Text>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    chip: {
        flex: 1,
        minWidth: '22%',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    chipPressed: {
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        borderColor: 'rgba(212, 175, 55, 0.35)',
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        color: '#E2E8F0',
        marginTop: 6,
    },
});
