import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, ActivityIndicator, Animated } from 'react-native';
import Colors from '@/constants/Colors';
import { Tokens } from '@/constants/Tokens';
import { VisualSystem } from '@/constants/VisualSystem';
import { useColorScheme } from 'react-native';

interface StyledButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'glass';
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
}

export function StyledButton({ title, onPress, variant = 'primary', loading = false, disabled = false, style }: StyledButtonProps) {
    const colorScheme = useColorScheme();
    const themeColors = Colors[colorScheme ?? 'light'];
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    const getBackgroundColor = () => {
        if (variant === 'primary') return themeColors.tint;
        if (variant === 'secondary') return VisualSystem.colors.navy;
        if (variant === 'glass') return themeColors.glass;
        return 'transparent';
    };

    const getTextColor = () => {
        if (variant === 'outline' || variant === 'glass') return VisualSystem.colors.goldText;
        // Primary sits on gold, where white fails contrast — navy is the readable pair.
        if (variant === 'primary') return VisualSystem.colors.textOnGold;
        return VisualSystem.colors.textOnNavy;
    };

    return (
        <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={loading || disabled}
                style={({ pressed }) => [
                    styles.button,
                    {
                        backgroundColor: getBackgroundColor(),
                        borderColor: themeColors.tint,
                        borderWidth: (variant === 'outline' || variant === 'glass') ? 1 : 0,
                        opacity: loading ? 0.6 : 1,
                    }
                ]}
            >
                {loading ? (
                    <ActivityIndicator color={getTextColor()} />
                ) : (
                    <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
                )}
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    button: {
        width: '100%',
        paddingVertical: Tokens.spacing.lg,
        paddingHorizontal: Tokens.spacing.xl,
        borderRadius: Tokens.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Tokens.spacing.md,
        // Soft, modern shadow — navy-tinted; black reads as grime on a light page.
        shadowColor: VisualSystem.colors.navy,
        shadowOffset: {
            width: 0,
            height: 5,
        },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 3,
    },
    text: {
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    }
});
