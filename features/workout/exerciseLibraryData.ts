import { ExerciseLibraryEntry } from './exerciseTypes';

/** Canonical naming: "Exercise Name (Equipment)" */
function ex(
    name: string,
    category: string,
    primary: string[],
    secondary: string[] = []
): ExerciseLibraryEntry {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return {
        id,
        name,
        category,
        primaryMuscles: primary,
        secondaryMuscles: secondary.length ? secondary : undefined,
    };
}

const RAW: ExerciseLibraryEntry[] = [
    // ─── CHEST ───
    ex('Bench Press (Barbell)', 'Chest', ['chest'], ['triceps', 'shoulders']),
    ex('Bench Press (Dumbbell)', 'Chest', ['chest'], ['triceps', 'shoulders']),
    ex('Bench Press - Close Grip (Barbell)', 'Chest', ['chest', 'triceps'], ['shoulders']),
    ex('Bench Press - Incline (Barbell)', 'Chest', ['chest'], ['triceps', 'shoulders']),
    ex('Bench Press - Incline (Dumbbell)', 'Chest', ['chest'], ['triceps', 'shoulders']),
    ex('Bench Press - Decline (Barbell)', 'Chest', ['chest'], ['triceps']),
    ex('Chest Fly (Dumbbell)', 'Chest', ['chest']),
    ex('Chest Fly (Cable)', 'Chest', ['chest']),
    ex('Chest Fly (Machine)', 'Chest', ['chest']),
    ex('Cable Crossover (Cable)', 'Chest', ['chest']),
    ex('Push Up (Bodyweight)', 'Chest', ['chest'], ['triceps', 'shoulders']),
    ex('Push Up - Incline (Bodyweight)', 'Chest', ['chest'], ['triceps']),
    ex('Dips (Bodyweight)', 'Chest', ['chest', 'triceps'], ['shoulders']),
    ex('Dips - Assisted (Machine)', 'Chest', ['chest', 'triceps']),
    ex('Pec Deck (Machine)', 'Chest', ['chest']),
    ex('Landmine Press (Barbell)', 'Chest', ['chest', 'shoulders'], ['triceps']),

    // ─── BACK ───
    ex('Deadlift (Barbell)', 'Back', ['back', 'glutes', 'hamstrings'], ['forearms', 'lower_back']),
    ex('Deadlift - Romanian (Barbell)', 'Back', ['hamstrings', 'glutes'], ['back', 'lower_back']),
    ex('Deadlift - Sumo (Barbell)', 'Back', ['back', 'glutes', 'hamstrings']),
    ex('Row - Bent Over (Barbell)', 'Back', ['back'], ['biceps', 'forearms']),
    ex('Row - Bent Over (Dumbbell)', 'Back', ['back'], ['biceps']),
    ex('Row - Seated Cable (Cable)', 'Back', ['back'], ['biceps']),
    ex('Row - Chest Supported (Machine)', 'Back', ['back'], ['biceps']),
    ex('Row - T-Bar (Barbell)', 'Back', ['back'], ['biceps']),
    ex('Row - Meadows (Barbell)', 'Back', ['back'], ['biceps']),
    ex('Lat Pulldown (Cable)', 'Back', ['back'], ['biceps']),
    ex('Lat Pulldown - Close Grip (Cable)', 'Back', ['back'], ['biceps']),
    ex('Pull Up (Bodyweight)', 'Back', ['back'], ['biceps']),
    ex('Chin Up (Bodyweight)', 'Back', ['back', 'biceps']),
    ex('Pull Up - Assisted (Machine)', 'Back', ['back'], ['biceps']),
    ex('Pullover (Dumbbell)', 'Back', ['back', 'chest']),
    ex('Pullover (Cable)', 'Back', ['back']),
    ex('Face Pull (Cable)', 'Back', ['back', 'shoulders']),
    ex('Shrug (Barbell)', 'Back', ['traps'], ['forearms']),
    ex('Shrug (Dumbbell)', 'Back', ['traps']),
    ex('Hyperextension (Bodyweight)', 'Back', ['lower_back', 'glutes']),
    ex('Good Morning (Barbell)', 'Back', ['lower_back', 'hamstrings']),

    // ─── SHOULDERS ───
    ex('Overhead Press (Barbell)', 'Shoulders', ['shoulders'], ['triceps']),
    ex('Overhead Press (Dumbbell)', 'Shoulders', ['shoulders'], ['triceps']),
    ex('Overhead Press - Seated (Dumbbell)', 'Shoulders', ['shoulders'], ['triceps']),
    ex('Arnold Press (Dumbbell)', 'Shoulders', ['shoulders'], ['triceps']),
    ex('Lateral Raise (Dumbbell)', 'Shoulders', ['shoulders']),
    ex('Lateral Raise (Cable)', 'Shoulders', ['shoulders']),
    ex('Lateral Raise (Machine)', 'Shoulders', ['shoulders']),
    ex('Front Raise (Dumbbell)', 'Shoulders', ['shoulders']),
    ex('Front Raise (Cable)', 'Shoulders', ['shoulders']),
    ex('Rear Delt Fly (Dumbbell)', 'Shoulders', ['shoulders']),
    ex('Rear Delt Fly (Cable)', 'Shoulders', ['shoulders']),
    ex('Rear Delt Fly (Machine)', 'Shoulders', ['shoulders']),
    ex('Upright Row (Barbell)', 'Shoulders', ['shoulders', 'traps'], ['biceps']),
    ex('Upright Row (Cable)', 'Shoulders', ['shoulders', 'traps']),

    // ─── LEGS ───
    ex('Squat (Barbell)', 'Legs', ['quads', 'glutes'], ['hamstrings', 'lower_back', 'core']),
    ex('Squat (Dumbbell)', 'Legs', ['quads', 'glutes']),
    ex('Squat - Front (Barbell)', 'Legs', ['quads'], ['core', 'glutes']),
    ex('Squat - Goblet (Dumbbell)', 'Legs', ['quads', 'glutes']),
    ex('Squat - Box (Barbell)', 'Legs', ['quads', 'glutes']),
    ex('Leg Press (Machine)', 'Legs', ['quads'], ['glutes', 'hamstrings']),
    ex('Hack Squat (Machine)', 'Legs', ['quads'], ['glutes']),
    ex('Leg Extension (Machine)', 'Legs', ['quads']),
    ex('Leg Curl - Lying (Machine)', 'Legs', ['hamstrings']),
    ex('Leg Curl - Seated (Machine)', 'Legs', ['hamstrings']),
    ex('Lunge (Barbell)', 'Legs', ['quads', 'glutes'], ['hamstrings']),
    ex('Lunge (Dumbbell)', 'Legs', ['quads', 'glutes']),
    ex('Walking Lunge (Dumbbell)', 'Legs', ['quads', 'glutes']),
    ex('Bulgarian Split Squat (Dumbbell)', 'Legs', ['quads', 'glutes']),
    ex('Step Up (Dumbbell)', 'Legs', ['quads', 'glutes']),
    ex('Hip Thrust (Barbell)', 'Legs', ['glutes'], ['hamstrings']),
    ex('Hip Thrust (Machine)', 'Legs', ['glutes']),
    ex('Glute Bridge (Barbell)', 'Legs', ['glutes']),
    ex('Calf Raise - Standing (Machine)', 'Legs', ['calves']),
    ex('Calf Raise - Seated (Machine)', 'Legs', ['calves']),
    ex('Calf Raise (Dumbbell)', 'Legs', ['calves']),
    ex('Sissy Squat (Bodyweight)', 'Legs', ['quads']),
    ex('Hip Abduction (Machine)', 'Legs', ['glutes']),
    ex('Hip Adduction (Machine)', 'Legs', ['quads']),

    // ─── ARMS — BICEPS ───
    ex('Bicep Curl (Barbell)', 'Arms', ['biceps']),
    ex('Bicep Curl (Dumbbell)', 'Arms', ['biceps']),
    ex('Bicep Curl (Cable)', 'Arms', ['biceps']),
    ex('Bicep Curl - Preacher (Barbell)', 'Arms', ['biceps']),
    ex('Bicep Curl - Preacher (Machine)', 'Arms', ['biceps']),
    ex('Bicep Curl - Incline (Dumbbell)', 'Arms', ['biceps']),
    ex('Bicep Curl - Concentration (Dumbbell)', 'Arms', ['biceps']),
    ex('Hammer Curl (Dumbbell)', 'Arms', ['biceps', 'forearms']),
    ex('Hammer Curl (Cable)', 'Arms', ['biceps', 'forearms']),
    ex('Reverse Curl (Barbell)', 'Arms', ['forearms', 'biceps']),

    // ─── ARMS — TRICEPS ───
    ex('Tricep Pushdown (Cable)', 'Arms', ['triceps']),
    ex('Tricep Pushdown - Rope (Cable)', 'Arms', ['triceps']),
    ex('Tricep Extension (Dumbbell)', 'Arms', ['triceps']),
    ex('Tricep Extension - Overhead (Dumbbell)', 'Arms', ['triceps']),
    ex('Tricep Extension - Overhead (Cable)', 'Arms', ['triceps']),
    ex('Skull Crusher (Barbell)', 'Arms', ['triceps']),
    ex('Skull Crusher (Dumbbell)', 'Arms', ['triceps']),
    ex('Close Grip Bench Press (Barbell)', 'Arms', ['triceps', 'chest']),
    ex('Tricep Kickback (Dumbbell)', 'Arms', ['triceps']),
    ex('Bench Dip (Bodyweight)', 'Arms', ['triceps']),

    // ─── CORE ───
    ex('Crunch (Bodyweight)', 'Core', ['abs']),
    ex('Crunch - Cable (Cable)', 'Core', ['abs']),
    ex('Sit Up (Bodyweight)', 'Core', ['abs']),
    ex('Leg Raise (Bodyweight)', 'Core', ['abs']),
    ex('Leg Raise - Hanging (Bodyweight)', 'Core', ['abs']),
    ex('Plank (Bodyweight)', 'Core', ['abs', 'core']),
    ex('Side Plank (Bodyweight)', 'Core', ['abs', 'core']),
    ex('Russian Twist (Bodyweight)', 'Core', ['abs']),
    ex('Russian Twist (Dumbbell)', 'Core', ['abs']),
    ex('Ab Wheel (Bodyweight)', 'Core', ['abs']),
    ex('Cable Crunch (Cable)', 'Core', ['abs']),
    ex('Wood Chop (Cable)', 'Core', ['abs', 'core']),
    ex('Pallof Press (Cable)', 'Core', ['core']),

    // ─── FULL BODY / OLYMPIC ───
    ex('Clean (Barbell)', 'Olympic', ['full_body'], ['back', 'shoulders']),
    ex('Clean and Jerk (Barbell)', 'Olympic', ['full_body']),
    ex('Snatch (Barbell)', 'Olympic', ['full_body']),
    ex('Power Clean (Barbell)', 'Olympic', ['full_body']),
    ex('Thruster (Barbell)', 'Full Body', ['full_body'], ['quads', 'shoulders']),
    ex('Thruster (Dumbbell)', 'Full Body', ['full_body']),
    ex('Kettlebell Swing (Kettlebell)', 'Full Body', ['glutes', 'hamstrings'], ['core']),
    ex('Burpee (Bodyweight)', 'Full Body', ['full_body']),
    ex('Farmers Walk (Dumbbell)', 'Full Body', ['forearms', 'core']),
    ex('Farmers Walk (Trap Bar)', 'Full Body', ['forearms', 'trap']),

    // ─── CARDIO ───
    ex('Treadmill Run (Cardio)', 'Cardio', ['cardio']),
    ex('Stationary Bike (Cardio)', 'Cardio', ['cardio']),
    ex('Elliptical (Cardio)', 'Cardio', ['cardio']),
    ex('Stair Climber (Cardio)', 'Cardio', ['cardio']),
    ex('Rowing Machine (Cardio)', 'Cardio', ['cardio', 'back']),
    ex('Jump Rope (Cardio)', 'Cardio', ['cardio']),
    ex('Battle Ropes (Cardio)', 'Cardio', ['cardio', 'shoulders']),

    // ─── OTHER / FOREARMS ───
    ex('Wrist Curl (Barbell)', 'Other', ['forearms']),
    ex('Wrist Curl (Dumbbell)', 'Other', ['forearms']),
    ex('Reverse Wrist Curl (Barbell)', 'Other', ['forearms']),
    ex('Neck Curl (Machine)', 'Other', ['other']),
];

/** Deduplicate by name and sort A→Z */
export const CANONICAL_EXERCISES: ExerciseLibraryEntry[] = Array.from(
    new Map(RAW.map((e) => [e.name, e])).values()
).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

export const EXERCISE_CATEGORIES = [
    'Arms',
    'Back',
    'Cardio',
    'Chest',
    'Core',
    'Full Body',
    'Legs',
    'Olympic',
    'Other',
    'Shoulders',
] as const;
