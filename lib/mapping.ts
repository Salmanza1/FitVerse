import { UserProfile } from '../types/user';

/**
 * Maps a Supabase 'profiles' row (snake_case) to our frontend UserProfile type (camelCase)
 */
export const mapProfile = (data: any): UserProfile => ({
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    name: data.name,
    avatar: data.avatar,
    phone: data.phone,
    weeklyWorkoutGoal: data.weekly_workout_goal,
    gender: data.gender,
    age: data.age,
    dob: data.dob,
    heightCm: data.height_cm,
    weightKg: data.weight_kg,
    activityLevel: data.activity_level,
    dorm: data.dorm,
    goal: data.goal,
    defaultGym: data.default_gym,
    proteinTarget: data.protein_target,
    carbTarget: data.carb_target,
    fatTarget: data.fat_target,
    calorieTarget: data.calorie_target,
    weeklyGoalRate: data.weekly_goal_rate,
    trainingSplit: data.training_split,
    aiCoachData: data.ai_coach_data,
    enableNegativeAdjustments: data.enable_negative_adjustments,
    weightUnitLbs: data.weight_unit_lbs,
    distanceUnitMi: data.distance_unit_mi,
    pushNotifications: data.push_notifications,
    emailRecaps: data.email_recaps,
    privateProfile: data.private_profile,
    weeklyWeightCheckDay: data.weekly_weight_check_day,
    weeklyWeightCheckTime: data.weekly_weight_check_time,
    weightCheckEnabled: data.weight_check_enabled,
    createdAt: data.created_at,
    lastUsernameChange: data.last_username_change,
    friends: [], // Populated separately
});

/**
 * Maps a frontend UserProfile partial to a Supabase 'profiles' update payload (snake_case)
 */
export const mapProfileUpdate = (updates: Partial<UserProfile>): any => {
    const payload: any = {};

    // Auth & Identity
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.displayName !== undefined) payload.display_name = updates.displayName;
    if (updates.avatar !== undefined) payload.avatar = updates.avatar;
    if (updates.phone !== undefined) payload.phone = updates.phone;

    // Stats & Goals
    if (updates.age !== undefined) payload.age = updates.age;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.heightCm !== undefined) payload.height_cm = updates.heightCm;
    if (updates.weightKg !== undefined) payload.weight_kg = updates.weightKg;
    if (updates.activityLevel !== undefined) payload.activity_level = updates.activityLevel;
    if (updates.dorm !== undefined) payload.dorm = updates.dorm;
    if (updates.goal !== undefined) payload.goal = updates.goal;
    if (updates.defaultGym !== undefined) payload.default_gym = updates.defaultGym;
    if (updates.weeklyWorkoutGoal !== undefined) payload.weekly_workout_goal = updates.weeklyWorkoutGoal;
    if (updates.weeklyGoalRate !== undefined) payload.weekly_goal_rate = updates.weeklyGoalRate;
    if (updates.trainingSplit !== undefined) payload.training_split = updates.trainingSplit;
    if (updates.aiCoachData !== undefined) payload.ai_coach_data = updates.aiCoachData;
    if (updates.enableNegativeAdjustments !== undefined) payload.enable_negative_adjustments = updates.enableNegativeAdjustments;
    if (updates.dob !== undefined) payload.dob = updates.dob;

    // Macro Targets
    if (updates.proteinTarget !== undefined) payload.protein_target = updates.proteinTarget;
    if (updates.carbTarget !== undefined) payload.carb_target = updates.carbTarget;
    if (updates.fatTarget !== undefined) payload.fat_target = updates.fatTarget;
    if (updates.calorieTarget !== undefined) payload.calorie_target = updates.calorieTarget;

    // Settings
    if (updates.weightUnitLbs !== undefined) payload.weight_unit_lbs = updates.weightUnitLbs;
    if (updates.distanceUnitMi !== undefined) payload.distance_unit_mi = updates.distanceUnitMi;
    if (updates.pushNotifications !== undefined) payload.push_notifications = updates.pushNotifications;
    if (updates.emailRecaps !== undefined) payload.email_recaps = updates.emailRecaps;
    if (updates.privateProfile !== undefined) payload.private_profile = updates.privateProfile;
    if (updates.weeklyWeightCheckDay !== undefined) payload.weekly_weight_check_day = updates.weeklyWeightCheckDay;
    if (updates.weeklyWeightCheckTime !== undefined) payload.weekly_weight_check_time = updates.weeklyWeightCheckTime;
    if (updates.weightCheckEnabled !== undefined) payload.weight_check_enabled = updates.weightCheckEnabled;

    return payload;
};
