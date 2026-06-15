import { supabase } from '../../lib/supabase';
import { DailyLog, FoodItem, MealType, LoggedFoodItem } from '../../types/nutrition';
import { UserProfile } from '../../types/user';
import { calculateTargets } from '../../lib/nutrition';

/**
 * NutritionStore — Supabase-backed nutrition logging.
 *
 * DB schema:
 *   nutrition_logs { id, user_id, date (DATE), log_data (JSONB), created_at, updated_at }
 *   UNIQUE(user_id, date) — one log row per user per day, upserted
 *
 * The entire DailyLog object is stored as JSONB in `log_data`.
 * This is intentional: nutrition data is deeply personal and changes many
 * times per day. A JSONB column avoids complex relational queries while
 * keeping the data in the cloud.
 */

/** Returns a blank DailyLog skeleton for a given date */
const emptyLog = (date: string): DailyLog => ({
    date,
    meals: {
        Breakfast: [],
        Brunch: [],
        Lunch: [],
        'Late Lunch': [],
        Dinner: [],
        Snack: [],
    },
    totals: { 
        calories: 0, 
        protein: 0, 
        carbs: 0, 
        fat: 0,
        daily_goal: 0,
        food_calories: 0,
        manual_exercise_calories: 0,
        workout_calories: 0,
        synced_calorie_adjustment: 0,
        total_exercise_calories: 0,
        net_calories: 0,
        remaining_calories: 0,
        protein_goal_g: 0,
        carb_goal_g: 0,
        fat_goal_g: 0
    },
});

/** Fetch (or initialise) a daily nutrition log */
export const getDailyLog = async (userId: string, date: string, profile?: UserProfile): Promise<DailyLog> => {
    try {
        const { data, error } = await supabase
            .from('nutrition_logs')
            .select('log_data')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle();

        if (error) throw error; 

        if (data?.log_data) {
            const log = data.log_data as DailyLog;
            const meals = log.meals || {} as any;
            const allMeals: MealType[] = ['Breakfast', 'Brunch', 'Lunch', 'Late Lunch', 'Dinner', 'Snack'];
            allMeals.forEach(m => { if (!meals[m]) meals[m] = []; });
            log.meals = meals;

            // Legacy: gym sessions used to write to manual_exercise_calories
            let migratedLegacyBurn = false;
            if (log.totals.workout_calories == null && (log.totals.manual_exercise_calories || 0) > 0) {
                log.totals.workout_calories = log.totals.manual_exercise_calories;
                log.totals.manual_exercise_calories = 0;
                migratedLegacyBurn = true;
            }

            log.totals = recalculateTotals(log, profile);
            if (migratedLegacyBurn) {
                upsertLog(userId, log).catch(() => {});
            }
            return log;
        }

        const freshLog = emptyLog(date);
        if (profile) {
            freshLog.totals = recalculateTotals(freshLog, profile);
        }
        return freshLog;
    } catch (e) {
        console.error('NutritionStore.getDailyLog error:', e);
        return emptyLog(date);
    }
};

/** Persist the full DailyLog to Supabase (upsert) */
const upsertLog = async (userId: string, log: DailyLog): Promise<void> => {
    const { error } = await supabase.from('nutrition_logs').upsert(
        {
            user_id: userId,
            date: log.date,
            log_data: log,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date' }
    );
    if (error) throw error;
};

/** Add a food item to a given meal in a given day */
export const addFoodToLog = async (
    userId: string,
    date: string,
    meal: MealType,
    food: FoodItem,
    quantity: number = 1,
    amount?: number,
    unit?: string,
    profile?: UserProfile
): Promise<DailyLog> => {
    const currentLog = await getDailyLog(userId, date, profile);

    const loggedItem: LoggedFoodItem = {
        ...food,
        quantity,
        amount: amount ?? food.baseAmount ?? 1,
        unit: unit ?? food.baseUnit ?? 'serving',
        loggedAt: new Date().toISOString(),
    };

    currentLog.meals[meal].push(loggedItem);

    // Recalculate totals from scratch to avoid floating-point drift
    currentLog.totals = recalculateTotals(currentLog, profile);

    await upsertLog(userId, currentLog);
    return currentLog;
};

/** Remove a food item from a given meal by index */
export const removeFoodFromLog = async (
    userId: string,
    date: string,
    meal: MealType,
    foodIndex: number,
    profile?: UserProfile
): Promise<DailyLog> => {
    const currentLog = await getDailyLog(userId, date, profile);

    if (!currentLog.meals[meal]?.[foodIndex]) return currentLog;

    currentLog.meals[meal].splice(foodIndex, 1);
    currentLog.totals = recalculateTotals(currentLog, profile);

    await upsertLog(userId, currentLog);
    return currentLog;
};

/** Update an existing food item in a given meal by index */
export const updateFoodInLog = async (
    userId: string,
    date: string,
    meal: MealType,
    foodIndex: number,
    updates: Partial<LoggedFoodItem>,
    profile?: UserProfile
): Promise<DailyLog> => {
    const currentLog = await getDailyLog(userId, date, profile);

    if (!currentLog.meals[meal]?.[foodIndex]) return currentLog;

    currentLog.meals[meal][foodIndex] = { ...currentLog.meals[meal][foodIndex], ...updates };
    currentLog.totals = recalculateTotals(currentLog, profile);

    await upsertLog(userId, currentLog);
    return currentLog;
};

/** Add manually logged exercise calories (outside FitVerse workouts) */
export const addExerciseCaloriesToLog = async (
    userId: string,
    date: string,
    calories: number,
    profile?: UserProfile
): Promise<DailyLog> => {
    const currentLog = await getDailyLog(userId, date, profile);
    currentLog.totals.manual_exercise_calories = (currentLog.totals.manual_exercise_calories || 0) + calories;
    currentLog.totals = recalculateTotals(currentLog, profile);
    await upsertLog(userId, currentLog);
    return currentLog;
};

/** Add calories burned from a completed FitVerse gym session */
export const addWorkoutCaloriesToLog = async (
    userId: string,
    date: string,
    calories: number,
    profile?: UserProfile
): Promise<DailyLog> => {
    const currentLog = await getDailyLog(userId, date, profile);
    currentLog.totals.workout_calories = (currentLog.totals.workout_calories || 0) + calories;
    currentLog.totals = recalculateTotals(currentLog, profile);
    await upsertLog(userId, currentLog);
    return currentLog;
};

/** Clear the entire log for a given date */
export const clearLog = async (userId: string, date: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('nutrition_logs')
            .delete()
            .eq('user_id', userId)
            .eq('date', date);
        if (error) throw error;
    } catch (e) {
        console.error('NutritionStore.clearLog error:', e);
    }
};

