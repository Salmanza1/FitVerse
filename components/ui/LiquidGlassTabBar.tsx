import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    LayoutChangeEvent,
    PanResponder,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
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
 * On iOS 26 the bar is a single native GlassView — Apple's real Liquid Glass,
 * which refracts and specularly highlights whatever scrolls under it.
 *
 * Do not wrap this in a GlassContainer. That renders as an opaque slab and the
 * glass is lost; the material has to come from the GlassView being the surface
 * itself. Everywhere else the bar falls back to a blurred, near-opaque surface.
 *
 * A selection lozenge sits on top and travels between tabs — springing on tap,
 * and following your finger if you drag along the bar.
 */

const BAR_HEIGHT = 72;
const BAR_INSET = 12;
const BAR_BOTTOM = 10;
const WEB_MAX_WIDTH = 540;
const ICON_SIZE = 25;
const LOZENGE_INSET_Y = 8;
const LOZENGE_GAP_X = 8;

/** Follows the finger closely, then settles without a rubbery overshoot. */
const SETTLE_SPRING = { damping: 20, stiffness: 210, mass: 0.85 } as const;

const isWeb = Platform.OS === 'web';
const HAS_NATIVE_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

function TabItem({
    focused,
    color,
    label,
    icon,
    accessibilityLabel,
    testID,
    onPress,
    onLongPress,
}: {
    focused: boolean;
    color: string;
    label: string;
    icon: React.ReactNode;
    accessibilityLabel?: string;
    testID?: string;
    onPress: () => void;
    onLongPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}>
            <View style={styles.tabItemInner}>
                {icon}
                <Text
                    numberOfLines={1}
                    style={[styles.label, { color }, focused && styles.labelFocused]}>
                    {label}
                </Text>
            </View>
        </Pressable>
    );
}

