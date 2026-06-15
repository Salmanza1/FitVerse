import type { RealtimeChannel } from '@supabase/supabase-js';
import { Message } from '@/types/chat';

export const CHAT_MESSAGE_EVENT = 'new_message';
export const CHAT_MESSAGE_UPDATE_EVENT = 'message_update';
export const CHAT_REACTION_EVENT = 'reaction_update';

export function getChatRoomChannelName(chatId: string): string {
    return `chat_room_${chatId}`;
}

/** Push a message to everyone else in the room — faster than postgres_changes alone. */
export async function broadcastChatMessage(
    channel: RealtimeChannel | null,
    message: Message
): Promise<void> {
    if (!channel) return;
    try {
        await channel.send({
            type: 'broadcast',
            event: CHAT_MESSAGE_EVENT,
            payload: message,
        });
    } catch (e) {
        console.warn('[Chat] broadcast failed:', e);
    }
}

export function isPendingMessageId(id: string): boolean {
    return id.startsWith('pending-');
}

export async function broadcastChatMessageUpdate(
    channel: RealtimeChannel | null,
    message: Message
): Promise<void> {
    if (!channel) return;
    try {
        await channel.send({
            type: 'broadcast',
            event: CHAT_MESSAGE_UPDATE_EVENT,
            payload: message,
        });
    } catch (e) {
        console.warn('[Chat] message update broadcast failed:', e);
    }
}

export type ReactionBroadcast = {
    messageId: string;
    userId: string;
    emoji: string | null;
};

export async function broadcastReactionUpdate(
    channel: RealtimeChannel | null,
    payload: ReactionBroadcast
): Promise<void> {
    if (!channel) return;
    try {
        await channel.send({
            type: 'broadcast',
            event: CHAT_REACTION_EVENT,
            payload,
        });
    } catch (e) {
        console.warn('[Chat] reaction broadcast failed:', e);
    }
}
