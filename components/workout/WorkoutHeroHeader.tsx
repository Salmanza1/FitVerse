import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VisualSystem } from '@/constants/VisualSystem';

/**
 * Screen header for the Workout tab.
 *
 * This used to be a 220pt photo hero with "LIFT & LOG / WORKOUT DASHBOARD" set
 * in all caps — a landing-page device that ate a third of the screen before any
 * content appeared. Apps people use every day put a compact title bar here and
 * let the content lead, so that's what this is now: a title, today's date, and
 * the two actions as icon buttons.
 *
 * The export name and props are unchanged so the screen doesn't have to care.
 */

const BAR_HEIGHT = 56;

/** @deprecated The header is in-flow now; screens need no top padding. */
export const WORKOUT_HEADER_MAX_HEIGHT = 0;

function todayLabel() {
    return new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
}

function HeaderAction({
    name,
    label,
    onPress,
}: {
    name: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress?: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onPress}
            hitSlop={8}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.55 }]}>
            <Ionicons name={name} size={22} color={VisualSystem.colors.textPrimary} />
        </Pressable>
    );
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
    const insets = useSafeAreaInsets();

    // A hairline appears only once content has scrolled under the bar, so a
    // resting screen has no line across it.
    const borderOpacity =
        scrollY?.interpolate({
            inputRange: [0, 12],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        }) ?? 1;

    return (
        <View style={[styles.wrap, { paddingTop: insets.top }]}>
            <View style={styles.bar}>
                <View style={styles.titleBlock}>
                    <Text style={styles.title}>Workout</Text>
                    <Text style={styles.subtitle}>{todayLabel()}</Text>
                </View>
                <View style={styles.actions}>
                    <HeaderAction name="sparkles-outline" label="AI coach" onPress={onCoachPress} />
                    <HeaderAction name="list-outline" label="Exercise library" onPress={onLibraryPress} />
                </View>
            </View>
            <Animated.View style={[styles.hairline, { opacity: borderOpacity }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    /**
     * In-flow, not absolute. As an absolute bar its real height was
     * insets.top + BAR_HEIGHT while the scroll view only padded by BAR_HEIGHT,
     * so on a notched phone the first card sat underneath it. Letting it take
     * part in layout removes that coordination entirely.
     */
    wrap: {
        backgroundColor: VisualSystem.colors.bgBase,
        zIndex: 10,
    },
    bar: {
        height: BAR_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: VisualSystem.spacing.lg,
    },
    titleBlock: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: VisualSystem.text.heading,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
        letterSpacing: -0.4,
    },
    subtitle: {
        fontSize: VisualSystem.text.small,
        color: VisualSystem.colors.textSecondary,
        marginTop: 1,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: VisualSystem.spacing.xs,
    },
    action: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hairline: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: VisualSystem.colors.borderSubtle,
    },
});
