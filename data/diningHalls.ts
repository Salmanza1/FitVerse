import { FoodItem } from '../types/nutrition';

// Realistic ND Dining Data 
// Note: This is a simulation based on typical offerings at North (NDH) and South (SDH) Dining Halls.

export const DINING_MENU: FoodItem[] = [
    // --- BREAKFAST ---
    {
        id: 'b1', name: "Scrambled Eggs", calories: 190, protein: 14, carbs: 2, fat: 14,
        location: "North Dining Hall", servingSize: "2 eggs", tags: ["High Protein", "GF"],
        availableAt: ['North', 'South'], mealTypes: ['Breakfast']
    },
    {
        id: 'b2', name: "Oatmeal", calories: 150, protein: 5, carbs: 27, fat: 3,
        location: "Both", servingSize: "1 cup", tags: ["Vegan", "High Carb"],
        availableAt: ['North', 'South'], mealTypes: ['Breakfast']
    },
    {
        id: 'b3', name: "Turkey Sausage Links", calories: 120, protein: 12, carbs: 0, fat: 7,
        location: "South Dining Hall", servingSize: "3 links", tags: ["High Protein", "GF"],
        availableAt: ['South'], mealTypes: ['Breakfast']
    },
    {
        id: 'b4', name: "Greek Yogurt Parfait (Berry)", calories: 250, protein: 15, carbs: 35, fat: 5,
        location: "Duncan Student Center", servingSize: "1 cup", tags: ["Vegetarian"],
        availableAt: ['North', 'South'], mealTypes: ['Breakfast', 'Snack'] // Available all day often
    },
    {
        id: 'b5', name: "Hard Boiled Egg", calories: 70, protein: 6, carbs: 0, fat: 5,
        location: "Both", servingSize: "1 egg", tags: ["High Protein", "GF"],
        availableAt: ['North', 'South'], mealTypes: ['Breakfast', 'Lunch']
    },
    {
        id: 'b6', name: "Breakfast Potatoes", calories: 180, protein: 3, carbs: 30, fat: 6,
        location: "North Dining Hall", servingSize: "1/2 cup", tags: ["Vegan"],
        availableAt: ['North'], mealTypes: ['Breakfast']
    },
    {
        id: 'b7', name: "French Toast Stick", calories: 110, protein: 2, carbs: 18, fat: 4,
        location: "South Dining Hall", servingSize: "1 stick", tags: ["Vegetarian"],
        availableAt: ['South'], mealTypes: ['Breakfast']
    },
    {
        id: 'b8', name: "Banana", calories: 105, protein: 1, carbs: 27, fat: 0,
        location: "Both", servingSize: "1 medium", tags: ["Vegan", "Fruit"],
        availableAt: ['North', 'South'], mealTypes: ['Breakfast', 'Lunch', 'Dinner', 'Snack']
    },

    // --- LUNCH / DINNER (PROTEINS) ---
    {
        id: 'l1', name: "Grilled Chicken Breast", calories: 160, protein: 30, carbs: 0, fat: 4,
        location: "Both", servingSize: "1 breast (4oz)", tags: ["High Protein", "Clean", "GF"],
        availableAt: ['North', 'South'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 'l2', name: "Baked Salmon (Lemon Herb)", calories: 280, protein: 22, carbs: 0, fat: 12,
        location: "North Dining Hall", servingSize: "1 fillet (4oz)", tags: ["High Protein", "Healthy Fat", "GF"],
        availableAt: ['North'], mealTypes: ['Dinner']
    },
    {
        id: 'l3', name: "Tofu Stir Fry", calories: 210, protein: 18, carbs: 12, fat: 9,
        location: "South Dining Hall", servingSize: "1 cup", tags: ["Vegan", "Plant-Based"],
        availableAt: ['South'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 'l4', name: "Beef Burger Patty", calories: 350, protein: 25, carbs: 0, fat: 25,
        location: "Both", servingSize: "1 patty", tags: ["Bulking"],
        availableAt: ['North', 'South'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 'l5', name: "Chicken Tenders", calories: 280, protein: 18, carbs: 15, fat: 14,
        location: "North Dining Hall", servingSize: "3 tenders", tags: [],
        availableAt: ['North'], mealTypes: ['Lunch', 'Dinner'] // Often lunch at North
    },
    {
        id: 'l6', name: "Pulled Pork Sandwich", calories: 450, protein: 28, carbs: 42, fat: 18,
        location: "South Dining Hall", servingSize: "1 sandwich", tags: ["Bulking"],
        availableAt: ['South'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 'l7', name: "Quarter Dog (Hot Dog)", calories: 320, protein: 12, carbs: 22, fat: 20,
        location: "North Dining Hall", servingSize: "1 dog w/ bun", tags: [],
        availableAt: ['North'], mealTypes: ['Lunch', 'Dinner']
    },

    // --- LUNCH / DINNER (SIDES & CARBS) ---
    {
        id: 's1', name: "Brown Rice", calories: 220, protein: 4, carbs: 46, fat: 2,
        location: "Both", servingSize: "1 cup", tags: ["Clean Carb", "Vegan", "GF"],
        availableAt: ['North', 'South'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 's2', name: "Roasted Sweet Potatoes", calories: 180, protein: 2, carbs: 41, fat: 0,
        location: "South Dining Hall", servingSize: "1 cup", tags: ["Healthy Carb", "Vegan", "GF"],
        availableAt: ['South'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 's3', name: "Steamed Broccoli", calories: 50, protein: 4, carbs: 6, fat: 0,
        location: "Both", servingSize: "1 cup", tags: ["Veggie", "Vegan", "GF"],
        availableAt: ['North', 'South'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 's4', name: "Pesto Pasta", calories: 380, protein: 10, carbs: 45, fat: 18,
        location: "North Dining Hall", servingSize: "1.5 cups", tags: ["Bulking", "Vegetarian"],
        availableAt: ['North'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 's5', name: "Quinoa Salad", calories: 240, protein: 8, carbs: 32, fat: 8,
        location: "Duncan Student Center", servingSize: "1 container", tags: ["Vegan"],
        availableAt: ['North', 'South'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 's6', name: "Make Your Own Pizza", calories: 280, protein: 12, carbs: 35, fat: 10,
        location: "South Dining Hall", servingSize: "1 slice", tags: ["Vegetarian"],
        availableAt: ['South'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 's7', name: "Fries", calories: 360, protein: 4, carbs: 48, fat: 17,
        location: "Both", servingSize: "1 serving", tags: ["Vegan"],
        availableAt: ['North', 'South'], mealTypes: ['Lunch', 'Dinner']
    },
    {
        id: 's8', name: "Southwest Salad", calories: 320, protein: 10, carbs: 22, fat: 18,
        location: "North Dining Hall", servingSize: "1 bowl", tags: ["Vegetarian", "GF"],
        availableAt: ['North'], mealTypes: ['Lunch', 'Dinner']
    },
];

export const recommendMeals = (goal: 'Cut' | 'Bulk' | 'Maintain'): FoodItem[] => {
    if (goal === 'Cut') {
        // High protein (>=10g), lower calorie (<300), or Veggie
        return DINING_MENU.filter(item => (item.protein >= 10 && item.calories < 300) || item.tags?.includes("Veggie") || item.tags?.includes("Clean"));
    } else if (goal === 'Bulk') {
        // Calorie dense (>250), high carb (>30) or items marked Bulking
        return DINING_MENU.filter(item => item.calories > 250 || item.carbs > 30 || item.tags?.includes("Bulking"));
    } else {
        return DINING_MENU;
    }
};
