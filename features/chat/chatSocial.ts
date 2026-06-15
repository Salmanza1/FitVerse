import { GymInviteMetadata } from '@/types/chat';
import { WorkoutDayStatus } from '@/features/workout/WorkoutPresenceStore';

export const REACTION_EMOJIS = ['💪', '🔥', '😤', '👏', '☘️'] as const;

export type QuickReplyId = 'on_my_way' | 'finished' | 'rest_day';

export const REST_DAY_MESSAGE = 'Rest day today — back at it tomorrow.';

export const QUICK_REPLIES: ReadonlyArray<{
    id: QuickReplyId;
    label: string;
    text: string;
    bg: string;
    border: string;
    color: string;
    showWhen: WorkoutDayStatus[];
}> = [
    {
        id: 'on_my_way',
        label: 'On my way',
        text: 'On my way to the gym!',
        bg: 'rgba(241,196,15,0.14)',
        border: 'rgba(241,196,15,0.45)',
        color: '#f1c40f',
        showWhen: ['not_done'],
    },
    {
        id: 'finished',
        label: 'Finished',
        text: 'Just finished — good session!',
        bg: 'rgba(81,207,102,0.14)',
        border: 'rgba(81,207,102,0.45)',
        color: '#51cf66',
        showWhen: ['in_progress'],
    },
    {
        id: 'rest_day',
        label: 'Rest day',
        text: REST_DAY_MESSAGE,
        bg: 'rgba(177,151,252,0.14)',
        border: 'rgba(177,151,252,0.4)',
        color: '#b197fc',
        showWhen: ['not_done'],
    },
];

export const GYM_TOGETHER_CHIP = {
    label: '🏋️ Together',
    bg: 'rgba(212,175,55,0.14)',
    border: 'rgba(212,175,55,0.45)',
    color: '#D4AF37',
} as const;

export function getVisibleQuickReplies(status: WorkoutDayStatus) {
    return QUICK_REPLIES.filter((q) => q.showWhen.includes(status));
}

export function showGymTogetherChip(status: WorkoutDayStatus): boolean {
    return status === 'not_done' || status === 'in_progress';
}

export function isRestDayMessage(text: string): boolean {
    return text.trim() === REST_DAY_MESSAGE;
}

export const GYM_TOGETHER_OPTIONS = [
    { label: 'Right now', time: 'Right now' },
    { label: 'This afternoon', time: 'This afternoon' },
    { label: 'Tonight', time: 'Tonight' },
    { label: 'Tomorrow AM', time: 'Tomorrow morning' },
] as const;

export function gymInviteText(proposedTime: string): string {
    return `🏋️ Lift together? ${proposedTime}`;
}

export function isGymInviteMetadata(meta: unknown): meta is GymInviteMetadata {
    if (!meta || typeof meta !== 'object') return false;
    const m = meta as GymInviteMetadata;
    return typeof m.proposedTime === 'string' && typeof m.status === 'string';
}
