import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Pressable,
    ScrollView,
    StyleSheet,
    Modal,
    ActivityIndicator,
    Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserProfile } from '../../types/user';
import { Chat, ChatInvite, Message } from '../../types/chat';
import { ChatStore } from './ChatStore';
import { CHAT_MESSAGE_EVENT, getChatRoomChannelName } from './chatRealtime';
import { NewChatModal } from './NewChatModal';
import { ChatRoomScreen } from './ChatRoomScreen';
import { supabase } from '@/lib/supabase';
import {
    getMemberWorkoutStatuses,
    MemberWorkoutStatus,
    WORKOUT_STATUS_COLORS,
    WORKOUT_STATUS_LABELS,
    WorkoutDayStatus,
} from '@/features/workout/WorkoutPresenceStore';

interface Props {
    visible: boolean;
    currentUser: UserProfile;
    onClose: () => void;
}

type ChatScreen = 'list' | 'new' | 'room';

function statusColor(status: WorkoutDayStatus): string {
    return WORKOUT_STATUS_COLORS[status];
}

function getOtherMemberId(chat: Chat, currentUserId: string): string | null {
    const idx = chat.memberIds.findIndex((id) => id !== currentUserId);
    return idx >= 0 ? chat.memberIds[idx] : null;
}

function bumpChatPreview(chats: Chat[], msg: Message): Chat[] {
    const idx = chats.findIndex((c) => c.id === msg.chatId);
    if (idx < 0) return chats;

    const updated: Chat = {
        ...chats[idx],
        lastMessage: {
            text: msg.text,
            sentAt: msg.sentAt,
            senderName: msg.senderName,
        },
    };

    const next = [...chats];
    next.splice(idx, 1);
    next.unshift(updated);
    return next;
}

