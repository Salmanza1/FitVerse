import { Workout, Exercise } from '@/types/workout';
import { ActivityLogEstimate } from './ActivityLogAIService';

const INTENSITY_MET: Record<string, number> = {
    light: 3.5,
    moderate: 5.5,
    vigorous: 8.0,
};

/** kcal from MET × body weight × duration (standard formula). */
export function estimateActivityCaloriesBurn(
    durationMinutes: number,
    met: number,
    weightKg: number
): number {
    const safeWeight = weightKg > 0 ? weightKg : 75;
    const mins = Math.max(1, Math.round(durationMinutes));
    const safeMet = met > 0 ? met : 5;
    return Math.max(1, Math.round(((safeMet * 3.5 * safeWeight) / 200) * mins));
}

export function activityEstimateToWorkout(
    estimate: ActivityLogEstimate,
    weightKg = 75
): Workout {
    const met = estimate.met || INTENSITY_MET[estimate.intensity] || 5.5;
    const durationSeconds = Math.round(estimate.durationMinutes * 60);
    const calories =
        estimate.caloriesBurned ?? estimateActivityCaloriesBurn(estimate.durationMinutes, met, weightKg);

    const exercise: Exercise = {
        id: `activity-${Date.now()}`,
        name: estimate.activityName,
        category: estimate.category.charAt(0).toUpperCase() + estimate.category.slice(1),
        type: 'cardio',
        sets: [
            {
                id: '1',
                weight: 0,
                reps: estimate.durationMinutes,
                completed: true,
                type: 'normal',
                previousPerformance: `${estimate.durationMinutes} min`,
            },
        ],
    };

    const noteParts = [
        'AI activity log',
        estimate.insight,
        estimate.assumptions,
        `~${calories} kcal est.`,
    ].filter(Boolean);

    return {
        id: Math.random().toString(),
        name: estimate.activityName,
        date: new Date().toISOString(),
        duration: durationSeconds,
        notes: noteParts.join(' · '),
        exercises: [exercise],
        totalVolume: 0,
    };
}

export function formatActivityLogSuccess(
    estimate: ActivityLogEstimate,
    calories: number
): string {
    return `Logged ${estimate.activityName} · ${estimate.durationMinutes} min · ~${calories} kcal`;
}
