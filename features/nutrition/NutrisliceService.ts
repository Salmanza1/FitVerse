import { FoodItem, MealType } from '@/types/nutrition';
import { Platform } from 'react-native';

const API_BASE = 'https://nd.api.nutrislice.com/menu/api/weeks/school';

const HALL_IDS = {
    'North': 'north-dining-hall',
    'South': 'south-dining-hall'
};

const NUTRISLICE_PERIODS = [
    'breakfast',
    'lunch',
    'late-lunch',
    'dinner',
    'brunch',
    'all-day',
    'special'
];

export const fetchLiveMenu = async (location: 'North' | 'South', date: string): Promise<FoodItem[]> => {
    try {
        const hallId = HALL_IDS[location];
        const [year, month, day] = date.split('-');
        const allItems: FoodItem[] = [];

        // Fetch all potential periods
        const results = await Promise.all(
            NUTRISLICE_PERIODS.map(async (period) => {
                let url = `${API_BASE}/${hallId}/menu-type/${period}/${year}/${month}/${day}/?format=json`;

                if (Platform.OS === 'web') {
                    url = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                }

                try {
                    const response = await fetch(url, {
                        headers: { 'User-Agent': 'FitVerse/1.0' }
                    });
                    if (!response.ok) return [];

                    const data = await response.json();
                    const dayData = data.days?.find((d: any) => d.date === date);

                    if (!dayData || !dayData.menu_items) return [];

                    const periodItems: FoodItem[] = [];
                    let currentStation = 'General';

                    dayData.menu_items.forEach((item: any) => {
                        // Track current station header
                        if (item.is_station_header || item.is_section_title) {
                            currentStation = (item.text || 'General').trim();
                            return;
                        }

                        if (item.food && item.food.name) {
                            const food = item.food;
                            const nutrition = food.rounded_nutrition_info || food.nutrition_info || {};

                            // Map icons to tags
                            const tags = Array.isArray(food.icons?.food_icons)
                                ? food.icons.food_icons.map((icon: any) => icon.name || icon.synced_name || icon.slug).filter(Boolean)
                                : [];

                            periodItems.push({
                                id: `live-${food.id}-${location}-${period}`,
                                name: food.name,
                                calories: parseMacro(nutrition.calories),
                                protein: parseMacro(nutrition.g_protein ?? nutrition.protein),
                                carbs: parseMacro(nutrition.g_carbs ?? nutrition.carbohydrate),
                                fat: parseMacro(nutrition.g_fat ?? nutrition.total_fat),
                                servingSize: formatServingSize(food.serving_size_info),
                                baseAmount: parseFloat(food.serving_size_info?.serving_size_amount) || 1,
                                baseUnit: (food.serving_size_info?.serving_size_unit || 'serving').toLowerCase(),
                                location: `${location} Dining Hall`,
                                availableAt: [location],
                                mealTypes: mapNutrislicePeriod(period),
                                tags: Array.from(new Set(tags)),
                                category: currentStation,
                                isMainItem: currentStation === 'Homestyle' || currentStation === 'Main' || currentStation === 'Grill'
                            });
                        }
                    });

                    return periodItems;
                } catch (err) {
                    console.warn(`Failed to fetch/parse menu for ${period}:`, err);
                    return [];
                }
            })
        );

        // Flatten results
        results.forEach(items => allItems.push(...items));

        // Deduplicate items by name and location
        const uniqueItems = new Map<string, FoodItem>();
        allItems.forEach(item => {
            const existing = uniqueItems.get(item.name);
            if (!existing || (item.calories > 0 && existing.calories === 0)) {
                uniqueItems.set(item.name, item);
            } else if (existing) {
                // Combine meal types and preserve category if existing is "General"
                existing.mealTypes = Array.from(new Set([...(existing.mealTypes || []), ...(item.mealTypes || [])]));
                if (existing.category === 'General' && item.category !== 'General') {
                    existing.category = item.category;
                    existing.isMainItem = item.isMainItem;
                }
            }
        });

        return Array.from(uniqueItems.values());
    } catch (error) {
        console.error('Error fetching Nutrislice menu:', error);
        return [];
    }
};

const parseMacro = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
    if (typeof val === 'string') {
        const numeric = val.replace(/[^0-9.]/g, '');
        if (!numeric) return 0;
        const parsed = parseFloat(numeric);
        return isNaN(parsed) ? 0 : Math.round(parsed);
    }
    return 0;
};

const formatServingSize = (info: any): string => {
    if (!info) return '1 serving';
    if (typeof info === 'string') return info;
    if (typeof info === 'object') {
        const amt = info.serving_size_amount || '';
        const unit = info.serving_size_unit || '';
        return `${amt} ${unit}`.trim() || '1 serving';
    }
    return '1 serving';
};

const mapNutrislicePeriod = (period: string): MealType[] => {
    switch (period) {
        case 'breakfast': return ['Breakfast'];
        case 'brunch': return ['Brunch', 'Breakfast', 'Lunch'];
        case 'lunch': return ['Lunch'];
        case 'late-lunch': return ['Late Lunch', 'Lunch'];
        case 'dinner': return ['Dinner'];
        case 'all-day': return ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
        case 'special': return ['Snack'];
        default: return ['Snack'];
    }
};
