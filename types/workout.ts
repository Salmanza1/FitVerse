export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure';
export type ExerciseType = 'weight_reps' | 'bodyweight' | 'assisted' | 'duration' | 'cardio' | 'distance';

export interface Set {
    id: string;
    weight: number;
    reps: number;
    completed: boolean;
    type: SetType;
    previousPerformance?: string; // e.g. "185 x 5"
    volume?: number;
    estimated1RM?: number;
    /** Rest after this set (seconds) before the next set — overrides exercise default when set. */
    restAfterSeconds?: number;
    /** Seconds held or worked. Used by 'duration' and 'cardio' exercises. */
    durationSeconds?: number;
    /** Distance covered, in miles. Used by 'cardio' exercises. */
    distance?: number;
}

export interface Exercise {
    id: string;
    name: string;
    category?: string; // e.g. "Legs", "Chest"
    type: ExerciseType;
    sets: Set[];
    previousBest?: string;
    stickyNote?: string;
    primaryMuscles?: string[];
    secondaryMuscles?: string[];
    supersetId?: string; // Grouping ID for supersets
    restTimers?: {
        work: number;
        warmup: number;
        dropset: number;
    };
}

export interface Workout {
    id: string;
    name: string;
    date: string;
    duration: number; // Seconds
    notes?: string; 
    exercises: Exercise[];
    isTemplate?: boolean;
    sourceTemplateId?: string;
    totalVolume?: number;
    muscleIntensities?: Record<string, number>;
}
