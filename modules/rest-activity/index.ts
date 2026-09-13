import { Platform } from 'react-native';
import { NativeModule, requireOptionalNativeModule } from 'expo';

/**
 * The rest timer's Live Activity — the Dynamic Island countdown.
 *
 * Every call is best-effort. The activity is a convenience; being *told* rest
 * is over is the scheduled notification's job, so nothing here throws and
 * nothing here is awaited by the timer.
 */

declare class RestActivityModule extends NativeModule {
    areActivitiesEnabled(): boolean;
    start(
        workoutName: string,
        exerciseName: string,
        startedAtMs: number,
        endsAtMs: number
    ): boolean;
    end(): void;
}

// Optional: the native side only exists in a build that included the widget
// target, and never on Android or web. Missing means "no Live Activity", not
// a crash on import.
const native =
    Platform.OS === 'ios' ? requireOptionalNativeModule<RestActivityModule>('RestActivity') : null;

export function areLiveActivitiesAvailable(): boolean {
    try {
        return native?.areActivitiesEnabled() ?? false;
    } catch {
        return false;
    }
}

export function startRestActivity(options: {
    workoutName: string;
    exerciseName: string;
    startedAt: number;
    endsAt: number;
}): void {
    try {
        native?.start(
            options.workoutName || 'Workout',
            options.exerciseName || 'Next set',
            options.startedAt,
            options.endsAt
        );
    } catch {
        // A Live Activity that fails to start changes nothing about the workout.
    }
}

export function endRestActivity(): void {
    try {
        native?.end();
    } catch {
        // ignore
    }
}
