import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { VisualSystem } from '@/constants/VisualSystem';
import { safeImpact } from '@/lib/safeHaptics';

/**
 * Floating tab bar.
 *
 * On iOS 26 this is Apple's real Liquid Glass — a native GlassView, so the bar
 * actually refracts and specularly highlights the content moving under it,
 * which a blur cannot imitate. Everywhere else it falls back to a blurred,
 * near-opaque surface that reads the same way at a glance.
 *
 * The layout follows Strava's: selection is carried by color alone. No pill, no
 * highlight, no outline behind the active tab — the active item turns gold and
 * everything else stays navy.
 */

const BAR_HEIGHT = 72;
const BAR_INSET = 12;
const BAR_BOTTOM = 10;
const WEB_MAX_WIDTH = 540;
const ICON_SIZE = 25;

const isWeb = Platform.OS === 'web';

/** Resolved once: it's a device capability, not something that changes at runtime. */
const HAS_NATIVE_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

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
        transform: [{ scale: 1 - pressed.value * 0.12 }],
        opacity: 1 - pressed.value * 0.3,
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

/** The bar's material: real glass where the OS provides it, blur everywhere else. */
function BarSurface({ children }: { children: React.ReactNode }) {
    if (HAS_NATIVE_GLASS) {
        return (
            <GlassView
                glassEffectStyle="regular"
                colorScheme="light"
                isInteractive
                style={[styles.bar, styles.barGlass]}>
                {children}
            </GlassView>
        );
    }
    return (
        <View style={[styles.bar, styles.barFallback]}>
            <BlurView
                intensity={Platform.select({ ios: 40, android: 20, default: 16 })}
                tint="light"
                experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
                style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, styles.fill]} />
            {children}
        </View>
    );
}

export function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();

    const routes = state.routes.filter((route) => {
        // `href: null` is expo-router's way of hiding a route from the tab bar.
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
            style={[styles.container, { bottom: BAR_BOTTOM + (isWeb ? 0 : insets.bottom * 0.35) }]}>
            <BarSurface>
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
                                icon={options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
                            />
                        );
                    })}
                </View>
            </BarSurface>
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
    },
    /** Native glass carries its own edge and shadow; adding ours muddies it. */
    barGlass: {
        // no fill, no border — the material is the surface
    },
    barFallback: {
        shadowColor: VisualSystem.colors.navy,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    fill: {
        backgroundColor: Platform.select({
            ios: 'rgba(255, 255, 255, 0.82)',
            android: 'rgba(255, 255, 255, 0.96)',
            default: 'rgba(255, 255, 255, 0.9)',
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
        gap: 5,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.1,
        maxWidth: '100%',
    },
    labelFocused: {
        fontWeight: '700',
    },
});
