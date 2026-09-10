import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ModernAppBackground } from './ModernAppBackground';
import { VisualSystem } from '@/constants/VisualSystem';

type LoadingVariant = 'fullscreen' | 'overlay';

const COACH_LINES = [
    'Showing up counts — we\'re getting your space ready.',
    'No streaks to stress about. Just your campus, your pace.',
    'Your plan is a starting guide, not a grade.',
    'Fuel, move, rest — we\'ll meet you where you are.',
];

const CAMPUS_MOMENTS = [
    '☘️ North & South Dining — real menus, real macros.',
    '☘️ Log a workout in minutes, share a win if you want.',
    '☘️ Leprechaun AI is here to explain, not guilt-trip.',
    '☘️ Dorms show up together — community, not competition.',
];

const STATUS_LABELS = [
    'Preparing FitVerse',
    'Syncing your profile',
    'Almost there',
];

type Props = {
    variant?: LoadingVariant;
    /** Shown under the brand on signup/login */
    headline?: string;
};

export function NotreDameFactLoading({
    variant = 'fullscreen',
    headline = 'Getting things ready',
}: Props) {
    const [lineIndex, setLineIndex] = useState(0);
    const [statusIndex, setStatusIndex] = useState(0);
    const fade = useRef(new Animated.Value(1)).current;
    const spin = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(1)).current;

    const lines = useRef([...COACH_LINES, ...CAMPUS_MOMENTS].sort(() => Math.random() - 0.5)).current;

    useEffect(() => {
        const spinLoop = Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 2800,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
            ])
        );
        spinLoop.start();
        pulseLoop.start();

        const interval = setInterval(() => {
            Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
                setLineIndex((i) => (i + 1) % lines.length);
                setStatusIndex((i) => (i + 1) % STATUS_LABELS.length);
                Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
            });
        }, 3200);

        return () => {
            clearInterval(interval);
            spinLoop.stop();
            pulseLoop.stop();
        };
    }, [fade, lines.length, pulse, spin]);

    const rotation = spin.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const isOverlay = variant === 'overlay';

    return (
        <View style={[styles.container, isOverlay && styles.containerOverlay]}>
            {!isOverlay && <ModernAppBackground minimal />}

            {isOverlay && <View style={styles.overlayDim} />}

            <View style={[styles.inner, isOverlay && styles.innerOverlay]}>
                <Animated.View style={[styles.logoRing, { transform: [{ scale: pulse }] }]}>
                    <LinearGradient
                        colors={['rgba(212, 175, 55, 0.35)', 'rgba(212, 175, 55, 0.08)']}
                        style={styles.logoGradient}
                    >
                        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                            <FontAwesome name="heart" size={28} color={VisualSystem.colors.gold} />
                        </Animated.View>
                    </LinearGradient>
                </Animated.View>

                <Text style={styles.brand}>FitVerse</Text>
                <Text style={styles.headline}>{headline}</Text>

                <View style={styles.statusRow}>
                    <ActivityIndicator size="small" color={VisualSystem.colors.gold} />
                    <Text style={styles.statusText}>{STATUS_LABELS[statusIndex]}…</Text>
                </View>

                <View style={styles.messageCard}>
                    <Text style={styles.messageLabel}>WHILE YOU WAIT</Text>
                    <Animated.Text style={[styles.messageText, { opacity: fade }]}>
                        {lines[lineIndex]}
                    </Animated.Text>
                </View>

                <View style={styles.dots}>
                    {[0, 1, 2].map((i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                statusIndex % 3 === i && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        justifyContent: 'center',
        alignItems: 'center',
    },
    containerOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
    },
    overlayDim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(12, 35, 64, 0.92)',
    },
    inner: {
        alignItems: 'center',
        paddingHorizontal: 32,
        width: '100%',
        maxWidth: 400,
    },
    innerOverlay: {
        flex: 1,
        justifyContent: 'center',
    },
    logoRing: {
        marginBottom: 20,
    },
    logoGradient: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.45)',
    },
    brand: {
        fontSize: 36,
        fontWeight: '900',
        color: VisualSystem.colors.textPrimary,
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    headline: {
        fontSize: 15,
        color: VisualSystem.colors.textSecondary,
        fontWeight: '600',
        marginBottom: 20,
        textAlign: 'center',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 24,
    },
    statusText: {
        color: VisualSystem.colors.goldText,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    messageCard: {
        width: '100%',
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        paddingVertical: 22,
        paddingHorizontal: 22,
        minHeight: 120,
        justifyContent: 'center',
    },
    messageLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: 'rgba(212, 175, 55, 0.7)',
        letterSpacing: 2,
        marginBottom: 12,
        textAlign: 'center',
    },
    messageText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 17,
        lineHeight: 26,
        textAlign: 'center',
        fontWeight: '600',
    },
    dots: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 28,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: VisualSystem.colors.bgDeep,
    },
    dotActive: {
        backgroundColor: VisualSystem.colors.gold,
        width: 18,
    },
});
