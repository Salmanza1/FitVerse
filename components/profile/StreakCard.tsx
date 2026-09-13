import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VisualSystem } from '@/constants/VisualSystem';

/**
 * Week streak plus the last seven days at a glance.
 *
 * Streaks are counted in weeks rather than days: a lifting plan has rest days
 * built into it, and a day streak would punish following one.
 */

const C = VisualSystem.colors;

export function StreakCard({
    streakWeeks,
    activeDays,
    totalWorkouts,
}: {
    streakWeeks: number;
    /** Last 7 days, oldest first. */
    activeDays: boolean[];
    totalWorkouts: number;
}) {
    const dayLabels = useMemo(() => {
        const today = new Date();
        return activeDays.map((_, i) => {
            const day = new Date(today);
            day.setDate(day.getDate() - (activeDays.length - 1 - i));
            return day.toLocaleDateString(undefined, { weekday: 'narrow' });
        });
    }, [activeDays]);

    const trainedThisWeek = activeDays.filter(Boolean).length;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>Streak</Text>
                <Text style={styles.total}>
                    {totalWorkouts} session{totalWorkouts === 1 ? '' : 's'} all time
                </Text>
            </View>

            <View style={styles.body}>
                <View style={styles.streakBlock}>
                    <Text style={styles.streakValue}>{streakWeeks}</Text>
                    <Text style={styles.streakUnit}>
                        {streakWeeks === 1 ? 'week' : 'weeks'}
                    </Text>
                </View>

                <View style={styles.days}>
                    {activeDays.map((active, i) => (
                        <View key={i} style={styles.day}>
                            <View style={[styles.dot, active && styles.dotActive]} />
                            <Text style={styles.dayLabel}>{dayLabels[i]}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <Text style={styles.caption}>
                {streakWeeks === 0
                    ? 'Train once this week to start a streak.'
                    : `${trainedThisWeek} day${trainedThisWeek === 1 ? '' : 's'} in the last week.`}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: C.bgMid,
        borderRadius: VisualSystem.radius.md,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        padding: VisualSystem.spacing.lg,
        ...VisualSystem.shadow.card,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: VisualSystem.spacing.md,
    },
    title: {
        fontSize: VisualSystem.text.title,
        fontWeight: '800',
        color: C.textPrimary,
        letterSpacing: -0.3,
    },
    total: {
        fontSize: VisualSystem.text.small,
        color: C.textSecondary,
    },
    body: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: VisualSystem.spacing.lg,
    },
    streakBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    streakValue: {
        fontSize: VisualSystem.text.display,
        fontWeight: '800',
        color: C.textPrimary,
        letterSpacing: -1,
        fontVariant: ['tabular-nums'],
    },
    streakUnit: {
        fontSize: VisualSystem.text.body,
        fontWeight: '700',
        color: C.textSecondary,
    },
    days: { flexDirection: 'row', gap: VisualSystem.spacing.sm },
    day: { alignItems: 'center', gap: 4 },
    dot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: C.borderStrong,
        backgroundColor: 'transparent',
    },
    dotActive: {
        backgroundColor: C.gold,
        borderColor: C.gold,
    },
    dayLabel: {
        fontSize: VisualSystem.text.caption,
        fontWeight: '700',
        color: C.textTertiary,
    },
    caption: {
        fontSize: VisualSystem.text.small,
        color: C.textTertiary,
        marginTop: VisualSystem.spacing.md,
    },
});
