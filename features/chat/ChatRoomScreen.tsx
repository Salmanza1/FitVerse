import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    StyleSheet,
    Modal,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Animated,
    Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chat, Message, WorkoutDayStatus } from '../../types/chat';
import { ChatStore } from './ChatStore';
import {
    broadcastChatMessage,
    broadcastChatMessageUpdate,
    broadcastReactionUpdate,
    CHAT_MESSAGE_EVENT,
    CHAT_MESSAGE_UPDATE_EVENT,
    CHAT_REACTION_EVENT,
    getChatRoomChannelName,
    isPendingMessageId,
} from './chatRealtime';
import {
    FriendStreakBanner,
    GymInviteBubble,
    GymTimePicker,
    MessageReactionBar,
    MilestoneBubble,
    QuickReplyBar,
} from './ChatMessageExtras';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
    declareRestDay,
    getMemberWorkoutStatuses,
    WORKOUT_STATUS_COLORS,
    WORKOUT_STATUS_LABELS,
    MemberWorkoutStatus,
} from '@/features/workout/WorkoutPresenceStore';
import { isRestDayMessage } from './chatSocial';
import { VisualSystem } from '@/constants/VisualSystem';

/** Shape of a `message_reactions` row as delivered by Supabase realtime. */
type MessageReactionRow = {
    message_id: string;
    user_id: string;
    emoji: string | null;
};

interface Props {
    visible: boolean;
    chat: Chat | null;
    currentUserId: string;
    currentUserName: string;
    onClose: () => void;
    /** When true, renders inside parent modal instead of opening another Modal (fixes web). */
    embedded?: boolean;
    /** Keeps the inbox preview in sync while the room is open. */
    onMessageSent?: (message: Message) => void;
}

function statusColor(status: WorkoutDayStatus): string {
    return WORKOUT_STATUS_COLORS[status];
}

