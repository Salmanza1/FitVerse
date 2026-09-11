import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Exercise, Set } from '@/types/workout';
import { formatRestSeconds, getRestAfterSetSeconds, parseRestInput } from '@/features/workout/restTimerUtils';
import { VisualSystem } from '@/constants/VisualSystem';

const C = VisualSystem.colors;
const REST_GREEN = VisualSystem.colors.success;
const REST_GREEN_MUTED = VisualSystem.colors.textSecondary;

type Props = {
    exercise: Exercise;
    set: Set;
    isActive: boolean;
    activeTimer: ActiveSetRestTimer | null;
    isEditing: boolean;
    onStartEdit: () => void;
    onSaveRest: (seconds: number) => void;
    onCancelEdit: () => void;
};

export type ActiveSetRestTimer = {
    remaining: number;
    total: number;
    status: 'running' | 'finished';
};

export function BetweenSetRestRow({
    exercise,
    set,
    isActive,
    activeTimer,
    isEditing,
    onStartEdit,
    onSaveRest,
    onCancelEdit,
}: Props) {
    const displaySeconds = getRestAfterSetSeconds(exercise, set);
    const [draft, setDraft] = useState(formatRestSeconds(displaySeconds));

    useEffect(() => {
        if (isEditing) setDraft(formatRestSeconds(getRestAfterSetSeconds(exercise, set)));
    }, [isEditing, exercise, set]);

    if (isEditing) {
        return (
            <View style={styles.editRow}>
                <FontAwesome name="clock-o" size={12} color={REST_GREEN} style={styles.icon} />
                <TextInput
                    style={styles.editInput}
                    value={draft}
                    onChangeText={setDraft}
                    keyboardType="numbers-and-punctuation"
                    placeholder="2:00"
                    placeholderTextColor={C.textTertiary}
                    autoFocus
                    selectTextOnFocus
                />
                <Pressable
                    style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => onSaveRest(parseRestInput(draft))}
                >
                    <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
                <Pressable onPress={onCancelEdit} hitSlop={8}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
            </View>
        );
    }

    if (isActive && activeTimer) {
        const progress =
            activeTimer.total > 0
                ? Math.min(100, Math.max(0, ((activeTimer.total - activeTimer.remaining) / activeTimer.total) * 100))
                : 0;
        return (
            <View style={[styles.bar, styles.barActive]}>
                <View style={[styles.fill, { width: `${progress}%` }]} />
                <Text style={styles.barTextActive}>
                    REST {formatRestSeconds(activeTimer.remaining)}
                    {activeTimer.status === 'finished' ? ' · Go!' : ''}
                </Text>
            </View>
        );
    }

    if (displaySeconds <= 0) {
        return (
            <Pressable
                style={({ pressed }) => [styles.bar, styles.barMuted, pressed && { opacity: 0.75 }]}
                onPress={onStartEdit}
            >
                <FontAwesome name="clock-o" size={11} color="rgba(212, 175, 55, 0.45)" style={styles.iconInline} />
                <Text style={styles.barTextMuted}>No rest · tap to set</Text>
            </Pressable>
        );
    }

    const isCustom = set.restAfterSeconds != null;

    return (
        <Pressable
            style={({ pressed }) => [styles.bar, pressed && { opacity: 0.82 }]}
            onPress={onStartEdit}
        >
            <FontAwesome name="clock-o" size={11} color={REST_GREEN_MUTED} style={styles.iconInline} />
            <Text style={styles.barText}>
                Rest {formatRestSeconds(displaySeconds)}
                {isCustom ? '' : ' · tap to change'}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    bar: {
        height: 24,
        backgroundColor: VisualSystem.colors.bgDeep,
        borderRadius: 6,
        marginTop: 4,
        marginBottom: 4,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: 'rgba(92, 158, 111, 0.2)',
    },
    barMuted: {
        borderColor: 'rgba(212, 175, 55, 0.12)',
    },
    barActive: {
        borderColor: 'rgba(46, 204, 113, 0.35)',
    },
    fill: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: REST_GREEN,
        opacity: 0.28,
    },
    barText: {
        color: REST_GREEN_MUTED,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    barTextMuted: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 11,
        fontWeight: '600',
    },
    barTextActive: {
        color: REST_GREEN,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
        zIndex: 1,
    },
    iconInline: {
        marginRight: 4,
    },
    editRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 32,
        marginTop: 4,
        marginBottom: 4,
        paddingHorizontal: 8,
        backgroundColor: C.bgElevated,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(46, 204, 113, 0.25)',
    },
    icon: {
        marginRight: 8,
    },
    editInput: {
        flex: 1,
        color: C.textPrimary,
        fontSize: 15,
        fontWeight: '700',
        paddingVertical: 4,
    },
    doneBtn: {
        backgroundColor: REST_GREEN,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6,
        marginLeft: 8,
    },
    doneBtnText: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '800',
        fontSize: 11,
    },
    cancelText: {
        color: C.textTertiary,
        fontSize: 11,
        marginLeft: 8,
    },
});
