import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WEB_BG } from '@/constants/webLayout';

type Props = {
    children: React.ReactNode;
};

/** Optional max-width frame for the main app on desktop browsers. */
export function AppWebFrame({ children }: Props) {
    if (Platform.OS !== 'web') {
        return <>{children}</>;
    }

    return <View style={styles.frame}>{children}</View>;
}

const styles = StyleSheet.create({
    frame: {
        flex: 1,
        width: '100%',
        maxWidth: 900,
        alignSelf: 'center',
        backgroundColor: WEB_BG,
        ...(Platform.OS === 'web'
            ? { minHeight: '100vh' as unknown as number, position: 'relative' as const }
            : {}),
    },
});
