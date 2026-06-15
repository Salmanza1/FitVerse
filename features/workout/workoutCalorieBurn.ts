import { Workout } from '@/types/workout';

/** Vigorous resistance training — Compendium of Physical Activities ~6.0 MET */
const STRENGTH_TRAINING_MET = 6.0;

/**
 * Estimate calories burned for a completed workout session.
 * Uses duration (primary), body weight, and a small volume bonus for heavy sessions.
 */
export function estimateWorkoutCaloriesBurn(
    workout: Pick<Workout, 'duration' | 'totalVolume' | 'exercises'>,
    weightKg: number
): number {
    const safeWeight = weightKg > 0 ? weightKg : 75;
    const durationMinutes = Math.max(1, Math.round((workout.duration || 0) / 60));

    // (MET × 3.5 × kg) / 200 = kcal per minute
    const caloriesPerMin = (STRENGTH_TRAINING_MET * 3.5 * safeWeight) / 200;
    let burn = caloriesPerMin * durationMinutes;

    const volume = workout.totalVolume ?? 0;
    // ~2 kcal per 1,000 lbs moved — rewards heavier overall sessions
    if (volume > 0) {
        burn += volume * 0.002;
    }

    const completedSets = workout.exercises.reduce(
        (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
        0
    );
    // Light bump for high set count (more time under tension than a quick session)
    if (completedSets >= 12) burn += Math.min(40, completedSets * 1.5);

    return Math.max(1, Math.round(burn));
}
