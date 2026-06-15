import { supabase } from '@/lib/supabase';

export type WeightCheckLog = {
    id: string;
    userId: string;
    weightKg: number;
    loggedAt: string;
    note?: string;
};

export async function logWeightCheck(
    userId: string,
    weightKg: number,
    source = 'weekly_check'
): Promise<WeightCheckLog | null> {
    const { data, error } = await supabase
        .from('weight_check_logs')
        .insert({
            user_id: userId,
            weight_kg: weightKg,
            source,
        })
        .select('id, user_id, weight_kg, logged_at, note')
        .single();

    if (error) {
        console.error('[WeightCheck] log failed:', error.message);
        return null;
    }

    return {
        id: data.id,
        userId: data.user_id,
        weightKg: Number(data.weight_kg),
        loggedAt: data.logged_at,
        note: data.note ?? undefined,
    };
}

export async function getRecentWeightChecks(userId: string, limit = 8): Promise<WeightCheckLog[]> {
    const { data, error } = await supabase
        .from('weight_check_logs')
        .select('id, user_id, weight_kg, logged_at, note')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(limit);

    if (error || !data) return [];

    return data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        weightKg: Number(row.weight_kg),
        loggedAt: row.logged_at,
        note: row.note ?? undefined,
    }));
}
