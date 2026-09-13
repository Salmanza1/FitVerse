import { workoutFromAIPlan, type AIWorkoutPlan } from './exerciseResolver';
import type { Workout } from '@/types/workout';

/**
 * Routines the app ships with, so a new account has somewhere to start before
 * it has any history to build a routine from.
 *
 * Exercise names are resolved through the same path the AI coach uses, so
 * anything that drifts from the library shows up as unresolved rather than
 * silently becoming a free-text exercise with no muscles or category.
 */

export type StarterTemplate = {
    id: string;
    name: string;
    /** One line of context under the title — who it suits, or what it needs. */
    summary: string;
    plan: AIWorkoutPlan;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
    {
        id: 'starter-push',
        name: 'Push Day',
        summary: 'Chest, shoulders, triceps · full gym',
        plan: {
            name: 'Push Day',
            exercises: [
                { name: 'Bench Press (Barbell)', setsCount: 4, targetReps: '6-8' },
                { name: 'Overhead Press (Dumbbell)', setsCount: 3, targetReps: '8-10' },
                { name: 'Bench Press - Incline (Dumbbell)', setsCount: 3, targetReps: '8-12' },
                { name: 'Lateral Raise (Dumbbell)', setsCount: 3, targetReps: '12-15' },
                { name: 'Tricep Pushdown - Rope (Cable)', setsCount: 3, targetReps: '10-12' },
            ],
        },
    },
    {
        id: 'starter-pull',
        name: 'Pull Day',
        summary: 'Back and biceps · full gym',
        plan: {
            name: 'Pull Day',
            exercises: [
                { name: 'Deadlift (Barbell)', setsCount: 3, targetReps: '5' },
                { name: 'Lat Pulldown (Cable)', setsCount: 3, targetReps: '8-12' },
                { name: 'Row - Seated Cable (Cable)', setsCount: 3, targetReps: '8-12' },
                { name: 'Face Pull (Cable)', setsCount: 3, targetReps: '12-15' },
                { name: 'Bicep Curl (Dumbbell)', setsCount: 3, targetReps: '10-12' },
            ],
        },
    },
    {
        id: 'starter-legs',
        name: 'Leg Day',
        summary: 'Quads, hamstrings, calves · full gym',
        plan: {
            name: 'Leg Day',
            exercises: [
                { name: 'Squat (Barbell)', setsCount: 4, targetReps: '6-8' },
                { name: 'Deadlift - Romanian (Barbell)', setsCount: 3, targetReps: '8-10' },
                { name: 'Leg Press (Machine)', setsCount: 3, targetReps: '10-12' },
                { name: 'Leg Curl - Lying (Machine)', setsCount: 3, targetReps: '10-12' },
                { name: 'Calf Raise - Standing (Machine)', setsCount: 4, targetReps: '12-15' },
            ],
        },
    },
    {
        id: 'starter-upper',
        name: 'Upper Body',
        summary: 'Everything above the waist · full gym',
        plan: {
            name: 'Upper Body',
            exercises: [
                { name: 'Bench Press (Barbell)', setsCount: 4, targetReps: '6-8' },
                { name: 'Row - Bent Over (Barbell)', setsCount: 4, targetReps: '8-10' },
                { name: 'Overhead Press (Dumbbell)', setsCount: 3, targetReps: '8-10' },
                { name: 'Lat Pulldown (Cable)', setsCount: 3, targetReps: '10-12' },
                { name: 'Bicep Curl (Dumbbell)', setsCount: 3, targetReps: '10-12' },
                { name: 'Tricep Pushdown (Cable)', setsCount: 3, targetReps: '10-12' },
            ],
        },
    },
    {
        id: 'starter-lower',
        name: 'Lower Body',
        summary: 'Legs and glutes · full gym',
        plan: {
            name: 'Lower Body',
            exercises: [
                { name: 'Squat (Barbell)', setsCount: 4, targetReps: '6-8' },
                { name: 'Hip Thrust (Barbell)', setsCount: 3, targetReps: '8-12' },
                { name: 'Bulgarian Split Squat (Dumbbell)', setsCount: 3, targetReps: '10-12' },
                { name: 'Leg Extension (Machine)', setsCount: 3, targetReps: '12-15' },
                { name: 'Calf Raise - Seated (Machine)', setsCount: 4, targetReps: '12-15' },
            ],
        },
    },
    {
        id: 'starter-full-body',
        name: 'Full Body',
        summary: 'New to lifting · three days a week',
        plan: {
            name: 'Full Body',
            exercises: [
                { name: 'Squat - Goblet (Dumbbell)', setsCount: 3, targetReps: '10-12' },
                { name: 'Bench Press (Dumbbell)', setsCount: 3, targetReps: '10-12' },
                { name: 'Row - Seated Cable (Cable)', setsCount: 3, targetReps: '10-12' },
                { name: 'Overhead Press - Seated (Dumbbell)', setsCount: 3, targetReps: '10-12' },
                { name: 'Plank (Bodyweight)', setsCount: 3, targetReps: '30-45s' },
            ],
        },
    },
    {
        id: 'starter-dorm',
        name: 'Dorm Session',
        summary: 'No equipment · anywhere',
        plan: {
            name: 'Dorm Session',
            exercises: [
                { name: 'Push Up (Bodyweight)', setsCount: 4, targetReps: '10-20' },
                { name: 'Sissy Squat (Bodyweight)', setsCount: 3, targetReps: '12-15' },
                { name: 'Bench Dip (Bodyweight)', setsCount: 3, targetReps: '10-15' },
                { name: 'Leg Raise (Bodyweight)', setsCount: 3, targetReps: '12-15' },
                { name: 'Plank (Bodyweight)', setsCount: 3, targetReps: '30-60s' },
                { name: 'Burpee (Bodyweight)', setsCount: 3, targetReps: '10' },
            ],
        },
    },
];

/** One line naming the movements, for the card under the title. */
export function starterDetail(template: StarterTemplate): string {
    return template.plan.exercises.map((e) => e.name.replace(/\s*\([^)]*\)$/, '')).join(', ');
}

/** A fresh, unstarted workout built from a shipped routine. */
export function workoutFromStarter(template: StarterTemplate): Workout {
    const { workout } = workoutFromAIPlan(template.plan);
    return {
        ...workout,
        id: Math.random().toString(36).slice(2, 11),
        name: template.name,
        date: new Date().toISOString(),
        duration: 0,
        // workoutFromAIPlan stamps its own coach note; these are not from the coach.
        notes: undefined,
    };
}