export function ChatRoomScreen({ visible, chat, currentUserId, currentUserName, onClose, embedded = false, onMessageSent }: Props) {
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [memberStatuses, setMemberStatuses] = useState<Record<string, MemberWorkoutStatus>>({});
    const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());
    const [nudgeSending, setNudgeSending] = useState(false);
    const [streakDays, setStreakDays] = useState(0);
    const [showGymPicker, setShowGymPicker] = useState(false);
    const [roomChat, setRoomChat] = useState<Chat | null>(chat);
    const [pendingInvitees, setPendingInvitees] = useState<{ id: string; name: string }[]>([]);
    const scrollRef = useRef<ScrollView>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const pendingBroadcastsRef = useRef<Message[]>([]);
    const nudgeScale = useRef(new Animated.Value(1)).current;

    const activeChat = roomChat ?? chat;
    const roomChatRef = useRef(activeChat);
    roomChatRef.current = activeChat;

    const refreshRoomChat = useCallback(async () => {
        if (!chat) return;
        const updated = await ChatStore.getChatById(chat.id, currentUserId);
        if (!updated) return;

        setRoomChat(updated);

        if (updated.type === 'group') {
            const pending = await ChatStore.getPendingInviteesForChat(chat.id);
            setPendingInvitees(pending);
        } else {
            setPendingInvitees([]);
        }

        const allIds = Array.from(new Set([currentUserId, ...updated.memberIds]));
        const [statuses, nudged] = await Promise.all([
            getMemberWorkoutStatuses(allIds),
            ChatStore.getNudgedToday(
                currentUserId,
                updated.memberIds.filter((id) => id !== currentUserId)
            ),
        ]);
        setMemberStatuses(statuses);
        setNudgedToday(nudged);
    }, [chat?.id, currentUserId]);

    useEffect(() => {
        if (chat) setRoomChat(chat);
    }, [chat?.id, chat?.memberIds?.join('|'), chat?.hasPendingInvites, chat?.name]);

    useEffect(() => {
        if (!visible || !chat?.id) return;
        setMessages([]);
        setInputText('');
    }, [visible, chat?.id]);

    const notifyMessageSent = useCallback(
        (msg: Message) => {
            onMessageSent?.(msg);
        },
        [onMessageSent]
    );

    const queueBroadcast = useCallback((msg: Message) => {
        const channel = channelRef.current;
        if (channel) {
            void broadcastChatMessage(channel, msg);
            return;
        }
        pendingBroadcastsRef.current.push(msg);
    }, []);

    const syncMessagesFromServer = useCallback(async () => {
        const c = roomChatRef.current ?? chat;
        if (!c) return;

        const fresh = await ChatStore.getMessages(c.id, c.memberIds, c.memberNames);
        setMessages((prev) => {
            const pending = prev.filter((m) => isPendingMessageId(m.id));
            const byId = new Map<string, Message>();
            for (const m of fresh) byId.set(m.id, m);
            for (const m of pending) byId.set(m.id, m);
            return Array.from(byId.values()).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
        });
    }, [chat]);

    const loadMessages = useCallback(async () => {
        if (!activeChat) return;
        setLoading(true);
        const msgs = await ChatStore.getMessages(
            activeChat.id,
            activeChat.memberIds,
            activeChat.memberNames
        );
        setMessages(msgs);
        await ChatStore.markChatRead(activeChat.id, currentUserId);
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }, [activeChat?.id, activeChat?.memberIds?.join('|'), currentUserId]);

    const loadMemberStatuses = useCallback(async () => {
        if (!activeChat) return;
        const others = activeChat.memberIds.filter((id) => id !== currentUserId);
        const allIds = Array.from(new Set([currentUserId, ...activeChat.memberIds]));
        const [statuses, nudged] = await Promise.all([
            getMemberWorkoutStatuses(allIds),
            ChatStore.getNudgedToday(currentUserId, others),
        ]);
        setMemberStatuses(statuses);
        setNudgedToday(nudged);
    }, [activeChat, currentUserId]);

    const loadStreak = useCallback(async () => {
        if (!activeChat || activeChat.type !== 'dm') {
            setStreakDays(0);
            return;
        }
        const friendId = activeChat.memberIds.find((id) => id !== currentUserId);
        if (!friendId) {
            setStreakDays(0);
            return;
        }
        const days = await ChatStore.getFriendActiveDaysTogether(currentUserId, friendId);
        setStreakDays(days);
    }, [activeChat, currentUserId]);

    useEffect(() => {
        if (visible && activeChat) {
            void loadMemberStatuses();
        }
    }, [visible, activeChat?.memberIds?.join('|'), loadMemberStatuses]);

    const applyReactionUpdate = useCallback(
        (messageId: string, userId: string, emoji: string | null) => {
            setMessages((prev) =>
                prev.map((m) => {
                    if (m.id !== messageId) return m;
                    const reactions = [...(m.reactions ?? [])].filter((r) => r.userId !== userId);
                    if (emoji) reactions.push({ emoji, userId });
                    return { ...m, reactions };
                })
            );
        },
        []
    );

    const applyMessageUpdate = useCallback((updated: Message) => {
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    }, []);

    const appendMessage = useCallback(
        (msg: Message, options?: { scroll?: boolean }) => {
            const c = roomChatRef.current ?? chat;
            if (!c || msg.chatId !== c.id) return;

            setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });

            if (msg.senderId !== currentUserId) {
                void ChatStore.markChatRead(c.id, currentUserId);
            }

            if (options?.scroll !== false) {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
            }
        },
        [chat, currentUserId]
    );

    const appendLiveMessage = useCallback(
        (row: {
            id: string;
            chat_id: string;
            sender_id: string;
            content: string;
            created_at: string;
            message_type?: string;
            metadata?: Record<string, unknown> | null;
        }) => {
            const c = roomChatRef.current ?? chat;
            if (!c || row.chat_id !== c.id) return;

            const memberIdx = c.memberIds.indexOf(row.sender_id);
            const msg = ChatStore.mapMessageRow(row, c.memberIds, c.memberNames);
            appendMessage(msg);

            if (row.sender_id !== currentUserId) {
                void ChatStore.resolveSenderName(row.sender_id, msg.senderName).then((name) => {
                    if (name === msg.senderName) return;
                    setMessages((prev) =>
                        prev.map((m) => (m.id === msg.id ? { ...m, senderName: name } : m))
                    );
                });
            }

            if (memberIdx < 0 && row.sender_id !== currentUserId) {
                void refreshRoomChat();
            }
        },
        [chat, appendMessage, refreshRoomChat]
    );

    useEffect(() => {
        if (visible && chat) {
            loadMessages();
            loadMemberStatuses();
            loadStreak();
            void refreshRoomChat();

            const channel = supabase
                .channel(getChatRoomChannelName(chat.id), {
                    config: { broadcast: { ack: false, self: false } },
                })
                .on('broadcast', { event: CHAT_MESSAGE_EVENT }, ({ payload }) => {
                    const msg = payload as Message;
                    appendMessage(msg);
                })
                .on('broadcast', { event: CHAT_MESSAGE_UPDATE_EVENT }, ({ payload }) => {
                    applyMessageUpdate(payload as Message);
                })
                .on('broadcast', { event: CHAT_REACTION_EVENT }, ({ payload }) => {
                    const { messageId, userId, emoji } = payload as {
                        messageId: string;
                        userId: string;
                        emoji: string | null;
                    };
                    applyReactionUpdate(messageId, userId, emoji);
                })
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `chat_id=eq.${chat.id}`,
                    },
                    (payload) => {
                        appendLiveMessage(payload.new as {
                            id: string;
                            chat_id: string;
                            sender_id: string;
                            content: string;
                            created_at: string;
                            message_type?: string;
                            metadata?: Record<string, unknown> | null;
                        });
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'messages',
                        filter: `chat_id=eq.${chat.id}`,
                    },
                    (payload) => {
                        const row = payload.new as {
                            id: string;
                            chat_id: string;
                            sender_id: string;
                            content: string;
                            created_at: string;
                            message_type?: string;
                            metadata?: Record<string, unknown> | null;
                        };
                        applyMessageUpdate(
                            ChatStore.mapMessageRow(
                                row,
                                roomChatRef.current?.memberIds ?? chat.memberIds,
                                roomChatRef.current?.memberNames ?? chat.memberNames
                            )
                        );
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'chat_participants',
                        filter: `chat_id=eq.${chat.id}`,
                    },
                    () => {
                        void refreshRoomChat();
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'chat_invites',
                        filter: `chat_id=eq.${chat.id}`,
                    },
                    () => {
                        void refreshRoomChat();
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'message_reactions',
                    },
                    (payload) => {
                        const row = (payload.new ?? payload.old) as Partial<MessageReactionRow>;
                        if (!row?.message_id || !row.user_id) return;
                        if (payload.eventType === 'DELETE') {
                            applyReactionUpdate(row.message_id, row.user_id, null);
                        } else {
                            applyReactionUpdate(row.message_id, row.user_id, row.emoji ?? null);
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'workout_live_status',
                    },
                    () => {
                        loadMemberStatuses();
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'user_rest_days',
                    },
                    () => {
                        loadMemberStatuses();
                    }
                );

            channelRef.current = channel;

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    const queued = pendingBroadcastsRef.current;
                    pendingBroadcastsRef.current = [];
                    for (const msg of queued) {
                        void broadcastChatMessage(channel, msg);
                    }
                }
                if (status === 'CHANNEL_ERROR') {
                    console.warn('[Chat] realtime subscription error for chat', chat.id);
                }
            });

            const statusPoll = setInterval(loadMemberStatuses, 30000);
            const messagePoll = setInterval(() => {
                void syncMessagesFromServer();
            }, 15000);

            return () => {
                clearInterval(statusPoll);
                clearInterval(messagePoll);
                channelRef.current = null;
                pendingBroadcastsRef.current = [];
                void supabase.removeChannel(channel);
            };
        }
    }, [
        visible,
        chat?.id,
        loadMemberStatuses,
        loadMessages,
        loadStreak,
        refreshRoomChat,
        appendLiveMessage,
        appendMessage,
        applyMessageUpdate,
        applyReactionUpdate,
        syncMessagesFromServer,
    ]);

    const handleSend = async (text: string, isNudge = false) => {
        const c = roomChatRef.current ?? chat;
        if (!c || !text.trim()) return;
        const trimmed = text.trim();
        const tempId = `pending-${Date.now()}`;
        const optimistic: Message = {
            id: tempId,
            chatId: c.id,
            senderId: currentUserId,
            senderName: currentUserName,
            text: trimmed,
            sentAt: new Date().toISOString(),
            isNudge,
        };

        appendMessage(optimistic);
        setInputText('');

        try {
            const msg = await ChatStore.sendMessage(
                c.id,
                currentUserId,
                currentUserName,
                trimmed,
                isNudge
            );
            setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
            queueBroadcast(msg);
            notifyMessageSent(msg);

            if (isRestDayMessage(trimmed)) {
                await declareRestDay(currentUserId);
                setMemberStatuses((prev) => ({
                    ...prev,
                    [currentUserId]: { userId: currentUserId, status: 'rest_day' },
                }));
            }
        } catch (e) {
            console.error('[Chat] send failed:', e);
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            Alert.alert('Message failed', 'Could not send. Check your connection and try again.');
        }
    };

    const handleSendGymInvite = async (proposedTime: string) => {
        const c = roomChatRef.current ?? chat;
        if (!c) return;
        setShowGymPicker(false);
        const tempId = `pending-${Date.now()}`;
        const optimistic: Message = {
            id: tempId,
            chatId: c.id,
            senderId: currentUserId,
            senderName: currentUserName,
            text: `🏋️ Lift together? ${proposedTime}`,
            sentAt: new Date().toISOString(),
            messageType: 'gym_invite',
            metadata: { proposedTime, status: 'pending', inviterName: currentUserName },
            reactions: [],
        };
        appendMessage(optimistic);
        try {
            const msg = await ChatStore.sendGymInvite(
                c.id,
                currentUserId,
                currentUserName,
                proposedTime
            );
            setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
            queueBroadcast(msg);
            notifyMessageSent(msg);
        } catch (e) {
            console.error('[Chat] gym invite failed:', e);
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            Alert.alert('Invite failed', 'Could not send gym invite. Try again.');
        }
    };

    const handleRespondInvite = async (messageId: string, status: 'accepted' | 'declined') => {
        try {
            const updated = await ChatStore.respondGymInvite(messageId, currentUserId, status);
            if (updated) {
                applyMessageUpdate(updated);
                void broadcastChatMessageUpdate(channelRef.current, updated);
            }
        } catch (e) {
            console.error('[Chat] invite response failed:', e);
            Alert.alert('Could not respond', 'Try again in a moment.');
        }
    };

    const handleToggleReaction = async (messageId: string, emoji: string) => {
        const msg = messages.find((m) => m.id === messageId);
        const mine = msg?.reactions?.find((r) => r.userId === currentUserId);
        const nextEmoji = mine?.emoji === emoji ? null : emoji;

        applyReactionUpdate(messageId, currentUserId, nextEmoji);
        void broadcastReactionUpdate(channelRef.current, {
            messageId,
            userId: currentUserId,
            emoji: nextEmoji,
        });

        try {
            await ChatStore.toggleReaction(messageId, currentUserId, emoji);
        } catch (e) {
            console.error('[Chat] reaction failed:', e);
            applyReactionUpdate(messageId, currentUserId, mine?.emoji ?? null);
        }
    };

    const handleNudge = async () => {
        const c = roomChatRef.current ?? chat;
        if (!c || nudgeSending) return;

        Animated.sequence([
            Animated.spring(nudgeScale, { toValue: 0.9, useNativeDriver: true }),
            Animated.spring(nudgeScale, { toValue: 1, useNativeDriver: true }),
        ]).start();

        const targets = c.memberIds
            .map((id, i) => ({
                id,
                name: c.memberNames[i] || 'Friend',
            }))
            .filter((m) => m.id !== currentUserId)
            .filter((m) => {
                const st = memberStatuses[m.id]?.status ?? 'not_done';
                return st !== 'completed' && st !== 'rest_day' && !nudgedToday.has(m.id);
            });

        if (targets.length === 0) {
            Alert.alert(
                'No nudges left',
                'Everyone already worked out today, is mid-session, or you already nudged them once today.'
            );
            return;
        }

        setNudgeSending(true);
        let sentCount = 0;
        try {
            for (const target of targets) {
                const result = await ChatStore.sendWorkoutNudge(
                    c.id,
                    currentUserId,
                    currentUserName,
                    target.id,
                    target.name
                );
                if (result.sent && result.message) {
                    sentCount++;
                    appendMessage(result.message);
                    queueBroadcast(result.message);
                    notifyMessageSent(result.message);
                    setNudgedToday((prev) => new Set([...prev, target.id]));
                }
            }
            if (sentCount > 0) {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
            }
        } catch (e) {
            console.error('[Chat] nudge failed:', e);
            Alert.alert('Nudge failed', 'Could not send workout reminder. Try again.');
        } finally {
            setNudgeSending(false);
        }
    };

    const getSenderStatus = (senderId: string): WorkoutDayStatus => {
        return memberStatuses[senderId]?.status ?? 'not_done';
    };

    const getChatTitle = () => {
        if (!activeChat) return '';
        if (activeChat.type === 'group') return activeChat.name || 'Group Chat';
        const otherName = activeChat.memberNames.find((_, i) => activeChat.memberIds[i] !== currentUserId);
        return otherName || 'DM';
    };

    const getSubtitle = () => {
        if (!activeChat) return '';
        if (activeChat.type === 'group') {
            const pending = pendingInvitees.length;
            const memberCount = activeChat.memberIds.length;
            if (pending > 0) {
                return `${memberCount} in · ${pending} invite${pending === 1 ? '' : 's'} pending`;
            }
            return `${memberCount} members · live workout meter`;
        }
        const otherIdx = activeChat.memberIds.findIndex((id) => id !== currentUserId);
        if (otherIdx >= 0) {
            const otherId = activeChat.memberIds[otherIdx];
            const st = memberStatuses[otherId]?.status ?? 'not_done';
            const live = memberStatuses[otherId];
            if (st === 'in_progress' && live?.exerciseName) {
                return `${WORKOUT_STATUS_LABELS[st]} · ${live.exerciseName}`;
            }
            return WORKOUT_STATUS_LABELS[st];
        }
        return activeChat.goalContext ? `Goal: ${activeChat.goalContext}` : '';
    };

    if (!activeChat || !visible) return null;

    const myStatus = memberStatuses[currentUserId]?.status ?? 'not_done';
    const otherMemberIdx = activeChat.memberIds.findIndex((id) => id !== currentUserId);
    const otherMemberId = otherMemberIdx >= 0 ? activeChat.memberIds[otherMemberIdx] : null;
    const otherStatus = otherMemberId
        ? memberStatuses[otherMemberId]?.status ?? 'not_done'
        : 'not_done';
    const dmTitleColor =
        activeChat.type === 'dm' ? statusColor(otherStatus) : '#F5F5F5';

    const roomBody = (
            <View style={[styles.root, embedded ? styles.rootEmbedded : { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable accessibilityLabel="Back" onPress={onClose} style={styles.backBtn} hitSlop={12}>
                        <FontAwesome name="chevron-left" size={18} color={VisualSystem.colors.gold} />
                    </Pressable>
                    <View style={styles.headerCenter}>
                        <View
                            style={[
                                styles.chatAvatarSmall,
                                activeChat.type === 'dm' && {
                                    borderColor: statusColor(otherStatus),
                                },
                            ]}
                        >
                            {activeChat.type === 'dm' && (
                                <View
                                    style={[
                                        styles.headerStatusDot,
                                        { backgroundColor: statusColor(otherStatus) },
                                    ]}
                                />
                            )}
                            <FontAwesome
                                name={activeChat.type === 'group' ? 'users' : 'user'}
                                size={16}
                                color={activeChat.type === 'dm' ? statusColor(otherStatus) : '#D4AF37'}
                            />
                        </View>
                        <View style={styles.headerText}>
                            <Text
                                style={[styles.headerTitle, { color: dmTitleColor }]}
                                numberOfLines={1}
                            >
                                {getChatTitle()}
                            </Text>
                            {!!getSubtitle() && (
                                <Text style={[styles.headerSub, activeChat.type === 'dm' && { color: statusColor(otherStatus) }]}>
                                    {getSubtitle()}
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                {activeChat.type === 'group' && pendingInvitees.length > 0 && (
                    <View style={styles.pendingBanner}>
                        <FontAwesome name="clock-o" size={13} color={VisualSystem.colors.gold} />
                        <Text style={styles.pendingBannerText} numberOfLines={2}>
                            Waiting for {pendingInvitees.map((p) => p.name.split(' ')[0]).join(', ')} to accept
                        </Text>
                    </View>
                )}

                {activeChat.type === 'group' && (
                    <MemberStatusBar
                        chat={activeChat}
                        currentUserId={currentUserId}
                        memberStatuses={memberStatuses}
                        pendingInvitees={pendingInvitees}
                    />
                )}

                {activeChat.type === 'dm' && streakDays > 0 && (
                    <FriendStreakBanner days={streakDays} />
                )}

                {/* Messages */}
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={embedded ? 0 : insets.top}
                >
                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator color={VisualSystem.colors.gold} />
                        </View>
                    ) : (
                        <ScrollView
                            ref={scrollRef}
                            style={styles.messageList}
                            contentContainerStyle={styles.messageContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {messages.length === 0 && (
                                <View style={styles.emptyWrap}>
                                    <FontAwesome name="comments-o" size={48} color="rgba(212,175,55,0.35)" />
                                    <Text style={styles.emptyText}>Start the conversation!</Text>
                                    <Text style={styles.emptySubText}>
                                        Green = worked out · Yellow = in session · Red = not yet today
                                    </Text>
                                </View>
                            )}
                            {messages.map((msg) => {
                                const isMine = msg.senderId === currentUserId;
                                const senderStatus = getSenderStatus(msg.senderId);
                                const senderColor = isMine ? undefined : statusColor(senderStatus);
                                return (
                                    <View
                                        key={msg.id}
                                        style={[
                                            styles.messageRow,
                                            isMine ? styles.messageRowMine : styles.messageRowTheirs,
                                        ]}
                                    >
                                        {!isMine && (
                                            <View style={styles.smallAvatar}>
                                                <Text style={styles.smallAvatarText}>
                                                    {msg.senderName.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                        <View style={{ maxWidth: '72%' }}>
                                            {!isMine && activeChat.type === 'group' && (
                                                <Text style={[styles.msgSenderName, { color: senderColor }]}>
                                                    {msg.senderName}
                                                </Text>
                                            )}
                                            {msg.messageType === 'gym_invite' ? (
                                                <GymInviteBubble
                                                    msg={msg}
                                                    isMine={isMine}
                                                    currentUserId={currentUserId}
                                                    onRespond={(status) => handleRespondInvite(msg.id, status)}
                                                />
                                            ) : msg.messageType === 'milestone' ? (
                                                <MilestoneBubble msg={msg} isMine={isMine} />
                                            ) : (
                                                <View style={[
                                                    styles.bubble,
                                                    isMine ? styles.bubbleMine : styles.bubbleTheirs,
                                                    msg.isNudge && styles.bubbleNudge,
                                                ]}>
                                                    <Text style={[
                                                        styles.bubbleText,
                                                        isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs,
                                                    ]}>
                                                        {msg.text}
                                                    </Text>
                                                </View>
                                            )}
                                            <MessageReactionBar
                                                reactions={msg.reactions}
                                                currentUserId={currentUserId}
                                                isMine={isMine}
                                                onToggle={(emoji) => handleToggleReaction(msg.id, emoji)}
                                            />
                                            <Text style={[styles.msgTime, isMine && { textAlign: 'right' }]}>
                                                {new Date(msg.sentAt).toLocaleTimeString('en-US', {
                                                    hour: 'numeric', minute: '2-digit',
                                                })}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}

                    <GymTimePicker
                        visible={showGymPicker}
                        onSelect={handleSendGymInvite}
                        onClose={() => setShowGymPicker(false)}
                    />
                    <QuickReplyBar
                        userStatus={myStatus}
                        onSelect={(text) => handleSend(text)}
                        onGymTogether={() => setShowGymPicker((v) => !v)}
                    />

                    {/* Input Row */}
                    <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
                        <Animated.View style={{ transform: [{ scale: nudgeScale }] }}>
                            <Pressable
                                onPress={handleNudge}
                                style={styles.nudgeBtn}
                                disabled={nudgeSending}
                            >
                                {nudgeSending ? (
                                    <ActivityIndicator size="small" color={VisualSystem.colors.gold} />
                                ) : (
                                    <Text style={styles.nudgeBtnText}>🏋️</Text>
                                )}
                            </Pressable>
                        </Animated.View>
                        <TextInput
                            style={styles.textInput}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Message..."
                            placeholderTextColor={VisualSystem.colors.textTertiary}
                            multiline
                            maxLength={500}
                            returnKeyType="send"
                            onSubmitEditing={() => handleSend(inputText)}
                        />
                        <Pressable accessibilityLabel="Send"
                            onPress={() => handleSend(inputText)}
                            disabled={!inputText.trim()}
                            style={({ pressed }) => [
                                styles.sendBtn,
                                !inputText.trim() && styles.sendBtnDisabled,
                                { opacity: pressed ? 0.7 : 1 },
                            ]}
                        >
                            <FontAwesome name="send" size={16} color={inputText.trim() ? '#0C2340' : 'rgba(12,35,64,0.4)'} />
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </View>
    );

    if (embedded) {
        return roomBody;
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            {roomBody}
        </Modal>
    );
}

function MemberStatusBar({
    chat,
    currentUserId,
    memberStatuses,
    pendingInvitees = [],
}: {
    chat: Chat;
    currentUserId: string;
    memberStatuses: Record<string, MemberWorkoutStatus>;
    pendingInvitees?: { id: string; name: string }[];
}) {
    const completed = chat.memberIds.filter((id) => memberStatuses[id]?.status === 'completed').length;
    const total = chat.memberIds.length + pendingInvitees.length;
    const meterPct = total > 0 ? completed / total : 0;

    return (
        <View style={memberStyles.wrap}>
            <View style={memberStyles.meterRow}>
                <Text style={memberStyles.meterLabel}>Today&apos;s crew</Text>
                <Text style={memberStyles.meterCount}>{completed}/{total} done</Text>
            </View>
            <View style={memberStyles.meterTrack}>
                <View style={[memberStyles.meterFill, { width: `${meterPct * 100}%` }]} />
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={memberStyles.chipRow}
            >
                {chat.memberIds.map((id, i) => {
                    const name = chat.memberNames[i] || 'User';
                    const status = memberStatuses[id]?.status ?? 'not_done';
                    const live = memberStatuses[id];
                    const isYou = id === currentUserId;
                    const label = isYou ? 'You' : name.split(' ')[0];

                    return (
                        <View key={id} style={[memberStyles.chip, { borderColor: statusColor(status) }]}>
                            <View style={[memberStyles.dot, { backgroundColor: statusColor(status) }]} />
                            <View style={{ flexShrink: 1 }}>
                                <Text style={[memberStyles.chipName, { color: statusColor(status) }]} numberOfLines={1}>
                                    {label}
                                </Text>
                                {status === 'in_progress' && live?.exerciseName ? (
                                    <Text style={memberStyles.chipSub} numberOfLines={1}>
                                        {live.exerciseName}
                                        {live.setsCompleted ? ` · ${live.setsCompleted} sets` : ''}
                                    </Text>
                                ) : (
                                    <Text style={memberStyles.chipSub}>{WORKOUT_STATUS_LABELS[status]}</Text>
                                )}
                            </View>
                        </View>
                    );
                })}
                {pendingInvitees.map((p) => (
                    <View
                        key={`pending-${p.id}`}
                        style={[memberStyles.chip, { borderColor: VisualSystem.colors.borderSubtle }]}
                    >
                        <View style={[memberStyles.dot, { backgroundColor: VisualSystem.colors.bgDeep }]} />
                        <View style={{ flexShrink: 1 }}>
                            <Text
                                style={[memberStyles.chipName, { color: VisualSystem.colors.textSecondary }]}
                                numberOfLines={1}
                            >
                                {p.name.split(' ')[0]}
                            </Text>
                            <Text style={memberStyles.chipSub}>Invited</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <View style={memberStyles.legendRow}>
                <LegendDot color={WORKOUT_STATUS_COLORS.completed} label="Done" />
                <LegendDot color={WORKOUT_STATUS_COLORS.in_progress} label="Live" />
                <LegendDot color={WORKOUT_STATUS_COLORS.rest_day} label="Rest" />
                <LegendDot color={WORKOUT_STATUS_COLORS.not_done} label="Not yet" />
            </View>
        </View>
    );
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <View style={memberStyles.legendItem}>
            <View style={[memberStyles.legendDot, { backgroundColor: color }]} />
            <Text style={memberStyles.legendText}>{label}</Text>
        </View>
    );
}

const memberStyles = StyleSheet.create({
    wrap: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212,175,55,0.12)',
    },
    meterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    meterLabel: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
    },
    meterCount: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '800',
    },
    meterTrack: {
        height: 4,
        borderRadius: 6,
        backgroundColor: VisualSystem.colors.bgMid,
        marginBottom: 8,
        overflow: 'hidden',
    },
    meterFill: {
        height: '100%',
        backgroundColor: VisualSystem.colors.successSoft,
        borderRadius: 6,
    },
    chipRow: {
        gap: 8,
        paddingBottom: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        maxWidth: 150,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 6,
    },
    chipName: {
        fontSize: 11,
        fontWeight: '800',
    },
    chipSub: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        marginTop: 4,
    },
    legendRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 6,
        height: 6,
        borderRadius: 6,
    },
    legendText: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 11,
        fontWeight: '600',
    },
});

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    rootEmbedded: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212,175,55,0.2)',
        backgroundColor: VisualSystem.colors.bgMid,
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    chatAvatarSmall: {
        width: 36,
        height: 36,
        borderRadius: 16,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    headerStatusDot: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 10,
        height: 10,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: VisualSystem.colors.borderStrong,
    },
    /**
     * Text column of a row. Without flex it sizes to the natural width of its
     * longest line and runs past the row, where it is clipped; minWidth lets
     * it shrink below that width so the text wraps or ellipsises instead.
     */
    headerText: {
        flex: 1,
        minWidth: 0,
    },
    headerTitle: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        fontWeight: '700',
    },
    headerSub: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        marginTop: 4,
    },
    pendingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(212,175,55,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.25)',
    },
    pendingBannerText: {
        flex: 1,
        color: VisualSystem.colors.textPrimary,
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 16,
    },
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageList: {
        flex: 1,
    },
    messageContent: {
        padding: 16,
        paddingBottom: 8,
        gap: 4,
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 32,
        gap: 8,
    },
    emptyText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 15,
        fontWeight: '600',
    },
    emptySubText: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 13,
        textAlign: 'center',
    },
    messageRow: {
        flexDirection: 'row',
        marginVertical: 4,
        alignItems: 'flex-end',
        gap: 8,
    },
    messageRowMine: {
        justifyContent: 'flex-end',
    },
    messageRowTheirs: {
        justifyContent: 'flex-start',
    },
    smallAvatar: {
        width: 28,
        height: 28,
        borderRadius: 16,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    smallAvatarText: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '700',
    },
    msgSenderName: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        marginBottom: 4,
        marginLeft: 4,
    },
    bubble: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    bubbleMine: {
        backgroundColor: VisualSystem.colors.gold,
        borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.15)',
    },
    bubbleNudge: {
        borderWidth: 1.5,
        borderColor: VisualSystem.colors.borderGold,
    },
    bubbleText: {
        fontSize: 15,
        lineHeight: 20,
    },
    bubbleTextMine: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '600',
    },
    bubbleTextTheirs: {
        color: VisualSystem.colors.textPrimary,
    },
    msgTime: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 11,
        marginTop: 4,
        paddingHorizontal: 4,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingTop: 8,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(212,175,55,0.15)',
        backgroundColor: VisualSystem.colors.bgMid,
    },
    nudgeBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(212,175,55,0.15)',
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    nudgeBtnText: {
        fontSize: 20,
    },
    textInput: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 8,
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
        maxHeight: 100,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: VisualSystem.colors.gold,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
    },
});
