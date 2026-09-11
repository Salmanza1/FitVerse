import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { Tokens } from '@/constants/Tokens';
import { SocialStore, SocialActionResult } from './SocialStore';
import { useAuth } from '@/features/auth/AuthContext';
import { UserProfile } from '@/types/user';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';
import { MemberProfileModal } from './MemberProfileModal';
import { supabase } from '@/lib/supabase';
import { VisualSystem } from '@/constants/VisualSystem';

interface SocialDashboardModalProps {
    visible: boolean;
    onClose: () => void;
}

export const SocialDashboardModal: React.FC<SocialDashboardModalProps> = ({ visible, onClose }) => {
    const { user, refreshProfile } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [receivedProfiles, setReceivedProfiles] = useState<UserProfile[]>([]);
    const [friendsProfiles, setFriendsProfiles] = useState<UserProfile[]>([]);
    const [searching, setSearching] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [activeTab, setActiveTab] = useState<'search' | 'requests' | 'friends'>('search');
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

    const [suggestedFriends, setSuggestedFriends] = useState<UserProfile[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [contactsPermission, setContactsPermission] = useState<boolean | null>(null);

    const [pendingSentIds, setPendingSentIds] = useState<string[]>([]);
    const [pendingReceivedIds, setPendingReceivedIds] = useState<string[]>([]);
    const [actionUserId, setActionUserId] = useState<string | null>(null);

    useEffect(() => {
        if (visible && user) {
            setActiveTab('search');
            setSearchQuery('');
            setSearchResults([]);
            loadSocialData();
            loadSuggestedFriends();

            // Phase 3: Real-time Friending via Supabase
            // We listen to the friendships table for any inserts or updates
            const channel = supabase.channel('friendships_presence')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `receiver_id=eq.${user.id}`,
                }, () => loadSocialData())
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `requester_id=eq.${user.id}`,
                }, () => loadSocialData())
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [visible, user?.id]);

    useEffect(() => {
        if (activeTab === 'search' && visible && suggestedFriends.length === 0) {
            loadSuggestedFriends();
        }
    }, [activeTab]);

    const loadSocialData = async () => {
        if (!user) return;
        setLoadingData(true);
        try {
            const summary = await SocialStore.getSocialSummary(user.id);
            const pendingReqs = await SocialStore.getPendingRequests(user.id);
            const friends = await SocialStore.getFriends(user.id);

            setReceivedProfiles(pendingReqs);
            setFriendsProfiles(friends);
            setPendingSentIds(summary.friendRequestsSent);
            setPendingReceivedIds(summary.friendRequestsReceived);
        } catch (e) {
            console.error("Failed to load social data:", e);
        } finally {
            setLoadingData(false);
        }
    };

    const loadSuggestedFriends = async () => {
        if (!user) return;
        setLoadingContacts(true);
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            setContactsPermission(status === 'granted');

            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers],
                });

                if (data.length > 0) {
                    const phoneNumbers: string[] = [];
                    data.forEach(contact => {
                        if (contact.phoneNumbers) {
                            contact.phoneNumbers.forEach(pn => {
                                if (pn.number) phoneNumbers.push(pn.number);
                            });
                        }
                    });

                    const suggestions = await SocialStore.getSuggestedFriends(user.id, phoneNumbers);
                    setSuggestedFriends(suggestions);
                }
            }
        } catch (e) {
            console.error("Failed to load contacts for suggestions", e);
        } finally {
            setLoadingContacts(false);
        }
    };

    // debounced search
    useEffect(() => {
        const performSearch = async () => {
            if (searchQuery.length > 0 && user) {
                setSearching(true);
                const results = await SocialStore.searchUsers(searchQuery, user.id);
                setSearchResults(results);
                setSearching(false);
            } else {
                setSearchResults([]);
            }
        };
        const timer = setTimeout(performSearch, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, user?.id]);

    const runSocialAction = async (
        userId: string,
        action: () => Promise<SocialActionResult>,
        successMessage: string,
    ) => {
        setActionUserId(userId);
        const result = await action();
        setActionUserId(null);

        if (!result.ok) {
            Alert.alert('Could not update friends', result.error || 'Please try again.');
            return;
        }

        await loadSocialData();
        await refreshProfile();
        if (!result.already) {
            Alert.alert('Success', successMessage);
        }
    };

    const handleAccept = async (requesterId: string) => {
        if (!user) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await runSocialAction(
            requesterId,
            () => SocialStore.acceptFriendRequest(user.id, requesterId),
            'You are now friends.',
        );
    };

    const handleDecline = async (requesterId: string) => {
        if (!user) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActionUserId(requesterId);
        const result = await SocialStore.declineFriendRequest(user.id, requesterId);
        setActionUserId(null);
        if (!result.ok) {
            Alert.alert('Could not update friends', result.error || 'Please try again.');
            return;
        }
        await loadSocialData();
        await refreshProfile();
    };

    const handleSendRequest = async (targetId: string) => {
        if (!user) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await runSocialAction(
            targetId,
            () => SocialStore.sendFriendRequest(user.id, targetId),
            'Friend request sent.',
        );
    };

    const renderUserItem = (otherUser: UserProfile, type: 'search' | 'request' | 'friend') => {
        const label = SocialStore.displayLabel(otherUser);
        const isPendingSent = pendingSentIds.includes(otherUser.id);
        const isPendingReceived = pendingReceivedIds.includes(otherUser.id);
        const isFriend = friendsProfiles.some(f => f.id === otherUser.id);
        const isBusy = actionUserId === otherUser.id;

        const cardBody = (
            <>
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>{label.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{label}</Text>
                    <Text style={styles.userSub}>{otherUser.dorm || 'Notre Dame'}</Text>
                </View>
            </>
        );

        if (type === 'friend') {
            return (
                <Pressable
                    key={otherUser.id}
                    style={styles.userCard}
                    onPress={() => setSelectedMemberId(otherUser.id)}
                >
                    {cardBody}
                    <FontAwesome name="chevron-right" size={12} color={FitVerseTheme.colors.textMuted} />
                </Pressable>
            );
        }

        if (type === 'request') {
            return (
                <View key={otherUser.id} style={styles.userCard}>
                    {cardBody}
                    <View style={styles.actionRow}>
                        <Pressable
                            style={[styles.miniBtn, styles.declineBtn]}
                            onPress={() => handleDecline(otherUser.id)}
                            disabled={isBusy}
                        >
                            <FontAwesome name="times" size={14} color={VisualSystem.colors.textPrimary} />
                        </Pressable>
                        <Pressable
                            style={[styles.miniBtn, styles.acceptBtn]}
                            onPress={() => handleAccept(otherUser.id)}
                            disabled={isBusy}
                        >
                            {isBusy ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <FontAwesome name="check" size={14} color="#000" />
                            )}
                        </Pressable>
                    </View>
                </View>
            );
        }

        return (
            <View key={otherUser.id} style={styles.userCard}>
                {cardBody}
                {isFriend ? (
                    <View style={styles.badge}><Text style={styles.badgeText}>Friends</Text></View>
                ) : isPendingReceived ? (
                    <Pressable
                        style={styles.addBtn}
                        onPress={() => handleAccept(otherUser.id)}
                        disabled={isBusy}
                    >
                        {isBusy ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <>
                                <FontAwesome name="check" size={12} color="#000" />
                                <Text style={styles.addBtnText}>Accept</Text>
                            </>
                        )}
                    </Pressable>
                ) : isPendingSent ? (
                    <View style={styles.badgePending}><Text style={styles.badgeTextPending}>Pending</Text></View>
                ) : (
                    <Pressable
                        style={styles.addBtn}
                        onPress={() => handleSendRequest(otherUser.id)}
                        disabled={isBusy}
                    >
                        {isBusy ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <>
                                <FontAwesome name="plus" size={12} color="#000" />
                                <Text style={styles.addBtnText}>Add</Text>
                            </>
                        )}
                    </Pressable>
                )}
            </View>
        );
    };

    return (
        <React.Fragment>
            <Modal
                visible={visible}
                animationType="slide"
                transparent={true}
                onRequestClose={onClose}
            >
                <View style={styles.overlay}>
                    <View style={styles.container}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Friends</Text>
                            <Pressable onPress={onClose} style={styles.closeBtn}>
                                <FontAwesome name="times" size={20} color={FitVerseTheme.colors.textMuted} />
                            </Pressable>
                        </View>

                        {/* Tabs */}
                        <View style={styles.tabContainer}>
                            <Pressable
                                style={[styles.tab, activeTab === 'search' && styles.activeTab]}
                                onPress={() => setActiveTab('search')}
                            >
                                <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>Add</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
                                onPress={() => setActiveTab('requests')}
                            >
                                <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                                    Requests {receivedProfiles.length > 0 ? `(${receivedProfiles.length})` : ''}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
                                onPress={() => setActiveTab('friends')}
                            >
                                <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>Friends</Text>
                            </Pressable>
                        </View>

                        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                            {activeTab === 'search' && (
                                <View>
                                    <View style={styles.searchBar}>
                                        <FontAwesome name="search" size={16} color={FitVerseTheme.colors.accentGold} />
                                        <TextInput
                                            style={styles.searchInput}
                                            placeholder="Search by name or @nd.edu email..."
                                            placeholderTextColor={FitVerseTheme.colors.textMuted}
                                            value={searchQuery}
                                            onChangeText={setSearchQuery}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                    </View>

                                    {searchQuery.length > 0 ? (
                                        searching ? (
                                            <ActivityIndicator style={styles.loader} color={FitVerseTheme.colors.accentGold} />
                                        ) : (
                                            searchResults.length > 0 ? (
                                                searchResults.map(u => renderUserItem(u, 'search'))
                                            ) : (
                                                <Text style={styles.emptyText}>No users found. Try their display name or email.</Text>
                                            )
                                        )
                                    ) : (
                                        <View>
                                            {loadingContacts ? (
                                                <ActivityIndicator style={styles.loader} color={FitVerseTheme.colors.accentGold} />
                                            ) : contactsPermission === false ? (
                                                <View style={styles.suggestionBox}>
                                                    <FontAwesome name="address-book" size={32} color={FitVerseTheme.colors.textMuted} />
                                                    <Text style={styles.emptyText}>Enable Contacts access in iOS Settings to discover friends automatically.</Text>
                                                </View>
                                            ) : suggestedFriends.length > 0 ? (
                                                <View>
                                                    <Text style={styles.sectionTitle}>Suggested from Contacts</Text>
                                                    {suggestedFriends.map(u => renderUserItem(u, 'search'))}
                                                </View>
                                            ) : (
                                                <View style={styles.suggestionBox}>
                                                    <FontAwesome name="search" size={32} color={FitVerseTheme.colors.textMuted} />
                                                    <Text style={styles.emptyText}>Search for a username above or invite friends to join FitVerse.</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}

                            {activeTab === 'requests' && (
                                <View>
                                    {loadingData ? (
                                        <ActivityIndicator style={styles.loader} color={FitVerseTheme.colors.accentGold} />
                                    ) : (
                                        receivedProfiles.length > 0 ? (
                                            receivedProfiles.map(u => renderUserItem(u, 'request'))
                                        ) : (
                                            <View style={styles.emptyState}>
                                                <FontAwesome name="bell-o" size={40} color={FitVerseTheme.colors.surface} />
                                                <Text style={styles.emptyText}>No pending requests.</Text>
                                            </View>
                                        )
                                    )}
                                </View>
                            )}

                            {activeTab === 'friends' && (
                                <View>
                                    {loadingData ? (
                                        <ActivityIndicator style={styles.loader} color={FitVerseTheme.colors.accentGold} />
                                    ) : (
                                        friendsProfiles.length > 0 ? (
                                            friendsProfiles.map(u => renderUserItem(u, 'friend'))
                                        ) : (
                                            <View style={styles.emptyState}>
                                                <FontAwesome name="users" size={40} color={FitVerseTheme.colors.surface} />
                                                <Text style={styles.emptyText}>No friends yet. Search the Add tab to connect.</Text>
                                            </View>
                                        )
                                    )}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <MemberProfileModal
                visible={!!selectedMemberId}
                userId={selectedMemberId}
                onClose={() => setSelectedMemberId(null)}
            />
        </React.Fragment>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: VisualSystem.colors.overlay,
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        height: '85%',
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: VisualSystem.colors.goldText,
        letterSpacing: 1,
    },
    closeBtn: {
        padding: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 10,
        padding: 4,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeTab: {
        backgroundColor: FitVerseTheme.colors.accentGold,
    },
    tabText: {
        color: FitVerseTheme.colors.textMuted,
        fontWeight: '600',
        fontSize: 13,
    },
    activeTabText: {
        color: '#000',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 10,
        paddingHorizontal: 16,
        height: 50,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    searchInput: {
        flex: 1,
        color: VisualSystem.colors.textPrimary,
        marginLeft: 8,
        fontSize: 15,
    },
    content: {
        flex: 1,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: VisualSystem.colors.borderSubtle,
    },
    avatarContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: FitVerseTheme.colors.accentGold,
    },
    avatarText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '700',
        fontSize: 17,
    },
    userInfo: {
        flex: 1,
        marginLeft: 16,
    },
    userName: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        fontWeight: '700',
    },
    userSub: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: 11,
        marginTop: 4,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    miniBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptBtn: {
        backgroundColor: FitVerseTheme.colors.accentGold,
    },
    declineBtn: {
        backgroundColor: '#ef4444',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: FitVerseTheme.colors.accentGold,
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderRadius: 22,
    },
    addBtnText: {
        color: '#000',
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 4,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
    },
    badgeText: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '700',
    },
    badgePending: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    badgeTextPending: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: 11,
        fontWeight: '700',
    },
    loader: {
        marginTop: 32,
    },
    emptyText: {
        color: FitVerseTheme.colors.textMuted,
        textAlign: 'center',
        marginTop: 16,
        fontSize: 13,
    },
    emptyState: {
        marginTop: 32,
        alignItems: 'center',
        opacity: 0.5,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: FitVerseTheme.colors.textMuted,
        marginTop: 8,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    suggestionBox: {
        marginTop: 32,
        alignItems: 'center',
        paddingHorizontal: 32,
    }
});
