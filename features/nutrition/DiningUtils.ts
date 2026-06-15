import { FoodItem, MealType } from '@/types/nutrition';
import { DINING_MENU } from '@/data/diningHalls';

export type DiningLocation = 'North' | 'South';

/**
 * Returns the current meal period based on Notre Dame dining hours (approximate).
 * Breakfast: < 11am
 * Lunch: 11am - 4:30pm
 * Dinner: 4:30pm - 9pm
 */
export const getCurrentMealPeriod = (): MealType => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
    const time = hours + minutes / 60;

    const isWeekend = day === 0 || day === 6;

    if (isWeekend) {
        // Saturday - Sunday
        if (time < 10) return 'Breakfast';
        if (time < 14) return 'Brunch';
        if (time < 16.5) return 'Late Lunch';
        return 'Dinner';
    }

    // Weekdays
    if (time < 10.5) return 'Breakfast';
    if (time < 14) return 'Lunch';
    if (time < 16.5) return 'Late Lunch';
    return 'Dinner';
};

/**
 * Filters the menu based on Location and Meal Period.
 * Handles "Both" locations and items available all day.
 */
export const getAvailableItems = (
    location: DiningLocation,
    mealPeriod: MealType,
    menu: FoodItem[] = DINING_MENU
): FoodItem[] => {
    return menu.filter(item => {
        // Check Location
        const matchesLocation = item.availableAt?.includes(location) || item.location === 'Both' || item.availableAt?.length === 2; // Fallback logic if data is messy

        // Check Meal Type
        const matchesMeal = item.mealTypes?.includes(mealPeriod);

        return matchesLocation && matchesMeal;
    });
};

/**
 * Normalizes fragmented dining station names into consistent, clean categories.
 * This simplifies navigation by grouping similar items (e.g. all drinks together).
 */
export const normalizeCategory = (category: string = 'General'): string => {
    const cat = category.toLowerCase().trim();

    // 1. BEVERAGES (DRINKING ZONE)
    if (
        cat.includes('drink') || 
        cat.includes('beverage') || 
        cat.includes('milk') || 
        cat.includes('juice') || 
        cat.includes('soda') || 
        cat.includes('water') || 
        cat.includes('coffee') || 
        cat.includes('tea') ||
        cat.includes('milk')
    ) {
        return 'BEVERAGES';
    }

    // 2. MAIN GRILL & ENTREES
    if (
        cat.includes('grill') || 
        cat.includes('entree') || 
        cat.includes('homestyle') || 
        cat.includes('main') || 
        cat.includes('pastaria') || 
        cat.includes('wok') || 
        cat.includes('bowl')
    ) {
        return 'MAIN DISHES';
    }

    // 3. SALADS & SOUPS (HEALTHY ZONE)
    if (
        cat.includes('salad') || 
        cat.includes('soup') || 
        cat.includes('green') || 
        cat.includes('veg')
    ) {
        return 'HEALTHY & FRESH';
    }

    // 4. DELI & BAKERY
    if (
        cat.includes('deli') || 
        cat.includes('sandwich') || 
        cat.includes('toast') || 
        cat.includes('bread') || 
        cat.includes('bakery')
    ) {
        return 'DELI & BAKERY';
    }

    // 5. PIZZA & ITALIAN
    if (cat.includes('pizzar') || cat.includes('pizza') || cat.includes('italian')) {
        return 'PIZZARIA';
    }

    // 6. DESSERTS & FRUIT
    if (cat.includes('dessert') || cat.includes('fruit') || cat.includes('yogurt') || cat.includes('sweet')) {
        return 'SWEETS & FRUITS';
    }

    // Fallback: Use broad STATION naming
    return category.toUpperCase();
};
