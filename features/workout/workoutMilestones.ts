import { Workout, Exercise } from '@/types/workout';

export type WorkoutMilestone = {
    type: 'first_workout' | 'volume_pr' | 'exercise_pr' | 'weekly_streak';
    label: string;
    priority: number;
};

const WEEKLY_STREAK_THRESHOLDS = [3, 5, 10] as const;

function completedMaxWeight(exercise: Exercise): number {
    const weights = exercise.sets
        .filter((s) => s.completed)
        .map((s) => s.weight || 0);
    return weights.length ? Math.max(...weights) : 0;
}

function historicalMaxWeight(priorWorkouts: Workout[], exerciseName: string): number {
    let max = 0;
    for (const workout of priorWorkouts) {
        const match = workout.exercises.find((ex) => ex.name === exerciseName);
        if (match) max = Math.max(max, completedMaxWeight(match));
    }
    return max;
}

function sessionsInLast7Days(priorWorkouts: Workout[], current: Workout): number {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return [...priorWorkouts, current].filter((w) => new Date(w.date).getTime() >= cutoff).length;
}

function formatWeight(weight: number): string {
    const rounded = Math.round(weight * 100) / 100;
    return String(rounded);
}

/** Compare finished session against history logged *before* this save. */
export function detectWorkoutMilestones(
    workout: Workout,
    priorWorkouts: Workout[]
): WorkoutMilestone[] {
    const milestones: WorkoutMilestone[] = [];

    if (priorWorkouts.length === 0) {
        milestones.push({
            type: 'first_workout',
            label: 'First workout logged on FitVerse',
            priority: 100,
        });
    }

    const sessionVolume = workout.totalVolume ?? 0;
    const priorMaxVolume = priorWorkouts.reduce(
        (max, w) => Math.max(max, w.totalVolume ?? 0),
        0
    );
    if (sessionVolume > 0 && sessionVolume > priorMaxVolume) {
        milestones.push({
            type: 'volume_pr',
            label: `Session volume PR — ${sessionVolume.toLocaleString()} lbs`,
            priority: 90,
        });
    }

    const exercisePrs: WorkoutMilestone[] = [];
    for (const ex of workout.exercises) {
        const sessionMax = completedMaxWeight(ex);
        if (sessionMax <= 0) continue;
        const priorMax = historicalMaxWeight(priorWorkouts, ex.name);
        if (sessionMax > priorMax) {
            const isFirstLog = priorMax === 0;
            exercisePrs.push({
                type: 'exercise_pr',
                label: isFirstLog
                    ? `New lift logged — ${ex.name} ${formatWeight(sessionMax)} lbs`
                    : `${ex.name} PR — ${formatWeight(sessionMax)} lbs`,
                priority: 70 + sessionMax / 1000,
            });
        }
    }
    exercisePrs.sort((a, b) => b.priority - a.priority);
    milestones.push(...exercisePrs.slice(0, 2));

    const weeklyCount = sessionsInLast7Days(priorWorkouts, workout);
    for (const threshold of WEEKLY_STREAK_THRESHOLDS) {
        if (weeklyCount === threshold) {
            milestones.push({
                type: 'weekly_streak',
                label: `${threshold} workouts this week`,
                priority: 50 + threshold,
            });
            break;
        }
    }

    return milestones.sort((a, b) => b.priority - a.priority);
}
