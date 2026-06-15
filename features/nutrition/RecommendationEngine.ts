import { FoodItem, DailyLog } from '@/types/nutrition';
import { Goal, UserProfile } from '@/types/user';

export const getRecommendedItems = (
    items: FoodItem[],
    user: UserProfile,
    dailyLog?: DailyLog | null
): FoodItem[] => {
    const goal = user.goal || 'maintain';
    const normalizedGoal = goal.toLowerCase();

    // Calculate macro deficits
    const proteinTarget = user.proteinTarget || 150;
    const currentProtein = dailyLog?.totals.protein || 0;
    const proteinDeficit = Math.max(0, proteinTarget - currentProtein);

    const calorieTarget = user.calorieTarget || 2000;
    const currentCalories = dailyLog?.totals.calories || 0;
    const caloriesRemaining = Math.max(0, calorieTarget - currentCalories);

    const junkTerms = ['pizza', 'burger', 'fries', 'nugget', 'donut', 'cookie', 'cake'];

    const scoredItems = items.map(item => {
        let score = 0;
        const nameLower = item.name.toLowerCase();
        const proteinRatio = item.calories > 0 ? (item.protein * 4) / item.calories : 0;
        const isHighProtein = proteinRatio > 0.25 || item.tags?.some(t => t.toLowerCase().includes('high protein'));

        // 1. Goal Alignment
        if (normalizedGoal.includes('cut')) {
            if (isHighProtein) score += 20;
            if (item.calories < 300) score += 10;
            if (item.calories > 600) score -= 15;
        } else if (normalizedGoal.includes('bulk')) {
            if (item.protein > 20) score += 15;
            if (item.calories > 400) score += 10;
        } else if (normalizedGoal.includes('endurance')) {
            if (item.carbs > 40) score += 15;
            if (item.protein > 15) score += 5;
        }

        // 2. Deficit Response
        if (proteinDeficit > 50 && item.protein > 20) score += 25;
        else if (proteinDeficit > 20 && item.protein > 10) score += 10;

        // 3. Quality & Source (The "Elite" factor)
        if (item.isMainItem) score += 15; // Prioritize Homestyle/Main items
        if (item.tags?.some(t => t.toLowerCase().includes('clean') || t.toLowerCase().includes('healthy'))) score += 10;

        // 4. Junk Penalty
        if (junkTerms.some(term => nameLower.includes(term))) {
            score -= 30; // Significant penalty for junk
            // Low weight/penalty reversal if bulking and desperate for calories?
            // No, the user specifically complained about pizza recommendation. Maintain elite standard.
        }

        return { item, score };
    });

    return scoredItems
        .filter(si => si.score > 0) // Only recommend things with a positive "FitVerse" score
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(si => si.item);
};
