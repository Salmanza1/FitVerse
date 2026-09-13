import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Switch,
    ActivityIndicator,
    Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { VisualSystem } from '@/constants/VisualSystem';
import {
    clearRestDay,
    declareRestDay,
    isUserOnRestDay,
    WORKOUT_STATUS_COLORS,
} from '@/features/workout/WorkoutPresenceStore';

type Props = {
    userId: string;
    /** Compact row for settings */
    compact?: boolean;
    /** Blends into parent card on gym dashboard */
    embedded?: boolean;
};

export function RestDayToggle({ userId, compact = false, embedded = false }: Props) {
    const [onRest, setOnRest] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        const active = await isUserOnRestDay(userId);
        setOnRest(active);
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleToggle = async (next: boolean) => {
        if (saving) return;
        setSaving(true);
        setOnRest(next);
        try {
            if (next) {
                await declareRestDay(userId);
            } else {
                await clearRestDay(userId);
            }
        } catch {
            setOnRest(!next);
        } finally {
            setSaving(false);
        }
    };

    const purple = WORKOUT_STATUS_COLORS.rest_day;

    if (compact) {
        return (
            <View style={styles.compactRow}>
                <View style={styles.compactLeft}>
                    <View style={[styles.iconWrap, { backgroundColor: `${purple}22` }]}>
                        <FontAwesome name="bed" size={14} color={purple} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.compactTitle}>Rest day today</Text>
                        <Text style={styles.compactSub}>
                            Friends see you in purple in chat
                        </Text>
                    </View>
                </View>
                {loading ? (
                    <ActivityIndicator size="small" color={purple} />
                ) : (
                    <Switch
                        value={onRest}
                        onValueChange={handleToggle}
                        disabled={saving}
                        trackColor={{ false: 'rgba(255,255,255,0.15)', true: `${purple}88` }}
                        thumbColor={onRest ? purple : '#f4f3f4'}
                    />
                )}
            </View>
        );
    }

    if (embedded) {
        return (
            <View style={styles.groupRow}>
                <FontAwesome name="bed" size={19} color={purple} style={styles.groupRowIcon} />
                <View style={styles.groupRowText}>
                    <Text style={styles.groupRowTitle}>Rest day today</Text>
                    <Text style={styles.groupRowSub}>Friends see you in purple</Text>
                </View>
                {loading ? (
                    <ActivityIndicator size="small" color={purple} />
                ) : (
                    <Switch
                        value={onRest}
                        onValueChange={handleToggle}
                        disabled={saving}
                        trackColor={{ false: VisualSystem.colors.borderStrong, true: `${purple}88` }}
                        thumbColor={onRest ? purple : '#FFFFFF'}
                    />
                )}
            </View>
        );
    }

    return (
        <View style={[styles.card, embedded && styles.cardEmbedded]}>
            <View style={styles.cardRow}>
                <View style={[styles.iconWrap, { backgroundColor: `${purple}22` }]}>
                    <FontAwesome name="bed" size={17} color={purple} />
                </View>
                <View style={styles.cardBody}>
                    <Text style={styles.eyebrow}>Accountability</Text>
                    <Text style={styles.title}>Rest day today</Text>
                    <Text style={styles.hint}>
                        Your name turns purple in chats so friends know you're recovering
                    </Text>
                </View>
                {loading ? (
                    <ActivityIndicator size="small" color={purple} />
                ) : (
                    <Switch
                        value={onRest}
                        onValueChange={handleToggle}
                        disabled={saving}
                        trackColor={{ false: 'rgba(255,255,255,0.15)', true: `${purple}88` }}
                        thumbColor={onRest ? purple : '#f4f3f4'}
                    />
                )}
            </View>
            {onRest && (
                <View style={styles.activeBanner}>
                    <View style={[styles.activeDot, { backgroundColor: purple }]} />
                    <Text style={[styles.activeText, { color: purple }]}>
                        Rest day is on — visible to your chat groups
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // Matches the dashboard's grouped list so the rows line up.
    groupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    groupRowIcon: { width: 22, textAlign: 'center' },
    groupRowText: { flex: 1, minWidth: 0 },
    groupRowTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
    },
    groupRowSub: {
        fontSize: 13,
        color: VisualSystem.colors.textSecondary,
        marginTop: 1,
    },
    card: {
        backgroundColor: VisualSystem.colors.glassFill,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(177, 151, 252, 0.25)',
        padding: 16,
        marginBottom: 16,
    },
    cardEmbedded: {
        marginBottom: 16,
        backgroundColor: 'rgba(177, 151, 252, 0.06)',
        borderColor: 'rgba(177, 151, 252, 0.2)',
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardBody: {
        flex: 1,
        paddingRight: 8,
    },
    /** A quiet label, not a shouted one — the value below it is the content. */
    eyebrow: {
        fontSize: 13,
        fontWeight: '600',
        color: VisualSystem.colors.textSecondary,
        marginBottom: 2,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
    },
    hint: {
        fontSize: 11,
        color: VisualSystem.colors.textSecondary,
        marginTop: 4,
        lineHeight: 16,
    },
    activeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(177, 151, 252, 0.2)',
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 6,
    },
    activeText: {
        fontSize: 11,
        fontWeight: '700',
        flex: 1,
    },
    compactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        paddingHorizontal: 16,
    },
    compactLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
        paddingRight: 12,
    },
    compactTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: VisualSystem.colors.textPrimary,
    },
    compactSub: {
        fontSize: 11,
        color: VisualSystem.colors.textSecondary,
        marginTop: 4,
    },
});
