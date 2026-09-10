import React, { useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Workout } from '@/types/workout';
import { VisualSystem } from '@/constants/VisualSystem';
import { WorkoutMilestone } from '@/features/workout/workoutMilestones';
import { formatExerciseDisplayName } from '@/features/workout/exerciseLibrary';

const C = VisualSystem.colors;

type Props = {
    visible: boolean;
    workout: Workout | null;
    milestones: WorkoutMilestone[];
    caloriesBurned: number | null;
    isQuickPosting: boolean;
    onQuickPost: () => void;
    onCustomizePost: () => void;
    onSaveTemplate: () => void;
    onDone: () => void;
};

function formatDuration(seconds: number): string {
    const mins = Math.max(1, Math.round(seconds / 60));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function milestoneIcon(type: WorkoutMilestone['type']) {
    switch (type) {
        case 'first_workout':
            return 'flag';
        case 'volume_pr':
            return 'line-chart';
        case 'exercise_pr':
            return 'trophy';
        case 'weekly_streak':
            return 'fire';
        default:
            return 'star';
    }
}

export function WorkoutCompleteModal({
    visible,
    workout,
    milestones,
    caloriesBurned,
    isQuickPosting,
    onQuickPost,
    onCustomizePost,
    onSaveTemplate,
    onDone,
}: Props) {
    const insets = useSafeAreaInsets();
    const summary = useMemo(() => {
        if (!workout) return null;
        let setsCompleted = 0;
        const highlights: { name: string; sets: number }[] = [];
        for (const ex of workout.exercises) {
            const done = ex.sets.filter((s) => s.completed).length;
            if (done > 0) {
                setsCompleted += done;
                highlights.push({ name: ex.name, sets: done });
            }
        }
        return { setsCompleted, highlights };
    }, [workout]);

    if (!workout || !summary) return null;

    const volume = workout.totalVolume ?? 0;
    const durationSec = workout.duration ?? 0;
    const hasMilestones = milestones.length > 0;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.root}>
                <ScrollView
                    contentContainerStyle={[
                        styles.scroll,
                        { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 20 : 16) },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.hero}>
                        <View style={[styles.iconCircle, hasMilestones && styles.iconCirclePr]}>
                            <FontAwesome
                                name={hasMilestones ? 'trophy' : 'check'}
                                size={22}
                                color="#0C2340"
                            />
                        </View>
                        <Text style={styles.eyebrow}>
                            {hasMilestones ? 'New milestone' : 'Session complete'}
                        </Text>
                        <Text style={styles.title} numberOfLines={2}>
                            {workout.name}
                        </Text>
                        <Text style={styles.subtitle}>
                            Saved to your history. Quick post shares stats in one tap.
                        </Text>
                    </View>

                    {hasMilestones && (
                        <View style={styles.milestonesSection}>
                            <Text style={styles.milestonesTitle}>Highlights</Text>
                            {milestones.map((m, i) => (
                                <View key={`${m.type}-${i}`} style={styles.milestoneRow}>
                                    <View style={styles.milestoneIcon}>
                                        <FontAwesome
                                            name={milestoneIcon(m.type)}
                                            size={12}
                                            color={C.gold}
                                        />
                                    </View>
                                    <Text style={styles.milestoneLabel}>{m.label}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{formatDuration(durationSec)}</Text>
                            <Text style={styles.statLabel}>Time</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>
                                {volume > 0 ? volume.toLocaleString() : '—'}
                            </Text>
                            <Text style={styles.statLabel}>Volume</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{summary.setsCompleted}</Text>
                            <Text style={styles.statLabel}>Sets</Text>
                        </View>
                    </View>

                    {caloriesBurned != null && caloriesBurned > 0 && (
                        <View style={styles.nutritionBanner}>
                            <FontAwesome name="fire" size={14} color="#2ecc71" />
                            <View style={styles.nutritionBannerText}>
                                <Text style={styles.nutritionBannerTitle}>
                                    ~{caloriesBurned.toLocaleString()} kcal burned
                                </Text>
                                <Text style={styles.nutritionBannerSub}>
                                    Added to today's nutrition budget on the Dining tab
                                </Text>
                            </View>
                        </View>
                    )}

                    {summary.highlights.length > 0 && (
                        <View style={styles.highlightsSection}>
                            <Text style={styles.highlightsTitle}>What you logged</Text>
                            {summary.highlights.slice(0, 4).map((ex, i) => (
                                <View key={`${ex.name}-${i}`} style={styles.highlightRow}>
                                    <View style={styles.highlightDot} />
                                    <Text style={styles.highlightName} numberOfLines={1}>
                                        {formatExerciseDisplayName(ex.name)}
                                    </Text>
                                    <Text style={styles.highlightSets}>{ex.sets} sets</Text>
                                </View>
                            ))}
                            {summary.highlights.length > 4 && (
                                <Text style={styles.highlightMore}>
                                    +{summary.highlights.length - 4} more exercises
                                </Text>
                            )}
                        </View>
                    )}
                </ScrollView>

                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.primaryBtn,
                            (pressed || isQuickPosting) && { opacity: 0.9 },
                            isQuickPosting && { opacity: 0.75 },
                        ]}
                        onPress={onQuickPost}
                        disabled={isQuickPosting}
                    >
                        {isQuickPosting ? (
                            <ActivityIndicator color="#0C2340" />
                        ) : (
                            <>
                                <FontAwesome name="bolt" size={16} color="#0C2340" />
                                <Text style={styles.primaryBtnText}>Quick Post</Text>
                            </>
                        )}
                    </Pressable>
                    <Text style={styles.primaryHint}>
                        {hasMilestones
                            ? 'Posts stats + milestones to the feed instantly'
                            : 'Posts your workout stats to the feed instantly'}
                    </Text>
                    <Pressable
                        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
                        onPress={onCustomizePost}
                        disabled={isQuickPosting}
                    >
                        <FontAwesome name="edit" size={15} color={C.gold} />
                        <Text style={styles.secondaryBtnText}>Customize Post</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.tertiaryBtn, pressed && { opacity: 0.85 }]}
                        onPress={onSaveTemplate}
                        disabled={isQuickPosting}
                    >
                        <FontAwesome name="bookmark-o" size={14} color={C.textTertiary} />
                        <Text style={styles.tertiaryBtnText}>Save as Template</Text>
                    </Pressable>
                    <Pressable onPress={onDone} style={styles.doneLink} disabled={isQuickPosting}>
                        <Text style={styles.doneLinkText}>Skip for now</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: C.bgMid,
    },
    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    hero: {
        alignItems: 'center',
        marginBottom: 18,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: C.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    iconCirclePr: {
        backgroundColor: VisualSystem.colors.successSoft,
    },
    eyebrow: {
        color: C.gold,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    title: {
        color: C.textPrimary,
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 30,
    },
    subtitle: {
        color: C.textSecondary,
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    milestonesSection: {
        backgroundColor: C.goldMuted,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.borderGold,
        padding: 14,
        marginBottom: 14,
    },
    milestonesTitle: {
        color: C.gold,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    milestoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6,
    },
    milestoneIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: C.bgElevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    milestoneLabel: {
        flex: 1,
        color: C.textPrimary,
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: C.glassFill,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        paddingVertical: 16,
        marginBottom: 14,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: C.borderSubtle,
    },
    statValue: {
        color: C.textPrimary,
        fontSize: 18,
        fontWeight: '800',
    },
    statLabel: {
        color: C.textTertiary,
        fontSize: 11,
        marginTop: 4,
        fontWeight: '600',
    },
    nutritionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(46, 204, 113, 0.25)',
        padding: 14,
        marginBottom: 14,
    },
    nutritionBannerText: {
        flex: 1,
    },
    nutritionBannerTitle: {
        color: C.textPrimary,
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 2,
    },
    nutritionBannerSub: {
        color: C.textTertiary,
        fontSize: 11,
        lineHeight: 15,
    },
    highlightsSection: {
        backgroundColor: C.glassFill,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        padding: 14,
    },
    highlightsTitle: {
        color: C.textTertiary,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    highlightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 8,
    },
    highlightDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: C.gold,
        opacity: 0.8,
    },
    highlightName: {
        flex: 1,
        color: C.textPrimary,
        fontSize: 13,
        fontWeight: '600',
    },
    highlightSets: {
        color: C.textTertiary,
        fontSize: 12,
        fontWeight: '600',
    },
    highlightMore: {
        color: C.textTertiary,
        fontSize: 11,
        marginTop: 4,
        marginLeft: 13,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: C.borderSubtle,
        backgroundColor: C.bgDeep,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: VisualSystem.colors.successSoft,
        paddingVertical: 14,
        borderRadius: 14,
        marginBottom: 6,
        minHeight: 48,
    },
    primaryBtnText: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '800',
        fontSize: 15,
    },
    primaryHint: {
        color: C.textTertiary,
        fontSize: 11,
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 15,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.borderGold,
        marginBottom: 8,
        backgroundColor: C.goldMuted,
    },
    secondaryBtnText: {
        color: C.gold,
        fontWeight: '700',
        fontSize: 14,
    },
    tertiaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        marginBottom: 4,
    },
    tertiaryBtnText: {
        color: C.textTertiary,
        fontWeight: '600',
        fontSize: 13,
    },
    doneLink: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    doneLinkText: {
        color: C.textTertiary,
        fontSize: 15,
        fontWeight: '600',
    },
});
