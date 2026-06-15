import { supabase } from '../../lib/supabase';
import {
    Chat,
    ChatCreateResult,
    ChatInvite,
    GymInviteMetadata,
    GymInviteStatus,
    Message,
    MessageType,
} from '../../types/chat';
import { gymInviteText } from './chatSocial';

function formatChatError(error: { message?: string; code?: string; details?: string } | null): string {
    if (!error) return 'Something went wrong. Please try again.';
    const msg = error.message || error.details || '';
    if (msg.includes('create_chat_with_invites') || error.code === 'PGRST202') {
        return 'Chat invites are not enabled on the server yet. Pull the latest app update or contact support.';
    }
    if (msg.includes('must be friends')) return 'You need to be friends before starting a chat.';
    if (msg.includes('Unauthorized')) return 'Please sign in again and retry.';
    return msg || 'Could not send invite. Please try again.';
}

function fallbackChat(
    chatId: string,
    creatorId: string,
    creatorName: string,
    type: 'dm' | 'group',
    groupName?: string
): Chat {
    return {
        id: chatId,
        type,
        name: groupName,
        memberIds: [creatorId],
        memberNames: [creatorName],
        unreadCounts: {},
        createdAt: new Date().toISOString(),
        hasPendingInvites: true,
    };
}

function mapChatRow(c: any, lastMessage?: Chat['lastMessage']): Chat {
    const members = c.participants || [];
    const memberIds = members.map((m: any) => m.user_id);
    const memberNames = members.map((m: any) =>
        m.profiles ? m.profiles.display_name : 'User'
    );

    return {
        id: c.id,
        type: c.type === 'direct' ? 'dm' : 'group',
        name: c.name ?? undefined,
        memberIds,
        memberNames,
        createdAt: c.created_at,
        unreadCounts: {},
        lastMessage,
        hasPendingInvites: c.has_pending_invites ?? false,
    };
}

