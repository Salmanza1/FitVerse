import { Gender, Goal, ActivityLevel, WeeklyGoalRate } from '../types/user';

// --- BMR & activity (Mifflin–St Jeor + activity multiplier) ---

export const calculateBMR = (gender: Gender, weightKg: number, heightCm: number, age: number): number => {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return gender === Gender.MALE ? base + 5 : base - 161;
};

export const getActivityMultiplier = (level: ActivityLevel): number => {
    switch (level) {
        case ActivityLevel.SEDENTARY:
            return 1.3;
        case ActivityLevel.LIGHT:
            return 1.45;
        case ActivityLevel.MODERATE:
            return 1.6;
        case ActivityLevel.ACTIVE:
            return 1.75;
        default:
            return 1.3;
    }
};

/** ~3,500 kcal per lb — used when user picks an explicit weekly rate. */
export const getGoalAdjustment = (rate: WeeklyGoalRate): number => {
    switch (rate) {
        case WeeklyGoalRate.LOSE_1_5_LB:
            return -750;
        case WeeklyGoalRate.LOSE_1_0_LB:
            return -500;
        case WeeklyGoalRate.LOSE_0_5_LB:
            return -250;
        case WeeklyGoalRate.MAINTAIN:
            return 0;
        case WeeklyGoalRate.GAIN_0_5_LB:
            return 250;
        case WeeklyGoalRate.GAIN_1_0_LB:
            return 500;
        default:
            return 0;
    }
};

/** Default daily calorie shift when weekly rate is "maintain" — driven by main goal. */
export const getDefaultCalorieAdjustmentForGoal = (goal: Goal): number => {
    switch (goal) {
        case Goal.CUT:
            return -500;
        case Goal.BULK:
            return 500;
        case Goal.LEAN_BULK:
            return 250;
        case Goal.ENDURANCE:
        case Goal.MAINTAIN:
        default:
            return 0;
    }
};

/**
 * Weekly rate wins when set; otherwise calories follow the main fitness goal.
 */
export const getCalorieAdjustment = (goal: Goal, weeklyGoalRate: WeeklyGoalRate): number => {
    if (weeklyGoalRate !== WeeklyGoalRate.MAINTAIN) {
        return getGoalAdjustment(weeklyGoalRate);
    }
    return getDefaultCalorieAdjustmentForGoal(goal);
};

/** Protein target in g/kg body weight by goal (common coaching ranges). */
export const getProteinGramsPerKg = (goal: Goal): number => {
    switch (goal) {
        case Goal.CUT:
            return 2.2;
        case Goal.LEAN_BULK:
            return 1.8;
        case Goal.BULK:
            return 1.7;
        case Goal.ENDURANCE:
            return 1.5;
        case Goal.MAINTAIN:
        default:
            return 1.6;
    }
};

/** Share of calories *after protein* allocated to carbs (remainder goes to fat). */
const getCarbShareOfRemainder = (goal: Goal): number => {
    switch (goal) {
        case Goal.CUT:
            return 0.5;
        case Goal.ENDURANCE:
            return 0.75;
        case Goal.BULK:
        case Goal.LEAN_BULK:
            return 0.65;
        case Goal.MAINTAIN:
        default:
            return 0.55;
    }
};

const getMinCalories = (gender: Gender): number => (gender === Gender.FEMALE ? 1200 : 1500);

export const calculateTargets = (
    gender: Gender,
    weightKg: number,
    heightCm: number,
    age: number,
    activity: ActivityLevel,
    goal: Goal,
    weeklyGoalRate: WeeklyGoalRate = WeeklyGoalRate.MAINTAIN
): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    bmr: number;
    tdee: number;
    proteinPct: number;
    carbsPct: number;
    fatPct: number;
} => {
    const bmr = calculateBMR(gender, weightKg, heightCm, age);
    const tdee = bmr * getActivityMultiplier(activity);

    const adjustment = getCalorieAdjustment(goal, weeklyGoalRate);
    const calories = Math.max(getMinCalories(gender), Math.round(tdee + adjustment));

    // Protein from body weight (capped so it never dominates the whole budget)
    const proteinPerKg = getProteinGramsPerKg(goal);
    const maxProteinG = Math.floor((calories * 0.35) / 4);
    const minProteinG = Math.max(50, Math.round(weightKg * 0.8));
    let protein = Math.round(weightKg * proteinPerKg);
    protein = Math.min(Math.max(minProteinG, protein), maxProteinG);

    const proteinKcal = protein * 4;
    let remainingKcal = Math.max(0, calories - proteinKcal);

    // Minimum fat (~0.5 g/kg) for health; reduce carbs if needed
    const minFatG = Math.max(35, Math.round(weightKg * 0.5));
    const minFatKcal = minFatG * 9;
    let fat =
        remainingKcal > minFatKcal
            ? Math.round((remainingKcal * (1 - getCarbShareOfRemainder(goal))) / 9)
            : minFatG;
    fat = Math.max(minFatG, fat);
    let fatKcal = fat * 9;

    if (fatKcal > remainingKcal) {
        fat = Math.max(minFatG, Math.floor(remainingKcal / 9));
        fatKcal = fat * 9;
    }

    remainingKcal = Math.max(0, calories - proteinKcal - fatKcal);
    const carbs = Math.max(0, Math.round(remainingKcal / 4));

    const proteinPct = calories > 0 ? Math.round((proteinKcal / calories) * 100) : 0;
    const carbsPct = calories > 0 ? Math.round(((carbs * 4) / calories) * 100) : 0;
    const fatPct = calories > 0 ? Math.round((fatKcal / calories) * 100) : 0;

    return {
        calories,
        protein,
        carbs,
        fat,
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        proteinPct,
        carbsPct,
        fatPct,
    };
};

/**
 * Calculates remaining calories based on goal, consumption and exercise.
 */
export const calculateRemainingCalories = (
    goal: number,
    foodConsumed: number,
    exerciseBurned: number = 0,
    includeExercise: boolean = false
): number => {
    if (includeExercise) {
        return Math.max(0, goal - foodConsumed + exerciseBurned);
    }
    return Math.max(0, goal - foodConsumed);
};

/** UI-facing calorie budget — food vs goal with optional workout credit */
export function getNutritionBudgetView(
    totals: {
        daily_goal?: number;
        food_calories?: number;
        calories?: number;
        total_exercise_calories?: number;
        workout_calories?: number;
        remaining_calories?: number;
    },
    includeExercise: boolean
) {
    const goal = totals.daily_goal || 2000;
    const food = totals.food_calories ?? totals.calories ?? 0;
    const burned = totals.total_exercise_calories || 0;
    const workoutBurn = totals.workout_calories || 0;
    const effectiveGoal = includeExercise ? goal + burned : goal;
    const rawRemaining = includeExercise
        ? (totals.remaining_calories ?? goal - food + burned)
        : goal - food;
    const remaining = Math.round(rawRemaining);
    const isOverBudget = remaining < 0;
    const ringProgress = effectiveGoal > 0 ? Math.min(food / effectiveGoal, 1) : 0;

    return {
        goal,
        food,
        burned,
        workoutBurn,
        effectiveGoal,
        remaining,
        isOverBudget,
        overBy: isOverBudget ? Math.abs(remaining) : 0,
        ringProgress,
    };
}
