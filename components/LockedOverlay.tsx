import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, View } from './Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { palette } from '@/constants/Colors';

interface LockedOverlayProps {
    title: string;
    availableIn?: string;
    icon?: React.ComponentProps<typeof FontAwesome>['name'];
}

export function LockedOverlay({ title, availableIn = "Phase 3", icon = "lock" }: LockedOverlayProps) {
    const color = palette.tint;

    return (
        <View style={styles.container}>
            <FontAwesome name={icon} size={64} color={color} style={styles.icon} />
            <Text style={styles.title}>{title}</Text>
            <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
            <Text style={styles.subtitle}>Coming in {availableIn}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    icon: {
        marginBottom: 20,
        opacity: 0.8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    separator: {
        marginVertical: 30,
        height: 1,
        width: '80%',
    },
    subtitle: {
        fontSize: 18,
        opacity: 0.6,
    },
});
