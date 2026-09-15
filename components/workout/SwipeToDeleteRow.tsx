import React, { useCallback } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { VisualSystem } from '@/constants/VisualSystem';

const C = VisualSystem.colors;

type Props = {
    children: React.ReactNode;
    onDelete: () => void;
    enabled?: boolean;
    deleteLabel?: string;
    contentBackgroundColor?: string;
};

/** How far the row must travel before letting go deletes it. */
const DELETE_DISTANCE = 56;
/** A flick counts even when it has not travelled that far. */
const FLING_VELOCITY = 500;
const FLING_MIN_DISTANCE = 28;
/**
 * Sideways movement that activates the swipe, and vertical movement that
 * abandons it. Together these hand a vertical drag to the list and a
 * horizontal one to the row, decided natively before either starts moving.
 */
const ACTIVATE_X = 12;
const FAIL_Y = 14;

/**
 * A row that is deleted by swiping it aside.
 *
 * This used to be a PanResponder, which lost to the scrolling list it sits in:
 * the JS responder system only offers the gesture to the row after the native
 * scroll view has declined it, so a swipe scrolled the page, blurred whichever
 * weight or reps field was focused, and sprang the row back. Gesture Handler
 * recognises the direction natively and the two never both claim the drag.
 */
export function SwipeToDeleteRow({
    children,
    onDelete,
    enabled = true,
    deleteLabel = 'Delete set',
    contentBackgroundColor = 'transparent',
}: Props) {
    const translateX = useSharedValue(0);
    const remove = useCallback(() => onDelete(), [onDelete]);

    const pan = Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
        .failOffsetY([-FAIL_Y, FAIL_Y])
        .onUpdate((e) => {
            translateX.value = e.translationX;
        })
        .onEnd((e) => {
            const travelled = Math.abs(e.translationX);
            const flung = Math.abs(e.velocityX) >= FLING_VELOCITY && travelled >= FLING_MIN_DISTANCE;

            if (travelled >= DELETE_DISTANCE || flung) {
                const direction = e.translationX > 0 ? 1 : -1;
                translateX.value = withTiming(direction * 420, { duration: 160 }, (finished) => {
                    if (!finished) return;
                    runOnJS(remove)();
                    translateX.value = 0;
                });
                return;
            }

            translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
        });

    const contentStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    // The backdrop shows through in step with the row, so the action is
    // legible before the swipe is far enough to commit to it.
    const backdropStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, Math.abs(translateX.value) / DELETE_DISTANCE),
    }));

    return (
        <View style={styles.wrapper}>
            <Animated.View style={[styles.deleteBg, backdropStyle]}>
                <FontAwesome name="trash" size={16} color={C.textPrimary} />
                <Text style={styles.deleteText}>{deleteLabel}</Text>
            </Animated.View>
            <GestureDetector gesture={pan}>
                <Animated.View style={[styles.content, { backgroundColor: contentBackgroundColor }, contentStyle]}>
                    {children}
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 6,
    },
    deleteBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(140, 55, 55, 0.92)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 6,
    },
    deleteText: {
        color: C.textPrimary,
        fontWeight: '700',
        fontSize: 13,
    },
    content: {
        backgroundColor: 'transparent',
    },
});