export const ChatStore = {
    // ─── Chats ────────────────────────────────────────────────────────────────

    /** Returns all chats where this user is a member, sorted by latest message */
    async getChatsForUser(userId: string): Promise<Chat[]> {
        try {
            // 1. Find all chats where user is participant
            const { data: participations, error: partError } = await supabase
                .from('chat_participants')
                .select('chat_id')
                .eq('user_id', userId);

            if (partError) throw partError;
            if (!participations || participations.length === 0) return [];

            const chatIds = participations.map(p => p.chat_id);

            // 2. Fetch chats details AND their members (joined with profiles) in one go
            const { data: chatsData, error: chatsError } = await supabase
                .from('chats')
                .select(`
                    *,
                    participants:chat_participants(
                        user_id,
                        profiles(display_name)
                    )
                `)
                .in('id', chatIds);

            if (chatsError) throw chatsError;
            if (!chatsData) return [];

            // 3. Fetch the latest messages for all these chats in one batch query
            // We'll get the latest message per chat_id. 
            // Since we can't easily do a "group by limit 1" in Supabase simple JS, 
            // we'll run parallel fetches for the latest message of each chat.
            // This is still N queries but parallel and much faster than sequential.
            const lastMessagesPromises = chatsData.map(c =>
                supabase
                    .from('messages')
                    .select('content, created_at, profiles!messages_sender_id_fkey(display_name)')
                    .eq('chat_id', c.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
            );

            const lastMessagesResults = await Promise.all(lastMessagesPromises);

            const chatIdsList = chatsData.map((c) => c.id);
            const chatsWithPending = new Set<string>();
            if (chatIdsList.length > 0) {
                const { data: pendingInviteRows, error: inviteErr } = await supabase
                    .from('chat_invites')
                    .select('chat_id')
                    .in('chat_id', chatIdsList)
                    .eq('status', 'pending');

                if (!inviteErr && pendingInviteRows) {
                    pendingInviteRows.forEach((r) => chatsWithPending.add(r.chat_id));
                }
            }

            const chats: Chat[] = chatsData.map((c, idx) => {
                const msgData = lastMessagesResults[idx].data;
                let lastMessage: Chat['lastMessage'];
                if (msgData && msgData.length > 0) {
                    const latest = msgData[0];
                    lastMessage = {
                        text: latest.content,
                        sentAt: latest.created_at,
                        senderName: latest.profiles
                            ? (latest.profiles as { display_name?: string }).display_name ?? 'User'
                            : 'User',
                    };
                }

                return mapChatRow(
                    { ...c, has_pending_invites: chatsWithPending.has(c.id) },
                    lastMessage
                );
            });

            // 4. Sort by latest message date or creation date
            return chats.sort((a, b) => {
                const ta = a.lastMessage?.sentAt ?? a.createdAt;
                const tb = b.lastMessage?.sentAt ?? b.createdAt;
                return tb.localeCompare(ta);
            });
        } catch (e) {
            console.error('getChatsForUser error:', e);
            return [];
        }
    },

    async getChatById(chatId: string, userId: string): Promise<Chat | null> {
        try {
            const { data, error } = await supabase
                .from('chats')
                .select(`
                    *,
                    participants:chat_participants(
                        user_id,
                        profiles(display_name)
                    )
                `)
                .eq('id', chatId)
                .single();

            if (error || !data) return null;

            const isMember = (data as any).participants?.some(
                (p: { user_id: string }) => p.user_id === userId
            );
            if (!isMember) return null;

            const { data: msgData } = await supabase
                .from('messages')
                .select('content, created_at, profiles!messages_sender_id_fkey(display_name)')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: false })
                .limit(1);

            let lastMessage: Chat['lastMessage'];
            if (msgData?.length) {
                const latest = msgData[0];
                lastMessage = {
                    text: latest.content,
                    sentAt: latest.created_at,
                    senderName: (latest.profiles as { display_name?: string } | null)?.display_name ?? 'User',
                };
            }

            const { count } = await supabase
                .from('chat_invites')
                .select('id', { count: 'exact', head: true })
                .eq('chat_id', chatId)
                .eq('status', 'pending');

            return mapChatRow(
                { ...data, has_pending_invites: (count ?? 0) > 0 },
                lastMessage
            );
        } catch (e) {
            console.error('getChatById error:', e);
            return null;
        }
    },

    async getPendingInvites(userId: string): Promise<ChatInvite[]> {
        try {
            const { data, error } = await supabase.rpc('get_my_pending_chat_invites');

            if (error) {
                // Fallback if RPC not deployed yet
                const { data: rows, error: tableErr } = await supabase
                    .from('chat_invites')
                    .select('id, chat_id, inviter_id, invitee_id, created_at, chats(type, name)')
                    .eq('invitee_id', userId)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });

                if (tableErr) throw tableErr;
                if (!rows?.length) return [];

                const inviterIds = [...new Set(rows.map((r: any) => r.inviter_id))];
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, display_name')
                    .in('id', inviterIds);
                const nameById = new Map(
                    (profiles ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name])
                );

                return rows.map((row: any) => ({
                    id: row.id,
                    chatId: row.chat_id,
                    inviterId: row.inviter_id,
                    inviterName: nameById.get(row.inviter_id) ?? 'Someone',
                    inviteeId: row.invitee_id,
                    type: row.chats?.type === 'direct' ? 'dm' : 'group',
                    groupName: row.chats?.name ?? undefined,
                    createdAt: row.created_at,
                }));
            }

            if (!data) return [];

            return data.map((row: {
                id: string;
                chat_id: string;
                inviter_id: string;
                inviter_name: string;
                chat_type: string;
                group_name: string | null;
                created_at: string;
            }) => ({
                id: row.id,
                chatId: row.chat_id,
                inviterId: row.inviter_id,
                inviterName: row.inviter_name ?? 'Someone',
                inviteeId: userId,
                type: row.chat_type === 'direct' ? 'dm' : 'group',
                groupName: row.group_name ?? undefined,
                createdAt: row.created_at,
            }));
        } catch (e) {
            console.error('getPendingInvites error:', e);
            return [];
        }
    },

    async getPendingInviteCount(userId: string): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('chat_invites')
                .select('id', { count: 'exact', head: true })
                .eq('invitee_id', userId)
                .eq('status', 'pending');

            if (error) throw error;
            return count ?? 0;
        } catch {
            return 0;
        }
    },

    async acceptInvite(inviteId: string, userId: string): Promise<Chat> {
        const { data: chatId, error } = await supabase.rpc('accept_chat_invite', {
            p_invite_id: inviteId,
        });
        if (error) throw error;

        const chat = await this.getChatById(chatId, userId);
        if (!chat) throw new Error('Chat not found after accepting invite');
        return chat;
    },

    async declineInvite(inviteId: string): Promise<void> {
        const { error } = await supabase.rpc('decline_chat_invite', {
            p_invite_id: inviteId,
        });
        if (error) throw error;
    },

    async createDM(
        fromId: string,
        fromName: string,
        toId: string,
        _toName: string,
        goalContext?: string
    ): Promise<ChatCreateResult> {
        const { data: chatId, error } = await supabase.rpc('create_chat_with_invites', {
            p_type: 'direct',
            p_group_name: null,
            p_invitee_ids: [toId],
        });
        if (error) throw new Error(formatChatError(error));

        const resolvedId = String(chatId);
        const chat =
            (await this.getChatById(resolvedId, fromId)) ??
            fallbackChat(resolvedId, fromId, fromName, 'dm');

        const status = chat.memberIds.includes(toId) ? 'active' : 'invite_sent';
        return { chat: { ...chat, goalContext, hasPendingInvites: status === 'invite_sent' }, status };
    },

    async createGroup(
        creatorId: string,
        memberIds: string[],
        memberNames: string[],
        groupName: string,
        goalContext?: string
    ): Promise<ChatCreateResult> {
        const uniqueInvitees = Array.from(new Set(memberIds.filter((id) => id !== creatorId)));
        const creatorName = memberNames[0] ?? 'You';

        const { data: chatId, error } = await supabase.rpc('create_chat_with_invites', {
            p_type: 'group',
            p_group_name: groupName,
            p_invitee_ids: uniqueInvitees,
        });
        if (error) throw new Error(formatChatError(error));

        const resolvedId = String(chatId);
        const chat =
            (await this.getChatById(resolvedId, creatorId)) ??
            fallbackChat(resolvedId, creatorId, creatorName, 'group', groupName);

        const allJoined = uniqueInvitees.every((id) => chat.memberIds.includes(id));

        return {
            chat: {
                ...chat,
                goalContext,
                name: groupName,
                memberIds: chat.memberIds,
                memberNames: chat.memberNames,
                hasPendingInvites: !allJoined,
            },
            // Creator is already in the group — open the chat immediately.
            status: 'active',
        };
    },

    async getPendingInviteesForChat(
        chatId: string
    ): Promise<{ id: string; name: string }[]> {
        try {
            const { data: rows, error } = await supabase
                .from('chat_invites')
                .select('invitee_id')
                .eq('chat_id', chatId)
                .eq('status', 'pending');

            if (error || !rows?.length) return [];

            const ids = rows.map((r) => r.invitee_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, display_name')
                .in('id', ids);

            const nameById = new Map(
                (profiles ?? []).map((p: { id: string; display_name: string }) => [
                    p.id,
                    p.display_name,
                ])
            );

            return ids.map((id) => ({
                id,
                name: nameById.get(id) ?? 'Friend',
            }));
        } catch (e) {
            console.error('getPendingInviteesForChat error:', e);
            return [];
        }
    },

    async updateChatLastMessage(chatId: string, message: Message): Promise<void> {
        // Handled automatically via querying the `messages` table directly.
    },

    async markChatRead(chatId: string, userId: string): Promise<void> {
        // Subbed for MVP
    },

    async getTotalUnread(userId: string): Promise<number> {
        return this.getPendingInviteCount(userId);
    },

    // ─── Messages ─────────────────────────────────────────────────────────────

    mapMessageRow(
        row: {
            id: string;
            chat_id: string;
            sender_id: string;
            content: string;
            created_at: string;
            message_type?: string;
            metadata?: Record<string, unknown> | null;
            message_reactions?: { emoji: string; user_id: string }[] | null;
            profiles?: { display_name?: string } | { display_name?: string }[] | null;
        },
        memberIds: string[] = [],
        memberNames: string[] = []
    ): Message {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const memberIdx = memberIds.indexOf(row.sender_id);
        const senderName =
            profile?.display_name ??
            (memberIdx >= 0 ? memberNames[memberIdx] : undefined) ??
            'User';

        const messageType = (row.message_type ?? 'text') as MessageType;

        return {
            id: row.id,
            chatId: row.chat_id,
            senderId: row.sender_id,
            senderName,
            text: row.content,
            sentAt: row.created_at,
            isNudge:
                messageType === 'text' &&
                row.content.includes('🏋️') &&
                row.content.toLowerCase().includes('gym'),
            messageType,
            metadata: row.metadata ?? undefined,
            reactions: (row.message_reactions ?? []).map((r) => ({
                emoji: r.emoji,
                userId: r.user_id,
            })),
        };
    },

    async getMessages(
        chatId: string,
        memberIds: string[] = [],
        memberNames: string[] = []
    ): Promise<Message[]> {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id, chat_id, sender_id, content, created_at,
                    message_type, metadata,
                    profiles!messages_sender_id_fkey(display_name),
                    message_reactions ( emoji, user_id )
                `)
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            if (!data) return [];

            return data.map((m: any) => this.mapMessageRow(m, memberIds, memberNames));
        } catch (e) {
            console.error('getMessages error:', e);
            return [];
        }
    },

    async getFriendActiveDaysTogether(userId: string, friendId: string, days = 7): Promise<number> {
        try {
            const since = new Date();
            since.setDate(since.getDate() - (days - 1));
            const sinceStr = since.toISOString().split('T')[0];

            const [{ data: mine }, { data: theirs }] = await Promise.all([
                supabase
                    .from('user_daily_points')
                    .select('date')
                    .eq('user_id', userId)
                    .gte('date', sinceStr)
                    .gt('workout_count', 0),
                supabase
                    .from('user_daily_points')
                    .select('date')
                    .eq('user_id', friendId)
                    .gte('date', sinceStr)
                    .gt('workout_count', 0),
            ]);

            const myDates = new Set((mine ?? []).map((r) => r.date));
            return (theirs ?? []).filter((r) => myDates.has(r.date)).length;
        } catch {
            return 0;
        }
    },

    async resolveSenderName(senderId: string, fallback = 'User'): Promise<string> {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', senderId)
                .maybeSingle();
            return data?.display_name ?? fallback;
        } catch {
            return fallback;
        }
    },

    /** Send a workout nudge (max once per friend per day). Returns false if already nudged. */
    async sendWorkoutNudge(
        chatId: string,
        senderId: string,
        senderName: string,
        receiverId: string,
        receiverName: string
    ): Promise<{ sent: boolean; message?: Message }> {
        const today = new Date().toISOString().split('T')[0];

        const { data: existing } = await supabase
            .from('workout_nudges')
            .select('id')
            .eq('sender_id', senderId)
            .eq('receiver_id', receiverId)
            .eq('nudge_date', today)
            .maybeSingle();

        if (existing) {
            return { sent: false };
        }

        const { error: nudgeError } = await supabase.from('workout_nudges').insert({
            sender_id: senderId,
            receiver_id: receiverId,
            chat_id: chatId,
            nudge_date: today,
        });

        if (nudgeError) {
            if (nudgeError.code === '23505') return { sent: false };
            throw nudgeError;
        }

        const text = `🏋️ ${senderName} nudged you — time to hit the gym! Let's get it, ${receiverName}.`;
        const message = await this.sendMessage(chatId, senderId, senderName, text, true);
        return { sent: true, message };
    },

    async getNudgedToday(senderId: string, receiverIds: string[]): Promise<Set<string>> {
        if (receiverIds.length === 0) return new Set();
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
            .from('workout_nudges')
            .select('receiver_id')
            .eq('sender_id', senderId)
            .eq('nudge_date', today)
            .in('receiver_id', receiverIds);
        return new Set((data ?? []).map((r) => r.receiver_id));
    },

    async sendMessage(
        chatId: string,
        senderId: string,
        senderName: string,
        text: string,
        isNudge = false,
        messageType: MessageType = 'text',
        metadata?: Record<string, unknown>
    ): Promise<Message> {
        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    chat_id: chatId,
                    sender_id: senderId,
                    content: text,
                    message_type: messageType,
                    metadata: metadata ?? {},
                })
                .select(`
                    id, chat_id, sender_id, content, created_at,
                    message_type, metadata,
                    profiles!messages_sender_id_fkey(display_name)
                `)
                .single();

            if (error) throw error;

            const msg = this.mapMessageRow(
                data as {
                    id: string;
                    chat_id: string;
                    sender_id: string;
                    content: string;
                    created_at: string;
                    message_type?: string;
                    metadata?: Record<string, unknown> | null;
                    profiles?: { display_name?: string } | null;
                }
            );
            return {
                ...msg,
                senderName: msg.senderName === 'User' ? senderName : msg.senderName,
                isNudge,
            };
        } catch (e) {
            console.error('sendMessage error:', e);
            throw e;
        }
    },

    async sendGymInvite(
        chatId: string,
        senderId: string,
        senderName: string,
        proposedTime: string
    ): Promise<Message> {
        const metadata: GymInviteMetadata = {
            proposedTime,
            status: 'pending',
            inviterName: senderName,
        };
        return this.sendMessage(
            chatId,
            senderId,
            senderName,
            gymInviteText(proposedTime),
            false,
            'gym_invite',
            metadata
        );
    },

    async respondGymInvite(
        messageId: string,
        userId: string,
        status: Exclude<GymInviteStatus, 'pending'>
    ): Promise<Message | null> {
        try {
            const { data: existing, error: readErr } = await supabase
                .from('messages')
                .select('id, chat_id, sender_id, content, created_at, message_type, metadata')
                .eq('id', messageId)
                .single();

            if (readErr || !existing || existing.message_type !== 'gym_invite') return null;

            const metadata: GymInviteMetadata = {
                ...(existing.metadata as GymInviteMetadata),
                status,
                respondedBy: userId,
                respondedAt: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from('messages')
                .update({ metadata })
                .eq('id', messageId)
                .select()
                .single();

            if (error) throw error;

            return this.mapMessageRow(data);
        } catch (e) {
            console.error('respondGymInvite error:', e);
            throw e;
        }
    },

    async toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
        try {
            const { data: existing } = await supabase
                .from('message_reactions')
                .select('emoji')
                .eq('message_id', messageId)
                .eq('user_id', userId)
                .maybeSingle();

            if (existing?.emoji === emoji) {
                await supabase
                    .from('message_reactions')
                    .delete()
                    .eq('message_id', messageId)
                    .eq('user_id', userId);
                return;
            }

            if (existing) {
                await supabase
                    .from('message_reactions')
                    .update({ emoji })
                    .eq('message_id', messageId)
                    .eq('user_id', userId);
                return;
            }

            await supabase.from('message_reactions').insert({
                message_id: messageId,
                user_id: userId,
                emoji,
            });
        } catch (e) {
            console.error('toggleReaction error:', e);
            throw e;
        }
    },
};
