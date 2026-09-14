import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    useWindowDimensions,
    Pressable,
    Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/features/auth/AuthContext';
import { Dorm, Gym } from '@/types/user';
import { VisualSystem } from '@/constants/VisualSystem';
import { SheetModal } from '@/components/ui/SheetModal';
import {
    CAMPUS_GYM_NAMES,
    GYM_PROFILES,
    getDormGymNames,
    resolveTrainingLocation,
    isUserDormGymLocation,
    getEquipmentSummaryForUI,
} from '@/lib/gymContext';
import { RestDayToggle } from '@/components/workout/RestDayToggle';

function selectedGymName(user: { dorm?: Dorm | null; defaultGym?: string | null }): string {
    const saved = user.defaultGym?.trim();
    if (saved && GYM_PROFILES[saved]) return saved;
    return resolveTrainingLocation(user);
}

type LocationRowProps = {
    name: string;
    subtitle?: string;
    badge?: string;
    selected: boolean;
    highlighted?: boolean;
    onPress: () => void;
};

function LocationRow({ name, subtitle, badge, selected, highlighted, onPress }: LocationRowProps) {
    return (
        <TouchableOpacity
            style={[
                styles.row,
                selected && styles.rowSelected,
                highlighted && !selected && styles.rowHighlighted,
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.rowText}>
                <Text style={[styles.rowTitle, selected && styles.rowTitleSelected]} numberOfLines={2}>
                    {name}
                </Text>
                {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
                {badge ? (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                ) : null}
            </View>
            {selected ? (
                <View style={styles.checkCircle}>
                    <FontAwesome name="check" size={12} color="#0C2340" />
                </View>
            ) : (
                <FontAwesome name="circle-o" size={18} color={VisualSystem.colors.textTertiary} />
            )}
        </TouchableOpacity>
    );
}

type TrainingLocationSectionProps = {
    /** Blends into a parent card instead of looking like a nested panel */
    embedded?: boolean;
};

export function TrainingLocationSection({ embedded = false }: TrainingLocationSectionProps = {}) {
    const { user, updateProfile } = useAuth();
    const [modalVisible, setModalVisible] = useState(false);
    const { height: windowHeight } = useWindowDimensions();

    const activeName = user ? selectedGymName(user) : 'Duncan Student Center';
    const atDormHall = user?.dorm ? isUserDormGymLocation(activeName, user.dorm) : false;

    const dormGyms = useMemo(() => getDormGymNames(), []);

    const pickLocation = (name: string) => {
        updateProfile({ defaultGym: name as Gym });
        setModalVisible(false);
    };

    if (!user) return null;

    return (
        <>
            <RestDayToggle userId={user.id} embedded />
            {embedded && <View style={styles.groupDivider} />}
            {embedded ? (
                <TouchableOpacity
                    style={styles.groupRow}
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.7}
                >
                    <FontAwesome
                        name="map-marker"
                        size={19}
                        color={VisualSystem.colors.goldText}
                        style={styles.groupRowIcon}
                    />
                    <View style={styles.groupRowText}>
                        <Text style={styles.groupRowTitle}>Training location</Text>
                        <Text style={styles.groupRowSub} numberOfLines={1}>
                            {activeName}
                        </Text>
                    </View>
                    <FontAwesome
                        name="chevron-right"
                        size={13}
                        color={VisualSystem.colors.textTertiary}
                    />
                </TouchableOpacity>
            ) : (
            <TouchableOpacity
                style={[styles.card, embedded && styles.cardEmbedded]}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.85}
            >
                <View style={styles.cardRow}>
                    <View style={styles.iconWrap}>
                        <FontAwesome name="map-marker" size={17} color={VisualSystem.colors.gold} />
                    </View>
                    <View style={styles.cardBody}>
                        <Text style={styles.eyebrow}>Training location</Text>
                        <Text style={styles.locationTitle} numberOfLines={2}>
                            {activeName}
                        </Text>
                        <Text style={styles.equipmentHint} numberOfLines={2}>
                            {getEquipmentSummaryForUI(activeName)}
                        </Text>
                        {user.dorm ? (
                            <View style={styles.metaRow}>
                                <View style={[styles.dormChip, atDormHall && styles.dormChipActive]}>
                                    <Text style={[styles.dormChipText, atDormHall && styles.dormChipTextActive]}>
                                        {user.dorm}
                                    </Text>
                                </View>
                                {atDormHall ? (
                                    <Text style={styles.metaHint}>Your dorm hall</Text>
                                ) : (
                                    <Text style={styles.metaHint}>Tap to change gym</Text>
                                )}
                            </View>
                        ) : (
                            <Text style={styles.metaHint}>Tap to change</Text>
                        )}
                    </View>
                    <View style={styles.chevronWrap}>
                        <FontAwesome name="chevron-right" size={13} color={VisualSystem.colors.gold} />
                    </View>
                </View>
            </TouchableOpacity>
            )}

            <SheetModal visible={modalVisible} onClose={() => setModalVisible(false)} bare>
                    <View style={[styles.sheet, { maxHeight: windowHeight * 0.88 }]}>
                        <View style={styles.handle} />
                        <View style={styles.sheetHeader}>
                            <View>
                                <Text style={styles.sheetTitle}>Training location</Text>
                                <Text style={styles.sheetSubtitle}>
                                    Equipment plans match where you train
                                </Text>
                            </View>
                            <TouchableOpacity accessibilityLabel="Close"
                                onPress={() => setModalVisible(false)}
                                hitSlop={12}
                                style={styles.closeBtn}
                            >
                                <FontAwesome name="times" size={18} color={VisualSystem.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.sheetScroll}
                        >
                            <Text style={styles.sectionLabel}>Campus centers</Text>
                            {CAMPUS_GYM_NAMES.map((name) => (
                                <LocationRow
                                    key={name}
                                    name={name}
                                    subtitle={getEquipmentSummaryForUI(name)}
                                    selected={selectedGymName(user) === name}
                                    onPress={() => pickLocation(name)}
                                />
                            ))}

                            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
                                Residential halls
                            </Text>
                            {dormGyms.map((name) => {
                                const isYourDorm = isUserDormGymLocation(name, user.dorm);
                                return (
                                    <LocationRow
                                        key={name}
                                        name={name}
                                        subtitle={getEquipmentSummaryForUI(name)}
                                        badge={isYourDorm ? 'Your dorm' : undefined}
                                        selected={selectedGymName(user) === name}
                                        highlighted={isYourDorm}
                                        onPress={() => pickLocation(name)}
                                    />
                                );
                            })}
                        </ScrollView>

                        <View style={styles.restDaySheetSection}>
                            <RestDayToggle userId={user.id} embedded />
                        </View>
                    </View>
            </SheetModal>
        </>
    );
}

