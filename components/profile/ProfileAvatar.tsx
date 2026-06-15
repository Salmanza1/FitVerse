import React from 'react';
import { View, Text, Image, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import { FitVerseTheme } from '@/constants/FitVerseTheme';

type Props = {
    uri?: string | null;
    name?: string | null;
    size?: number;
    style?: StyleProp<ImageStyle>;
};

export function ProfileAvatar({ uri, name, size = 52, style }: Props) {
    const letter = (name?.trim() || 'A').charAt(0).toUpperCase();
    const radius = size / 2;

    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={[
                    styles.image,
                    { width: size, height: size, borderRadius: radius },
                    style,
                ]}
            />
        );
    }

    return (
        <View
            style={[
                styles.fallback,
                { width: size, height: size, borderRadius: radius },
                style,
            ]}
        >
            <Text style={[styles.letter, { fontSize: size * 0.38 }]}>{letter}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    image: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.22)',
    },
    fallback: {
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.22)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    letter: {
        color: FitVerseTheme.colors.accentGold,
        fontWeight: '800',
    },
});
