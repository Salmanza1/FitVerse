import { Exercise } from '@/types/workout';

export type ExerciseLibraryEntry = Partial<Exercise> & {
    id: string;
    name: string;
    category: string;
    primaryMuscles?: string[];
    secondaryMuscles?: string[];
};
