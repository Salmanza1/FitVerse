import type { Workout } from '@/types/workout';

/**
 * Training analytics for the profile screen.
 *
 * Kept apart from the view so the bucketing is readable on its own: dates
 * arrive as plain 'YYYY-MM-DD' strings and every boundary here is a local one,
 * which is fiddlier than it looks.
 */

/** Weeks of history the profile chart shows. */
export const WEEKS_SHOWN = 12;

export type WeekBucket = {
    /** Monday 00:00, local. */
    start: Date;
    workouts: number;
    seconds: number;
    volume: number;
};

export type TrainingTotals = {
    workouts: number;
    seconds: number;
    volume: number;
};

export type TrainingSummary = {
    thisWeek: TrainingTotals;
    /** WEEKS_SHOWN buckets, oldest first. The last one is the current week. */
    weeks: WeekBucket[];
    /** Consecutive weeks with at least one session, counting back from now. */
    streakWeeks: number;
    totalWorkouts: number;
    /** The last 7 days, oldest first; true where something was logged. */
    activeDays: boolean[];
};

const DAY_MS = 86_400_000;

/**
 * Parse a log date in local time.
 *
 * `new Date('2026-09-13')` is UTC midnight, which is still the 12th anywhere
 * west of Greenwich — enough to file a Monday session under the week before.
 */
function parseLogDate(value: string | undefined): Date | null {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!m) {
        const loose = new Date(value);
        return Number.isNaN(loose.getTime()) ? null : startOfDay(loose);
    }
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday, matching how the rest of the app talks about a training week. */
function startOfWeek(date: Date): Date {
    const day = startOfDay(date);
    const mondayOffset = (day.getDay() + 6) % 7;
    day.setDate(day.getDate() - mondayOffset);
    return day;
}

export function summarizeTraining(workouts: Workout[], now: Date = new Date()): TrainingSummary {
    const currentWeek = startOfWeek(now);
    const today = startOfDay(now);

    const weeks: WeekBucket[] = [];
    const byWeek = new Map<number, WeekBucket>();
    for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
        const start = new Date(currentWeek);
        start.setDate(start.getDate() - i * 7);
        const bucket: WeekBucket = { start, workouts: 0, seconds: 0, volume: 0 };
        weeks.push(bucket);
        byWeek.set(start.getTime(), bucket);
    }

    const activeDays = new Array<boolean>(7).fill(false);
    const weeksTrained = new Set<number>();
    let totalWorkouts = 0;

    for (const workout of workouts) {
        if (workout.isTemplate) continue;
        const date = parseLogDate(workout.date);
        if (!date) continue;

        totalWorkouts += 1;
        weeksTrained.add(startOfWeek(date).getTime());

        const bucket = byWeek.get(startOfWeek(date).getTime());
        if (bucket) {
            bucket.workouts += 1;
            bucket.seconds += Math.max(0, workout.duration || 0);
            bucket.volume += Math.max(0, workout.totalVolume || 0);
        }

        // Rounded because a DST change makes a day 23 or 25 hours long.
        const daysAgo = Math.round((today.getTime() - date.getTime()) / DAY_MS);
        if (daysAgo >= 0 && daysAgo < 7) activeDays[6 - daysAgo] = true;
    }

    // An empty current week doesn't break a streak — there's still time left in
    // it. Only once it's over does a blank week count against you.
    const cursor = new Date(currentWeek);
    if (!weeksTrained.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7);
    let streakWeeks = 0;
    while (weeksTrained.has(cursor.getTime())) {
        streakWeeks += 1;
        cursor.setDate(cursor.getDate() - 7);
    }

    const current = weeks[weeks.length - 1];

    return {
        thisWeek: {
            workouts: current.workouts,
            seconds: current.seconds,
            volume: current.volume,
        },
        weeks,
        streakWeeks,
        totalWorkouts,
        activeDays,
    };
}

/** `45m`, `1h`, `4h 12m` — never `0h 45m`. */
export function formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Thousands collapse to `12.4k` so the stat row keeps its columns. */
export function formatVolume(volume: number): string {
    if (volume >= 10_000) return `${(volume / 1000).toFixed(1)}k`;
    return Math.round(volume).toLocaleString();
}
