export type MealType = 'Breakfast' | 'Brunch' | 'Lunch' | 'Late Lunch' | 'Dinner' | 'Snack';

export interface FoodItem {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    location?: string; // e.g. "North Dining Hall", "South Dining Hall"
    servingSize?: string;
    tags?: string[]; // e.g., ["Vegan", "Gluten Free", "High Protein"]
    availableAt?: ('North' | 'South')[];
    mealTypes?: MealType[];
    category?: string;
    isMainItem?: boolean;
    baseAmount?: number;
    baseUnit?: string;
}

export interface LoggedFoodItem extends FoodItem {
    quantity: number; // calculated multiplier for macros
    amount: number; // user-entered amount
    unit: string; // user-selected unit
    loggedAt: string; // ISO timestamp
}

export interface DailyLog {
    date: string; // YYYY-MM-DD
    meals: {
        [key in MealType]: LoggedFoodItem[];
    };
    totals: {
        calories: number; // Consumed food calories
        protein: number;
        carbs: number;
        fat: number;
        
        // MFP Net Calorie Model
        daily_goal: number;
        food_calories: number;
        manual_exercise_calories: number;
        /** Auto-synced from FitVerse gym session finish */
        workout_calories?: number;
        synced_calorie_adjustment: number;
        total_exercise_calories: number;
        net_calories: number;
        remaining_calories: number;
        
        // Macro Goals
        protein_goal_g: number;
        carb_goal_g: number;
        fat_goal_g: number;
    };
}
