import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';

type Props = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    maxWidth?: number;
};

/** Centers and constrains width on desktop web so forms and modals read well on a computer. */
export function WebShell({ children, style, maxWidth = 520 }: Props) {
    if (Platform.OS !== 'web') {
        return <>{children}</>;
    }

    return (
        <View style={[styles.outer, { maxWidth }, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        width: '100%',
        alignSelf: 'center',
    },
});
