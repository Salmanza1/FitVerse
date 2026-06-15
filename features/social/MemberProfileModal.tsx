import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, Pressable, ScrollView, ActivityIndicator, ImageBackground } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { Tokens } from '@/constants/Tokens';
import { SocialStore } from './SocialStore';
import { UserProfile } from '@/types/user';
import { LinearGradient } from 'expo-linear-gradient';

interface MemberProfileModalProps {
    userId: string | null;
    visible: boolean;
    onClose: () => void;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({ userId, visible, onClose }) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && userId) {
            loadProfile();
        }
    }, [visible, userId]);

    const loadProfile = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const data = await SocialStore.getProfile(userId);
            setProfile(data);
        } catch (e) {
            console.error("Failed to load member profile:", e);
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator color={FitVerseTheme.colors.accentGold} size="large" />
                        </View>
                    ) : profile ? (
                        <View style={{ flex: 1 }}>
                            <View style={styles.header}>
                                <ImageBackground
                                    source={require('@/assets/images/profile_hero.png')}
                                    style={styles.hero}
                                >
                                    <LinearGradient
                                        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
                                        style={StyleSheet.absoluteFill}
                                    />
                                    <Pressable style={styles.closeBtn} onPress={onClose}>
                                        <FontAwesome name="chevron-down" size={20} color="#fff" />
                                    </Pressable>
                                </ImageBackground>
                                <View style={styles.avatarWrapper}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{profile.displayName.charAt(0)}</Text>
                                    </View>
                                </View>
                            </View>

                            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                                <View style={styles.infoCenter}>
                                    <Text style={styles.name}>{profile.displayName}</Text>
                                    <Text style={styles.sub}>{profile.email}</Text>
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>LEGEND</Text>
                                    </View>
                                </View>

                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{profile.friends?.length || 0}</Text>
                                        <Text style={styles.statLabel}>Friends</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{profile.dorm || 'N/A'}</Text>
                                        <Text style={styles.statLabel}>Dorm</Text>
                                    </View>
                                </View>

                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Fitness Goal</Text>
                                    <View style={styles.goalCard}>
                                        <FontAwesome name="trophy" size={20} color={FitVerseTheme.colors.accentGold} />
                                        <Text style={styles.goalText}>{profile.goal || 'No goal set yet'}</Text>
                                    </View>
                                </View>
                            </ScrollView>
                        </View>
                    ) : (
                        <View style={styles.center}>
                            <Text style={{ color: '#fff' }}>Profile not found.</Text>
                            <Pressable onPress={onClose} style={{ marginTop: 20 }}>
                                <Text style={{ color: FitVerseTheme.colors.accentGold }}>Close</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#0C2340',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderTopWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        height: '92%',
        overflow: 'hidden',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        height: 180,
    },
    hero: {
        width: '100%',
        height: '100%',
        justifyContent: 'flex-start',
    },
    closeBtn: {
        marginTop: 20,
        marginLeft: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarWrapper: {
        position: 'absolute',
        bottom: -40,
        alignSelf: 'center',
        zIndex: 10,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(212, 175, 55, 0.06)',
        borderWidth: 2,
        borderColor: 'rgba(212, 175, 55, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: FitVerseTheme.colors.accentGold,
        fontSize: 40,
        fontWeight: '900',
    },
    content: {
        flex: 1,
        marginTop: 50,
        paddingHorizontal: 25,
    },
    infoCenter: {
        alignItems: 'center',
        marginBottom: 25,
    },
    name: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    sub: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: 14,
        marginBottom: 15,
    },
    badge: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.4)',
    },
    badgeText: {
        color: '#D4AF37',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 30,
        alignItems: 'center',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    statValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    statLabel: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: 12,
        marginTop: 4,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    goalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    goalText: {
        color: '#fff',
        marginLeft: 15,
        fontSize: 14,
        fontWeight: '500',
    },
    prefsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    prefTag: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    prefText: {
        color: '#fff',
        fontSize: 13,
    }
});
