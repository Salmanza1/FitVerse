import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SectionList,
    Modal,
    Pressable,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
    EXERCISE_CATEGORIES,
    CANONICAL_EXERCISES,
    searchExercises,
} from '@/features/workout/exerciseLibrary';
import { ExerciseLibraryEntry } from '@/features/workout/exerciseTypes';
import { VisualSystem } from '@/constants/VisualSystem';
import { Tokens } from '@/constants/Tokens';

type Props = {
    visible: boolean;
    onClose: () => void;
    /** If set, tapping an exercise calls this (e.g. add to active workout) */
    onSelectExercise?: (exercise: ExerciseLibraryEntry) => void;
};

export function ExerciseLibraryPanel({ visible, onClose, onSelectExercise }: Props) {
    const [query, setQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    const sections = useMemo(() => {
        let list = searchExercises(query);
        if (categoryFilter) list = list.filter((e) => e.category === categoryFilter);

        const grouped = new Map<string, ExerciseLibraryEntry[]>();
        for (const e of list) {
            const arr = grouped.get(e.category) || [];
            arr.push(e);
            grouped.set(e.category, arr);
        }

        return EXERCISE_CATEGORIES.filter((c) => grouped.has(c)).map((title) => ({
            title,
            data: grouped.get(title)!,
        }));
    }, [query, categoryFilter]);

    const total = CANONICAL_EXERCISES.length;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={12}>
                        <FontAwesome name="times" size={22} color={VisualSystem.colors.gold} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.title}>Exercise Library</Text>
                        <Text style={styles.subtitle}>{total} exercises in library</Text>
                    </View>
                    <View style={{ width: 22 }} />
                </View>

                <View style={styles.searchRow}>
                    <FontAwesome name="search" size={16} color="rgba(212,175,55,0.5)" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search exercises..."
                        placeholderTextColor="rgba(160,180,203,0.45)"
                        value={query}
                        onChangeText={setQuery}
                        autoCorrect={false}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <FontAwesome name="times-circle" size={18} color={VisualSystem.colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.chipScroll}>
                    <TouchableOpacity
                        style={[styles.chip, !categoryFilter && styles.chipActive]}
                        onPress={() => setCategoryFilter(null)}
                    >
                        <Text style={[styles.chipText, !categoryFilter && styles.chipTextActive]}>All</Text>
                    </TouchableOpacity>
                    {EXERCISE_CATEGORIES.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.chip, categoryFilter === cat && styles.chipActive]}
                            onPress={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                        >
                            <Text style={[styles.chipText, categoryFilter === cat && styles.chipTextActive]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    stickySectionHeadersEnabled
                    contentContainerStyle={{ paddingBottom: 32 }}
                    ListEmptyComponent={
                        <Text style={styles.empty}>No exercises match your search.</Text>
                    }
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{title}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <Pressable
                            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                            onPress={() => onSelectExercise?.(item)}
                            disabled={!onSelectExercise}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.exName}>{item.name}</Text>
                                {item.primaryMuscles?.length ? (
                                    <Text style={styles.exMeta}>
                                        {item.primaryMuscles.join(', ')}
                                    </Text>
                                ) : null}
                            </View>
                            {onSelectExercise ? (
                                <FontAwesome name="plus-circle" size={20} color={VisualSystem.colors.gold} />
                            ) : null}
                        </Pressable>
                    )}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        paddingTop: 32,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Tokens.spacing.lg,
        marginBottom: Tokens.spacing.md,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    title: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 17,
        fontWeight: '800',
    },
    subtitle: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 11,
        marginTop: 4,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: Tokens.spacing.lg,
        marginBottom: Tokens.spacing.sm,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
    },
    chipScroll: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: Tokens.spacing.lg,
        marginBottom: Tokens.spacing.sm,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 22,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    chipActive: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderColor: VisualSystem.colors.borderGold,
    },
    chipText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    chipTextActive: {
        color: VisualSystem.colors.gold,
    },
    sectionHeader: {
        backgroundColor: VisualSystem.colors.bgMid,
        paddingHorizontal: Tokens.spacing.lg,
        paddingVertical: 8,
    },
    sectionTitle: {
        color: VisualSystem.colors.gold,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Tokens.spacing.lg,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: VisualSystem.colors.borderSubtle,
    },
    rowPressed: {
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    exName: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        fontWeight: '600',
    },
    exMeta: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 11,
        marginTop: 4,
        textTransform: 'capitalize',
    },
    empty: {
        color: VisualSystem.colors.textSecondary,
        textAlign: 'center',
        marginTop: 32,
        paddingHorizontal: 24,
    },
});
