import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { UserProfile } from '@/types/user';
import { DailyLog } from '@/types/nutrition';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { Tokens } from '@/constants/Tokens';
import { getNutritionBudgetView } from '@/lib/nutrition';
import { VisualSystem } from '@/constants/VisualSystem';

type Props = {
    user: UserProfile;
    log: DailyLog | null;
    greeting: string;
};

function ProgressBar({ progress, color }: { progress: number; color: string }) {
    const pct = Math.min(Math.max(progress, 0), 1);
    return (
        <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
    );
}

export function PlanSummaryCard({ user, log, greeting }: Props) {
    const firstName = user.name?.trim().split(/\s+/)[0] || user.displayName || 'there';
    const totals = log?.totals;
    const budget = totals ? getNutritionBudgetView(totals, true) : null;
    const goalKcal = user.calorieTarget || budget?.goal || 0;
    const eaten = totals?.calories ?? totals?.food_calories ?? 0;
    const effectiveGoal = budget?.effectiveGoal || goalKcal;
    const remaining = budget?.remaining ?? Math.max(0, goalKcal - eaten);
    const isOver = budget?.isOverBudget ?? remaining < 0;
    const workoutBurn = budget?.workoutBurn ?? 0;
    const calProgress = effectiveGoal > 0 ? eaten / effectiveGoal : 0;

    const proteinGoal = user.proteinTarget || log?.totals?.protein_goal_g || 0;
    const carbsGoal = user.carbTarget || log?.totals?.carb_goal_g || 0;
    const fatGoal = user.fatTarget || log?.totals?.fat_goal_g || 0;

    return (
        <LinearGradient
            colors={['rgba(212, 175, 55, 0.12)', 'rgba(255, 255, 255, 0.05)', 'rgba(10, 28, 52, 0.2)']}
            style={styles.card}
        >
            <Text style={styles.greeting}>
                {greeting}, {firstName}
            </Text>

            <View style={styles.calorieBlock}>
                <View style={styles.calorieHeader}>
                    <Text style={styles.calorieLabel}>Today&apos;s fuel</Text>
                    <Text style={styles.calorieNums}>
                        <Text style={styles.calorieEaten}>{Math.round(eaten)}</Text>
                        <Text style={styles.calorieGoal}>
                            {' '}/ {effectiveGoal || '—'} kcal
                            {workoutBurn > 0 ? ` (+${workoutBurn} gym)` : ''}
                        </Text>
                    </Text>
                </View>
                {effectiveGoal > 0 && <ProgressBar progress={calProgress} color={VisualSystem.colors.gold} />}
                {effectiveGoal > 0 && (
                    <Text style={[styles.remainingLine, isOver && styles.remainingLineOver]}>
                        {isOver
                            ? `${budget?.overBy ?? Math.abs(remaining)} kcal over today`
                            : `${Math.max(0, remaining)} kcal remaining today`}
                    </Text>
                )}
            </View>

            <View style={styles.macroRow}>
                <MacroPill label="P" value={log?.totals?.protein ?? 0} goal={proteinGoal} color="#51cf66" />
                <MacroPill label="C" value={log?.totals?.carbs ?? 0} goal={carbsGoal} color="#4dabf7" />
                <MacroPill label="F" value={log?.totals?.fat ?? 0} goal={fatGoal} color="#ff6b6b" />
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push('/(tabs)/dining')}
                    activeOpacity={0.8}
                >
                    <FontAwesome name="cutlery" size={14} color="#0C2340" />
                    <Text style={styles.actionBtnText}>Log food</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnOutline]}
                    onPress={() => router.push('/profile/personal-info')}
                    activeOpacity={0.8}
                >
                    <FontAwesome name="sliders" size={14} color={VisualSystem.colors.gold} />
                    <Text style={[styles.actionBtnText, { color: VisualSystem.colors.goldText }]}>Edit targets</Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
}

function MacroPill({
    label,
    value,
    goal,
    color,
}: {
    label: string;
    value: number;
    goal: number;
    color: string;
}) {
    return (
        <View style={styles.macroPill}>
            <Text style={[styles.macroLetter, { color }]}>{label}</Text>
            <Text style={styles.macroValue}>{Math.round(value)}g</Text>
            <Text style={styles.macroGoal}>of {goal || '—'}g</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: Tokens.radius.lg,
        padding: Tokens.spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        shadowColor: VisualSystem.colors.navy,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 6,
        marginBottom: Tokens.spacing.sm,
    },
    greeting: {
        fontSize: 20,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
        marginBottom: 4,
    },
    sub: {
        fontSize: 13,
        lineHeight: 20,
        color: FitVerseTheme.colors.textMuted,
        marginBottom: Tokens.spacing.lg,
    },
    calorieBlock: {
        marginBottom: Tokens.spacing.md,
    },
    calorieHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 8,
    },
    calorieLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: VisualSystem.colors.goldText,
        letterSpacing: 0.2,
    },
    calorieNums: {
        fontSize: 13,
    },
    calorieEaten: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '800',
    },
    calorieGoal: {
        color: FitVerseTheme.colors.textMuted,
        fontWeight: '600',
    },
    remainingLine: {
        fontSize: 11,
        fontWeight: '700',
        color: 'rgba(64, 192, 87, 0.85)',
        marginTop: 4,
    },
    remainingLineOver: {
        color: 'rgba(255, 107, 107, 0.9)',
    },
    progressTrack: {
        height: 8,
        borderRadius: 6,
        backgroundColor: VisualSystem.colors.bgMid,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 6,
    },
    macroRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: Tokens.spacing.md,
    },
    macroPill: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 10,
        paddingVertical: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    macroLetter: {
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 4,
    },
    macroValue: {
        fontSize: 15,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
    },
    macroGoal: {
        fontSize: 11,
        color: FitVerseTheme.colors.textMuted,
        marginTop: 4,
    },
    goalLine: {
        fontSize: 11,
        color: VisualSystem.colors.textSecondary,
        marginBottom: Tokens.spacing.md,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: VisualSystem.colors.gold,
        paddingVertical: 12,
        borderRadius: 10,
    },
    actionBtnOutline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.45)',
    },
    actionBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
    },
});
