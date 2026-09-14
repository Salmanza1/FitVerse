import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/features/utils/DateUtils';

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
    return getLocalDateString();
}

/** Nobody is still in the same session after this long. */
const MAX_SESSION_MS = 4 * 60 * 60 * 1000;
/**
 * A live session is only believed while it keeps checking in. Every completed
 * set writes updated_at, so a row that has gone quiet for this long belongs to
 * a session the app never got to close — force quit, or a finish that failed
 * before clearWorkoutActive ran.
 */
const HEARTBEAT_MS = 90 * 60 * 1000;

const msSince = (value?: string | null): number | null => {
    if (!value) return null;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? Date.now() - t : null;
};

function isActiveSession(startedAt?: string | null, updatedAt?: string | null): boolean {
    const sinceStart = msSince(startedAt);
    if (sinceStart == null || sinceStart > MAX_SESSION_MS) return false;
    // Fall back to the start when nothing has been logged yet: a session in its
    // first minutes is real even though no set has landed.
    const sinceBeat = msSince(updatedAt) ?? sinceStart;
    return sinceBeat < HEARTBEAT_MS;
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
            .select('user_id, status, workout_name, exercise_name, sets_completed, started_at, updated_at')
            .in('user_id', userIds),
        supabase
            .from('workout_logs')
            .select('user_id, created_at')
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

    // When today's workout was saved, so a live row left behind by that same
    // session can be told apart from a genuine second one started afterwards.
    const loggedAt = new Map<string, number>();
    for (const row of logsRes.data ?? []) {
        const t = new Date((row as { created_at?: string }).created_at ?? 0).getTime();
        if (!Number.isFinite(t)) continue;
        loggedAt.set(row.user_id, Math.max(loggedAt.get(row.user_id) ?? 0, t));
    }

    for (const row of liveRes.data ?? []) {
        if (row.status !== 'active') continue;
        if (!isActiveSession(row.started_at, row.updated_at)) continue;

        // The workout was saved after this row last checked in, so the row is
        // the leftover of a session that is already finished and logged.
        const beat = new Date(row.updated_at ?? row.started_at ?? 0).getTime();
        const saved = loggedAt.get(row.user_id);
        if (saved != null && Number.isFinite(beat) && saved >= beat) continue;

        result[row.user_id] = {
            userId: row.user_id,
            status: 'in_progress',
            workoutName: row.workout_name ?? undefined,
            exerciseName: row.exercise_name ?? undefined,
            setsCompleted: row.sets_completed ?? 0,
            startedAt: row.started_at ?? undefined,
        };
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
