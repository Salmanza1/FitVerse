import { supabase } from '../../lib/supabase';
import { Workout } from '../../types/workout';

/**
 * WorkoutStore — Supabase-backed workout history & templates.
 *
 * DB schema:
 *   workout_logs     { id, user_id, name, date, duration, notes, exercises (JSONB),
 *                      total_volume, muscle_intensities, created_at }
 *   workout_templates { id, user_id, name, exercises (JSONB), created_at }
 */

// Helper: map a Supabase row → Workout
const mapWorkout = (row: any): Workout | null => {
    if (!row) return null;
    
    // Parse exercises and ensure they have a default type if missing (for legacy data)
    let rawEx = Array.isArray(row.exercises) ? row.exercises : (row.exercises ? JSON.parse(row.exercises) : []);
    const exercises = rawEx.map((ex: any) => ({
        ...ex,
        type: ex.type || 'weight_reps',
        sets: (ex.sets || []).map((s: any) => ({
            ...s,
            type: s.type || 'normal'
        }))
    }));

    return {
        id: row.id,
        name: row.name,
        date: row.date,
        duration: row.duration ?? 0,
        notes: row.notes ?? undefined,
        exercises: exercises,
        totalVolume: row.total_volume ?? 0,
        muscleIntensities: row.muscle_intensities ? (typeof row.muscle_intensities === 'string' ? JSON.parse(row.muscle_intensities) : row.muscle_intensities) : undefined,
    };
};

/** Save a completed workout to Supabase */
export const saveWorkout = async (workout: Workout, userId: string): Promise<void> => {
    try {
        const { error } = await supabase.from('workout_logs').insert({
            user_id: userId,
            name: workout.name,
            date: workout.date ? new Date(workout.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            duration: Math.round(workout.duration),
            notes: workout.notes || null,
            exercises: JSON.stringify(workout.exercises), // Explicitly stringify for JSONB
            total_volume: Math.round(workout.totalVolume ?? 0),
            muscle_intensities: workout.muscleIntensities ? JSON.stringify(workout.muscleIntensities) : null,
        });
        if (error) throw error;
    } catch (e) {
        console.error('WorkoutStore.saveWorkout error:', e);
        throw e;
    }
};

/** Get all workout history for a user, newest first */
export const getWorkoutHistory = async (userId: string): Promise<Workout[]> => {
    try {
        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data ?? []).map(mapWorkout).filter((w): w is Workout => w !== null);
    } catch (e) {
        console.error('WorkoutStore.getWorkoutHistory error:', e);
        return [];
    }
};

/** Get workout history filtered to a specific date (YYYY-MM-DD) */
export const getWorkoutsByDate = async (userId: string, date: string): Promise<Workout[]> => {
    try {
        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data ?? []).map(mapWorkout).filter((w): w is Workout => w !== null);
    } catch (e) {
        console.error('WorkoutStore.getWorkoutsByDate error:', e);
        return [];
    }
};

/** Get workout history for the past N days */
export const getRecentWorkouts = async (userId: string, days: number = 30): Promise<Workout[]> => {
    try {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceStr = since.toISOString().slice(0, 10);

        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('user_id', userId)
            .gte('date', sinceStr)
            .order('date', { ascending: false });

        if (error) throw error;
        return (data ?? []).map(mapWorkout).filter((w): w is Workout => w !== null);
    } catch (e) {
        console.error('WorkoutStore.getRecentWorkouts error:', e);
        return [];
    }
};

/** Get the total number of workouts logged by a user */
export const getWorkoutHistoryCount = async (userId: string): Promise<number> => {
    try {
        const { count, error } = await supabase
            .from('workout_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (error) throw error;
        return count || 0;
    } catch (e) {
        console.error('WorkoutStore.getWorkoutHistoryCount error:', e);
        return 0;
    }
};

/** Delete a workout log entry */
export const deleteWorkout = async (workoutId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('workout_logs')
            .delete()
            .eq('id', workoutId);
        if (error) throw error;
    } catch (e) {
        console.error('WorkoutStore.deleteWorkout error:', e);
        throw e;
    }
};

/** Get the most recent instance of a specific workout by name */
export const getLastWorkoutByName = async (userId: string, workoutName: string): Promise<Workout | null> => {
    try {
        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('name', workoutName)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .maybeSingle();

        if (error) throw error;
        return mapWorkout(data);
    } catch (e) {
        console.error('WorkoutStore.getLastWorkoutByName error:', e);
        return null;
    }
};

