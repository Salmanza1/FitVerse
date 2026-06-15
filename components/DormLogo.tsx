import React, { useState } from 'react';
import { Image, View, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Dorm } from '@/types/user';
import { getDormLogoSource, resolveDormFromName } from '@/lib/dormLogo';

type Props = {
    dorm: Dorm | string;
    size?: number;
    style?: StyleProp<ImageStyle>;
};

export function DormLogo({ dorm, size = 44, style }: Props) {
    const [failed, setFailed] = useState(false);
    const dormEnum = typeof dorm === 'string' ? resolveDormFromName(dorm) : dorm;
    const source = getDormLogoSource(dormEnum);

    if (failed) {
        return (
            <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }, style]}>
                <FontAwesome name="shield" size={size * 0.45} color="#D4AF37" />
            </View>
        );
    }

    return (
        <Image
            source={source}
            style={[{ width: size, height: size }, style]}
            resizeMode="contain"
            onError={() => setFailed(true)}
        />
    );
}

const styles = StyleSheet.create({
    fallback: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.35)',
    },
});
