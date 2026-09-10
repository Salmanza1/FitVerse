import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { VisualSystem } from '@/constants/VisualSystem';
import { safeImpact } from '@/lib/safeHaptics';

/**
 * Floating tab bar, modelled on Strava's.
 *
 * The defining choice is that selection is carried by color alone — the active
 * item turns gold and everything else stays navy. There is no pill, no
 * highlight and no border behind the active tab; adding those is what made the
 * earlier version read as a different component. The bar is a near-solid white
 * slab floating on a soft shadow, with just enough translucency to suggest the
 * content passing underneath.
 */

const BAR_HEIGHT = 64;
const BAR_INSET = 14;
const BAR_BOTTOM = 14;
const WEB_MAX_WIDTH = 520;

const isWeb = Platform.OS === 'web';

function TabItem({
    focused,
    color,
    label,
    icon,
    onPress,
    onLongPress,
    accessibilityLabel,
    testID,
}: {
    focused: boolean;
    color: string;
    label: string;
    icon: React.ReactNode;
    onPress: () => void;
    onLongPress: () => void;
    accessibilityLabel?: string;
    testID?: string;
}) {
    const pressed = useSharedValue(0);

    const pressStyle = useAnimatedStyle(() => ({
        transform: [{ scale: 1 - pressed.value * 0.1 }],
        opacity: 1 - pressed.value * 0.25,
    }));

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={() => {
                pressed.value = withTiming(1, { duration: 80, easing: Easing.out(Easing.quad) });
            }}
            onPressOut={() => {
                pressed.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) });
            }}
            style={styles.tabItem}>
            <Animated.View style={[styles.tabItemInner, pressStyle]}>
                {icon}
                <Text
                    numberOfLines={1}
                    style={[styles.label, { color }, focused && styles.labelFocused]}>
                    {label}
                </Text>
            </Animated.View>
        </Pressable>
    );
}

export function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();

    const routes = state.routes.filter((route) => {
        // `href: null` is expo-router's way of hiding a route from the tab bar;
        // it isn't part of the base react-navigation options type.
        const options = descriptors[route.key]?.options as { href?: string | null } | undefined;
        return options?.href !== null;
    });

    const activeKey = state.routes[state.index]?.key;

    const handlePress = useCallback(
        (routeKey: string, routeName: string, params: object | undefined, focused: boolean) =>
            () => {
                const event = navigation.emit({
                    type: 'tabPress',
                    target: routeKey,
                    canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                    safeImpact();
                    navigation.navigate(routeName, params);
                }
            },
        [navigation]
    );

    return (
        <View
            pointerEvents="box-none"
            style={[styles.container, { bottom: BAR_BOTTOM + (isWeb ? 0 : insets.bottom * 0.4) }]}>
            <View style={styles.bar}>
                <BlurView
                    intensity={Platform.select({ ios: 24, android: 16, default: 12 })}
                    tint="light"
                    experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
                    style={StyleSheet.absoluteFill}
                />
                {/* Near-solid white — the bar reads as a surface, not a scrim. */}
                <View style={[StyleSheet.absoluteFill, styles.fill]} />

                <View style={styles.row}>
                    {routes.map((route) => {
                        const { options } = descriptors[route.key];
                        const focused = route.key === activeKey;
                        const color = focused
                            ? VisualSystem.colors.goldAccent
                            : VisualSystem.colors.textPrimary;

                        const label =
                            typeof options.tabBarLabel === 'string'
                                ? options.tabBarLabel
                                : options.title ?? route.name;

                        return (
                            <TabItem
                                key={route.key}
                                focused={focused}
                                color={color}
                                label={label}
                                accessibilityLabel={options.tabBarAccessibilityLabel}
                                testID={options.tabBarButtonTestID}
                                onPress={handlePress(route.key, route.name, route.params, focused)}
                                onLongPress={() =>
                                    navigation.emit({ type: 'tabLongPress', target: route.key })
                                }
                                icon={options.tabBarIcon?.({ focused, color, size: 23 })}
                            />
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: BAR_INSET,
        right: BAR_INSET,
        alignItems: 'center',
    },
    bar: {
        width: '100%',
        maxWidth: isWeb ? WEB_MAX_WIDTH : undefined,
        height: BAR_HEIGHT,
        borderRadius: BAR_HEIGHT / 2,
        overflow: 'hidden',
        // No border: Strava's bar is defined by its shadow alone, and an
        // outline — gold especially — is what made this read as something else.
        shadowColor: VisualSystem.colors.navy,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
        elevation: 10,
    },
    fill: {
        backgroundColor: Platform.select({
            ios: 'rgba(255, 255, 255, 0.90)',
            android: 'rgba(255, 255, 255, 0.97)',
            default: 'rgba(255, 255, 255, 0.94)',
        }),
    },
    row: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabItem: {
        flex: 1,
        // Keeps a long label ("Leaderboard") from setting a min-content floor on
        // web and pushing the row wider than the bar.
        minWidth: 0,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabItemInner: {
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '100%',
        gap: 4,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        maxWidth: '100%',
    },
    labelFocused: {
        fontWeight: '700',
    },
});
