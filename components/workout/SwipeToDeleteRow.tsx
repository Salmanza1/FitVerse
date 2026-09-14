import React, { useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, Text } from 'react-native';
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

/** How far the row has to travel before letting go deletes it. */
const SWIPE_DELETE_THRESHOLD = 56;
/** A quick flick counts even if it did not travel the full distance. */
const FLING_VELOCITY = 0.4;
const FLING_MIN_DISTANCE = 28;
/** Movement below this is a tap or the start of a scroll, not a swipe. */
const CLAIM_DISTANCE = 6;
/**
 * How much more horizontal than vertical the movement has to be before the row
 * takes the gesture. The list scrolls vertically, so a drag that is at all
 * ambiguous has to stay with the scroll view.
 */
const CLAIM_RATIO = 1.5;

export function SwipeToDeleteRow({
    children,
    onDelete,
    enabled = true,
    deleteLabel = 'Delete set',
    contentBackgroundColor = 'transparent',
}: Props) {
    const translateX = useRef(new Animated.Value(0)).current;

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                /**
                 * Claimed on the capture phase so the row wins the gesture
                 * from the scrolling list rather than waiting for it to
                 * decline. Without this the swipe only registered once the
                 * list had already decided the drag was not a scroll, which
                 * is what made deleting a set feel like a fight.
                 */
                onMoveShouldSetPanResponderCapture: (_, gesture) => {
                    if (!enabled) return false;
                    const { dx, dy } = gesture;
                    return Math.abs(dx) > CLAIM_DISTANCE && Math.abs(dx) > Math.abs(dy) * CLAIM_RATIO;
                },
                onMoveShouldSetPanResponder: (_, gesture) => {
                    if (!enabled) return false;
                    const { dx, dy } = gesture;
                    return Math.abs(dx) > CLAIM_DISTANCE && Math.abs(dx) > Math.abs(dy) * CLAIM_RATIO;
                },
                onPanResponderMove: (_, gesture) => {
                    translateX.setValue(gesture.dx);
                },
                onPanResponderRelease: (_, gesture) => {
                    const far = Math.abs(gesture.dx) >= SWIPE_DELETE_THRESHOLD;
                    const flung =
                        Math.abs(gesture.vx) >= FLING_VELOCITY &&
                        Math.abs(gesture.dx) >= FLING_MIN_DISTANCE;
                    if (far || flung) {
                        const direction = gesture.dx > 0 ? 1 : -1;
                        Animated.timing(translateX, {
                            toValue: direction * 420,
                            duration: 180,
                            useNativeDriver: true,
                        }).start(() => {
                            onDelete();
                            translateX.setValue(0);
                        });
                        return;
                    }
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        friction: 8,
                    }).start();
                },
                onPanResponderTerminate: () => {
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
                },
            }),
        [enabled, onDelete, translateX]
    );

    const deleteOpacity = translateX.interpolate({
        inputRange: [-100, -40, 0, 40, 100],
        outputRange: [1, 0.5, 0, 0.5, 1],
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.wrapper}>
            <Animated.View style={[styles.deleteBg, { opacity: deleteOpacity }]}>
                <FontAwesome name="trash" size={16} color={C.textPrimary} />
                <Text style={styles.deleteText}>{deleteLabel}</Text>
            </Animated.View>
            <Animated.View
                style={[styles.content, { backgroundColor: contentBackgroundColor, transform: [{ translateX }] }]}
                {...panResponder.panHandlers}
            >
                {children}
            </Animated.View>
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
