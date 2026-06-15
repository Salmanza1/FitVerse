export type MessageType = 'text' | 'gym_invite' | 'milestone';

export type GymInviteStatus = 'pending' | 'accepted' | 'declined';

export interface GymInviteMetadata {
    proposedTime: string;
    status: GymInviteStatus;
    inviterName?: string;
    respondedBy?: string;
    respondedAt?: string;
}

export interface MilestoneMetadata {
    title: string;
    subtitle?: string;
}

export interface MessageReaction {
    emoji: string;
    userId: string;
}

export interface Message {
    id: string;
    chatId: string;
    senderId: string;
    senderName: string;
    text: string;
    sentAt: string; // ISO string
    isNudge?: boolean;
    messageType?: MessageType;
    metadata?: GymInviteMetadata | MilestoneMetadata | Record<string, unknown>;
    reactions?: MessageReaction[];
}

export type ChatType = 'dm' | 'group';

export type WorkoutDayStatus = 'not_done' | 'in_progress' | 'completed' | 'rest_day';

export interface ChatMemberStatus {
    userId: string;
    name: string;
    status: WorkoutDayStatus;
    workoutName?: string;
    exerciseName?: string;
    setsCompleted?: number;
}

export interface Chat {
    id: string;
    type: ChatType;
    memberIds: string[]; // User IDs
    memberNames: string[]; // Matching display names
    name?: string; // Group chat name (optional for DMs)
    goalContext?: string; // e.g. "Cut (Lose Fat)"
    lastMessage?: {
        text: string;
        sentAt: string;
        senderName: string;
    };
    unreadCounts: Record<string, number>; // userId -> unread count
    createdAt: string;
    /** True when other members haven't accepted the invite yet */
    hasPendingInvites?: boolean;
}

export interface ChatInvite {
    id: string;
    chatId: string;
    inviterId: string;
    inviterName: string;
    inviteeId: string;
    type: ChatType;
    groupName?: string;
    createdAt: string;
}

export type ChatCreateResult = {
    chat: Chat;
    status: 'active' | 'invite_sent';
};
