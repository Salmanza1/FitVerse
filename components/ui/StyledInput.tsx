import React from 'react';
import { TextInput, StyleSheet, TextInputProps, View, Text, Platform } from 'react-native';
import { palette } from '@/constants/Colors';
import { Tokens } from '@/constants/Tokens';
import { VisualSystem } from '@/constants/VisualSystem';

interface StyledInputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: any;
}

export function StyledInput({ label, error, style, containerStyle, ...props }: StyledInputProps) {
    const themeColors = palette;

    return (
        <View style={[styles.container, containerStyle]}>
            {!!label && (
                <Text style={styles.label}>
                    {label.toUpperCase()}
                </Text>
            )}
            <TextInput
                style={[
                    styles.input,
                    {
                        // A white field on a white card is invisible — inset it.
                        backgroundColor: VisualSystem.colors.bgDeep,
                        borderColor: error
                            ? VisualSystem.colors.danger
                            : VisualSystem.colors.borderStrong,
                        color: VisualSystem.colors.textPrimary,
                    },
                    style
                ]}
                placeholderTextColor={VisualSystem.colors.textTertiary}
                autoCorrect={props.secureTextEntry ? false : props.autoCorrect}
                {...props}
            />
            {!!error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        width: '100%',
    },
    label: {
        fontSize: Tokens.typography.xs,
        fontWeight: '800',
        marginBottom: Tokens.spacing.sm,
        marginLeft: Tokens.spacing.xs,
        color: VisualSystem.colors.goldText,
        letterSpacing: 0.2,
    },
    input: {
        width: '100%',
        paddingHorizontal: Tokens.spacing.lg,
        paddingVertical: 12,
        borderRadius: Tokens.radius.md,
        fontSize: Tokens.typography.md,
        borderWidth: 1.5,
    },
    errorText: {
        color: VisualSystem.colors.danger,
        fontSize: Tokens.typography.xs,
        marginTop: Tokens.spacing.xs,
        marginLeft: Tokens.spacing.xs,
        fontWeight: '700',
    }
});
