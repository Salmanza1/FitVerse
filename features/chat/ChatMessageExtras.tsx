import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { GymInviteMetadata, Message, MessageReaction, MilestoneMetadata } from '@/types/chat';
import { WorkoutDayStatus } from '@/features/workout/WorkoutPresenceStore';
import {
    getVisibleQuickReplies,
    GYM_TOGETHER_CHIP,
    GYM_TOGETHER_OPTIONS,
    isGymInviteMetadata,
    REACTION_EMOJIS,
    showGymTogetherChip,
} from './chatSocial';
import { VisualSystem } from '@/constants/VisualSystem';

export function FriendStreakBanner({ days }: { days: number }) {
    if (days < 1) return null;

    return (
        <View style={extrasStyles.streakBanner}>
            <Text style={extrasStyles.streakEmoji}>🔥</Text>
            <View style={{ flex: 1 }}>
                <Text style={extrasStyles.streakTitle}>
                    {days} day{days === 1 ? '' : 's'} training together this week
                </Text>
                <Text style={extrasStyles.streakSub}>You both logged workouts on the same days</Text>
            </View>
        </View>
    );
}

export function QuickReplyBar({
    userStatus,
    onSelect,
    onGymTogether,
}: {
    userStatus: WorkoutDayStatus;
    onSelect: (text: string) => void;
    onGymTogether: () => void;
}) {
    const replies = getVisibleQuickReplies(userStatus);
    const showTogether = showGymTogetherChip(userStatus);

    if (replies.length === 0 && !showTogether) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={extrasStyles.quickScroll}
            contentContainerStyle={extrasStyles.quickRow}
            keyboardShouldPersistTaps="handled"
        >
            {showTogether && (
                <Pressable
                    onPress={onGymTogether}
                    style={[
                        extrasStyles.chip,
                        {
                            backgroundColor: GYM_TOGETHER_CHIP.bg,
                            borderColor: GYM_TOGETHER_CHIP.border,
                        },
                    ]}
                >
                    <Text style={[extrasStyles.chipText, { color: GYM_TOGETHER_CHIP.color }]}>
                        {GYM_TOGETHER_CHIP.label}
                    </Text>
                </Pressable>
            )}
            {replies.map((q) => (
                <Pressable
                    key={q.id}
                    onPress={() => onSelect(q.text)}
                    style={[
                        extrasStyles.chip,
                        { backgroundColor: q.bg, borderColor: q.border },
                    ]}
                >
                    <Text style={[extrasStyles.chipText, { color: q.color }]}>{q.label}</Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

export function GymTimePicker({
    visible,
    onSelect,
    onClose,
}: {
    visible: boolean;
    onSelect: (time: string) => void;
    onClose: () => void;
}) {
    if (!visible) return null;

    return (
        <View style={extrasStyles.gymPicker}>
            <View style={extrasStyles.gymPickerHeader}>
                <Text style={extrasStyles.gymPickerTitle}>When?</Text>
                <Pressable onPress={onClose} hitSlop={8}>
                    <FontAwesome name="times" size={12} color={VisualSystem.colors.textSecondary} />
                </Pressable>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={extrasStyles.gymPickerRow}
                keyboardShouldPersistTaps="handled"
            >
                {GYM_TOGETHER_OPTIONS.map((opt) => (
                    <Pressable
                        key={opt.time}
                        onPress={() => onSelect(opt.time)}
                        style={[
                            extrasStyles.chip,
                            {
                                backgroundColor: GYM_TOGETHER_CHIP.bg,
                                borderColor: GYM_TOGETHER_CHIP.border,
                            },
                        ]}
                    >
                        <Text style={[extrasStyles.chipText, { color: GYM_TOGETHER_CHIP.color }]}>
                            {opt.label}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}

export function groupReactions(
    reactions: MessageReaction[] | undefined,
    currentUserId: string
): { emoji: string; count: number; mine: boolean }[] {
    const map = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const r of reactions ?? []) {
        const existing = map.get(r.emoji);
        if (existing) {
            existing.count += 1;
            if (r.userId === currentUserId) existing.mine = true;
        } else {
            map.set(r.emoji, {
                emoji: r.emoji,
                count: 1,
                mine: r.userId === currentUserId,
            });
        }
    }
    return Array.from(map.values());
}

export function MessageReactionBar({
    reactions,
    currentUserId,
    onToggle,
    isMine,
}: {
    reactions: MessageReaction[] | undefined;
    currentUserId: string;
    onToggle: (emoji: string) => void;
    isMine: boolean;
}) {
    const [showPicker, setShowPicker] = useState(false);
    const grouped = groupReactions(reactions, currentUserId);

    return (
        <View style={[extrasStyles.reactionWrap, isMine && extrasStyles.reactionWrapMine]}>
            <View style={[extrasStyles.reactionRow, isMine && extrasStyles.reactionRowMine]}>
                {grouped.map((g) => (
                    <Pressable
                        key={g.emoji}
                        onPress={() => onToggle(g.emoji)}
                        style={[extrasStyles.reactionPill, g.mine && extrasStyles.reactionPillMine]}
                    >
                        <Text style={extrasStyles.reactionEmoji}>{g.emoji}</Text>
                        {g.count > 1 && <Text style={extrasStyles.reactionCount}>{g.count}</Text>}
                    </Pressable>
                ))}
                <Pressable
                    onPress={() => setShowPicker((v) => !v)}
                    style={extrasStyles.addReactionBtn}
                    hitSlop={6}
                >
                    <FontAwesome
                        name={showPicker ? 'times' : grouped.length > 0 ? 'smile-o' : 'plus'}
                        size={showPicker || grouped.length > 0 ? 12 : 10}
                        color={VisualSystem.colors.textSecondary}
                    />
                </Pressable>
            </View>
            {showPicker && (
                <View style={[extrasStyles.reactionPicker, isMine && extrasStyles.reactionPickerMine]}>
                    {REACTION_EMOJIS.map((emoji) => (
                        <Pressable
                            key={emoji}
                            onPress={() => {
                                onToggle(emoji);
                                setShowPicker(false);
                            }}
                            style={extrasStyles.reactionPickerBtn}
                        >
                            <Text style={extrasStyles.reactionEmoji}>{emoji}</Text>
                        </Pressable>
                    ))}
                </View>
            )}
        </View>
    );
}

export function GymInviteBubble({
    msg,
    isMine,
    currentUserId,
    onRespond,
}: {
    msg: Message;
    isMine: boolean;
    currentUserId: string;
    onRespond: (status: 'accepted' | 'declined') => void;
}) {
    const meta = isGymInviteMetadata(msg.metadata) ? msg.metadata : null;
    const status = meta?.status ?? 'pending';
    const canRespond = !isMine && status === 'pending' && msg.senderId !== currentUserId;

    return (
        <View style={[extrasStyles.inviteCard, isMine ? extrasStyles.inviteCardMine : extrasStyles.inviteCardTheirs]}>
            <Text style={extrasStyles.inviteIcon}>🏋️</Text>
            <Text style={[extrasStyles.inviteTitle, isMine && extrasStyles.inviteTitleMine]}>
                Lift together?
            </Text>
            {meta?.proposedTime ? (
                <Text style={[extrasStyles.inviteTime, isMine && extrasStyles.inviteTimeMine]}>
                    {meta.proposedTime}
                </Text>
            ) : null}
            {status === 'pending' && canRespond && (
                <View style={extrasStyles.inviteActions}>
                    <Pressable onPress={() => onRespond('accepted')} style={extrasStyles.inviteAccept}>
                        <Text style={extrasStyles.inviteAcceptText}>I'm in</Text>
                    </Pressable>
                    <Pressable onPress={() => onRespond('declined')} style={extrasStyles.inviteDecline}>
                        <Text style={extrasStyles.inviteDeclineText}>Can't</Text>
                    </Pressable>
                </View>
            )}
            {status === 'accepted' && (
                <Text style={extrasStyles.inviteStatusAccepted}>Locked in — see you there!</Text>
            )}
            {status === 'declined' && (
                <Text style={extrasStyles.inviteStatusDeclined}>Maybe next time</Text>
            )}
        </View>
    );
}

export function MilestoneBubble({
    msg,
    isMine,
}: {
    msg: Message;
    isMine: boolean;
}) {
    const meta = (msg.metadata ?? {}) as MilestoneMetadata;
    return (
        <View style={[extrasStyles.milestoneCard, isMine && extrasStyles.milestoneCardMine]}>
            <Text style={extrasStyles.milestoneIcon}>🏆</Text>
            <Text style={[extrasStyles.milestoneTitle, isMine && extrasStyles.milestoneTitleMine]}>
                {meta.title || msg.text}
            </Text>
            {meta.subtitle ? (
                <Text style={[extrasStyles.milestoneSub, isMine && extrasStyles.milestoneSubMine]}>
                    {meta.subtitle}
                </Text>
            ) : null}
        </View>
    );
}

const extrasStyles = StyleSheet.create({
    streakBanner: {
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
    streakEmoji: { fontSize: 20 },
    streakTitle: {
        color: VisualSystem.colors.goldText,
        fontSize: 13,
        fontWeight: '800',
    },
    streakSub: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        marginTop: 4,
    },
    quickScroll: {
        flexGrow: 0,
        maxHeight: 32,
    },
    quickRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingBottom: 4,
    },
    chip: {
        alignSelf: 'flex-start',
        flexGrow: 0,
        flexShrink: 0,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.18)',
    },
    chipText: {
        fontSize: 11,
        fontWeight: '700',
    },
    gymPicker: {
        marginHorizontal: 12,
        marginBottom: 4,
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(26,58,92,0.85)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
    },
    gymPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    gymPickerTitle: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    gymPickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    reactionWrap: {
        marginTop: 4,
        marginLeft: 4,
    },
    reactionWrapMine: {
        alignItems: 'flex-end',
        marginLeft: 0,
        marginRight: 4,
    },
    reactionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
    },
    reactionRowMine: {
        justifyContent: 'flex-end',
    },
    reactionPicker: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 4,
        padding: 4,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    reactionPickerMine: {
        alignSelf: 'flex-end',
    },
    reactionPickerBtn: {
        padding: 4,
    },
    reactionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    reactionPillMine: {
        borderColor: 'rgba(212,175,55,0.45)',
        backgroundColor: 'rgba(212,175,55,0.12)',
    },
    reactionEmoji: { fontSize: 13 },
    reactionCount: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
    },
    addReactionBtn: {
        width: 22,
        height: 22,
        borderRadius: 10,
        backgroundColor: VisualSystem.colors.bgMid,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inviteCard: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        maxWidth: 220,
    },
    inviteCardMine: {
        backgroundColor: VisualSystem.colors.gold,
        borderBottomRightRadius: 4,
    },
    inviteCardTheirs: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
    },
    inviteIcon: { fontSize: 17, marginBottom: 4 },
    inviteTitle: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 13,
        fontWeight: '800',
    },
    inviteTitleMine: { color: VisualSystem.colors.textPrimary },
    inviteTime: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        marginTop: 4,
        fontWeight: '600',
    },
    inviteTimeMine: { color: 'rgba(12,35,64,0.75)' },
    inviteActions: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
        gap: 4,
        marginTop: 8,
    },
    inviteAccept: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: VisualSystem.colors.successSoft,
    },
    inviteAcceptText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 11,
        fontWeight: '800',
    },
    inviteDecline: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    inviteDeclineText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    inviteStatusAccepted: {
        marginTop: 8,
        color: VisualSystem.colors.success,
        fontSize: 11,
        fontWeight: '700',
    },
    inviteStatusDeclined: {
        marginTop: 8,
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        fontStyle: 'italic',
    },
    milestoneCard: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
        backgroundColor: VisualSystem.colors.bgMid,
    },
    milestoneCardMine: {
        backgroundColor: VisualSystem.colors.gold,
        borderBottomRightRadius: 4,
    },
    milestoneIcon: { fontSize: 20, marginBottom: 4 },
    milestoneTitle: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 13,
        fontWeight: '800',
    },
    milestoneTitleMine: { color: VisualSystem.colors.textPrimary },
    milestoneSub: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        marginTop: 4,
    },
    milestoneSubMine: { color: 'rgba(12,35,64,0.7)' },
});
