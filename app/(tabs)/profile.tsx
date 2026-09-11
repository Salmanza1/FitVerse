import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, View, Text as RNText, Modal, TextInput, ActivityIndicator, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/AuthContext';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import { FeedStore } from '@/features/feed/FeedStore';
import { Tokens } from '@/constants/Tokens';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { WeeklyWeightCheckCard, useWeeklyWeightCheckReminder } from '@/components/profile/WeeklyWeightCheckCard';
import { SocialDashboardModal } from '@/features/social/SocialDashboardModal';
import { ChatsListScreen } from '@/features/chat/ChatsListScreen';
import * as Haptics from 'expo-haptics';
import { safeImpact } from '@/lib/safeHaptics';
import { VisualSystem } from '@/constants/VisualSystem';

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const { user, signOut, resetDatabase, updateProfile, refreshProfile } = useAuth();
    useWeeklyWeightCheckReminder(user);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editName, setEditName] = useState('');
    const [saving, setSaving] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [isSocialModalVisible, setSocialModalVisible] = useState(false);
    const [isChatVisible, setChatVisible] = useState(false);

    useFocusEffect(
        useCallback(() => {
            refreshProfile();
        }, [user?.id])
    );

    const triggerHaptic = (type: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
        safeImpact(type);
    };

    const openEditModal = () => {
        if (!user) return;

        // Check for 30-day limit
        if (user.lastUsernameChange) {
            const lastChange = new Date(user.lastUsernameChange);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - lastChange.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const daysLeft = 30 - diffDays;

            // If it's been less than 30 days (approx check, using 30 days exactly in ms is safer)
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            if (now.getTime() - lastChange.getTime() < thirtyDaysMs) {
                const daysRemaining = Math.ceil((thirtyDaysMs - (now.getTime() - lastChange.getTime())) / (1000 * 60 * 60 * 24));
                Alert.alert(
                    "Username Locked",
                    `You can only change your username once every 30 days.\n\nPlease wait ${daysRemaining} more day(s).`
                );
                return;
            }
        }

        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setEditName(user.displayName || user.name || '');
        setEditModalVisible(true);
    };

    const handleSignOut = async () => {
        const performSignOut = async () => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
            await signOut();
            // AuthContext state change will trigger RootLayoutNav to show AuthScreen
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to do this?")) {
                await performSignOut();
            }
        } else {
            Alert.alert(
                "Sign Out",
                "Are you sure you want to do this?",
                [
                    { text: "No", style: "cancel" },
                    { text: "Yes", style: "destructive", onPress: performSignOut }
                ]
            );
        }
    };

    const handleDebugToggle = () => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
        setShowDebug(!showDebug);
        Alert.alert(showDebug ? "Debug Info Hidden" : "Debug Options Unlocked");
    };

    const handleSaveProfile = async () => {
        if (!user || !editName.trim()) return;
        setSaving(true);
        try {
            // 1. Update Profile in Auth/DB (with new timestamp)
            const nowIso = new Date().toISOString();
            await updateProfile({
                displayName: editName.trim(),
                lastUsernameChange: nowIso
            });

            // 2. Retroactively update all posts
            await FeedStore.updateUserPosts(user.id, editName.trim(), user.avatar);

            Alert.alert("Success", "Profile updated!");
            setEditModalVisible(false);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to update profile.");
        } finally {
            setSaving(false);
        }
    };

    if (!user) return null;

    return (
        <View style={[styles.container, { pointerEvents: 'auto' as const }]}>
            <Modal
                visible={editModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <RNText style={styles.modalTitle}>Edit Profile</RNText>

                        <RNText style={styles.inputLabel}>Display Name</RNText>
                        <TextInput
                            style={styles.input}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Enter your name"
                            placeholderTextColor="#666"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalBtnCancel}
                                onPress={() => {
                                    triggerHaptic();
                                    setEditModalVisible(false);
                                }}
                            >
                                <RNText style={styles.modalBtnTextCancel}>Cancel</RNText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalBtnSave}
                                onPress={() => {
                                    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                                    handleSaveProfile();
                                }}
                                disabled={saving}
                            >
                                {saving ? <ActivityIndicator color={FitVerseTheme.colors.ndNavy} /> : <RNText style={styles.modalBtnTextSave}>DONE</RNText>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={[styles.heroSection, { paddingTop: insets.top + 12 }]}>
                <View style={styles.heroTopBar}>
                    <RNText style={styles.headerEyebrow}>Profile</RNText>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => {
                            triggerHaptic();
                            router.push('/profile/settings');
                        }}
                        activeOpacity={0.85}
                    >
                        <FontAwesome name="cog" size={16} color={FitVerseTheme.colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                <LinearGradient
                    colors={['rgba(212, 175, 55, 0.14)', 'rgba(212, 175, 55, 0.02)', 'transparent']}
                    style={styles.heroGlow}
                />

                <TouchableOpacity
                    style={styles.avatarRing}
                    onPress={() => {
                        triggerHaptic();
                        router.push('/profile/personal-info');
                    }}
                    activeOpacity={0.85}
                >
                    <ProfileAvatar
                        uri={user.avatar}
                        name={user.displayName || user.name}
                        size={92}
                        style={styles.avatarHero}
                    />
                    <View style={styles.avatarEditDot}>
                        <FontAwesome name="camera" size={11} color={FitVerseTheme.colors.ndNavy} />
                    </View>
                </TouchableOpacity>

                <Pressable style={styles.nameRow} onPress={openEditModal}>
                    <RNText style={styles.userName} numberOfLines={1}>
                        {user.displayName || user.name || 'Athlete'}
                    </RNText>
                    <FontAwesome name="pencil" size={12} color={VisualSystem.colors.textTertiary} />
                </Pressable>

                <View style={styles.chipRow}>
                    {user.dorm ? (
                        <View style={styles.chip}>
                            <FontAwesome name="building" size={10} color={FitVerseTheme.colors.accentGold} />
                            <RNText style={styles.chipText}>{user.dorm}</RNText>
                        </View>
                    ) : null}
                    {user.goal ? (
                        <View style={styles.chip}>
                            <FontAwesome name="bullseye" size={10} color={FitVerseTheme.colors.accentGold} />
                            <RNText style={styles.chipText}>{user.goal}</RNText>
                        </View>
                    ) : null}
                    <View style={styles.chip}>
                        <FontAwesome name="users" size={10} color={FitVerseTheme.colors.accentGold} />
                        <RNText style={styles.chipText}>
                            {(user.friends?.length ?? 0)} friend{(user.friends?.length ?? 0) === 1 ? '' : 's'}
                        </RNText>
                    </View>
                </View>
            </View>

            <SocialDashboardModal
                visible={isSocialModalVisible}
                onClose={() => setSocialModalVisible(false)}
            />
            {user && (
                <ChatsListScreen
                    visible={isChatVisible}
                    currentUser={user}
                    onClose={() => setChatVisible(false)}
                />
            )}

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.actionGrid}>
                    <ActionTile
                        icon="line-chart"
                        label="Workouts"
                        onPress={() => router.push('/profile/workouts')}
                    />
                    <ActionTile
                        icon="user"
                        label="My stats"
                        onPress={() => router.push('/profile/personal-info')}
                    />
                    <ActionTile
                        icon="comments"
                        label="Messages"
                        onPress={() => {
                            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                            setChatVisible(true);
                        }}
                    />
                    <ActionTile
                        icon="users"
                        label="Friends"
                        badge={user.friendRequestsReceived?.length}
                        onPress={() => setSocialModalVisible(true)}
                    />
                    <ActionTile
                        icon="sliders"
                        label="Settings"
                        onPress={() => router.push('/profile/settings')}
                    />
                </View>

                <WeeklyWeightCheckCard user={user} />

                <View style={styles.footerBlock}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.signOutBtn,
                            { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
                        ]}
                        onPress={handleSignOut}
                    >
                        <FontAwesome name="sign-out" size={14} color="#ff8a8a" />
                        <RNText style={styles.signOutText}>Sign out</RNText>
                    </Pressable>

                    {showDebug && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.debugBtn,
                                { opacity: pressed ? 0.7 : 0.5, transform: [{ scale: pressed ? 0.98 : 1 }] }
                            ]}
                            onPress={() => {
                                triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                                Alert.alert(
                                    "DEBUG: Reset All Data",
                                    "This will delete ALL accounts and sessions. Continue?",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Reset",
                                            style: "destructive",
                                            onPress: async () => {
                                                triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                                                await resetDatabase();
                                                Alert.alert("Success", "All accounts have been cleared.");
                                            }
                                        }
                                    ]
                                );
                            }}
                        >
                            <FontAwesome name="trash" size={Tokens.typography.lg} color={Tokens.colors.textMuted} style={{ marginRight: Tokens.spacing.lg }} />
                            <RNText style={styles.debugBtnText}>Debug: Clear All Accounts</RNText>
                        </Pressable>
                    )}

                    <TouchableOpacity
                        onLongPress={handleDebugToggle}
                        delayLongPress={2000}
                        activeOpacity={0.7}
                        style={styles.versionContainer}
                    >
                        <RNText style={styles.versionText}>FitVerse v1.0.0-PROD</RNText>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}

