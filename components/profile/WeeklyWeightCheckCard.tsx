import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    Pressable,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from 'expo-router';
import { UserProfile, WeightCheckDay, WEIGHT_CHECK_DAY_LABELS, formatWeightCheckTime12h } from '@/types/user';
import { useAuth } from '@/features/auth/AuthContext';
import { getRecentWeightChecks, logWeightCheck } from '@/features/weight/WeightCheckStore';
import {
    formatNextCheckLabel,
    getWeightTrend,
    isWeightCheckDueToday,
} from '@/lib/weightCheck';
import { scheduleWeeklyWeightCheckReminder } from '@/lib/weightCheckNotifications';
import { Tokens } from '@/constants/Tokens';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { VisualSystem } from '@/constants/VisualSystem';

type Props = {
    user: UserProfile;
};

export function WeeklyWeightCheckCard({ user }: Props) {
    const { updateProfile } = useAuth();
    const [logs, setLogs] = useState<{ weightKg: number; loggedAt: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [weightInput, setWeightInput] = useState('');
    const [saving, setSaving] = useState(false);

    const day = user.weeklyWeightCheckDay ?? WeightCheckDay.SUNDAY;
    const time = user.weeklyWeightCheckTime ?? '08:00';
    const enabled = user.weightCheckEnabled !== false;

    const loadLogs = useCallback(async () => {
        if (!user.id) return;
        setLoading(true);
        const rows = await getRecentWeightChecks(user.id, 4);
        setLogs(rows);
        setLoading(false);
    }, [user.id]);

    useFocusEffect(
        useCallback(() => {
            loadLogs();
        }, [loadLogs])
    );

    const latest = logs[0];
    const previous = logs[1];
    const latestLbs = latest ? Math.round(latest.weightKg * 2.20462 * 10) / 10 : null;
    const trendInfo =
        latest != null
            ? getWeightTrend(latest.weightKg, previous?.weightKg ?? null, user.weeklyGoalRate)
            : null;

    const dueToday = enabled && isWeightCheckDueToday(day, time);
    const nextLabel = formatNextCheckLabel(day, time);

    const openLogModal = () => {
        const lbs = user.weightKg ? String(Math.round(user.weightKg * 2.20462)) : '';
        setWeightInput(lbs);
        setModalOpen(true);
    };

    const submitWeight = async () => {
        const lbs = parseFloat(weightInput);
        if (!lbs || lbs < 50 || lbs > 600) {
            Alert.alert('Invalid weight', 'Enter your weight in pounds (e.g. 165).');
            return;
        }
        setSaving(true);
        const weightKg = lbs * 0.453592;
        const logged = await logWeightCheck(user.id, weightKg, 'weekly_check');
        if (!logged) {
            setSaving(false);
            Alert.alert('Could not save', 'Try again in a moment.');
            return;
        }
        await updateProfile({ weightKg });
        await loadLogs();
        setSaving(false);
        setModalOpen(false);
        Alert.alert('Logged', 'Your weekly weigh-in is saved. We\'ll compare again next week.');
    };

    return (
        <>
            <View style={styles.card}>
                <View style={styles.headerRow}>
                    <View style={styles.iconWrap}>
                        <FontAwesome name="balance-scale" size={18} color={VisualSystem.colors.gold} />
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>Weekly weigh-in</Text>
                        <Text style={styles.subtitle}>
                            {enabled
                                ? `Every ${WEIGHT_CHECK_DAY_LABELS[day]} at ${formatWeightCheckTime12h(time)}`
                                : 'Reminders off'}
                        </Text>
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator color={VisualSystem.colors.gold} style={styles.loader} />
                ) : (
                    <>
                        <View style={styles.statRow}>
                            <View style={styles.stat}>
                                <Text style={styles.statLabel}>Last check</Text>
                                <Text style={styles.statValue}>
                                    {latestLbs != null ? `${latestLbs} lbs` : '—'}
                                </Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.stat}>
                                <Text style={styles.statLabel}>Next</Text>
                                <Text style={styles.statValueSmall} numberOfLines={2}>
                                    {enabled ? nextLabel : '—'}
                                </Text>
                            </View>
                        </View>

                        {trendInfo && (
                            <Text style={styles.trendMessage}>{trendInfo.message}</Text>
                        )}

                        {dueToday && (
                            <View style={styles.dueBanner}>
                                <FontAwesome name="bell" size={12} color={VisualSystem.colors.gold} />
                                <Text style={styles.dueText}>It&apos;s weigh-in day — log when you&apos;re ready.</Text>
                            </View>
                        )}
                    </>
                )}

                <TouchableOpacity style={styles.logBtn} onPress={openLogModal} activeOpacity={0.85}>
                    <FontAwesome name="plus-circle" size={16} color="#0B0C10" />
                    <Text style={styles.logBtnText}>Log weight</Text>
                </TouchableOpacity>
            </View>

            <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
                <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
                    <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.modalTitle}>Log weigh-in</Text>
                        <Text style={styles.modalSub}>
                            Same time each week helps you see if your plan is working — not daily noise.
                        </Text>
                        <Text style={styles.inputLabel}>WEIGHT (LBS)</Text>
                        <TextInput
                            style={styles.input}
                            value={weightInput}
                            onChangeText={setWeightInput}
                            keyboardType="decimal-pad"
                            placeholder="165"
                            placeholderTextColor={VisualSystem.colors.textTertiary}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                                onPress={submitWeight}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#0B0C10" size="small" />
                                ) : (
                                    <Text style={styles.saveText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

// Reschedule reminder when profile loads with push on
export function useWeeklyWeightCheckReminder(user: UserProfile | null) {
    useFocusEffect(
        useCallback(() => {
            if (!user?.id || user.weightCheckEnabled === false) return;
            const day = user.weeklyWeightCheckDay ?? WeightCheckDay.SUNDAY;
            const time = user.weeklyWeightCheckTime ?? '08:00';
            if (user.pushNotifications !== false) {
                scheduleWeeklyWeightCheckReminder(day, time);
            }
        }, [
            user?.id,
            user?.weeklyWeightCheckDay,
            user?.weeklyWeightCheckTime,
            user?.weightCheckEnabled,
            user?.pushNotifications,
        ])
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: Tokens.radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.18)',
        padding: Tokens.spacing.md,
        marginBottom: Tokens.spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: Tokens.spacing.sm,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: { flex: 1 },
    title: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    subtitle: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    loader: { marginVertical: 12 },
    statRow: {
        flexDirection: 'row',
        marginTop: 8,
        marginBottom: 8,
    },
    stat: { flex: 1 },
    statDivider: {
        width: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        marginHorizontal: 12,
    },
    statLabel: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    statValue: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 22,
        fontWeight: '700',
        marginTop: 4,
    },
    statValueSmall: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
    },
    trendMessage: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 8,
    },
    dueBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        padding: 10,
        borderRadius: 8,
        marginBottom: 8,
    },
    dueText: {
        flex: 1,
        color: VisualSystem.colors.goldText,
        fontSize: 12,
        fontWeight: '600',
    },
    logBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: VisualSystem.colors.gold,
        paddingVertical: 12,
        borderRadius: Tokens.radius.md,
        marginTop: 4,
    },
    logBtnText: {
        color: '#0B0C10',
        fontWeight: '700',
        fontSize: 15,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: 24,
    },
    modalCard: {
        backgroundColor: VisualSystem.colors.bgBase,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    modalTitle: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 18,
        fontWeight: '700',
    },
    modalSub: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 13,
        marginTop: 8,
        marginBottom: 16,
        lineHeight: 18,
    },
    inputLabel: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    input: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 10,
        padding: 14,
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 18,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    cancelText: { color: VisualSystem.colors.textPrimary, fontWeight: '600' },
    saveBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: VisualSystem.colors.gold,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveText: { color: '#0B0C10', fontWeight: '700' },
});
