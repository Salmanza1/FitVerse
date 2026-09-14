import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    ScrollView,
    useWindowDimensions,
    TouchableOpacity,
} from 'react-native';
import { Tokens } from '@/constants/Tokens';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { VisualSystem } from '@/constants/VisualSystem';
import { SheetModal } from '@/components/ui/SheetModal';

interface StyledSelectProps {
    label: string;
    value: string;
    options: string[];
    onSelect: (val: any) => void;
    placeholder?: string;
    containerStyle?: object;
}

/** Matches StyledInput label + field box so dropdowns look identical to text inputs. */
export function StyledSelect({
    label,
    value,
    options,
    onSelect,
    placeholder,
    containerStyle,
}: StyledSelectProps) {
    const [visible, setVisible] = React.useState(false);
    const { height: windowHeight } = useWindowDimensions();
    const hasValue = !!value?.trim();
    const displayText = hasValue ? value : (placeholder ?? 'Select...');

    return (
        <>
            <View style={[styles.container, containerStyle]}>
                <Text style={styles.label}>{label.toUpperCase()}</Text>
                <Pressable
                    style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
                    onPress={() => setVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}, ${displayText}`}
                >
                    <Text
                        style={[styles.valueText, !hasValue && styles.placeholderText]}
                        numberOfLines={2}
                    >
                        {displayText}
                    </Text>
                    <FontAwesome
                        name="chevron-down"
                        size={14}
                        color={VisualSystem.colors.textSecondary}
                        style={styles.chevron}
                    />
                </Pressable>
            </View>

            <SheetModal visible={visible} onClose={() => setVisible(false)} bare>
                    <View style={[styles.modalSheet, { maxHeight: windowHeight * 0.7 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select {label}</Text>
                            <TouchableOpacity accessibilityLabel="Close" onPress={() => setVisible(false)} hitSlop={12}>
                                <FontAwesome name="close" size={22} color="#0C2340" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            style={styles.optionList}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {options.map((option) => {
                                const selected = value === option;
                                return (
                                    <TouchableOpacity
                                        key={option}
                                        style={[styles.option, selected && styles.optionSelected]}
                                        onPress={() => {
                                            onSelect(option);
                                            setVisible(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[styles.optionText, selected && styles.optionTextSelected]}
                                            numberOfLines={3}
                                        >
                                            {option}
                                        </Text>
                                        {selected && (
                                            <FontAwesome name="check" size={16} color={VisualSystem.colors.textPrimary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
            </SheetModal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        width: '100%',
    },
    label: {
        fontSize: Tokens.typography.xs,
        fontWeight: '800',
        marginBottom: Tokens.spacing.sm,
        marginLeft: Tokens.spacing.xs,
        color: VisualSystem.colors.goldText,
        letterSpacing: 0.2,
    },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        minHeight: 48,
        paddingHorizontal: Tokens.spacing.lg,
        paddingVertical: 12,
        borderRadius: Tokens.radius.md,
        borderWidth: 1.5,
        backgroundColor: VisualSystem.colors.bgMid,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    triggerPressed: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderColor: 'rgba(212, 175, 55, 0.35)',
    },
    valueText: {
        flex: 1,
        fontSize: Tokens.typography.md,
        color: VisualSystem.colors.textPrimary,
        paddingRight: Tokens.spacing.sm,
        lineHeight: 22,
    },
    placeholderText: {
        color: VisualSystem.colors.textTertiary,
    },
    chevron: {
        marginLeft: Tokens.spacing.xs,
    },
    modalSheet: {
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: Tokens.radius.lg,
        borderTopRightRadius: Tokens.radius.lg,
        paddingHorizontal: Tokens.spacing.xl,
        paddingTop: Tokens.spacing.xl,
        paddingBottom: Tokens.spacing.xxl,
        },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Tokens.spacing.lg,
    },
    modalTitle: {
        fontSize: Tokens.typography.lg,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
    },
    optionList: {
        maxHeight: 360,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Tokens.spacing.md,
        paddingHorizontal: Tokens.spacing.md,
        borderRadius: Tokens.radius.sm,
        marginBottom: Tokens.spacing.sm,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    optionSelected: {
        backgroundColor: VisualSystem.colors.gold,
        borderColor: VisualSystem.colors.borderGold,
    },
    optionText: {
        flex: 1,
        fontSize: Tokens.typography.md,
        color: VisualSystem.colors.textPrimary,
        fontWeight: '600',
        paddingRight: Tokens.spacing.sm,
    },
    optionTextSelected: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '700',
    },
});
