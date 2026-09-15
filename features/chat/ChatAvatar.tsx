import React from 'react';
import { Image, StyleSheet } from 'react-native';
import type { Chat } from '@/types/chat';

/**
 * Profile pictures in chat.
 *
 * Chats only ever carried names, so every avatar fell back to an initial even
 * when the person had a picture set. The chat now carries memberAvatars
 * alongside memberNames, and these read it.
 */

/** The picture for one member of a chat, or null if they have none. */
export function avatarForMember(chat: Chat | null | undefined, userId: string): string | null {
    if (!chat) return null;
    const idx = chat.memberIds.indexOf(userId);
    if (idx < 0) return null;
    return chat.memberAvatars?.[idx] ?? null;
}

/**
 * The picture to show for a chat in a list.
 *
 * A group has no single face, so it keeps its icon — showing one member's
 * picture would misrepresent who is in it.
 */
export function avatarForChat(chat: Chat | null | undefined, currentUserId: string): string | null {
    if (!chat || chat.type !== 'dm') return null;
    const idx = chat.memberIds.findIndex((id) => id !== currentUserId);
    if (idx < 0) return null;
    return chat.memberAvatars?.[idx] ?? null;
}

/**
 * Fills whichever circle it is dropped into, so the existing avatar wells keep
 * their size, border and status ring and simply gain a face.
 */
export function ChatAvatarImage({ uri }: { uri: string }) {
    return <Image source={{ uri }} style={styles.image} resizeMode="cover" />;
}

const styles = StyleSheet.create({
    image: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: undefined,
        height: undefined,
        borderRadius: 999,
    },
});
