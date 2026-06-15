import React from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    ImageBackground,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Text } from '@/components/Themed';
import { VisualSystem } from '@/constants/VisualSystem';

export const WORKOUT_HEADER_MAX_HEIGHT = 280;

type WorkoutHeroHeaderProps = {
    scrollY: Animated.Value;
    onCoachPress: () => void;
    onLibraryPress: () => void;
};

export function WorkoutHeroHeader({
    scrollY,
    onCoachPress,
    onLibraryPress,
}: WorkoutHeroHeaderProps) {
    const insets = useSafeAreaInsets();
    const HEADER_MIN_HEIGHT = insets.top + 70;
    const HEADER_SCROLL_DISTANCE = WORKOUT_HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

    const headerHeight = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [WORKOUT_HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
        extrapolate: 'clamp',
    });

    const imageOpacity = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
        outputRange: [1, 1, 0.4],
        extrapolate: 'clamp',
    });

    const imageTranslateY = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [0, -50],
        extrapolate: 'clamp',
    });

    const headerBgOpacity = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const titleScale = scrollY.interpolate({
        inputRange: [-100, 0, HEADER_SCROLL_DISTANCE],
        outputRange: [1.1, 1, 0.85],
        extrapolate: 'clamp',
    });

    return (
        <Animated.View
            style={[
                styles.heroContainer,
                {
                    height: headerHeight,
                    zIndex: 10,
                },
            ]}
        >
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    { transform: [{ translateY: imageTranslateY }], opacity: imageOpacity },
                ]}
            >
                <ImageBackground
                    source={require('@/assets/images/workout_hero_fitverse.png')}
                    style={styles.heroImage}
                >
                    <LinearGradient
                        colors={['rgba(12,35,64,0.15)', 'rgba(12,35,64,0.92)']}
                        style={StyleSheet.absoluteFill}
                    />
                </ImageBackground>
            </Animated.View>

            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        backgroundColor: 'rgba(12, 35, 64, 0.85)',
                        opacity: headerBgOpacity,
                        borderBottomWidth: 1,
                        borderBottomColor: VisualSystem.colors.borderGold,
                    },
                ]}
            />

            <View style={[styles.heroContent, { paddingTop: insets.top + 10 }]}>
                <Animated.View style={{ transform: [{ scale: titleScale }] }}>
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={styles.heroTitle}>LIFT & LOG</Text>
                            <Text style={styles.heroSubtitle}>WORKOUT DASHBOARD</Text>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.actionBtn} onPress={onCoachPress} activeOpacity={0.85}>
                                <FontAwesome name="magic" size={13} color={VisualSystem.colors.gold} />
                                <Text style={styles.actionText}>COACH</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={onLibraryPress} activeOpacity={0.85}>
                                <FontAwesome name="list" size={13} color={VisualSystem.colors.gold} />
                                <Text style={styles.actionText}>LIBRARY</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    heroContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        overflow: 'hidden',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroContent: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: 25,
        paddingBottom: 15,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: VisualSystem.colors.gold,
        letterSpacing: 1,
    },
    heroSubtitle: {
        fontSize: 13,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.6)',
        marginTop: -2,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: VisualSystem.colors.gold,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 5,
    },
    actionText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
    },
});
