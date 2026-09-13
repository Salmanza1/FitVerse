import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useBottomTabBarHeight } from 'react-native-bottom-tabs';

import { useAuth } from '@/features/auth/AuthContext';
import { FeedStore } from '@/features/feed/FeedStore';
import { getWorkoutHistory } from '@/features/workout/WorkoutStore';
import { summarizeTraining, type TrainingSummary } from '@/features/profile/profileStats';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { TrainingSummaryCard } from '@/components/profile/TrainingSummaryCard';
import { StreakCard } from '@/components/profile/StreakCard';
import { WeeklyWeightCheckCard, useWeeklyWeightCheckReminder } from '@/components/profile/WeeklyWeightCheckCard';
import { SocialDashboardModal } from '@/features/social/SocialDashboardModal';
import { ChatsListScreen } from '@/features/chat/ChatsListScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { VisualSystem } from '@/constants/VisualSystem';
import { safeImpact } from '@/lib/safeHaptics';

const C = VisualSystem.colors;

/** Empty analytics, so the screen renders its real layout while data loads. */
const EMPTY_SUMMARY: TrainingSummary = summarizeTraining([]);

export default function ProfileScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const { user, signOut, resetDatabase, updateProfile, refreshProfile } = useAuth();
    useWeeklyWeightCheckReminder(user);

    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editName, setEditName] = useState('');
    const [saving, setSaving] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [isSocialModalVisible, setSocialModalVisible] = useState(false);
    const [isChatVisible, setChatVisible] = useState(false);
    const [summary, setSummary] = useState<TrainingSummary>(EMPTY_SUMMARY);
    const [loadingStats, setLoadingStats] = useState(true);

    const scrollY = useRef(new Animated.Value(0)).current;

    useFocusEffect(
        useCallback(() => {
            refreshProfile();
        }, [user?.id])
    );

    useFocusEffect(
        useCallback(() => {
            if (!user?.id) return;
            let cancelled = false;

            (async () => {
                setLoadingStats(true);
                const history = await getWorkoutHistory(user.id);
                if (cancelled) return;
                setSummary(summarizeTraining(history));
                setLoadingStats(false);
            })();

            return () => {
                cancelled = true;
            };
        }, [user?.id])
    );

    const unitLabel = user?.weightUnitLbs !== false ? 'lb' : 'kg';
    const friendRequests = user?.friendRequestsReceived?.length ?? 0;
    const friendCount = user?.friends?.length ?? 0;

    const subtitle = useMemo(() => {
        const parts = [`${summary.totalWorkouts} session${summary.totalWorkouts === 1 ? '' : 's'}`];
        if (friendCount > 0) parts.push(`${friendCount} friend${friendCount === 1 ? '' : 's'}`);
        return parts.join('  ·  ');
    }, [summary.totalWorkouts, friendCount]);

    const openEditModal = () => {
        if (!user) return;

        // Display names are locked for 30 days after a change.
        if (user.lastUsernameChange) {
            const lastChange = new Date(user.lastUsernameChange).getTime();
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const elapsed = Date.now() - lastChange;
            if (elapsed < thirtyDaysMs) {
                const daysRemaining = Math.ceil((thirtyDaysMs - elapsed) / (1000 * 60 * 60 * 24));
                Alert.alert(
                    'Username locked',
                    `You can change your username once every 30 days.\n\nPlease wait ${daysRemaining} more day(s).`
                );
                return;
            }
        }

        safeImpact(Haptics.ImpactFeedbackStyle.Medium);
        setEditName(user.displayName || user.name || '');
        setEditModalVisible(true);
    };

    const handleSaveProfile = async () => {
        if (!user || !editName.trim()) return;
        setSaving(true);
        try {
            await updateProfile({
                displayName: editName.trim(),
                lastUsernameChange: new Date().toISOString(),
            });
            await FeedStore.updateUserPosts(user.id, editName.trim(), user.avatar);
            setEditModalVisible(false);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        const performSignOut = async () => {
            safeImpact(Haptics.ImpactFeedbackStyle.Heavy);
            await signOut();
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Sign out of FitVerse?')) await performSignOut();
            return;
        }

        Alert.alert('Sign out', 'Sign out of FitVerse?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: performSignOut },
        ]);
    };

    if (!user) return null;

    return (
        <View style={styles.container}>
            <ScreenHeader
                title="Profile"
                scrollY={scrollY}
                actions={[
                    {
                        icon: 'chatbubble-outline',
                        label: 'Messages',
                        onPress: () => {
                            safeImpact(Haptics.ImpactFeedbackStyle.Medium);
                            setChatVisible(true);
                        },
                    },
                    {
                        icon: 'settings-outline',
                        label: 'Settings',
                        onPress: () => router.push('/profile/settings'),
                    },
                ]}
            />

            <Animated.ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 24 }]}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                    useNativeDriver: false,
                })}
                scrollEventThrottle={16}>
                {/* Identity */}
                <View style={styles.identity}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Edit photo"
                        onPress={() => {
                            safeImpact();
                            router.push('/profile/personal-info');
                        }}
                        style={({ pressed }) => pressed && { opacity: 0.85 }}>
                        <ProfileAvatar
                            uri={user.avatar}
                            name={user.displayName || user.name}
                            size={72}
                        />
                        <View style={styles.avatarEditDot}>
                            <Ionicons name="camera" size={11} color={C.textOnGold} />
                        </View>
                    </Pressable>

                    <View style={styles.identityText}>
                        <Text style={styles.name} numberOfLines={1}>
                            {user.displayName || user.name || 'Athlete'}
                        </Text>
                        <Text style={styles.subtitle}>{subtitle}</Text>
                        {!!(user.dorm || user.goal) && (
                            <Text style={styles.bio} numberOfLines={1}>
                                {[user.dorm, user.goal].filter(Boolean).join('  ·  ')}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Primary actions */}
                <View style={styles.pillRow}>
                    <OutlinePill label="Edit profile" onPress={openEditModal} />
                    <OutlinePill
                        label="Friends"
                        badge={friendRequests}
                        onPress={() => {
                            safeImpact();
                            setSocialModalVisible(true);
                        }}
                    />
                </View>

                {/* Analytics */}
                <TrainingSummaryCard
                    weeks={summary.weeks}
                    thisWeek={summary.thisWeek}
                    unitLabel={unitLabel}
                    loading={loadingStats}
                />

                <View style={styles.gap} />

                <StreakCard
                    streakWeeks={summary.streakWeeks}
                    activeDays={summary.activeDays}
                    totalWorkouts={summary.totalWorkouts}
                />

                <View style={styles.gap} />

                <WeeklyWeightCheckCard user={user} />

                <View style={styles.gap} />

                {/* Destinations. One grouped list rather than a tile grid, so the
                    eye runs down a single column instead of scanning a board. */}
                <View style={styles.group}>
                    <NavRow
                        icon="barbell-outline"
                        label="Workout history"
                        detail={`${summary.totalWorkouts}`}
                        onPress={() => router.push('/profile/workouts')}
                    />
                    <NavRow
                        icon="person-outline"
                        label="My stats"
                        onPress={() => router.push('/profile/personal-info')}
                    />
                    <NavRow
                        icon="options-outline"
                        label="Settings"
                        onPress={() => router.push('/profile/settings')}
                        last
                    />
                </View>

                <View style={styles.gap} />

                <Pressable
                    accessibilityRole="button"
                    onPress={handleSignOut}
                    style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="log-out-outline" size={17} color={C.danger} />
                    <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>

                {showDebug && (
                    <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.debugBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => {
                            safeImpact(Haptics.ImpactFeedbackStyle.Heavy);
                            Alert.alert(
                                'DEBUG: Reset all data',
                                'This will delete ALL accounts and sessions. Continue?',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Reset',
                                        style: 'destructive',
                                        onPress: async () => {
                                            await resetDatabase();
                                            Alert.alert('Success', 'All accounts have been cleared.');
                                        },
                                    },
                                ]
                            );
                        }}>
                        <Ionicons name="trash-outline" size={15} color={C.textTertiary} />
                        <Text style={styles.debugText}>Debug: clear all accounts</Text>
                    </Pressable>
                )}

                <Pressable
                    onLongPress={() => {
                        safeImpact(Haptics.ImpactFeedbackStyle.Heavy);
                        setShowDebug((v) => !v);
                    }}
                    delayLongPress={2000}
                    style={styles.version}>
                    <Text style={styles.versionText}>FitVerse v1.0.0</Text>
                </Pressable>
            </Animated.ScrollView>

            <SocialDashboardModal
                visible={isSocialModalVisible}
                onClose={() => setSocialModalVisible(false)}
            />
            <ChatsListScreen
                visible={isChatVisible}
                currentUser={user}
                onClose={() => setChatVisible(false)}
            />

            <Modal
                visible={editModalVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setEditModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Edit profile</Text>
                        <Text style={styles.inputLabel}>Display name</Text>
                        <TextInput
                            style={styles.input}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Enter your name"
                            placeholderTextColor={C.textTertiary}
                            autoFocus
                        />
                        <Text style={styles.inputHint}>
                            You can change this once every 30 days.
                        </Text>

                        <View style={styles.modalActions}>
                            <Pressable
                                style={({ pressed }) => [styles.modalBtnGhost, pressed && { opacity: 0.7 }]}
                                onPress={() => setEditModalVisible(false)}>
                                <Text style={styles.modalBtnGhostText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [styles.modalBtnPrimary, pressed && { opacity: 0.85 }]}
                                onPress={handleSaveProfile}
                                disabled={saving}>
                                {saving ? (
                                    <ActivityIndicator color={C.textOnGold} />
                                ) : (
                                    <Text style={styles.modalBtnPrimaryText}>Save</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function OutlinePill({
    label,
    onPress,
    badge,
}: {
    label: string;
    onPress: () => void;
    badge?: number;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={badge ? `${label}, ${badge} pending` : label}
            onPress={onPress}
            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}>
            <Text style={styles.pillText}>{label}</Text>
            {!!badge && badge > 0 && (
                <View style={styles.pillBadge}>
                    <Text style={styles.pillBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
            )}
        </Pressable>
    );
}

function NavRow({
    icon,
    label,
    detail,
    onPress,
    last,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    detail?: string;
    onPress: () => void;
    last?: boolean;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => {
                safeImpact();
                onPress();
            }}
            style={({ pressed }) => [
                styles.navRow,
                !last && styles.navRowDivider,
                pressed && { backgroundColor: C.bgDeep },
            ]}>
            <Ionicons name={icon} size={19} color={C.goldText} style={styles.navIcon} />
            <Text style={styles.navLabel}>{label}</Text>
            {!!detail && <Text style={styles.navDetail}>{detail}</Text>}
            <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: {
        paddingHorizontal: VisualSystem.spacing.lg,
        paddingTop: VisualSystem.spacing.md,
    },
    gap: { height: VisualSystem.spacing.md },

    identity: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: VisualSystem.spacing.lg,
        marginBottom: VisualSystem.spacing.lg,
    },
    identityText: { flex: 1, minWidth: 0 },
    avatarEditDot: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: C.gold,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: C.bgBase,
    },
    name: {
        fontSize: VisualSystem.text.heading,
        fontWeight: '800',
        color: C.textPrimary,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: VisualSystem.text.body,
        color: C.textSecondary,
        marginTop: 2,
    },
    bio: {
        fontSize: VisualSystem.text.small,
        color: C.textTertiary,
        marginTop: 3,
    },

    pillRow: {
        flexDirection: 'row',
        gap: VisualSystem.spacing.md,
        marginBottom: VisualSystem.spacing.lg,
    },
    pill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 40,
        borderRadius: VisualSystem.radius.pill,
        borderWidth: 1,
        borderColor: C.borderStrong,
    },
    pillText: {
        fontSize: VisualSystem.text.body,
        fontWeight: '700',
        color: C.textPrimary,
    },
    pillBadge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 5,
        backgroundColor: C.danger,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

    group: {
        backgroundColor: C.bgMid,
        borderRadius: VisualSystem.radius.md,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        overflow: 'hidden',
        ...VisualSystem.shadow.card,
    },
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 52,
        paddingHorizontal: VisualSystem.spacing.lg,
        gap: VisualSystem.spacing.md,
    },
    navRowDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: C.borderSubtle,
    },
    navIcon: { width: 22, textAlign: 'center' },
    navLabel: {
        flex: 1,
        fontSize: VisualSystem.text.emphasis,
        fontWeight: '600',
        color: C.textPrimary,
    },
    navDetail: {
        fontSize: VisualSystem.text.body,
        color: C.textTertiary,
        fontVariant: ['tabular-nums'],
    },

    signOut: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: VisualSystem.spacing.sm,
        height: 48,
        borderRadius: VisualSystem.radius.md,
        backgroundColor: C.dangerSoft,
    },
    signOutText: {
        fontSize: VisualSystem.text.body,
        fontWeight: '700',
        color: C.danger,
    },
    debugBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: VisualSystem.spacing.sm,
        height: 44,
        marginTop: VisualSystem.spacing.md,
    },
    debugText: { fontSize: VisualSystem.text.small, color: C.textTertiary },
    version: { alignItems: 'center', paddingVertical: VisualSystem.spacing.xl },
    versionText: { fontSize: VisualSystem.text.caption, color: C.textTertiary },

    modalOverlay: {
        flex: 1,
        backgroundColor: C.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: VisualSystem.spacing.xl,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: C.bgElevated,
        borderRadius: VisualSystem.radius.lg,
        padding: VisualSystem.spacing.xl,
        ...VisualSystem.shadow.raised,
    },
    modalTitle: {
        fontSize: VisualSystem.text.title,
        fontWeight: '800',
        color: C.textPrimary,
        marginBottom: VisualSystem.spacing.lg,
    },
    inputLabel: {
        fontSize: VisualSystem.text.small,
        fontWeight: '700',
        color: C.textSecondary,
        marginBottom: 6,
    },
    input: {
        height: 46,
        borderRadius: VisualSystem.radius.sm,
        borderWidth: 1,
        borderColor: C.borderStrong,
        backgroundColor: C.bgBase,
        paddingHorizontal: VisualSystem.spacing.md,
        fontSize: VisualSystem.text.emphasis,
        color: C.textPrimary,
    },
    inputHint: {
        fontSize: VisualSystem.text.caption,
        color: C.textTertiary,
        marginTop: 6,
    },
    modalActions: {
        flexDirection: 'row',
        gap: VisualSystem.spacing.md,
        marginTop: VisualSystem.spacing.xl,
    },
    modalBtnGhost: {
        flex: 1,
        height: 46,
        borderRadius: VisualSystem.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.borderStrong,
    },
    modalBtnGhostText: {
        fontSize: VisualSystem.text.body,
        fontWeight: '700',
        color: C.textPrimary,
    },
    modalBtnPrimary: {
        flex: 1,
        height: 46,
        borderRadius: VisualSystem.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.gold,
    },
    modalBtnPrimaryText: {
        fontSize: VisualSystem.text.body,
        fontWeight: '800',
        color: C.textOnGold,
    },
});
