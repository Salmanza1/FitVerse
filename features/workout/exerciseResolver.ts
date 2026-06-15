import { Exercise, Set, SetType, Workout } from '@/types/workout';
import { ExerciseLibraryEntry } from './exerciseTypes';
import { CANONICAL_EXERCISES } from './exerciseLibraryData';

const normalize = (s: string) =>
    s
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/\s+/g, ' ')
        .trim();

/** Map common AI / shorthand names → canonical library name */
const ALIASES: Record<string, string> = {
    'bench press': 'Bench Press (Barbell)',
    'incline bench press': 'Bench Press - Incline (Barbell)',
    'incline bench': 'Bench Press - Incline (Barbell)',
    'squat': 'Squat (Barbell)',
    'back squat': 'Squat (Barbell)',
    'front squat': 'Squat - Front (Barbell)',
    'deadlift': 'Deadlift (Barbell)',
    'rdl': 'Deadlift - Romanian (Barbell)',
    'romanian deadlift': 'Deadlift - Romanian (Barbell)',
    'lat pulldown': 'Lat Pulldown (Cable)',
    'pull up': 'Pull Up (Bodyweight)',
    'pullup': 'Pull Up (Bodyweight)',
    'chin up': 'Chin Up (Bodyweight)',
    'barbell row': 'Row - Bent Over (Barbell)',
    'bent over row': 'Row - Bent Over (Barbell)',
    'dumbbell row': 'Row - Bent Over (Dumbbell)',
    'cable row': 'Row - Seated Cable (Cable)',
    'seated row': 'Row - Seated Cable (Cable)',
    'ohp': 'Overhead Press (Barbell)',
    'overhead press': 'Overhead Press (Barbell)',
    'shoulder press': 'Overhead Press (Barbell)',
    'lateral raise': 'Lateral Raise (Dumbbell)',
    'face pull': 'Face Pull (Cable)',
    'leg press': 'Leg Press (Machine)',
    'leg extension': 'Leg Extension (Machine)',
    'leg curl': 'Leg Curl - Lying (Machine)',
    'hip thrust': 'Hip Thrust (Barbell)',
    'calf raise': 'Calf Raise - Standing (Machine)',
    'bicep curl': 'Bicep Curl (Dumbbell)',
    'tricep pushdown': 'Tricep Pushdown (Cable)',
    'skull crusher': 'Skull Crusher (Barbell)',
    'push up': 'Push Up (Bodyweight)',
    'pushup': 'Push Up (Bodyweight)',
    'dips': 'Dips (Bodyweight)',
};

const BY_NAME = new Map(CANONICAL_EXERCISES.map((e) => [normalize(e.name), e]));

export function resolveExerciseFromAI(rawName: string): ExerciseLibraryEntry | null {
    if (!rawName?.trim()) return null;
    const n = normalize(rawName);

    const exact = BY_NAME.get(n);
    if (exact) return exact;

    const alias = ALIASES[n];
    if (alias) return BY_NAME.get(normalize(alias)) ?? null;

    // Contains match (e.g. "Incline Bench Press (Barbell)" partial)
    for (const entry of CANONICAL_EXERCISES) {
        const en = normalize(entry.name);
        if (en === n || en.includes(n) || n.includes(en)) return entry;
    }

    // Match without equipment suffix
    const base = n.replace(/\s*\([^)]+\)\s*$/, '').trim();
    if (base !== n) {
        const hit = CANONICAL_EXERCISES.find((e) => normalize(e.name).startsWith(base));
        if (hit) return hit;
    }

    return null;
}

export function parseTargetReps(targetReps: string): number {
    const s = String(targetReps || '10');
    const nums = s.match(/\d+/g);
    if (!nums?.length) return 10;
    if (nums.length >= 2) {
        return Math.round((parseInt(nums[0], 10) + parseInt(nums[1], 10)) / 2);
    }
    return parseInt(nums[0], 10) || 10;
}

