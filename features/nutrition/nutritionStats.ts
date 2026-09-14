import type { DailyLog } from '@/types/nutrition';

/**
 * Nutrition analytics for the dining screen.
 *
 * Kept apart from the view for the same reason as profileStats: the day
 * bucketing is the fiddly part and is easier to read on its own. Dates arrive
 * as plain 'YYYY-MM-DD' and every boundary here is local.
 */

/** Days of history the trend chart shows. */
export const DAYS_SHOWN = 14;

export type Metric = 'calories' | 'protein' | 'carbs' | 'fat';

export type DayBucket = {
    /** Local midnight. */
    date: Date;
    /**
     * Whether anything was recorded that day. A day with no log is not a day
     * of eating nothing, and the two must never render the same way.
     */
    logged: boolean;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
};

export type Goals = Record<Metric, number>;

export type NutritionSummary = {
    /** DAYS_SHOWN buckets, oldest first. The last one is today. */
    days: DayBucket[];
    goals: Goals;
    /** How many of the shown days have a log at all. */
    loggedDays: number;
    /**
     * Mean over logged days only. Averaging unlogged days in as zero would
     * report a deficit nobody ate.
     */
    averages: Goals;
};

const DEFAULT_GOALS: Goals = { calories: 2000, protein: 150, carbs: 200, fat: 60 };

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Parse a log date in local time.
 *
 * `new Date('2026-09-13')` is UTC midnight, which is still the 12th anywhere
 * west of Greenwich — enough to file a day's eating under the day before.
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

const positive = (value: unknown, fallback: number): number => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function metricValue(day: DayBucket, metric: Metric): number {
    return day[metric];
}

export function summarizeNutrition(logs: DailyLog[], now: Date = new Date()): NutritionSummary {
    const today = startOfDay(now);

    const days: DayBucket[] = [];
    const byDay = new Map<number, DayBucket>();
    for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const bucket: DayBucket = {
            date,
            logged: false,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
        };
        days.push(bucket);
        byDay.set(date.getTime(), bucket);
    }

    // Goals are stored per day. The newest log that carries them wins, so the
    // line reflects the target they are on now rather than one they have left.
    let goals: Goals = { ...DEFAULT_GOALS };
    let goalsAt = -Infinity;

    for (const log of logs) {
        const date = parseLogDate(log?.date);
        if (!date) continue;
        const totals = log.totals;
        if (!totals) continue;

        if (date.getTime() > goalsAt) {
            goalsAt = date.getTime();
            goals = {
                calories: positive(totals.daily_goal, DEFAULT_GOALS.calories),
                protein: positive(totals.protein_goal_g, DEFAULT_GOALS.protein),
                carbs: positive(totals.carb_goal_g, DEFAULT_GOALS.carbs),
                fat: positive(totals.fat_goal_g, DEFAULT_GOALS.fat),
            };
        }

        const bucket = byDay.get(date.getTime());
        if (!bucket) continue;

        const calories = Math.max(0, Number(totals.food_calories ?? totals.calories) || 0);
        const protein = Math.max(0, Number(totals.protein) || 0);
        const carbs = Math.max(0, Number(totals.carbs) || 0);
        const fat = Math.max(0, Number(totals.fat) || 0);

        // A stored log whose totals are all zero is a day that was opened but
        // never eaten from; treating it as logged would draw a zero bar.
        if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) continue;

        bucket.logged = true;
        bucket.calories = calories;
        bucket.protein = protein;
        bucket.carbs = carbs;
        bucket.fat = fat;
    }

    const logged = days.filter((d) => d.logged);
    const mean = (metric: Metric) =>
        logged.length === 0
            ? 0
            : Math.round(logged.reduce((acc, d) => acc + d[metric], 0) / logged.length);

    return {
        days,
        goals,
        loggedDays: logged.length,
        averages: {
            calories: mean('calories'),
            protein: mean('protein'),
            carbs: mean('carbs'),
            fat: mean('fat'),
        },
    };
}

/** `1,850` for calories, `142g` for a macro. */
export function formatMetric(value: number, metric: Metric): string {
    const rounded = Math.round(value);
    if (metric === 'calories') return rounded.toLocaleString();
    return `${rounded}g`;
}
