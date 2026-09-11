import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withSpring,
    Easing,
    interpolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { VisualSystem } from '@/constants/VisualSystem';

export const PlayLikeAChampion = () => {
    const glint = useSharedValue(-1);
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    useEffect(() => {
        // Continuous glint effect every 4 seconds
        glint.value = withRepeat(
            withTiming(2, {
                duration: 2000,
                easing: Easing.linear,
            }),
            -1,
            false
        );
    }, []);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        scale.value = withSequence(
            withSpring(1.05),
            withSpring(1)
        );
        rotation.value = withSequence(
            withSpring(2),
            withSpring(-2),
            withSpring(0)
        );
    };

    const glintStyle = useAnimatedStyle(() => {
        const translateX = interpolate(glint.value, [-1, 2], [-200, 400]);
        return {
            transform: [{ translateX }, { skewX: '-20deg' }],
        };
    });

    const animatedContainer = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: scale.value },
                { rotate: `${rotation.value}deg` }
            ],
        };
    });

    return (
        <Pressable onPress={handlePress}>
            <Animated.View style={[styles.container, animatedContainer]}>
                <LinearGradient
                    colors={['#D4AF37', VisualSystem.colors.goldText, '#D4AF37']}
                    style={styles.board}
                >
                    <View style={styles.textContainer}>
                        <Text style={styles.text}>Play like a</Text>
                        <Text style={styles.textMain}>Champion</Text>
                        <Text style={styles.text}>Today</Text>
                    </View>

                    {/* Glint Overlay */}
                    <Animated.View style={[styles.glintContainer, glintStyle]}>
                        <LinearGradient
                            colors={['transparent', 'rgba(255, 255, 255, 0.4)', 'transparent']}
                            style={StyleSheet.absoluteFill}
                            start={[0, 0]}
                            end={[1, 0]}
                        />
                    </Animated.View>

                    {/* Border Inner */}
                    <View style={styles.innerBorder} />
                </LinearGradient>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 16,
        marginVertical: 16,
        shadowColor: VisualSystem.colors.gold,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 15,
        elevation: 12,
    },
    board: {
        borderRadius: 6,
        padding: 4,
        overflow: 'hidden',
        position: 'relative',
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: VisualSystem.colors.borderStrong,
    },
    textContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 11,
        fontWeight: '800',
        color: '#000',
        letterSpacing: 0.2,
        opacity: 0.8,
    },
    textMain: {
        fontSize: 20,
        fontWeight: '800',
        color: '#000',
        letterSpacing: 0.2,
        marginVertical: 4,
    },
    glintContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 150,
        backgroundColor: 'transparent',
    },
    innerBorder: {
        position: 'absolute',
        top: 4,
        left: 4,
        right: 4,
        bottom: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        borderRadius: 6,
    }
});
