/** Measured-ish heights for Add Exercise list rows (padding + 2 lines). */
export const EXERCISE_PICKER_HEADER_HEIGHT = 34;
export const EXERCISE_PICKER_ROW_HEIGHT = 56;

/** Full A–Z rail (always shown on index; empty letters scroll to nearest section). */
export const ALPHABET_INDEX = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Map scrubbed letter to nearest section that exists in the list. */
export function resolvePickerScrollLetter(
    requested: string,
    availableTitles: Iterable<string>
): string | null {
    const available = new Set(availableTitles);
    if (available.has(requested)) return requested;

    const i = ALPHABET_INDEX.indexOf(requested);
    if (i < 0) return null;

    for (let j = i; j < ALPHABET_INDEX.length; j++) {
        if (available.has(ALPHABET_INDEX[j])) return ALPHABET_INDEX[j];
    }
    for (let j = i - 1; j >= 0; j--) {
        if (available.has(ALPHABET_INDEX[j])) return ALPHABET_INDEX[j];
    }
    return null;
}

export type SectionSlice = { title: string; data: unknown[] };

export type ExercisePickerListItem =
    | { kind: 'header'; title: string; key: string }
    | { kind: 'exercise'; item: unknown; key: string };

/** Flat rows for FlatList + alphabet index (SectionList has no scrollToOffset on ref). */
export function buildExercisePickerRows(sections: SectionSlice[]): ExercisePickerListItem[] {
    const rows: ExercisePickerListItem[] = [];
    for (const section of sections) {
        rows.push({ kind: 'header', title: section.title, key: `hdr-${section.title}` });
        for (const item of section.data) {
            const ex = item as { id?: string; name?: string };
            rows.push({
                kind: 'exercise',
                item,
                key: `${ex.id || ex.name || 'ex'}_pick`,
            });
        }
    }
    return rows;
}

export function headerIndexForLetter(rows: ExercisePickerListItem[], letter: string): number {
    return rows.findIndex((r) => r.kind === 'header' && r.title === letter);
}

export function getPickerItemLayout(
    rows: ExercisePickerListItem[],
    index: number,
    headerHeight: number,
    rowHeight: number
): { length: number; offset: number; index: number } {
    let offset = 0;
    for (let i = 0; i < index; i++) {
        offset += rows[i].kind === 'header' ? headerHeight : rowHeight;
    }
    const length = rows[index].kind === 'header' ? headerHeight : rowHeight;
    return { length, offset, index };
}
