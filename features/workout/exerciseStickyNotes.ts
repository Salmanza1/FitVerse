import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLatestStickyNoteForExercise } from './WorkoutStore';

const storageKey = (userId: string) => `fitverse_exercise_sticky_notes_${userId}`;

function exerciseKey(exerciseId: string, exerciseName: string): string {
    return `${exerciseId}::${exerciseName}`;
}

export async function getExerciseStickyNote(
    userId: string,
    exerciseId: string,
    exerciseName: string
): Promise<string> {
    try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        if (!raw) return '';
        const map = JSON.parse(raw) as Record<string, string>;
        return map[exerciseKey(exerciseId, exerciseName)] ?? '';
    } catch {
        return '';
    }
}

export async function saveExerciseStickyNote(
    userId: string,
    exerciseId: string,
    exerciseName: string,
    note: string
): Promise<void> {
    try {
        const key = storageKey(userId);
        const raw = await AsyncStorage.getItem(key);
        const map: Record<string, string> = raw ? JSON.parse(raw) : {};
        const exKey = exerciseKey(exerciseId, exerciseName);
        const trimmed = note.trim();
        if (trimmed) {
            map[exKey] = note;
        } else {
            delete map[exKey];
        }
        await AsyncStorage.setItem(key, JSON.stringify(map));
    } catch (e) {
        console.warn('[exerciseStickyNotes] save failed:', e);
    }
}

/** Local saved note → in-workout value → last logged workout with this exercise. */
export async function resolveExerciseStickyNote(
    userId: string,
    exerciseId: string,
    exerciseName: string,
    inWorkoutNote?: string
): Promise<string> {
    const local = await getExerciseStickyNote(userId, exerciseId, exerciseName);
    if (local.trim()) return local;
    if (inWorkoutNote?.trim()) return inWorkoutNote;
    const fromHistory = await getLatestStickyNoteForExercise(userId, exerciseId, exerciseName);
    return fromHistory ?? '';
}
