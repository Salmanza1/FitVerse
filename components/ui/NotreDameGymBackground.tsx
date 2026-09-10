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
import { FontAwesome } from '@expo/vector-icons';
import { VisualSystem } from '@/constants/VisualSystem';

const { width, height } = Dimensions.get('window');

const PARTICLE_COUNT = Platform.OS === 'ios' ? 40 : 25;
const SHAMROCK_COUNT = 6;
const EQUIPMENT_COUNT = 4;

const GoldDust = () => {
    const x = useMemo(() => Math.random() * width, []);
    const y = useMemo(() => Math.random() * height, []);
    const size = useMemo(() => Math.random() * 3 + 1, []);
    const opacity = useSharedValue(Math.random());

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(Math.random() < 0.5 ? 0.3 : 1, {
                duration: 2500 + Math.random() * 3500,
                easing: Easing.inOut(Easing.quad),
            }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: opacity.value }],
    }));

    return (
        <Animated.View
            style={[
                styles.dust,
                {
                    left: x,
                    top: y,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
                animatedStyle,
            ]}
        />
    );
};

const FloatingShamrock = () => {
    const x = useMemo(() => Math.random() * width, []);
    const y = useMemo(() => Math.random() * height, []);
    const size = useMemo(() => Math.random() * 20 + 20, []);
    const rotation = useSharedValue(Math.random() * 360);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(0.1 + Math.random() * 0.2);

    useEffect(() => {
        // Continuous slow rotation
        rotation.value = withRepeat(
            withTiming(rotation.value + 360, {
                duration: 15000 + Math.random() * 10000,
                easing: Easing.linear,
            }),
            -1,
            false
        );

        // Floating up and down
        translateY.value = withRepeat(
            withTiming(20, {
                duration: 4000 + Math.random() * 3000,
                easing: Easing.inOut(Easing.sin),
            }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateY: translateY.value },
            { rotate: `${rotation.value}deg` }
        ],
    }));

    return (
        <Animated.View
            style={[
                styles.shamrock,
                {
                    left: x,
                    top: y,
                },
                animatedStyle,
            ]}
        >
            <FontAwesome name="leaf" size={size} color={VisualSystem.colors.gold} />
        </Animated.View>
    );
};

const FloatingEquipment = () => {
    const x = useMemo(() => Math.random() * width, []);
    const y = useMemo(() => Math.random() * height, []);
    const size = useMemo(() => Math.random() * 20 + 20, []);
    const rotation = useSharedValue(Math.random() * 360);
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(0.05 + Math.random() * 0.1);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(rotation.value + 360, {
                duration: 20000 + Math.random() * 10000,
                easing: Easing.linear,
            }),
            -1,
            false
        );

        translateY.value = withRepeat(
            withTiming(-30, {
                duration: 5000 + Math.random() * 3000,
                easing: Easing.inOut(Easing.sin),
            }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateY: translateY.value },
            { rotate: `${rotation.value}deg` }
        ],
    }));

    return (
        <Animated.View
            style={[
                styles.equipment,
                {
                    left: x,
                    top: y,
                },
                animatedStyle,
            ]}
        >
            <FontAwesome name="bolt" size={size} color="#0C2340" />
        </Animated.View>
    );
};

const EnergyBolt = () => {
    const translateX = useSharedValue(-100);
    const translateY = useSharedValue(-100);
    const opacity = useSharedValue(0);

    useEffect(() => {
        const startAnimation = () => {
            const startX = Math.random() * width;
            const startY = Math.random() * height;

            translateX.value = startX;
            translateY.value = startY;
            opacity.value = 0;

            const delay = 5000 + Math.random() * 10000;
            const duration = 800;

            opacity.value = withDelay(
                delay,
                withTiming(0.6, { duration: 100 }, (finished) => {
                    if (finished) {
                        translateX.value = withTiming(startX + 150, { duration, easing: Easing.out(Easing.quad) });
                        translateY.value = withTiming(startY + 50, { duration, easing: Easing.out(Easing.quad) });
                        opacity.value = withTiming(0, { duration });
                    }
                })
            );

            setTimeout(startAnimation, delay + duration + 3000);
        };

        startAnimation();
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: '15deg' }
        ],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[styles.bolt, animatedStyle]}>
            <LinearGradient
                colors={['rgba(212, 175, 55, 1)', 'rgba(12, 35, 64, 0)']}
                start={[0, 0.5]}
                end={[1, 0.5]}
                style={styles.boltGradient}
            />
        </Animated.View>
    );
};

export const NotreDameGymBackground = () => {
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#FFFFFF', '#F7F9FC', '#EEF2F7']}
                style={StyleSheet.absoluteFill}
            />

            {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
                <GoldDust key={`dust-${i}`} />
            ))}

            {Array.from({ length: SHAMROCK_COUNT }).map((_, i) => (
                <FloatingShamrock key={`shamrock-${i}`} />
            ))}

            {Array.from({ length: EQUIPMENT_COUNT }).map((_, i) => (
                <FloatingEquipment key={`equip-${i}`} />
            ))}

            <EnergyBolt />
            <EnergyBolt />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    dust: {
        position: 'absolute',
        backgroundColor: VisualSystem.colors.gold,
        shadowColor: VisualSystem.colors.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 3,
    },
    shamrock: {
        position: 'absolute',
    },
    equipment: {
        position: 'absolute',
    },
    bolt: {
        position: 'absolute',
        width: 150,
        height: 3,
    },
    boltGradient: {
        flex: 1,
        borderRadius: 2,
    },
});
