import { Animated } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

/**
 * Workout's header. Thin wrapper over the shared ScreenHeader so every tab
 * uses one component; kept as its own file because the screen imports it here.
 */

/** @deprecated The header is in-flow now; screens need no top padding. */
export const WORKOUT_HEADER_MAX_HEIGHT = 0;

function todayLabel() {
    return new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
}

export function WorkoutHeroHeader({
    scrollY,
    onCoachPress,
    onLibraryPress,
}: {
    scrollY?: Animated.Value;
    onCoachPress?: () => void;
    onLibraryPress?: () => void;
}) {
    return (
        <ScreenHeader
            title="Workout"
            subtitle={todayLabel()}
            scrollY={scrollY}
            actions={[
                { icon: 'sparkles-outline', label: 'AI coach', onPress: onCoachPress },
                { icon: 'list-outline', label: 'Exercise library', onPress: onLibraryPress },
            ]}
        />
    );
}