function ActionTile({
    icon,
    label,
    onPress,
    badge,
}: {
    icon: React.ComponentProps<typeof FontAwesome>['name'];
    label: string;
    onPress: () => void;
    badge?: number;
}) {
    return (
        <Pressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            style={({ pressed }) => [
                styles.actionTile,
                { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
        >
            <View style={styles.actionTileIconWrap}>
                <FontAwesome name={icon} size={18} color={FitVerseTheme.colors.accentGold} />
                {badge != null && badge > 0 && <View style={styles.tileBadge} />}
            </View>
            <RNText style={styles.actionTileLabel}>{label}</RNText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scrollView: { flex: 1 },
    scroll: {
        paddingHorizontal: Tokens.spacing.xl,
        paddingTop: 8,
        backgroundColor: 'transparent',
    },
    heroSection: {
        alignItems: 'center',
        paddingHorizontal: Tokens.spacing.xl,
        paddingBottom: 16,
        position: 'relative',
    },
    heroTopBar: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    heroGlow: {
        position: 'absolute',
        top: 28,
        left: '8%',
        right: '8%',
        height: 160,
        borderRadius: 80,
    },
    headerEyebrow: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.3,
        color: VisualSystem.colors.textPrimary,
    },
    avatarRing: {
        marginTop: 12,
        marginBottom: 12,
        padding: 4,
        borderRadius: 52,
        borderWidth: 2,
        borderColor: 'rgba(212, 175, 55, 0.35)',
        position: 'relative',
    },
    avatarHero: {
        borderWidth: 0,
    },
    avatarEditDot: {
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 28,
        height: 28,
        borderRadius: 16,
        backgroundColor: FitVerseTheme.colors.accentGold,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: VisualSystem.colors.borderStrong,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        maxWidth: '90%',
        marginBottom: 12,
    },
    userName: {
        fontSize: 24,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
        letterSpacing: -0.4,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 22,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
        color: VisualSystem.colors.textPrimary,
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    actionTile: {
        width: '47%',
        flexGrow: 1,
        minHeight: 96,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        justifyContent: 'center',
    },
    actionTileIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        position: 'relative',
    },
    actionTileLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
    },
    tileBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 10,
        height: 10,
        borderRadius: 6,
        backgroundColor: '#ef4444',
        borderWidth: 1.5,
        borderColor: VisualSystem.colors.borderStrong,
    },
    footerBlock: {
        marginTop: 4,
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        marginBottom: 8,
    },
    signOutText: {
        fontSize: 13,
        fontWeight: '600',
        color: VisualSystem.colors.danger,
    },
    debugBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        marginTop: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    debugBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: Tokens.colors.textMuted,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: VisualSystem.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: Tokens.radius.lg,
        padding: Tokens.spacing.xl,
        borderWidth: 1,
        borderColor: FitVerseTheme.colors.border,
    },
    modalTitle: {
        fontSize: Tokens.typography.xl,
        fontWeight: '700',
        color: VisualSystem.colors.goldText,
        textAlign: 'center',
        marginBottom: Tokens.spacing.xl,
    },
    inputLabel: {
        color: FitVerseTheme.colors.textMuted,
        marginBottom: Tokens.spacing.sm,
        fontSize: Tokens.typography.sm,
        fontWeight: '600',
    },
    input: {
        backgroundColor: VisualSystem.colors.bgMid,
        color: FitVerseTheme.colors.textPrimary,
        padding: Tokens.spacing.md,
        borderRadius: Tokens.radius.sm,
        borderWidth: 1,
        borderColor: FitVerseTheme.colors.border,
        marginBottom: Tokens.spacing.xl,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Tokens.spacing.md,
    },
    modalBtnCancel: {
        flex: 1,
        padding: Tokens.spacing.md,
        borderRadius: Tokens.radius.sm,
        borderWidth: 1,
        borderColor: FitVerseTheme.colors.border,
        alignItems: 'center',
    },
    modalBtnSave: {
        flex: 1,
        padding: Tokens.spacing.md,
        borderRadius: Tokens.radius.sm,
        backgroundColor: FitVerseTheme.colors.accentGold,
        alignItems: 'center',
    },
    modalBtnTextCancel: { color: FitVerseTheme.colors.textMuted, fontWeight: '700' },
    modalBtnTextSave: { color: FitVerseTheme.colors.ndNavy, fontWeight: '700' },
    versionContainer: {
        marginTop: 16,
        alignItems: 'center',
        paddingVertical: Tokens.spacing.sm,
    },
    versionText: {
        fontSize: 11,
        color: FitVerseTheme.colors.textMuted,
        letterSpacing: 2,
        fontWeight: '700',
        opacity: 0.5,
    },
});
