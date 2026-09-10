import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Pressable,
    TextInput,
    FlatList,
    StyleSheet,
    Modal,
    ActivityIndicator,
    Alert,
    Platform,
    ListRenderItem,
    ScrollView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserProfile } from '../../types/user';
import { Chat } from '../../types/chat';
import { SocialStore } from '../social/SocialStore';
import { ChatStore } from './ChatStore';
import { VisualSystem } from '@/constants/VisualSystem';

type SentConfirmation = {
    mode: 'dm' | 'group';
    recipientNames: string[];
    groupName?: string;
};

const GROUP_NAME_SUGGESTIONS = ['Gym Crew', 'Accountability', 'Lift Squad', 'Rest Day Crew'];

function formatRecipientList(names: string[]): string {
    if (names.length === 0) return 'your friend';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]}`;
    return `${names[0]}, ${names[1]}, and ${names.length - 2} others`;
}

interface Props {
    visible: boolean;
    currentUser: UserProfile;
    onClose: () => void;
    onChatCreated: (chat: Chat) => void;
    onInviteSent?: (message: string) => void;
    embedded?: boolean;
}

export function NewChatModal({
    visible,
    currentUser,
    onClose,
    onChatCreated,
    onInviteSent,
    embedded = false,
}: Props) {
    const [mode, setMode] = useState<'dm' | 'group'>('dm');
    const [friends, setFriends] = useState<UserProfile[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [sentConfirmation, setSentConfirmation] = useState<SentConfirmation | null>(null);

    useEffect(() => {
        if (visible) {
            loadFriends();
            setSelected([]);
            setGroupName('');
            setMode('dm');
            setSentConfirmation(null);
        }
    }, [visible]);

    const loadFriends = async () => {
        setLoading(true);
        const profiles = await SocialStore.getFriends(currentUser.id);
        setFriends(profiles);
        setLoading(false);
    };

    const toggleSelect = (uid: string) => {
        if (mode === 'dm') {
            setSelected([uid]);
        } else {
            setSelected(prev =>
                prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
            );
        }
    };

    const canCreate = mode === 'dm'
        ? selected.length === 1
        : selected.length >= 1 && groupName.trim().length >= 2;

    const createHint =
        mode === 'group' && selected.length >= 1 && groupName.trim().length < 2
            ? 'Add a group name (at least 2 characters)'
            : mode === 'group' && selected.length === 0
              ? 'Select at least one friend'
              : null;

    const handleCreate = async () => {
        if (!canCreate) return;
        setCreating(true);
        try {
            let result;
            if (mode === 'dm') {
                const friend = friends.find(f => f.id === selected[0]);
                if (!friend) return;
                result = await ChatStore.createDM(
                    currentUser.id,
                    currentUser.displayName || currentUser.name || 'You',
                    friend.id,
                    friend.displayName || friend.name || 'Friend',
                    currentUser.goal
                );
            } else {
                const selectedFriends = friends.filter(f => selected.includes(f.id));
                result = await ChatStore.createGroup(
                    currentUser.id,
                    selectedFriends.map(f => f.id),
                    [
                        currentUser.displayName || currentUser.name || 'You',
                        ...selectedFriends.map(f => f.displayName || f.name || 'Friend'),
                    ],
                    groupName.trim(),
                    currentUser.goal
                );
            }

            if (result.status === 'active') {
                onChatCreated(result.chat);
                return;
            }

            const recipientNames =
                mode === 'dm'
                    ? [
                          friends.find((f) => f.id === selected[0])?.displayName ||
                              friends.find((f) => f.id === selected[0])?.name ||
                              'your friend',
                      ]
                    : friends
                          .filter((f) => selected.includes(f.id))
                          .map((f) => f.displayName || f.name || 'Friend');

            setSentConfirmation({
                mode,
                recipientNames,
                groupName: mode === 'group' ? groupName.trim() : undefined,
            });
        } catch (e: any) {
            console.error('[NewChatModal] create failed:', e);
            const detail =
                e?.message ||
                e?.error?.message ||
                e?.details ||
                'Make sure you are friends first, then try again.';
            Alert.alert('Could not send invite', detail);
        } finally {
            setCreating(false);
        }
    };

    const handleDoneAfterSend = () => {
        if (!sentConfirmation) return;
        const recipients = formatRecipientList(sentConfirmation.recipientNames);
        const message =
            sentConfirmation.mode === 'group' && sentConfirmation.groupName
                ? `Request sent to ${recipients} for "${sentConfirmation.groupName}"`
                : `Request sent to ${recipients}`;
        onInviteSent?.(message);
        setSentConfirmation(null);
        onClose();
    };

    const renderFriend: ListRenderItem<UserProfile> = useCallback(({ item: friend }) => {
        const isSelected = selected.includes(friend.id);
        return (
            <Pressable
                style={[styles.friendRow, isSelected && styles.friendRowSelected]}
                onPress={() => toggleSelect(friend.id)}
            >
                <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                        {(friend.displayName || friend.name || '?').charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.friendInfo}>
                    <Text style={styles.friendName} numberOfLines={1}>
                        {friend.displayName || friend.name}
                    </Text>
                    {friend.goal ? (
                        <Text style={styles.friendGoal} numberOfLines={1}>🎯 {friend.goal}</Text>
                    ) : null}
                </View>
                <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                    {isSelected && <FontAwesome name="check" size={12} color="#0C2340" />}
                </View>
            </Pressable>
        );
    }, [selected, mode]);

    const listHeader = useCallback(() => (
        <View style={styles.controls}>
            <View style={styles.modeRow}>
                <Pressable
                    onPress={() => { setMode('dm'); setSelected([]); }}
                    style={[styles.modeBtn, mode === 'dm' && styles.modeBtnActive]}
                >
                    <FontAwesome name="comment" size={13} color={mode === 'dm' ? '#0C2340' : 'rgba(255,255,255,0.5)'} />
                    <Text style={[styles.modeBtnText, mode === 'dm' && styles.modeBtnTextActive]}>Direct</Text>
                </Pressable>
                <Pressable
                    onPress={() => { setMode('group'); setSelected([]); }}
                    style={[styles.modeBtn, mode === 'group' && styles.modeBtnActive]}
                >
                    <FontAwesome name="users" size={13} color={mode === 'group' ? '#0C2340' : 'rgba(255,255,255,0.5)'} />
                    <Text style={[styles.modeBtnText, mode === 'group' && styles.modeBtnTextActive]}>Group</Text>
                </Pressable>
            </View>

            {mode === 'group' && (
                <>
                    <View style={styles.groupNameWrap}>
                        <FontAwesome name="pencil" size={14} color={VisualSystem.colors.textTertiary} style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.groupNameInput}
                            value={groupName}
                            onChangeText={setGroupName}
                            placeholder="Name your group"
                            placeholderTextColor={VisualSystem.colors.textTertiary}
                            maxLength={40}
                            returnKeyType="done"
                            blurOnSubmit
                        />
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.suggestionRow}
                        keyboardShouldPersistTaps="handled"
                    >
                        {GROUP_NAME_SUGGESTIONS.map((name) => (
                            <Pressable
                                key={name}
                                onPress={() => setGroupName(name)}
                                style={[
                                    styles.suggestionChip,
                                    groupName === name && styles.suggestionChipActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.suggestionChipText,
                                        groupName === name && styles.suggestionChipTextActive,
                                    ]}
                                >
                                    {name}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                    <Text style={styles.groupHint}>
                        Pick friends, name the group, then tap Create. You can chat right away — they'll get a request to join.
                    </Text>
                </>
            )}

            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>
                    {mode === 'dm' ? 'Choose a friend' : 'Add friends'}
                </Text>
                {mode === 'group' && selected.length > 0 && (
                    <Text style={styles.selectedCount}>{selected.length} selected</Text>
                )}
            </View>
        </View>
    ), [mode, groupName, selected.length]);

    if (!visible) return null;

    const content = (
        <View style={styles.root}>
            {sentConfirmation ? (
                <View style={styles.successWrap}>
                    <View style={styles.successIcon}>
                        <FontAwesome name="check" size={28} color="#0C2340" />
                    </View>
                    <Text style={styles.successTitle}>Request sent</Text>
                    <Text style={styles.successRecipients} numberOfLines={3}>
                        {sentConfirmation.mode === 'group' && sentConfirmation.groupName ? (
                            <>
                                Invite sent to{' '}
                                <Text style={styles.successHighlight}>
                                    {formatRecipientList(sentConfirmation.recipientNames)}
                                </Text>
                                {' '}for{' '}
                                <Text style={styles.successHighlight}>
                                    {sentConfirmation.groupName}
                                </Text>
                            </>
                        ) : (
                            <>
                                Request sent to{' '}
                                <Text style={styles.successHighlight}>
                                    {formatRecipientList(sentConfirmation.recipientNames)}
                                </Text>
                            </>
                        )}
                    </Text>
                    <Text style={styles.successSub}>
                        They'll see it under Requests in Messages. You can chat once they accept.
                    </Text>
                    <Pressable
                        style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.9 }]}
                        onPress={handleDoneAfterSend}
                    >
                        <Text style={styles.doneBtnText}>Done</Text>
                    </Pressable>
                </View>
            ) : (
                <>
                    <View style={styles.header}>
                        <Pressable onPress={onClose} style={styles.cancelBtn} hitSlop={12} disabled={creating}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                        <Text style={styles.headerTitle} numberOfLines={1}>New Message</Text>
                        <Pressable
                            onPress={handleCreate}
                            disabled={!canCreate || creating}
                            style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
                        >
                            {creating ? (
                                <View style={styles.sendingWrap}>
                                    <ActivityIndicator size="small" color="#0C2340" />
                                    <Text style={styles.sendingText}>Sending</Text>
                                </View>
                            ) : (
                                <Text style={[styles.createText, !canCreate && styles.createTextDisabled]}>
                                    {mode === 'group' ? 'Create' : 'Send'}
                                </Text>
                            )}
                        </Pressable>
                    </View>

                    {createHint ? (
                        <Text style={styles.createHint}>{createHint}</Text>
                    ) : null}

                    {loading ? (
                        <View style={styles.centerWrap}>
                            <ActivityIndicator color={VisualSystem.colors.gold} size="large" />
                        </View>
                    ) : friends.length === 0 ? (
                        <View style={styles.centerWrap}>
                            <FontAwesome name="user-plus" size={40} color="rgba(124,255,107,0.3)" />
                            <Text style={styles.emptyText}>No friends yet</Text>
                            <Text style={styles.emptySubText}>Add friends from Profile to start messaging</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={friends}
                            keyExtractor={(f) => f.id}
                            renderItem={renderFriend}
                            ListHeaderComponent={listHeader}
                            style={styles.list}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                        />
                    )}
                </>
            )}
        </View>
    );

    if (embedded) {
        return content;
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
                {content}
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    root: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212,175,55,0.2)',
    },
    cancelBtn: {
        width: 72,
        paddingVertical: 8,
    },
    cancelText: { color: VisualSystem.colors.textSecondary, fontSize: 15 },
    headerTitle: {
        flex: 1,
        color: VisualSystem.colors.textPrimary,
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
    },
    createBtn: {
        width: 88,
        backgroundColor: VisualSystem.colors.gold,
        paddingVertical: 9,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendingWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    sendingText: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '700',
        fontSize: 12,
    },
    createBtnDisabled: { backgroundColor: 'rgba(212,175,55,0.2)' },
    createHint: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 12,
        textAlign: 'center',
        marginHorizontal: 20,
        marginBottom: 4,
    },
    createText: { color: VisualSystem.colors.textPrimary, fontWeight: '700', fontSize: 14 },
    createTextDisabled: { color: 'rgba(12,35,64,0.4)' },
    controls: {
        paddingBottom: 4,
    },
    modeRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 10,
        gap: 8,
    },
    modeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(124,255,107,0.25)',
        backgroundColor: 'rgba(124,255,107,0.05)',
        gap: 6,
    },
    modeBtnActive: {
        backgroundColor: VisualSystem.colors.gold,
        borderColor: VisualSystem.colors.borderGold,
    },
    modeBtnText: {
        color: VisualSystem.colors.textSecondary,
        fontWeight: '600',
        fontSize: 14,
    },
    modeBtnTextActive: { color: VisualSystem.colors.textPrimary },
    groupNameWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 10,
        paddingHorizontal: 14,
        height: 48,
        borderRadius: 14,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.25)',
    },
    groupNameInput: {
        flex: 1,
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        paddingVertical: Platform.OS === 'android' ? 0 : 8,
    },
    suggestionRow: {
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    suggestionChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.25)',
        backgroundColor: VisualSystem.colors.bgMid,
    },
    suggestionChipActive: {
        backgroundColor: 'rgba(212,175,55,0.15)',
        borderColor: 'rgba(212,175,55,0.45)',
    },
    suggestionChipText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    suggestionChipTextActive: {
        color: VisualSystem.colors.goldText,
        fontWeight: '700',
    },
    groupHint: {
        marginHorizontal: 16,
        marginBottom: 8,
        color: VisualSystem.colors.textTertiary,
        fontSize: 12,
        lineHeight: 17,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 20,
        marginBottom: 6,
    },
    sectionLabel: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    selectedCount: {
        color: VisualSystem.colors.goldText,
        fontSize: 12,
        fontWeight: '700',
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 24,
        flexGrow: 1,
    },
    centerWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 32,
    },
    emptyText: { color: VisualSystem.colors.textSecondary, fontSize: 16, fontWeight: '600' },
    emptySubText: { color: VisualSystem.colors.textTertiary, fontSize: 13, textAlign: 'center' },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: VisualSystem.colors.borderSubtle,
    },
    friendInfo: { flex: 1, minWidth: 0 },
    friendRowSelected: {
        backgroundColor: 'rgba(124,255,107,0.07)',
    },
    friendAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(124,255,107,0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(124,255,107,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    friendAvatarText: { color: VisualSystem.colors.goldText, fontSize: 18, fontWeight: 'bold' },
    friendName: { color: VisualSystem.colors.textPrimary, fontSize: 15, fontWeight: '600' },
    friendGoal: { color: VisualSystem.colors.textTertiary, fontSize: 12, marginTop: 2 },
    checkCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: VisualSystem.colors.borderSubtle,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkCircleSelected: {
        backgroundColor: VisualSystem.colors.gold,
        borderColor: VisualSystem.colors.borderGold,
    },
    successWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    successIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: VisualSystem.colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    successTitle: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 12,
    },
    successRecipients: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 12,
    },
    successHighlight: {
        color: VisualSystem.colors.goldText,
        fontWeight: '800',
    },
    successSub: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
    },
    doneBtn: {
        backgroundColor: VisualSystem.colors.gold,
        paddingHorizontal: 48,
        paddingVertical: 14,
        borderRadius: 24,
        minWidth: 160,
        alignItems: 'center',
    },
    doneBtnText: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '800',
        fontSize: 16,
    },
});
