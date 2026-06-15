import { supabase } from '@/lib/supabase';

export type WorkoutDayStatus = 'not_done' | 'in_progress' | 'completed' | 'rest_day';

export interface MemberWorkoutStatus {
    userId: string;
    status: WorkoutDayStatus;
    workoutName?: string;
    exerciseName?: string;
    setsCompleted?: number;
    startedAt?: string;
}

function todayDateString(): string {
    return new Date().toISOString().split('T')[0];
}

function isActiveSession(startedAt?: string | null): boolean {
    if (!startedAt) return false;
    const started = new Date(startedAt).getTime();
    const fourHoursMs = 4 * 60 * 60 * 1000;
    return Date.now() - started < fourHoursMs;
}

export async function declareRestDay(userId: string, date = todayDateString()): Promise<void> {
    const { error } = await supabase.from('user_rest_days').upsert({
        user_id: userId,
        rest_date: date,
    });
    if (error) console.warn('[Presence] declareRestDay failed:', error.message);
}

export async function clearRestDay(userId: string, date = todayDateString()): Promise<void> {
    const { error } = await supabase
        .from('user_rest_days')
        .delete()
        .eq('user_id', userId)
        .eq('rest_date', date);
    if (error) console.warn('[Presence] clearRestDay failed:', error.message);
}

export async function isUserOnRestDay(userId: string, date = todayDateString()): Promise<boolean> {
    const { data } = await supabase
        .from('user_rest_days')
        .select('user_id')
        .eq('user_id', userId)
        .eq('rest_date', date)
        .maybeSingle();
    return !!data;
}

export async function setWorkoutActive(userId: string, workoutName: string): Promise<void> {
    await clearRestDay(userId);
    const now = new Date().toISOString();
    const { error } = await supabase.from('workout_live_status').upsert({
        user_id: userId,
        status: 'active',
        workout_name: workoutName,
        exercise_name: null,
        sets_completed: 0,
        started_at: now,
        updated_at: now,
    });
    if (error) console.warn('[Presence] setWorkoutActive failed:', error.message);
}

export async function updateWorkoutProgress(
    userId: string,
    workoutName: string,
    exerciseName: string,
    setsCompleted: number
): Promise<void> {
    const { error } = await supabase
        .from('workout_live_status')
        .update({
            status: 'active',
            workout_name: workoutName,
            exercise_name: exerciseName,
            sets_completed: setsCompleted,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    if (error) console.warn('[Presence] updateWorkoutProgress failed:', error.message);
}

export async function clearWorkoutActive(userId: string): Promise<void> {
    const { error } = await supabase.from('workout_live_status').upsert({
        user_id: userId,
        status: 'idle',
        workout_name: null,
        exercise_name: null,
        sets_completed: 0,
        started_at: null,
        updated_at: new Date().toISOString(),
    });
    if (error) console.warn('[Presence] clearWorkoutActive failed:', error.message);
}

/** Resolve today's workout status for a set of users (e.g. group chat members). */
export async function getMemberWorkoutStatuses(
    userIds: string[]
): Promise<Record<string, MemberWorkoutStatus>> {
    const result: Record<string, MemberWorkoutStatus> = {};
    if (userIds.length === 0) return result;

    for (const id of userIds) {
        result[id] = { userId: id, status: 'not_done' };
    }

    const today = todayDateString();

    const [liveRes, logsRes, restRes] = await Promise.all([
        supabase
            .from('workout_live_status')
            .select('user_id, status, workout_name, exercise_name, sets_completed, started_at')
            .in('user_id', userIds),
        supabase
            .from('workout_logs')
            .select('user_id')
            .in('user_id', userIds)
            .eq('date', today),
        supabase
            .from('user_rest_days')
            .select('user_id')
            .in('user_id', userIds)
            .eq('rest_date', today),
    ]);

    const completedToday = new Set((logsRes.data ?? []).map((r) => r.user_id));
    const restToday = new Set((restRes.data ?? []).map((r) => r.user_id));

    for (const row of liveRes.data ?? []) {
        if (row.status === 'active' && isActiveSession(row.started_at)) {
            result[row.user_id] = {
                userId: row.user_id,
                status: 'in_progress',
                workoutName: row.workout_name ?? undefined,
                exerciseName: row.exercise_name ?? undefined,
                setsCompleted: row.sets_completed ?? 0,
                startedAt: row.started_at ?? undefined,
            };
        }
    }

    for (const id of userIds) {
        if (result[id].status === 'in_progress') continue;
        if (completedToday.has(id)) {
            result[id] = { userId: id, status: 'completed' };
            continue;
        }
        if (restToday.has(id)) {
            result[id] = { userId: id, status: 'rest_day' };
        }
    }

    return result;
}

export const WORKOUT_STATUS_COLORS = {
    not_done: '#ff6b6b',
    in_progress: '#f1c40f',
    completed: '#51cf66',
    rest_day: '#b197fc',
} as const;

export const WORKOUT_STATUS_LABELS = {
    not_done: 'Not yet today',
    in_progress: 'Working out',
    completed: 'Done today',
    rest_day: 'Rest day',
} as const;
