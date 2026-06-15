export interface Post {
    id: string;
    userId: string;
    userName: string;
    userImage?: string;
    userDorm?: string;
    type: 'workout' | 'photo' | 'status';
    content: {
        description: string;
        image?: string; // Base64 or URL
        workoutId?: string;
        workoutData?: {
            title: string;
            duration: number;
            exercisesCount: number;
            totalVolume: number;
            setsCompleted?: number;
            muscleIntensities?: Record<string, number>;
        };
    };
    likes: string[]; // User IDs
    comments: Comment[];
    createdAt: string;
    isPublic: boolean;
}

export interface Comment {
    id: string;
    userId: string;
    userName: string;
    userImage?: string;
    text: string;
    createdAt: string;
}
