import { UserProfile } from '@/types/user';

export type PersonalizationSnapshot = {
    firstName: string;
    displayName: string;
    goal: string;
    dorm: string;
    age: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
};

export function buildPersonalizationSnapshot(profile: UserProfile): PersonalizationSnapshot {
    const firstName = profile.name?.trim().split(/\s+/)[0] || profile.displayName || 'Student';
    return {
        firstName,
        displayName: profile.displayName,
        goal: profile.goal,
        dorm: profile.dorm,
        age: profile.age,
        calories: profile.calorieTarget,
        protein: profile.proteinTarget,
        carbs: profile.carbTarget,
        fat: profile.fatTarget,
    };
}