/** Sticky note from the most recent workout that logged this exercise. */
export const getLatestStickyNoteForExercise = async (
    userId: string,
    exerciseId: string,
    exerciseName: string
): Promise<string | null> => {
    try {
        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(15);

        if (error) throw error;
        if (!data) return null;

        for (const log of data) {
            const exercises = Array.isArray(log.exercises)
                ? log.exercises
                : log.exercises
                  ? JSON.parse(log.exercises)
                  : [];
            const match = exercises.find(
                (ex: { id?: string; name?: string; stickyNote?: string }) =>
                    (ex.id === exerciseId || ex.name === exerciseName) && ex.stickyNote?.trim()
            );
            if (match?.stickyNote?.trim()) return match.stickyNote.trim();
        }
        return null;
    } catch (e) {
        console.error('WorkoutStore.getLatestStickyNoteForExercise error:', e);
        return null;
    }
};

/** Get the sets from the MOST RECENT completed workout that contained a specific exercise_id or name */
export const getLatestSetsForExercise = async (userId: string, exerciseId: string, exerciseName: string): Promise<any[] | null> => {
    try {
        // We search by name as a fallback for custom exercises, but prioritize ID
        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('user_id', userId)
            // Filter JSONB exercises array to find at least one entry matching the ID or Name
            // We use a broader fetch and filter in JS for reliability with JSONB arrays
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(10); // Check last 10 workouts to find it

        if (error) throw error;
        if (!data) return null;

        for (const log of data) {
            const exercises = Array.isArray(log.exercises) ? log.exercises : (log.exercises ? JSON.parse(log.exercises) : []);
            const match = exercises.find((ex: any) => ex.id === exerciseId || ex.name === exerciseName);
            if (match && match.sets) {
                return match.sets;
            }
        }
        return null;
    } catch (e) {
        console.error('WorkoutStore.getLatestSetsForExercise error:', e);
        return null;
    }
};

// ─── Templates ────────────────────────────────────────────────────────────────

/** Save a workout as a reusable template */
export const saveTemplate = async (template: Workout, userId: string): Promise<void> => {
    try {
        const { error } = await supabase.from('workout_templates').insert({
            user_id: userId,
            name: template.name || 'Untitled Template',
            exercises: JSON.stringify(template.exercises),
        });
        if (error) throw error;
    } catch (e) {
        console.error('WorkoutStore.saveTemplate error:', e);
        throw e;
    }
};

/** Get all of a user's saved workout templates */
export const getTemplates = async (userId: string): Promise<Workout[]> => {
    try {
        const { data, error } = await supabase
            .from('workout_templates')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data ?? []).map(row => mapWorkout({ ...row, date: row.created_at })).filter((w): w is Workout => w !== null);
    } catch (e) {
        console.error('WorkoutStore.getTemplates error:', e);
        return [];
    }
};

/** Delete a workout template */
export const deleteTemplate = async (templateId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('workout_templates')
            .delete()
            .eq('id', templateId);
        if (error) throw error;
    } catch (e) {
        console.error('WorkoutStore.deleteTemplate error:', e);
        throw e;
    }
};
/** Get historical progress for a specific exercise */
export const getExerciseProgress = async (userId: string, exerciseName: string): Promise<{ date: string, maxWeight: number, volume: number }[]> => {
    try {
        const { data, error } = await supabase
            .from('workout_logs')
            .select('date, exercises')
            .eq('user_id', userId)
            .order('date', { ascending: true });

        if (error) throw error;
        if (!data) return [];

        const progress: { date: string, maxWeight: number, volume: number }[] = [];

        for (const log of data) {
            const exercises = Array.isArray(log.exercises) ? log.exercises : (log.exercises ? JSON.parse(log.exercises) : []);
            const match = exercises.find((ex: any) => ex.name === exerciseName);
            if (match && match.sets && match.sets.length > 0) {
                const weights = match.sets.map((s: any) => parseFloat(s.weight) || 0);
                const maxW = Math.max(...weights);
                const vol = match.sets.reduce((acc: number, s: any) => acc + ((parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)), 0);
                
                progress.push({
                    date: log.date,
                    maxWeight: maxW,
                    volume: vol
                });
            }
        }
        return progress;
    } catch (e) {
        console.error('WorkoutStore.getExerciseProgress error:', e);
        return [];
    }
};

/** Get a list of all unique exercise names the user has performed */
export const getPerformedExercises = async (userId: string): Promise<string[]> => {
    try {
        const { data, error } = await supabase
            .from('workout_logs')
            .select('exercises')
            .eq('user_id', userId);

        if (error) throw error;
        const names = new Set<string>();
        (data || []).forEach(log => {
            const exercises = Array.isArray(log.exercises) ? log.exercises : (log.exercises ? JSON.parse(log.exercises) : []);
            exercises.forEach((ex: any) => names.add(ex.name));
        });
        return Array.from(names).sort();
    } catch (e) {
        console.error('WorkoutStore.getPerformedExercises error:', e);
        return [];
    }
};
