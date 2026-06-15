import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, Text, Switch, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';

import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { Tokens } from '@/constants/Tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { RestDayToggle } from '@/components/workout/RestDayToggle';

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const { user, signOut, updateProfile } = useAuth();

    // Actual states for settings derived from user profile
    const weightUnitLbs = user?.weightUnitLbs ?? true;
    const distanceUnitMi = user?.distanceUnitMi ?? true;
    const pushNotifications = user?.pushNotifications ?? true;
    const emailRecaps = user?.emailRecaps ?? false;
    const privateProfile = user?.privateProfile ?? false;

    const handleUpdateSetting = async (key: string, value: boolean) => {
        try {
            await updateProfile({ [key]: value });
        } catch (error) {
            console.error('Failed to update setting:', error);
            Alert.alert("Error", "Failed to save setting.");
        }
    };

    const triggerHaptic = (type: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
        Haptics.impactAsync(type);
    };

    const handleSignOut = async () => {
        const performSignOut = async () => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
            await signOut();
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

    const renderSettingToggle = (icon: any, title: string, subtitle: string, value: boolean, onValueChange: (val: boolean) => void) => (
        <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
                <View style={styles.iconContainer}>
                    <FontAwesome name={icon} size={16} color={FitVerseTheme.colors.accentGold} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.settingTitle}>{title}</Text>
                    <Text style={styles.settingSubtitle}>{subtitle}</Text>
                </View>
            </View>
            <Switch
                value={value}
                onValueChange={(val) => {
                    triggerHaptic();
                    onValueChange(val);
                }}
                trackColor={{ false: FitVerseTheme.colors.border, true: FitVerseTheme.colors.accentGold }}
                thumbColor={value ? '#fff' : '#f4f3f4'}
            />
        </View>
    );

    const renderSettingLink = (icon: any, title: string, subtitle: string, onPress: () => void, danger: boolean = false) => (
        <TouchableOpacity
            style={styles.settingRow}
            onPress={() => {
                triggerHaptic();
                onPress();
            }}
            activeOpacity={0.7}
        >
            <View style={styles.settingRowLeft}>
                <View style={[styles.iconContainer, danger && { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}>
                    <FontAwesome name={icon} size={16} color={danger ? '#ff6b6b' : FitVerseTheme.colors.accentGold} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={[styles.settingTitle, danger && { color: '#ff6b6b' }]}>{title}</Text>
                    <Text style={styles.settingSubtitle}>{subtitle}</Text>
                </View>
            </View>
            <FontAwesome name="chevron-right" size={12} color={FitVerseTheme.colors.textMuted} />
        </TouchableOpacity>
    );

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <FontAwesome name="chevron-left" size={18} color={FitVerseTheme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={{ width: 40 }} />
        </View>
    );

    return (
        <View style={styles.container}>
            {renderHeader()}
            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>

                <Text style={styles.sectionTitle}>WORKOUT</Text>
                <View style={styles.sectionContainer}>
                    {user ? <RestDayToggle userId={user.id} compact /> : null}
                </View>

                <Text style={styles.sectionTitle}>PREFERENCES</Text>
                <View style={styles.sectionContainer}>
                    {renderSettingToggle('balance-scale', 'Weight Unit', weightUnitLbs ? 'Pounds (lbs)' : 'Kilograms (kg)', weightUnitLbs, (val) => handleUpdateSetting('weightUnitLbs', val))}
                    <View style={styles.divider} />
                    {renderSettingToggle('road', 'Distance Unit', distanceUnitMi ? 'Miles (mi)' : 'Kilometers (km)', distanceUnitMi, (val) => handleUpdateSetting('distanceUnitMi', val))}
                    <View style={styles.divider} />
                    {renderSettingToggle('minus-circle', 'Negative Adjustments', 'Deduct calories if step goal not met', user?.enableNegativeAdjustments ?? false, (val) => handleUpdateSetting('enableNegativeAdjustments', val))}
                </View>

                <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
                <View style={styles.sectionContainer}>
                    {renderSettingToggle('bell', 'Push Notifications', 'Workout reminders & alerts', pushNotifications, (val) => handleUpdateSetting('pushNotifications', val))}
                    <View style={styles.divider} />
                    {renderSettingToggle('envelope', 'Email Recaps', 'Weekly progress summary', emailRecaps, (val) => handleUpdateSetting('emailRecaps', val))}
                </View>

                <Text style={styles.sectionTitle}>PRIVACY & SECURITY</Text>
                <View style={styles.sectionContainer}>
                    {renderSettingToggle('lock', 'Private Profile', 'Hide your stats from others', privateProfile, (val) => handleUpdateSetting('privateProfile', val))}
                    <View style={styles.divider} />
                    {renderSettingLink('shield', 'Privacy Policy', 'How we handle your data', () => Alert.alert('Privacy Policy', 'Coming soon...'))}
                </View>

                <Text style={styles.sectionTitle}>ABOUT</Text>
                <View style={styles.sectionContainer}>
                    {renderSettingLink('question-circle', 'Help & Support', 'Get help with the app', () => Alert.alert('Help', 'Support email: support@fitverse.com'))}
                    <View style={styles.divider} />
                    {renderSettingLink('info-circle', 'App Version', 'v1.0.0-PROD', () => { })}
                </View>

                <View style={[styles.sectionContainer, { marginTop: Tokens.spacing.lg }]}>
                    {renderSettingLink('sign-out', 'Sign Out', 'Log out of your account', handleSignOut, true)}
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Tokens.spacing.md,
        paddingBottom: Tokens.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212, 175, 55, 0.2)',
        backgroundColor: 'rgba(12, 35, 64, 0.4)',
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: Tokens.typography.lg,
        fontWeight: 'bold',
        color: FitVerseTheme.colors.textPrimary,
    },
    scrollContent: {
        padding: Tokens.spacing.xl,
    },
    sectionTitle: {
        fontSize: Tokens.typography.xs,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: Tokens.spacing.md,
        marginLeft: Tokens.spacing.xs,
        color: FitVerseTheme.colors.textMuted,
        opacity: 0.8,
        marginTop: Tokens.spacing.lg,
    },
    sectionContainer: {
        backgroundColor: FitVerseTheme.colors.surface,
        borderRadius: Tokens.radius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: FitVerseTheme.colors.border,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Tokens.spacing.lg,
        paddingHorizontal: Tokens.spacing.lg,
    },
    settingRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Tokens.spacing.md,
    },
    textContainer: {
        flex: 1,
        marginRight: Tokens.spacing.md,
    },
    settingTitle: {
        fontSize: Tokens.typography.md,
        fontWeight: '600',
        color: FitVerseTheme.colors.textPrimary,
    },
    settingSubtitle: {
        fontSize: Tokens.typography.xs,
        color: FitVerseTheme.colors.textMuted,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: FitVerseTheme.colors.border,
        marginLeft: 68,
    }
});