export function buildSetsFromPlan(setsCount: number, targetReps: string): Set[] {
    const reps = parseTargetReps(targetReps);
    const count = Math.max(1, Math.min(8, setsCount || 3));
    return Array.from({ length: count }).map(() => ({
        id: Math.random().toString(36).slice(2, 11),
        reps,
        weight: 0,
        completed: false,
        type: 'normal' as SetType,
    }));
}

export type AIWorkoutExercise = {
    name: string;
    setsCount?: number;
    targetReps?: string;
    notes?: string;
};

export type AIWorkoutPlan = {
    name: string;
    exercises: AIWorkoutExercise[];
};

export function workoutFromAIPlan(
    plan: AIWorkoutPlan,
    meta?: { location?: string; workoutType?: string; durationMinutes?: number }
): { workout: Workout; unresolved: string[] } {
    const unresolved: string[] = [];
    const exercises: Exercise[] = [];

    for (const aiEx of plan.exercises || []) {
        const lib = resolveExerciseFromAI(aiEx.name);
        const canonicalName = lib?.name ?? aiEx.name;
        if (!lib) unresolved.push(aiEx.name);

        exercises.push({
            id: lib?.id ?? Math.random().toString(36).slice(2, 11),
            name: canonicalName,
            category: lib?.category ?? 'Other',
            type: 'weight_reps',
            primaryMuscles: lib?.primaryMuscles,
            secondaryMuscles: lib?.secondaryMuscles,
            stickyNote: aiEx.notes,
            sets: buildSetsFromPlan(aiEx.setsCount ?? 3, aiEx.targetReps ?? '8-12'),
        });
    }

    const noteParts = ['☘️ AI workout plan'];
    if (meta?.workoutType) noteParts.push(`Focus: ${meta.workoutType}`);
    if (meta?.location) noteParts.push(`Location: ${meta.location}`);
    if (meta?.durationMinutes) noteParts.push(`~${meta.durationMinutes} min`);

    const workout: Workout = {
        id: Math.random().toString(36).slice(2, 11),
        name: plan.name || 'AI Workout',
        date: new Date().toISOString(),
        duration: 0,
        exercises,
        notes: noteParts.join(' · '),
    };

    return { workout, unresolved };
}

/** Compact list for OpenAI system prompt (by category) */
export function getExerciseLibraryPromptSection(): string {
    const byCat = new Map<string, string[]>();
    for (const e of CANONICAL_EXERCISES) {
        const list = byCat.get(e.category) || [];
        list.push(e.name);
        byCat.set(e.category, list);
    }
    const lines: string[] = [
        'EXERCISE LIBRARY (use these EXACT names in workout plans — format "Name (Equipment)"):',
    ];
    for (const cat of ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Full Body', 'Olympic', 'Cardio', 'Other']) {
        const names = byCat.get(cat);
        if (names?.length) lines.push(`${cat}: ${names.join('; ')}`);
    }
    return lines.join('\n');
}

export function searchExercises(query: string): ExerciseLibraryEntry[] {
    const q = normalize(query);
    if (!q) return [...CANONICAL_EXERCISES];
    return CANONICAL_EXERCISES.filter(
        (e) =>
            normalize(e.name).includes(q) ||
            normalize(e.category).includes(q) ||
            e.primaryMuscles?.some((m) => m.includes(q))
    );
}

export function getExercisesByCategory(category: string): ExerciseLibraryEntry[] {
    return CANONICAL_EXERCISES.filter((e) => e.category === category);
}

/** Active-workout display label — body-part category is shown separately below the name. */
export function formatExerciseDisplayName(name: string, category?: string): string {
    let display = (name || '').trim();
    if (!display) return '';

    if (category?.trim()) {
        const escaped = category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const withSeparator = new RegExp(`^${escaped}\\s*[-–—:]\\s*`, 'i');
        if (withSeparator.test(display)) {
            display = display.replace(withSeparator, '').trim();
        }
    }

    const withoutEquipment = display.replace(/\s*\([^)]+\)\s*$/, '').trim();
    return withoutEquipment || display;
}
