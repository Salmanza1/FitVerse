import { WeightCheckDay, WEIGHT_CHECK_DAY_LABELS, formatWeightCheckTime12h, WeeklyGoalRate } from '@/types/user';

const DAY_TO_JS: Record<WeightCheckDay, number> = {
    [WeightCheckDay.SUNDAY]: 0,
    [WeightCheckDay.MONDAY]: 1,
    [WeightCheckDay.TUESDAY]: 2,
    [WeightCheckDay.WEDNESDAY]: 3,
    [WeightCheckDay.THURSDAY]: 4,
    [WeightCheckDay.FRIDAY]: 5,
    [WeightCheckDay.SATURDAY]: 6,
};

/** Expo weekly trigger: 1 = Sunday … 7 = Saturday */
const DAY_TO_EXPO: Record<WeightCheckDay, number> = {
    [WeightCheckDay.SUNDAY]: 1,
    [WeightCheckDay.MONDAY]: 2,
    [WeightCheckDay.TUESDAY]: 3,
    [WeightCheckDay.WEDNESDAY]: 4,
    [WeightCheckDay.THURSDAY]: 5,
    [WeightCheckDay.FRIDAY]: 6,
    [WeightCheckDay.SATURDAY]: 7,
};

export function getExpoWeekday(day: WeightCheckDay): number {
    return DAY_TO_EXPO[day] ?? 1;
}

export function parseCheckTime(time24: string): { hour: number; minute: number } {
    const [h, m] = time24.split(':').map((x) => parseInt(x, 10));
    return { hour: h || 8, minute: m || 0 };
}

/** Next occurrence of the scheduled weigh-in (local device time). */
export function getNextWeightCheckDate(day: WeightCheckDay, time24: string, from = new Date()): Date {
    const targetDow = DAY_TO_JS[day] ?? 0;
    const { hour, minute } = parseCheckTime(time24);
    const next = new Date(from);
    next.setHours(hour, minute, 0, 0);
    const currentDow = next.getDay();
    let daysUntil = (targetDow - currentDow + 7) % 7;
    if (daysUntil === 0 && next <= from) daysUntil = 7;
    next.setDate(next.getDate() + daysUntil);
    return next;
}

export function isWeightCheckDueToday(day: WeightCheckDay, time24: string, now = new Date()): boolean {
    const targetDow = DAY_TO_JS[day] ?? 0;
    if (now.getDay() !== targetDow) return false;
    const { hour, minute } = parseCheckTime(time24);
    const start = new Date(now);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end;
}

export function formatNextCheckLabel(day: WeightCheckDay, time24: string): string {
    const next = getNextWeightCheckDate(day, time24);
    const dayName = WEIGHT_CHECK_DAY_LABELS[day];
    const isToday = next.toDateString() === new Date().toDateString();
    const prefix = isToday ? 'Today' : next.toLocaleDateString('en-US', { weekday: 'long' });
    return `${prefix} at ${formatWeightCheckTime12h(time24)}`;
}

export type WeightTrend = 'down' | 'up' | 'same' | 'first';

export function getWeightTrend(
    currentKg: number,
    previousKg: number | null,
    weeklyGoalRate?: WeeklyGoalRate
): { trend: WeightTrend; deltaLbs: number; message: string } {
    if (previousKg == null || previousKg <= 0) {
        return {
            trend: 'first',
            deltaLbs: 0,
            message: 'First weigh-in logged — we\'ll compare next week.',
        };
    }

    const deltaKg = currentKg - previousKg;
    const deltaLbs = Math.round(deltaKg * 2.20462 * 10) / 10;
    const trend: WeightTrend = Math.abs(deltaLbs) < 0.2 ? 'same' : deltaLbs < 0 ? 'down' : 'up';

    const losing = weeklyGoalRate?.startsWith('lose') ?? false;
    const gaining = weeklyGoalRate?.startsWith('gain') ?? false;

    if (trend === 'same') {
        return { trend, deltaLbs, message: 'Holding steady — consistency still counts.' };
    }
    if (losing && trend === 'down') {
        return { trend, deltaLbs, message: `${Math.abs(deltaLbs)} lbs down since last check — on track for your goal.` };
    }
    if (gaining && trend === 'up') {
        return { trend, deltaLbs, message: `+${deltaLbs} lbs since last check — building as planned.` };
    }
    if (losing && trend === 'up') {
        return { trend, deltaLbs, message: `+${deltaLbs} lbs since last check — adjust food or check in with your plan.` };
    }
    if (gaining && trend === 'down') {
        return { trend, deltaLbs, message: `${Math.abs(deltaLbs)} lbs since last check — fuel and recovery matter.` };
    }
    return {
        trend,
        deltaLbs,
        message: `${deltaLbs > 0 ? '+' : ''}${deltaLbs} lbs since your last weekly check.`,
    };
}
