import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ModernAppBackground } from './ModernAppBackground';
import type { PersonalizationSnapshot } from '@/features/auth/personalization';
import { VisualSystem } from '@/constants/VisualSystem';

type Props = {
    snapshot: PersonalizationSnapshot;
    onComplete: () => void;
};

const STEP_MS = 1400;

function useCountUp(target: number, active: boolean, duration = 900) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!active || target <= 0) return;
        const start = Date.now();
        const tick = () => {
            const t = Math.min(1, (Date.now() - start) / duration);
            setValue(Math.round(target * t));
            if (t < 1) requestAnimationFrame(tick);
        };
        tick();
    }, [active, target, duration]);
    return value;
}

export function PersonalizingAccountLoading({ snapshot, onComplete }: Props) {
    const [step, setStep] = useState(0);
    const progress = useRef(new Animated.Value(0)).current;
    const fade = useRef(new Animated.Value(0)).current;
    const checkScale = useRef(new Animated.Value(0)).current;

    const firstName = snapshot.firstName?.trim() || snapshot.displayName || 'Irish';

    const steps = [
        { label: 'Reading your body metrics', detail: `${snapshot.age} yrs · campus stats saved` },
        { label: 'Calculating your starting plan', detail: snapshot.goal },
        { label: 'Calibrating daily macros', detail: 'Protein, carbs & fat from your goal' },
        { label: 'Implementing into your account', detail: `${snapshot.dorm} · ${snapshot.displayName}` },
    ];

    const showTargets = step >= 2;
    const targetsOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (showTargets) {
            Animated.timing(targetsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        }
    }, [showTargets, targetsOpacity]);
    const calDisplay = useCountUp(snapshot.calories, showTargets);
    const proteinDisplay = useCountUp(snapshot.protein, showTargets);
    const carbsDisplay = useCountUp(snapshot.carbs, showTargets);
    const fatDisplay = useCountUp(snapshot.fat, showTargets);

    useEffect(() => {
        Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, [fade]);

    useEffect(() => {
        if (step >= steps.length) {
            Animated.spring(checkScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
            const done = setTimeout(onComplete, 2200);
            return () => clearTimeout(done);
        }

        Animated.timing(progress, {
            toValue: (step + 1) / (steps.length + 1),
            duration: STEP_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();

        const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS);
        return () => clearTimeout(timer);
    }, [step, steps.length, progress, checkScale, onComplete]);

    const progressWidth = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const isDone = step >= steps.length;

    return (
        <View style={styles.container}>
            <ModernAppBackground minimal />
            <Animated.View style={[styles.inner, { opacity: fade }]}>
                <Text style={styles.brand}>FitVerse</Text>
                <Text style={styles.headline}>
                    {isDone ? `You're in, ${firstName} ☘️` : 'Building your personalized plan'}
                </Text>
                <Text style={styles.subhead}>
                    {isDone
                        ? 'Your targets are live in Nutrition & Workout.'
                        : 'This only happens once — tailored to you, not a template.'}
                </Text>

                <View style={styles.progressTrack}>
                    <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
                </View>

                {!isDone ? (
                    <View style={styles.stepCard}>
                        <View style={styles.stepIconWrap}>
                            <FontAwesome name="magic" size={18} color={VisualSystem.colors.gold} />
                        </View>
                        <View style={styles.stepTextWrap}>
                            <Text style={styles.stepLabel}>{steps[step]?.label}</Text>
                            <Text style={styles.stepDetail}>{steps[step]?.detail}</Text>
                        </View>
                    </View>
                ) : (
                    <Animated.View style={[styles.doneBadge, { transform: [{ scale: checkScale }] }]}>
                        <FontAwesome name="check-circle" size={48} color="#51cf66" />
                    </Animated.View>
                )}

                {(showTargets || isDone) && (
                    <Animated.View style={{ opacity: targetsOpacity, width: '100%', alignItems: 'center' }}>
                        <LinearGradient
                            colors={['rgba(212, 175, 55, 0.12)', 'rgba(255, 255, 255, 0.04)']}
                            style={styles.targetsCard}
                        >
                            <Text style={styles.targetsTitle}>Your starting targets</Text>
                            <View style={styles.calorieRow}>
                                <Text style={styles.calorieValue}>{calDisplay.toLocaleString()}</Text>
                                <Text style={styles.calorieUnit}> kcal / day</Text>
                            </View>
                            <View style={styles.macroRow}>
                                <View style={styles.macroItem}>
                                    <Text style={[styles.macroVal, { color: VisualSystem.colors.success }]}>{proteinDisplay}g</Text>
                                    <Text style={styles.macroLbl}>Protein</Text>
                                </View>
                                <View style={styles.macroItem}>
                                    <Text style={[styles.macroVal, { color: '#4dabf7' }]}>{carbsDisplay}g</Text>
                                    <Text style={styles.macroLbl}>Carbs</Text>
                                </View>
                                <View style={styles.macroItem}>
                                    <Text style={[styles.macroVal, { color: VisualSystem.colors.danger }]}>{fatDisplay}g</Text>
                                    <Text style={styles.macroLbl}>Fat</Text>
                                </View>
                            </View>
                            <Text style={styles.targetsFoot}>
                                Implemented into your profile — adjust anytime in Settings.
                            </Text>
                        </LinearGradient>
                    </Animated.View>
                )}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    inner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 32,
    },
    brand: {
        fontSize: 32,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
        marginBottom: 8,
    },
    headline: {
        fontSize: 20,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
        textAlign: 'center',
        marginBottom: 8,
    },
    subhead: {
        fontSize: 13,
        color: VisualSystem.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
        maxWidth: 320,
    },
    progressTrack: {
        width: '100%',
        maxWidth: 340,
        height: 6,
        borderRadius: 6,
        backgroundColor: VisualSystem.colors.bgMid,
        overflow: 'hidden',
        marginBottom: 24,
    },
    progressFill: {
        height: '100%',
        backgroundColor: VisualSystem.colors.gold,
        borderRadius: 6,
    },
    stepCard: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)',
        padding: 16,
        marginBottom: 16,
        minHeight: 80,
    },
    stepIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    stepTextWrap: {
        flex: 1,
    },
    stepLabel: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    stepDetail: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 13,
        lineHeight: 18,
    },
    doneBadge: {
        marginBottom: 16,
    },
    targetsCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 22,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        overflow: 'hidden',
    },
    targetsTitle: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
        color: VisualSystem.colors.goldText,
        textAlign: 'center',
        marginBottom: 12,
    },
    calorieRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    calorieValue: {
        fontSize: 40,
        fontWeight: '800',
        color: VisualSystem.colors.goldText,
    },
    calorieUnit: {
        fontSize: 15,
        color: VisualSystem.colors.textSecondary,
        fontWeight: '600',
    },
    macroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroVal: {
        fontSize: 20,
        fontWeight: '800',
    },
    macroLbl: {
        fontSize: 11,
        color: VisualSystem.colors.textSecondary,
        marginTop: 4,
        fontWeight: '600',
    },
    targetsFoot: {
        fontSize: 11,
        color: VisualSystem.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
});