const styles = StyleSheet.create({
    // Matches the dashboard's grouped list. The equipment summary and dorm
    // chip live in the picker this row opens, rather than on the dashboard.
    groupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    groupRowIcon: { width: 22, textAlign: 'center' },
    groupRowText: { flex: 1, minWidth: 0 },
    groupDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: VisualSystem.colors.borderSubtle,
        marginLeft: 16,
    },
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
        borderColor: VisualSystem.colors.borderSubtle,
        padding: 16,
        marginBottom: 16,
    },
    cardEmbedded: {
        marginBottom: 0,
        backgroundColor: VisualSystem.colors.bgMid,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.goldMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
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
    locationTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
        lineHeight: 22,
    },
    equipmentHint: {
        fontSize: 11,
        color: VisualSystem.colors.textSecondary,
        marginTop: 4,
        lineHeight: 16,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    dormChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 22,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    dormChipActive: {
        backgroundColor: VisualSystem.colors.goldMuted,
        borderColor: VisualSystem.colors.borderGold,
    },
    dormChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: VisualSystem.colors.textSecondary,
    },
    dormChipTextActive: {
        color: VisualSystem.colors.gold,
    },
    metaHint: {
        fontSize: 11,
        color: VisualSystem.colors.textTertiary,
    },
    chevronWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheet: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: VisualSystem.colors.borderSubtle,
            paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 6,
        backgroundColor: VisualSystem.colors.bgDeep,
        marginTop: 8,
        marginBottom: 8,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: VisualSystem.colors.borderSubtle,
    },
    sheetTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
    },
    sheetSubtitle: {
        fontSize: 13,
        color: VisualSystem.colors.textTertiary,
        marginTop: 4,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetScroll: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: VisualSystem.colors.gold,
        letterSpacing: 0.2,
        marginBottom: 8,
    },
    sectionLabelSpaced: {
        marginTop: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    rowSelected: {
        backgroundColor: VisualSystem.colors.goldMuted,
        borderColor: VisualSystem.colors.borderGold,
    },
    rowHighlighted: {
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    rowText: {
        flex: 1,
        paddingRight: 12,
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: VisualSystem.colors.textPrimary,
    },
    rowTitleSelected: {
        color: VisualSystem.colors.gold,
    },
    rowSubtitle: {
        fontSize: 11,
        color: VisualSystem.colors.textTertiary,
        marginTop: 4,
    },
    badge: {
        alignSelf: 'flex-start',
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: VisualSystem.colors.gold,
        letterSpacing: 0.3,
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 10,
        backgroundColor: VisualSystem.colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    restDaySheetSection: {
        marginTop: 8,
        paddingHorizontal: 4,
    },
});
