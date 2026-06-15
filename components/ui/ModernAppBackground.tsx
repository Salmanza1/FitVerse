import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { VisualSystem } from '@/constants/VisualSystem';

const { width, height } = Dimensions.get('window');

const STAR_COUNT = Platform.OS === 'ios' ? 42 : 28;
const SHOOTING_STAR_COUNT = 1;

type StarProps = { index: number; subtle?: boolean };

const Star = ({ index, subtle }: StarProps) => {
    const x = useMemo(() => Math.random() * width, []);
    const y = useMemo(() => Math.random() * height, []);
    const size = useMemo(() => (subtle ? Math.random() * 1.8 + 0.4 : Math.random() * 2.2 + 0.5), [subtle]);
    const isGold = useMemo(() => Math.random() > 0.82, []);
    const opacity = useSharedValue(0.15 + Math.random() * 0.35);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(Math.random() < 0.5 ? 0.12 : 0.75, {
                duration: 2400 + Math.random() * 4000,
                easing: Easing.inOut(Easing.sin),
            }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View
            style={[
                styles.star,
                {
                    left: x,
                    top: y,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: isGold ? '#E8D5A3' : '#FFFFFF',
                },
                animatedStyle,
            ]}
        />
    );
};

const ShootingStar = () => {
    const translateX = useSharedValue(-300);
    const translateY = useSharedValue(-300);
    const opacity = useSharedValue(0);

    useEffect(() => {
        const run = () => {
            const startX = Math.random() * (width * 0.6);
            const startY = Math.random() * (height * 0.35);
            const delay = 12000 + Math.random() * 18000;
            const duration = 900 + Math.random() * 400;

            translateX.value = startX;
            translateY.value = startY;
            opacity.value = 0;

            opacity.value = withDelay(
                delay,
                withTiming(0.85, { duration: 80 }, (finished) => {
                    if (finished) {
                        translateX.value = withTiming(startX + 220, { duration, easing: Easing.out(Easing.quad) });
                        translateY.value = withTiming(startY + 220, { duration, easing: Easing.out(Easing.quad) });
                        opacity.value = withTiming(0, { duration: duration * 0.9 });
                    }
                })
            );
            setTimeout(run, delay + duration + 4000);
        };
        run();
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: '45deg' },
        ],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[styles.shootingStar, animatedStyle]}>
            <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(212,175,55,0.35)']}
                start={[0, 0.5]}
                end={[1, 0.5]}
                style={styles.shootingStarGradient}
            />
        </Animated.View>
    );
};

/** Subtle horizontal accent — no corner orbs (they read as visible yellow circles). */
function AmbientGlows() {
    return <View style={[styles.glowLine, styles.glowLineTop]} />;
}

type ModernAppBackgroundProps = {
    /** Fewer stars + softer motion */
    minimal?: boolean;
};

/**
 * App-wide premium background: navy mesh, subtle gold accents, restrained stars.
 */
export function ModernAppBackground({ minimal }: ModernAppBackgroundProps) {
    // Web: static gradient only — Reanimated stars/gradients often render as a black void.
    if (Platform.OS === 'web') {
        return (
            <View style={styles.fullContainer} pointerEvents="none">
                <LinearGradient
                    colors={[...VisualSystem.gradient.app]}
                    style={StyleSheet.absoluteFill}
                    start={[0, 0]}
                    end={[0, 1]}
                />
                <View style={styles.webAccentBar} />
            </View>
        );
    }

    const stars = minimal ? Math.floor(STAR_COUNT * 0.5) : STAR_COUNT;

    return (
        <View style={styles.fullContainer} pointerEvents="none">
            <LinearGradient
                colors={[...VisualSystem.gradient.app]}
                style={StyleSheet.absoluteFill}
                start={[0, 0]}
                end={[0, 1]}
            />
            <AmbientGlows />
            <LinearGradient
                colors={[...VisualSystem.gradient.vignette]}
                style={StyleSheet.absoluteFill}
                start={[0, 0.5]}
                end={[0, 1]}
            />
            {Array.from({ length: stars }).map((_, i) => (
                <Star key={i} index={i} subtle={minimal} />
            ))}
            {!minimal &&
                Array.from({ length: SHOOTING_STAR_COUNT }).map((_, i) => (
                    <ShootingStar key={`shoot-${i}`} />
                ))}
        </View>
    );
}

/**
 * @deprecated Global ModernAppBackground is sufficient — kept as no-op for imports.
 */
export function WorkoutAmbientBackground() {
    return null;
}

/** Stars-only overlay for screens that supply their own base color. */
export function GymStarOverlay() {
    return (
        <View style={styles.overlayContainer} pointerEvents="none">
            {Array.from({ length: STAR_COUNT }).map((_, i) => (
                <Star key={i} index={i} subtle />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    fullContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    glowLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(212, 175, 55, 0.06)',
    },
    glowLineTop: {
        top: height * 0.12,
    },
    webAccentBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(212, 175, 55, 0.35)',
    },
    star: {
        position: 'absolute',
    },
    shootingStar: {
        position: 'absolute',
        width: 100,
        height: 1.5,
    },
    shootingStarGradient: {
        flex: 1,
        borderRadius: 1,
    },
});