/** Get nutrition logs for the past N days (for history/charts) */
export const getRecentLogs = async (userId: string, days: number = 7): Promise<DailyLog[]> => {
    try {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceStr = since.toISOString().slice(0, 10);

        const { data, error } = await supabase
            .from('nutrition_logs')
            .select('log_data')
            .eq('user_id', userId)
            .gte('date', sinceStr)
            .order('date', { ascending: false });

        if (error) throw error;
        return (data ?? []).map((row: any) => row.log_data as DailyLog).filter(Boolean);
    } catch (e) {
        console.error('NutritionStore.getRecentLogs error:', e);
        return [];
    }
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Recalculate totals from the ground up by iterating all meals */
export const recalculateTotals = (log: DailyLog, profile?: UserProfile) => {
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    const allMeals: MealType[] = ['Breakfast', 'Brunch', 'Lunch', 'Late Lunch', 'Dinner', 'Snack'];

    allMeals.forEach(meal => {
        (log.meals[meal] || []).forEach((item: LoggedFoodItem) => {
            const qty = typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 1;
            const cals = typeof item.calories === 'number' && !isNaN(item.calories) ? item.calories : (Number(item.calories) || 0);
            const pro = typeof item.protein === 'number' && !isNaN(item.protein) ? item.protein : (Number(item.protein) || 0);
            const crb = typeof item.carbs === 'number' && !isNaN(item.carbs) ? item.carbs : (Number(item.carbs) || 0);
            const f = typeof item.fat === 'number' && !isNaN(item.fat) ? item.fat : (Number(item.fat) || 0);

            calories += cals * qty;
            protein += pro * qty;
            carbs += crb * qty;
            fat += f * qty;
        });
    });

    const food_calories = Math.round(calories);
    const manual_exercise_calories = log.totals.manual_exercise_calories || 0;
    const workout_calories = log.totals.workout_calories || 0;
    const synced_calorie_adjustment = log.totals.synced_calorie_adjustment || 0;
    
    // Apply negative adjustment rule
    let effective_synced = synced_calorie_adjustment;
    if (synced_calorie_adjustment < 0 && profile && !profile.enableNegativeAdjustments) {
        effective_synced = 0;
    }

    const total_exercise_calories = workout_calories + manual_exercise_calories + effective_synced;
    const net_calories = food_calories - total_exercise_calories;

    // Get targets from profile or use previous
    let daily_goal = log.totals.daily_goal || 2000;
    let protein_goal = log.totals.protein_goal_g || 0;
    let carb_goal = log.totals.carb_goal_g || 0;
    let fat_goal = log.totals.fat_goal_g || 0;

    if (profile) {
        const targets = calculateTargets(
            profile.gender,
            profile.weightKg,
            profile.heightCm,
            profile.age,
            profile.activityLevel,
            profile.goal,
            profile.weeklyGoalRate
        );
        daily_goal = targets.calories;
        protein_goal = targets.protein;
        carb_goal = targets.carbs;
        fat_goal = targets.fat;
    }

    const remaining_calories = daily_goal - net_calories;

    return {
        calories: food_calories,
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        daily_goal,
        food_calories,
        manual_exercise_calories,
        workout_calories,
        synced_calorie_adjustment,
        total_exercise_calories,
        net_calories,
        remaining_calories,
        protein_goal_g: protein_goal,
        carb_goal_g: carb_goal,
        fat_goal_g: fat_goal
    };
};
