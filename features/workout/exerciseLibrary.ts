export { CANONICAL_EXERCISES, EXERCISE_CATEGORIES } from './exerciseLibraryData';
export {
    searchExercises,
    getExercisesByCategory,
    getExerciseLibraryPromptSection,
    workoutFromAIPlan,
    formatExerciseDisplayName,
} from './exerciseResolver';
export type { AIWorkoutPlan } from './exerciseResolver';
export type { ExerciseLibraryEntry } from './exerciseTypes';

import { CANONICAL_EXERCISES } from './exerciseLibraryData';

/** Full in-app exercise library */
export const EXERCISE_LIBRARY = CANONICAL_EXERCISES;
