import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VisualSystem } from '@/constants/VisualSystem';

/**
 * The app's one screen header.
 *
 * Every tab used to open with its own 220-280pt photo hero and an all-caps
 * slogan, which is a landing-page device: it spends a third of the screen
 * before the content starts and makes each tab look like a different product.
 * One compact bar — title, a line of context, and up to two icon actions —
 * is what makes the tabs feel like one app.
 *
 * It sits in normal flow rather than absolutely. As an absolute bar its real
 * height is insets.top + BAR_HEIGHT, and every screen then has to pad by a
 * number it can't see; getting that wrong hides content under the bar.
 */

const BAR_HEIGHT = 56;

export type ScreenHeaderAction = {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress?: () => void;
    /** Small count badge, e.g. unread messages. */
    badge?: number;
};

function Action({ icon, label, onPress, badge }: ScreenHeaderAction) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onPress}
            hitSlop={8}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.55 }]}>
            <Ionicons name={icon} size={22} color={VisualSystem.colors.textPrimary} />
            {!!badge && badge > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
            )}
        </Pressable>
    );
}

export function ScreenHeader({
    title,
    subtitle,
    actions = [],
    scrollY,
}: {
    title: string;
    subtitle?: string;
    actions?: ScreenHeaderAction[];
    /** Fades in the hairline once content has scrolled beneath the bar. */
    scrollY?: Animated.Value;
}) {
    const insets = useSafeAreaInsets();

    const hairlineOpacity =
        scrollY?.interpolate({
            inputRange: [0, 12],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        }) ?? 1;

    return (
        <View style={[styles.wrap, { paddingTop: insets.top }]}>
            <View style={styles.bar}>
                <View style={styles.titleBlock}>
                    <Text numberOfLines={1} style={styles.title}>
                        {title}
                    </Text>
                    {!!subtitle && (
                        <Text numberOfLines={1} style={styles.subtitle}>
                            {subtitle}
                        </Text>
                    )}
                </View>
                {actions.length > 0 && (
                    <View style={styles.actions}>
                        {actions.map((a) => (
                            <Action key={a.label} {...a} />
                        ))}
                    </View>
                )}
            </View>
            <Animated.View style={[styles.hairline, { opacity: hairlineOpacity }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        backgroundColor: VisualSystem.colors.bgBase,
        zIndex: 10,
    },
    bar: {
        height: BAR_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: VisualSystem.spacing.lg,
    },
    titleBlock: { flex: 1, minWidth: 0 },
    title: {
        fontSize: VisualSystem.text.heading,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
        letterSpacing: -0.4,
    },
    subtitle: {
        fontSize: VisualSystem.text.small,
        color: VisualSystem.colors.textSecondary,
        marginTop: 1,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: VisualSystem.spacing.xs,
    },
    action: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        paddingHorizontal: 4,
        backgroundColor: VisualSystem.colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    hairline: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: VisualSystem.colors.borderSubtle,
    },
});