export function ChatsListScreen(props: Props) {
    return (
        <Modal
            visible={props.visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={props.onClose}
        >
            <SafeAreaProvider>
                <ChatsListScreenBody {...props} />
            </SafeAreaProvider>
        </Modal>
    );
}

function ChatsListScreenBody({ visible, currentUser, onClose }: Props) {
    const insets = useSafeAreaInsets();
    const [chats, setChats] = useState<Chat[]>([]);
    const [invites, setInvites] = useState<ChatInvite[]>([]);
    const [loading, setLoading] = useState(false);
    const [respondingId, setRespondingId] = useState<string | null>(null);
    const [screen, setScreen] = useState<ChatScreen>('list');
    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [sentBanner, setSentBanner] = useState<string | null>(null);
    const [memberStatuses, setMemberStatuses] = useState<Record<string, MemberWorkoutStatus>>({});

    const loadMemberStatuses = useCallback(
        async (chatList: Chat[]) => {
            const ids = new Set<string>([currentUser.id]);
            for (const chat of chatList) {
                chat.memberIds.forEach((id) => ids.add(id));
            }
            const statuses = await getMemberWorkoutStatuses(Array.from(ids));
            setMemberStatuses(statuses);
        },
        [currentUser.id]
    );

    const loadChats = useCallback(async () => {
        setLoading(true);
        const [chatResult, inviteResult] = await Promise.all([
            ChatStore.getChatsForUser(currentUser.id),
            ChatStore.getPendingInvites(currentUser.id),
        ]);
        setChats(chatResult);
        setInvites(inviteResult);
        await loadMemberStatuses(chatResult);
        setLoading(false);
    }, [currentUser.id, loadMemberStatuses]);

    useEffect(() => {
        if (!visible) {
            setScreen('list');
            setActiveChat(null);
        }
    }, [visible]);

    useEffect(() => {
        if (visible) {
            loadChats();

            // Real-time Chat List updates
            // (Supabase inherently respects RLS, so this only fires for messages we are allowed to see)
            const channel = supabase
                .channel(`chats_list_${currentUser.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                    },
                    (payload) => {
                        const row = payload.new as {
                            id: string;
                            chat_id: string;
                            sender_id: string;
                            content: string;
                            created_at: string;
                        };

                        setChats((prev) => {
                            const chat = prev.find((c) => c.id === row.chat_id);
                            if (!chat) {
                                void loadChats();
                                return prev;
                            }
                            const msg = ChatStore.mapMessageRow(
                                row,
                                chat.memberIds,
                                chat.memberNames
                            );
                            if (row.sender_id === currentUser.id) {
                                msg.senderName =
                                    currentUser.displayName || currentUser.name || 'You';
                            }
                            return bumpChatPreview(prev, msg);
                        });
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'chat_invites',
                    },
                    () => {
                        loadChats();
                    }
                )
                .subscribe();

            const statusPoll = setInterval(() => {
                setChats((prev) => {
                    void loadMemberStatuses(prev);
                    return prev;
                });
            }, 30000);

            const presenceChannel = supabase
                .channel(`chats_list_presence_${currentUser.id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'workout_live_status' },
                    () => {
                        setChats((prev) => {
                            void loadMemberStatuses(prev);
                            return prev;
                        });
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'user_rest_days' },
                    () => {
                        setChats((prev) => {
                            void loadMemberStatuses(prev);
                            return prev;
                        });
                    }
                )
                .subscribe();

            return () => {
                clearInterval(statusPoll);
                supabase.removeChannel(channel);
                void supabase.removeChannel(presenceChannel);
            };
        }
    }, [visible, loadChats, loadMemberStatuses, currentUser.id]);

    // Instant inbox previews via broadcast (faster than DB replication).
    useEffect(() => {
        if (!visible || screen !== 'list' || chats.length === 0) return;

        const channels = chats.map((chat) =>
            supabase
                .channel(getChatRoomChannelName(chat.id))
                .on('broadcast', { event: CHAT_MESSAGE_EVENT }, ({ payload }) => {
                    const msg = payload as Message;
                    setChats((prev) => bumpChatPreview(prev, msg));
                })
                .subscribe()
        );

        return () => {
            channels.forEach((ch) => void supabase.removeChannel(ch));
        };
    }, [visible, screen, chats.map((c) => c.id).join('|')]);

    const handleChatCreated = (chat: Chat) => {
        setChats((prev) => {
            const idx = prev.findIndex((c) => c.id === chat.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...chat };
                return next;
            }
            return [chat, ...prev];
        });
        setActiveChat(chat);
        setScreen('room');
        void loadChats();
    };

    const handleInviteSent = (message: string) => {
        setScreen('list');
        setSentBanner(message);
        loadChats();
    };

    useEffect(() => {
        if (!sentBanner) return;
        const timer = setTimeout(() => setSentBanner(null), 5000);
        return () => clearTimeout(timer);
    }, [sentBanner]);

    const handleAcceptInvite = async (invite: ChatInvite) => {
        setRespondingId(invite.id);
        try {
            const chat = await ChatStore.acceptInvite(invite.id, currentUser.id);
            setChats((prev) => {
                const idx = prev.findIndex((c) => c.id === chat.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = { ...next[idx], ...chat };
                    return next;
                }
                return [chat, ...prev];
            });
            setActiveChat(chat);
            setScreen('room');
            await loadChats();
        } catch (e: any) {
            Alert.alert('Could not accept', e?.message || 'Please try again.');
        } finally {
            setRespondingId(null);
        }
    };

    const handleDeclineInvite = (invite: ChatInvite) => {
        const label =
            invite.type === 'group'
                ? `Decline invite to "${invite.groupName}"?`
                : `Decline chat request from ${invite.inviterName}?`;

        Alert.alert('Decline invite', label, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Decline',
                style: 'destructive',
                onPress: async () => {
                    setRespondingId(invite.id);
                    try {
                        await ChatStore.declineInvite(invite.id);
                        await loadChats();
                    } catch (e: any) {
                        Alert.alert('Could not decline', e?.message || 'Please try again.');
                    } finally {
                        setRespondingId(null);
                    }
                },
            },
        ]);
    };

    const getInviteDescription = (invite: ChatInvite): string => {
        if (invite.type === 'group') {
            return `${invite.inviterName} invited you to "${invite.groupName || 'Group Chat'}"`;
        }
        return `${invite.inviterName} wants to start a direct message`;
    };

    const handleChatRoomClose = () => {
        setActiveChat(null);
        setScreen('list');
        loadChats();
    };

    const handleCloseAll = () => {
        setScreen('list');
        setActiveChat(null);
        onClose();
    };

    const getChatDisplayName = (chat: Chat): string => {
        if (chat.type === 'group') return chat.name || 'Group Chat';
        const otherIndex = chat.memberIds.findIndex(id => id !== currentUser.id);
        return chat.memberNames[otherIndex] || 'Unknown';
    };

    const getInitial = (chat: Chat): string => {
        return getChatDisplayName(chat).charAt(0).toUpperCase();
    };

    const formatTime = (isoStr?: string): string => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) {
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const shellPadding = {
        paddingTop: insets.top,
        paddingBottom: screen === 'room' ? 0 : insets.bottom,
    };

    return (
            <View style={[styles.root, shellPadding]}>
                {screen === 'list' && (
                    <View style={styles.listScreen}>
                        <View style={styles.header}>
                            <Pressable onPress={handleCloseAll} style={styles.backBtn} hitSlop={12}>
                                <FontAwesome name="chevron-down" size={18} color="#D4AF37" />
                            </Pressable>
                            <Text style={styles.headerTitle}>Messages</Text>
                            <Pressable
                                onPress={() => setScreen('new')}
                                style={styles.newBtn}
                                hitSlop={8}
                            >
                                <FontAwesome name="edit" size={20} color="#D4AF37" />
                            </Pressable>
                        </View>

                        <View style={styles.subHeader}>
                            <FontAwesome name="bolt" size={12} color="#D4AF37" />
                            <Text style={styles.subHeaderText}>
                                {' '}
                                <Text style={{ color: WORKOUT_STATUS_COLORS.completed }}>Green</Text>
                                {' = done · '}
                                <Text style={{ color: WORKOUT_STATUS_COLORS.in_progress }}>Yellow</Text>
                                {' = live · '}
                                <Text style={{ color: WORKOUT_STATUS_COLORS.not_done }}>Red</Text>
                                {' = not yet · '}
                                <Text style={{ color: WORKOUT_STATUS_COLORS.rest_day }}>Purple</Text>
                                {' = rest day'}
                            </Text>
                        </View>

                        {sentBanner && (
                            <View style={styles.sentBanner}>
                                <FontAwesome name="check-circle" size={16} color="#D4AF37" />
                                <Text style={styles.sentBannerText} numberOfLines={2}>{sentBanner}</Text>
                                <Pressable onPress={() => setSentBanner(null)} hitSlop={8}>
                                    <FontAwesome name="times" size={14} color="rgba(255,255,255,0.5)" />
                                </Pressable>
                            </View>
                        )}

                        {loading ? (
                            <View style={styles.loadingWrap}>
                                <ActivityIndicator size="large" color="#D4AF37" />
                            </View>
                        ) : chats.length === 0 && invites.length === 0 ? (
                            <View style={styles.emptyWrap}>
                                <FontAwesome name="comments-o" size={64} color="rgba(212,175,55,0.15)" />
                                <Text style={styles.emptyTitle}>No messages yet</Text>
                                <Text style={styles.emptySubText}>
                                    Add friends from Profile → Friends, then tap New message.
                                </Text>
                                <Pressable style={styles.startBtn} onPress={() => setScreen('new')}>
                                    <FontAwesome name="edit" size={14} color="#0C2340" style={{ marginRight: 8 }} />
                                    <Text style={styles.startBtnText}>New message</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <ScrollView style={styles.chatsList} showsVerticalScrollIndicator={false}>
                                {invites.length > 0 && (
                                    <View style={styles.requestsSection}>
                                        <View style={styles.requestsHeader}>
                                            <Text style={styles.requestsTitle}>Requests</Text>
                                            <View style={styles.requestsBadge}>
                                                <Text style={styles.requestsBadgeText}>{invites.length}</Text>
                                            </View>
                                        </View>
                                        {invites.map((invite) => {
                                            const isResponding = respondingId === invite.id;
                                            return (
                                                <View key={invite.id} style={styles.requestCard}>
                                                    <View style={styles.requestIcon}>
                                                        <FontAwesome
                                                            name={invite.type === 'group' ? 'users' : 'comment'}
                                                            size={16}
                                                            color="#D4AF37"
                                                        />
                                                    </View>
                                                    <View style={styles.requestBody}>
                                                        <Text style={styles.requestDesc} numberOfLines={2}>
                                                            {getInviteDescription(invite)}
                                                        </Text>
                                                        <Text style={styles.requestTime}>
                                                            {formatTime(invite.createdAt)}
                                                        </Text>
                                                        <View style={styles.requestActions}>
                                                            <Pressable
                                                                style={[styles.acceptBtn, isResponding && styles.btnDisabled]}
                                                                onPress={() => handleAcceptInvite(invite)}
                                                                disabled={isResponding}
                                                            >
                                                                {isResponding ? (
                                                                    <ActivityIndicator size="small" color="#0C2340" />
                                                                ) : (
                                                                    <Text style={styles.acceptBtnText}>Accept</Text>
                                                                )}
                                                            </Pressable>
                                                            <Pressable
                                                                style={[styles.declineBtn, isResponding && styles.btnDisabled]}
                                                                onPress={() => handleDeclineInvite(invite)}
                                                                disabled={isResponding}
                                                            >
                                                                <Text style={styles.declineBtnText}>Decline</Text>
                                                            </Pressable>
                                                        </View>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}

                                {chats.length > 0 && (
                                    <Text style={styles.chatsSectionTitle}>Chats</Text>
                                )}

                                {chats.map(chat => {
                                    const unread = chat.unreadCounts?.[currentUser.id] ?? 0;
                                    const displayName = getChatDisplayName(chat);
                                    const otherId = getOtherMemberId(chat, currentUser.id);
                                    const dmStatus: WorkoutDayStatus | null =
                                        chat.type === 'dm' && otherId
                                            ? memberStatuses[otherId]?.status ?? 'not_done'
                                            : null;
                                    const nameColor =
                                        dmStatus != null
                                            ? statusColor(dmStatus)
                                            : unread > 0
                                              ? '#F5F5F5'
                                              : 'rgba(255,255,255,0.7)';
                                    return (
                                        <Pressable
                                            key={chat.id}
                                            style={styles.chatRow}
                                            onPress={() => {
                                                setActiveChat(chat);
                                                setScreen('room');
                                            }}
                                        >
                                            <View
                                                style={[
                                                    styles.avatar,
                                                    chat.type === 'group' && styles.avatarGroup,
                                                    dmStatus != null && {
                                                        borderColor: statusColor(dmStatus),
                                                        backgroundColor: `${statusColor(dmStatus)}18`,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={{
                                                        color: dmStatus != null ? statusColor(dmStatus) : '#D4AF37',
                                                        fontWeight: '800',
                                                        fontSize: 18,
                                                    }}
                                                >
                                                    {getInitial(chat)}
                                                </Text>
                                                {dmStatus != null && (
                                                    <View
                                                        style={[
                                                            styles.statusDot,
                                                            { backgroundColor: statusColor(dmStatus) },
                                                        ]}
                                                    />
                                                )}
                                                {unread > 0 && (
                                                    <View style={styles.unreadDot}>
                                                        <Text style={styles.unreadDotText}>
                                                            {unread > 9 ? '9+' : unread}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.chatInfo}>
                                                <View style={styles.chatTopRow}>
                                                    <Text
                                                        style={[
                                                            styles.chatName,
                                                            { color: nameColor },
                                                            unread > 0 && styles.chatNameUnread,
                                                        ]}
                                                        numberOfLines={1}
                                                    >
                                                        {displayName}
                                                    </Text>
                                                    <Text style={styles.chatTime}>
                                                        {formatTime(chat.lastMessage?.sentAt ?? chat.createdAt)}
                                                    </Text>
                                                </View>
                                                {chat.type === 'group' ? (
                                                    <View style={styles.memberStatusRow}>
                                                        {chat.memberIds.map((id, i) => {
                                                            const st =
                                                                memberStatuses[id]?.status ?? 'not_done';
                                                            const label =
                                                                id === currentUser.id
                                                                    ? 'You'
                                                                    : (chat.memberNames[i]?.split(' ')[0] ||
                                                                          'User');
                                                            return (
                                                                <Text
                                                                    key={id}
                                                                    style={[
                                                                        styles.memberStatusName,
                                                                        { color: statusColor(st) },
                                                                    ]}
                                                                >
                                                                    {label}
                                                                </Text>
                                                            );
                                                        })}
                                                    </View>
                                                ) : dmStatus != null ? (
                                                    <Text
                                                        style={[
                                                            styles.statusSub,
                                                            { color: statusColor(dmStatus) },
                                                        ]}
                                                        numberOfLines={1}
                                                    >
                                                        {WORKOUT_STATUS_LABELS[dmStatus]}
                                                    </Text>
                                                ) : null}
                                                {chat.lastMessage ? (
                                                    <Text
                                                        style={[styles.lastMsg, unread > 0 && styles.lastMsgUnread]}
                                                        numberOfLines={1}
                                                    >
                                                        {chat.lastMessage.text}
                                                    </Text>
                                                ) : chat.hasPendingInvites ? (
                                                    <Text style={styles.lastMsgPending}>Waiting for invite acceptance…</Text>
                                                ) : (
                                                    <Text style={styles.lastMsgEmpty}>Say hello</Text>
                                                )}
                                            </View>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                )}

                {screen === 'new' && (
                    <NewChatModal
                        visible
                        embedded
                        currentUser={currentUser}
                        onClose={() => setScreen('list')}
                        onChatCreated={handleChatCreated}
                        onInviteSent={handleInviteSent}
                    />
                )}

                {screen === 'room' && activeChat && (
                    <View style={styles.fullScreenPanel}>
                        <ChatRoomScreen
                            visible
                            embedded
                            chat={activeChat}
                            currentUserId={currentUser.id}
                            currentUserName={currentUser.displayName || currentUser.name || 'You'}
                            onClose={handleChatRoomClose}
                            onMessageSent={(msg) => {
                                setChats((prev) => bumpChatPreview(prev, msg));
                            }}
                        />
                    </View>
                )}
            </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#0C2340',
    },
    listScreen: {
        flex: 1,
    },
    fullScreenPanel: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212,175,55,0.2)',
    },
    backBtn: {
        width: 44, height: 44,
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: {
        color: '#F5F5F5',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    newBtn: {
        width: 44, height: 44,
        justifyContent: 'center', alignItems: 'center',
    },
    subHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: 'rgba(212,175,55,0.07)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212,175,55,0.1)',
    },
    subHeaderText: {
        color: '#D4AF37',
        fontSize: 12,
        fontWeight: '600',
    },
    sentBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: 'rgba(212,175,55,0.12)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.3)',
    },
    sentBannerText: {
        flex: 1,
        color: '#F5F5F5',
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: {
        flex: 1, alignItems: 'center',
        paddingTop: 80, gap: 14, paddingHorizontal: 40,
    },
    emptyTitle: { color: '#F5F5F5', fontSize: 20, fontWeight: '800' },
    emptySubText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14, textAlign: 'center', lineHeight: 20,
    },
    startBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#D4AF37',
        paddingHorizontal: 24, paddingVertical: 12,
        borderRadius: 24, marginTop: 8,
    },
    startBtnText: { color: '#0C2340', fontWeight: '800', fontSize: 15 },
    chatsList: { flex: 1 },
    requestsSection: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    requestsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    requestsTitle: {
        color: '#F5F5F5',
        fontSize: 15,
        fontWeight: '800',
    },
    requestsBadge: {
        backgroundColor: '#D4AF37',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    requestsBadgeText: {
        color: '#0C2340',
        fontSize: 11,
        fontWeight: '800',
    },
    requestCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(212,175,55,0.08)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.25)',
        padding: 14,
        marginBottom: 10,
        gap: 12,
    },
    requestIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(212,175,55,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    requestBody: { flex: 1, minWidth: 0 },
    requestDesc: {
        color: '#F5F5F5',
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
    requestTime: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 11,
        marginTop: 4,
        marginBottom: 10,
    },
    requestActions: {
        flexDirection: 'row',
        gap: 8,
    },
    acceptBtn: {
        flex: 1,
        backgroundColor: '#D4AF37',
        borderRadius: 10,
        paddingVertical: 9,
        alignItems: 'center',
        minHeight: 36,
        justifyContent: 'center',
    },
    acceptBtnText: {
        color: '#0C2340',
        fontWeight: '800',
        fontSize: 13,
    },
    declineBtn: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 9,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        minHeight: 36,
        justifyContent: 'center',
    },
    declineBtnText: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '700',
        fontSize: 13,
    },
    btnDisabled: { opacity: 0.6 },
    chatsSectionTitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginHorizontal: 20,
        marginTop: 8,
        marginBottom: 4,
    },
    chatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    avatar: {
        width: 52, height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(124,255,107,0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(124,255,107,0.3)',
        justifyContent: 'center', alignItems: 'center',
        position: 'relative',
    },
    avatarGroup: {
        backgroundColor: 'rgba(212,175,55,0.1)',
        borderColor: 'rgba(212,175,55,0.35)',
    },
    unreadDot: {
        position: 'absolute', top: -2, right: -2,
        backgroundColor: '#D4AF37',
        borderRadius: 10, minWidth: 18, height: 18,
        justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 3,
        borderWidth: 1.5, borderColor: '#0C2340',
    },
    unreadDotText: { color: '#0C2340', fontSize: 10, fontWeight: '800' },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#0C2340',
    },
    chatInfo: { flex: 1, gap: 3 },
    memberStatusRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    memberStatusName: {
        fontSize: 11,
        fontWeight: '800',
    },
    statusSub: {
        fontSize: 11,
        fontWeight: '700',
    },
    chatTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chatName: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600', flex: 1 },
    chatNameUnread: { fontWeight: '800' },
    chatTime: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
    lastMsg: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
    lastMsgUnread: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    lastMsgEmpty: { color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic' },
    lastMsgPending: { color: 'rgba(212,175,55,0.65)', fontSize: 13, fontStyle: 'italic' },
    goalBadge: { color: 'rgba(212,175,55,0.7)', fontSize: 11, marginTop: 2 },
    comingSoonBadge: {
        backgroundColor: 'rgba(212,175,55,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.3)',
        marginBottom: 10,
    },
    comingSoonBadgeText: {
        color: '#D4AF37',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
    },
    comingSoonPlaceholderCard: {
        marginTop: 30,
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(212,175,55,0.2)',
    },
    lockText: {
        color: 'rgba(212,175,55,0.4)',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 10,
        letterSpacing: 1,
    },
});
