import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Post } from '@/types/social';
import { FeedStore } from './FeedStore';
import { WorkoutMilestone } from '@/features/workout/workoutMilestones';

export type WorkoutPostPreview = {
    workoutId: string;
    title: string;
    duration: number;
    exercisesCount: number;
    totalVolume: number;
    setsCompleted: number;
    milestones?: WorkoutMilestone[];
};

export function buildWorkoutPostCaption(data: WorkoutPostPreview): string {
    const milestoneLabels = (data.milestones ?? []).slice(0, 2).map((m) => m.label);
    if (milestoneLabels.length > 0) {
        return milestoneLabels.join(' · ');
    }
    return '';
}

/** Hide legacy auto-captions that repeat stats already shown on the workout card. */
export function shouldShowWorkoutPostCaption(description: string | undefined): boolean {
    const d = description?.trim();
    if (!d) return false;
    if (/^Just finished .+ · \d+ min/.test(d)) return false;
    return true;
}

export function getWorkoutPostPreview(
    workout: {
        id: string;
        name: string;
        duration?: number;
        totalVolume?: number;
        exercises: { name: string; sets: { completed: boolean }[] }[];
    },
    milestones?: WorkoutMilestone[]
): WorkoutPostPreview {
    let setsCompleted = 0;
    for (const ex of workout.exercises) {
        setsCompleted += ex.sets.filter((s) => s.completed).length;
    }
    return {
        workoutId: workout.id,
        title: workout.name,
        duration: workout.duration ?? 0,
        exercisesCount: workout.exercises.length,
        totalVolume: workout.totalVolume ?? 0,
        setsCompleted,
        milestones,
    };
}

type PostAuthor = {
    id: string;
    displayName?: string;
    name?: string;
    avatar?: string;
    dorm?: string;
};

export async function publishWorkoutPost(
    user: PostAuthor,
    preview: WorkoutPostPreview,
    options?: { caption?: string; image?: string; shareToCommunity?: boolean }
): Promise<Post> {
    const caption = options?.caption?.trim() || buildWorkoutPostCaption(preview);

    const newPost: Post = {
        id: uuidv4(),
        userId: user.id,
        userName: user.displayName || user.name || 'FitVerse User',
        userImage: user.avatar,
        userDorm: user.dorm,
        type: 'workout',
        content: {
            description: caption,
            image: options?.image,
            workoutId: preview.workoutId,
            workoutData: {
                title: preview.title,
                duration: preview.duration,
                exercisesCount: preview.exercisesCount,
                totalVolume: preview.totalVolume,
                setsCompleted: preview.setsCompleted,
            },
        },
        likes: [],
        comments: [],
        createdAt: new Date().toISOString(),
        isPublic: options?.shareToCommunity ?? false,
    };

    await FeedStore.savePost(newPost);
    return newPost;
}
