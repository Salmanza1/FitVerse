export enum Dorm {
    ALUMNI = "Alumni",
    BADIN = "Badin",
    BAUMER = "Baumer",
    BREEN_PHILLIPS = "Breen-Phillips",
    CARROLL = "Carroll",
    CAVANAUGH = "Cavanaugh",
    DILLON = "Dillon",
    DUNCAN = "Duncan",
    DUNNE = "Dunne",
    FARLEY = "Farley",
    FISHER = "Fisher",
    FLAHERTY = "Flaherty",
    HOWARD = "Howard",
    JOHSON_FAMILY = "Johnson Family",
    KEENAN = "Keenan",
    KEOUGH = "Keough",
    KNOTT = "Knott",
    LEWIS = "Lewis",
    LYONS = "Lyons",
    MCGLINN = "McGlinn",
    MORRISSEY = "Morrissey",
    ONEILL = "O'Neill",
    PANGBORN = "Pangborn",
    PASQUERILLA_EAST = "Pasquerilla East",
    PASQUERILLA_WEST = "Pasquerilla West",
    RYAN = "Ryan",
    SIEGFRIED = "Siegfried",
    SORIN = "Sorin",
    STANFORD = "Stanford",
    WALSH = "Walsh",
    WELSH_FAMILY = "Welsh Family",
    OFF_CAMPUS = "Off-Campus",
}

export enum Goal {
    CUT = "Cut (Lose Fat)",
    MAINTAIN = "Maintain",
    LEAN_BULK = "Lean Bulk",
    BULK = "Bulk (Gain Size)",
    ENDURANCE = "Endurance / Performance",
}

export enum WeeklyGoalRate {
    LOSE_1_5_LB = "lose_1_5_lb_per_week",
    LOSE_1_0_LB = "lose_1_0_lb_per_week",
    LOSE_0_5_LB = "lose_0_5_lb_per_week",
    MAINTAIN = "maintain",
    GAIN_0_5_LB = "gain_0_5_lb_per_week",
    GAIN_1_0_LB = "gain_1_0_lb_per_week",
}

export type Gym = string;
export const DEFAULT_GYMS = {
    DUNCAN: "Duncan Student Center",
    ROCKNE: "Rockne Gym",
    HOME: "Home / Bodyweight"
} as const;

/** Day for weekly weigh-in reminder (stored as lowercase english name). */
export enum WeightCheckDay {
    SUNDAY = 'sunday',
    MONDAY = 'monday',
    TUESDAY = 'tuesday',
    WEDNESDAY = 'wednesday',
    THURSDAY = 'thursday',
    FRIDAY = 'friday',
    SATURDAY = 'saturday',
}

export const WEIGHT_CHECK_DAY_LABELS: Record<WeightCheckDay, string> = {
    [WeightCheckDay.SUNDAY]: 'Sunday',
    [WeightCheckDay.MONDAY]: 'Monday',
    [WeightCheckDay.TUESDAY]: 'Tuesday',
    [WeightCheckDay.WEDNESDAY]: 'Wednesday',
    [WeightCheckDay.THURSDAY]: 'Thursday',
    [WeightCheckDay.FRIDAY]: 'Friday',
    [WeightCheckDay.SATURDAY]: 'Saturday',
};

export const WEIGHT_CHECK_TIME_OPTIONS = (() => {
    const times: string[] = [];
    for (let h = 6; h <= 22; h++) {
        for (const m of [0, 30]) {
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            times.push(`${hh}:${mm}`);
        }
    }
    return times;
})();

export function formatWeightCheckTime12h(time24: string): string {
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${ampm}`;
}


export enum Gender {
    MALE = "Male",
    FEMALE = "Female",
}

export enum ActivityLevel {
    SEDENTARY = "Sedentary (0–1 days/week)",
    LIGHT = "Lightly Active (2–3 days/week)",
    MODERATE = "Moderately Active (4–5 days/week)",
    ACTIVE = "Active (6–7 days/week)",
}

export enum TrainingSplit {
    PPL = "Push / Pull / Legs",
    UPPER_LOWER = "Upper / Lower",
    FULL_BODY = "Full Body",
    BRO_SPLIT = "Bro Split (Body Part)",
    CUSTOM = "Custom / AI Managed",
}

export interface AICoachData {
    preferredSplit?: TrainingSplit;
    customSchedule?: string[]; // e.g. ["Push", "Pull", "Legs", "Rest"]
    trainingDayIndex?: number; // Pointer to the current day in customSchedule
    lastAiInteraction?: string; // ISO Date
    coachNotes?: string;
}

export interface UserProfile {
    id: string;
    email: string;
    displayName: string;
    name?: string;
    avatar?: string;
    phone?: string; // Stored to match against iOS contacts
    weeklyWorkoutGoal?: number;

    // Demographics / Stats
    gender: Gender;
    age: number;
    dob?: string; // ISO format YYYY-MM-DD
    heightCm: number; // Storing in CM for standard calc, can convert to FT/IN for UI
    weightKg: number; // Storing in KG, convert for UI
    activityLevel: ActivityLevel;

    // Preferences
    dorm: Dorm;
    goal: Goal;
    trainingSplit?: TrainingSplit;
    weeklyGoalRate?: WeeklyGoalRate;
    enableNegativeAdjustments?: boolean;
    defaultGym: Gym;
    aiCoachData?: AICoachData;

    // AI Context Info
    experienceLevel?: string; // e.g. "Beginner", "Advanced"
    injuries?: string; // e.g. "Shoulder pain", "Lower back tightness"
    likedExercises?: string[]; 
    dislikedExercises?: string[]; 

    // Targets (Calculated)
    proteinTarget: number; // grams
    carbTarget: number; // grams
    fatTarget: number; // grams
    calorieTarget: number; // kcal

    // Settings
    weightUnitLbs?: boolean;
    distanceUnitMi?: boolean;
    pushNotifications?: boolean;
    emailRecaps?: boolean;
    privateProfile?: boolean;

    /** Weekly weigh-in schedule (local day + HH:mm). */
    weeklyWeightCheckDay?: WeightCheckDay;
    weeklyWeightCheckTime?: string;
    weightCheckEnabled?: boolean;

    // Meta
    createdAt?: string;
    lastUsernameChange?: string;

    // Custom Content
    customExercises?: Array<{
        id: string;
        name: string;
        category: string;
        type: string;
        primaryMuscles: string[];
    }>;

    // Social
    friends?: string[]; // IDs of mutual friends
    friendRequestsSent?: string[]; // IDs of users you sent a request to
    friendRequestsReceived?: string[]; // IDs of users who sent you a request
}

export interface AuthState {
    user: UserProfile | null;
    isLoading: boolean;
}
