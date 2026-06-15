import { getLeprechaunResponseWithTools, Message } from '@/lib/openai';
import { resolveTrainingLocation } from '@/lib/gymContext';
import { UserProfile } from '@/types/user';
import { Workout } from '@/types/workout';
import { workoutFromAIPlan, AIWorkoutPlan } from './exerciseResolver';

export type GenerateWorkoutParams = {
    user: UserProfile;
    userMessage?: string;
    durationMinutes?: number;
    focus?: string;
};

export type GenerateWorkoutResult = {
    workout: Workout;
    unresolved: string[];
    coachMessage: string;
};

/**
 * Ask Leprechaun AI to build a structured workout using the official exercise library.
 */
export async function generateAIWorkoutPlan(params: GenerateWorkoutParams): Promise<GenerateWorkoutResult | null> {
    const { user, durationMinutes = 45, focus } = params;
    const location = resolveTrainingLocation(user);
    const userMessage =
        params.userMessage?.trim() ||
        [
            `Build me a ${durationMinutes}-minute workout for ${location}.`,
            focus ? `Focus: ${focus}.` : '',
            `Goal: ${user.goal || 'general fitness'}.`,
            `Split preference: ${user.trainingSplit || 'flexible'}.`,
            user.injuries ? `Injuries/limitations: ${user.injuries}.` : '',
            'Use only exercise names from your library list. Call start_workout when ready.',
        ]
            .filter(Boolean)
            .join(' ');

    const messages: Message[] = [{ role: 'user', content: userMessage }];

    const userContext = {
        displayName: user.displayName || user.name,
        goal: user.goal,
        trainingSplit: user.trainingSplit,
        defaultGym: user.defaultGym,
        dorm: user.dorm,
        activeTrainingLocation: location,
        experienceLevel: user.experienceLevel,
        injuries: user.injuries,
        likedExercises: user.likedExercises?.join(', '),
        dislikedExercises: user.dislikedExercises?.join(', '),
    };

    const response = await getLeprechaunResponseWithTools(messages, userContext, {
        forceWorkoutPlan: true,
    });
    if (!response || response.type !== 'action' || response.functionName !== 'start_workout') {
        return null;
    }

    const { workoutPlan, workoutType, location: aiLocation, durationMinutes: aiDuration } = response.args as {
        workoutPlan: AIWorkoutPlan;
        workoutType?: string;
        location?: string;
        durationMinutes?: number;
    };

    if (!workoutPlan?.exercises?.length) return null;

    const { workout, unresolved } = workoutFromAIPlan(workoutPlan, {
        workoutType,
        location: aiLocation || location,
        durationMinutes: aiDuration || durationMinutes,
    });

    const coachMessage = `☘️ Here's your plan: "${workout.name}" — ${workout.exercises.length} exercises for ${aiLocation || location}. Tap Start when you're ready!`;

    return { workout, unresolved, coachMessage };
}