export function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const [rowWidth, setRowWidth] = useState(0);
    const [reduceTransparency, setReduceTransparency] = useState(false);

    React.useEffect(() => {
        let alive = true;
        AccessibilityInfo.isReduceTransparencyEnabled?.()
            .then((v) => alive && setReduceTransparency(!!v))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    const useGlass = HAS_NATIVE_GLASS && !reduceTransparency;

    const routes = useMemo(
        () =>
            state.routes.filter((route) => {
                // `href: null` is expo-router's way of hiding a route from the bar.
                const o = descriptors[route.key]?.options as { href?: string | null } | undefined;
                return o?.href !== null;
            }),
        [state.routes, descriptors]
    );

    const activeKey = state.routes[state.index]?.key;
    const activeIndex = Math.max(0, routes.findIndex((r) => r.key === activeKey));
    const slot = routes.length ? rowWidth / routes.length : 0;

    const lozengeX = useSharedValue(0);
    const lozengeScale = useSharedValue(1);
    const placed = useRef(false);
    // Read by the pan handlers, which run on the JS thread.
    const geom = useRef({ slot: 0, count: 0 });
    geom.current = { slot, count: routes.length };

    React.useEffect(() => {
        if (!slot) return;
        const target = activeIndex * slot;
        if (!placed.current) {
            // The app restores your last tab on launch, so the first paint can be
            // any index — place it instantly rather than flying in from the left.
            placed.current = true;
            lozengeX.value = target;
        } else {
            lozengeX.value = withSpring(target, SETTLE_SPRING);
        }
    }, [activeIndex, slot]);

    const go = useCallback(
        (index: number) => {
            const route = routes[index];
            if (!route) return;
            const focused = route.key === activeKey;
            const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
                safeImpact();
                navigation.navigate(route.name, route.params);
            }
        },
        [routes, activeKey, navigation]
    );

    const indexAt = useCallback((x: number) => {
        const { slot: s, count } = geom.current;
        if (!s) return 0;
        return Math.min(count - 1, Math.max(0, Math.floor(x / s)));
    }, []);

    const pan = useMemo(
        () =>
            PanResponder.create({
                // Never claim on touch-down: that would swallow the tap before the
                // tab button under the finger ever saw it. Take over only once the
                // gesture is clearly a horizontal drag.
                onStartShouldSetPanResponder: () => false,
                onMoveShouldSetPanResponder: (_e, g) =>
                    Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
                onPanResponderGrant: () => {
                    lozengeScale.value = withTiming(0.93, {
                        duration: 110,
                        easing: Easing.out(Easing.quad),
                    });
                },
                onPanResponderMove: (e) => {
                    const { slot: s, count } = geom.current;
                    if (!s) return;
                    // Track the finger continuously so the lozenge glides rather
                    // than hopping slot to slot.
                    const raw = e.nativeEvent.locationX - s / 2;
                    lozengeX.value = Math.min(Math.max(raw, 0), (count - 1) * s);
                },
                onPanResponderRelease: (e) => {
                    lozengeScale.value = withTiming(1, {
                        duration: 160,
                        easing: Easing.out(Easing.quad),
                    });
                    const { slot: s } = geom.current;
                    if (!s) return;
                    const idx = indexAt(e.nativeEvent.locationX);
                    lozengeX.value = withSpring(idx * s, SETTLE_SPRING);
                    go(idx);
                },
                onPanResponderTerminate: () => {
                    lozengeScale.value = withTiming(1, { duration: 160 });
                    const { slot: s } = geom.current;
                    if (s) lozengeX.value = withSpring(activeIndex * s, SETTLE_SPRING);
                },
            }),
        [go, indexAt, activeIndex]
    );

    const lozengeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: lozengeX.value }, { scale: lozengeScale.value }],
    }));

    // Measured on the row, not the glass surface: GlassView/GlassContainer do not
    // report a usable layout width, which previously made the lozenge a circle.
    const onRowLayout = useCallback((e: LayoutChangeEvent) => {
        setRowWidth(e.nativeEvent.layout.width);
    }, []);

    const content = (
        <>
            {slot > 0 && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.lozenge,
                        useGlass ? styles.lozengeOnGlass : styles.lozengeFallback,
                        { width: slot - LOZENGE_GAP_X * 2, left: LOZENGE_GAP_X },
                        lozengeStyle,
                    ]}
                />
            )}
            <View style={styles.row} onLayout={onRowLayout} {...pan.panHandlers}>
                {routes.map((route, index) => {
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
                            onPress={() => go(index)}
                            onLongPress={() =>
                                navigation.emit({ type: 'tabLongPress', target: route.key })
                            }
                            icon={options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
                        />
                    );
                })}
            </View>
        </>
    );

    return (
        <View
            pointerEvents="box-none"
            style={[styles.container, { bottom: BAR_BOTTOM + (isWeb ? 0 : insets.bottom * 0.35) }]}>
            {useGlass ? (
                <GlassView
                    glassEffectStyle="regular"
                    colorScheme="light"
                    isInteractive
                    style={styles.bar}>
                    {content}
                </GlassView>
            ) : (
                <View style={[styles.bar, styles.barFallback]}>
                    <BlurView
                        intensity={Platform.select({ ios: 40, android: 20, default: 16 })}
                        tint="light"
                        experimentalBlurMethod={
                            Platform.OS === 'android' ? 'dimezisBlurView' : undefined
                        }
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={[StyleSheet.absoluteFill, styles.fill]} />
                    {content}
                </View>
            )}
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
        alignSelf: 'center',
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
    lozenge: {
        position: 'absolute',
        top: LOZENGE_INSET_Y,
        bottom: LOZENGE_INSET_Y,
        borderRadius: (BAR_HEIGHT - LOZENGE_INSET_Y * 2) / 2,
    },
    /** On real glass, a brighter lift reads as the selected pane of the material. */
    lozengeOnGlass: {
        backgroundColor: 'rgba(255, 255, 255, 0.45)',
    },
    lozengeFallback: {
        backgroundColor: 'rgba(201, 151, 0, 0.14)',
        borderWidth: 1,
        borderColor: 'rgba(201, 151, 0, 0.26)',
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
