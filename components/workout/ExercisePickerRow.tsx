import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { VisualSystem } from '@/constants/VisualSystem';

type ExerciseItem = {
    id?: string;
    name?: string;
    category?: string;
};

type Props = {
    item: ExerciseItem;
    onPress: () => void;
    onLayout?: (height: number) => void;
    disabled?: boolean;
};

export function ExercisePickerRow({ item, onPress, onLayout, disabled = false }: Props) {
    return (
        <Pressable
            style={({ pressed }) => [
                styles.row,
                pressed && !disabled && styles.rowPressed,
                disabled && styles.rowDisabled,
            ]}
            onPress={onPress}
            disabled={disabled}
            hitSlop={4}
            onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0) onLayout?.(h);
            }}
        >
            <View style={styles.textBlock}>
                <Text style={styles.name} numberOfLines={2}>
                    {item.name}
                </Text>
                {item.category ? (
                    <Text style={styles.category} numberOfLines={1}>
                        {item.category}
                    </Text>
                ) : null}
            </View>
            <View style={styles.addCircle}>
                <FontAwesome name="plus" size={13} color={VisualSystem.colors.gold} />
            </View>
        </Pressable>
    );
}

export function ExercisePickerSectionHeader({
    title,
    onLayout,
}: {
    title: string;
    onLayout?: (height: number) => void;
}) {
    return (
        <View
            style={styles.sectionHeader}
            onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0) onLayout?.(h);
            }}
        >
            <Text style={styles.sectionLetter}>{title}</Text>
        </View>
    );
}

export const exercisePickerListStyles = StyleSheet.create({
    listContent: {
        paddingBottom: 32,
        paddingRight: 4,
    },
});

const styles = StyleSheet.create({
    sectionHeader: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
        backgroundColor: 'transparent',
    },
    sectionLetter: {
        fontSize: 13,
        fontWeight: '600',
        color: VisualSystem.colors.textSecondary,
        letterSpacing: 0.8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: VisualSystem.colors.borderSubtle,
        minHeight: 52,
    },
    rowPressed: {
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    rowDisabled: {
        opacity: 0.5,
    },
    textBlock: {
        flex: 1,
        paddingRight: 12,
    },
    name: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
        letterSpacing: -0.2,
    },
    category: {
        marginTop: 4,
        fontSize: 11,
        fontWeight: '400',
        color: VisualSystem.colors.textTertiary,
        letterSpacing: 0.1,
    },
    addCircle: {
        width: 30,
        height: 30,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.goldMuted,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderGold,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
