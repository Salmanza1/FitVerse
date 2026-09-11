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
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { VisualSystem } from '@/constants/VisualSystem';
import { safeImpact } from '@/lib/safeHaptics';

/**
 * Floating tab bar with Apple's Liquid Glass behaviour.
 *
 * The selection is a glass capsule that travels between tabs. On iOS 26 the
 * capsule and the bar are sibling GlassViews inside a GlassContainer, so as the
 * capsule moves the two glass surfaces merge and deform into each other — the
 * morph you see in Apple's own tab bars. `spacing` sets how close they have to
 * be before they start affecting one another.
 *
 * Dragging along the bar carries the capsule with your finger and commits the
 * tab you release on, rather than only responding to discrete taps.
 *
 * Off iOS 26 the same capsule renders as a plain tinted pill over a blurred
 * bar, and the motion is identical.
 */

const BAR_HEIGHT = 72;
const BAR_INSET = 12;
const BAR_BOTTOM = 10;
const WEB_MAX_WIDTH = 540;
const ICON_SIZE = 25;
const CAPSULE_INSET = 6;
/** How near the capsule must be before the bar's glass starts merging with it. */
const GLASS_MERGE_SPACING = 18;

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
    const [barWidth, setBarWidth] = useState(0);
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
    const slot = routes.length ? barWidth / routes.length : 0;

    const capsuleX = useSharedValue(0);
    const capsuleScale = useSharedValue(1);
    const placed = useRef(false);
    // Read by the pan handlers, which run on the JS thread.
    const geom = useRef({ slot: 0, count: 0 });
    geom.current = { slot, count: routes.length };

    React.useEffect(() => {
        if (!slot) return;
        const target = activeIndex * slot;
        if (!placed.current) {
            // The app restores your last tab on launch, so the first paint can be
            // any index — place it instantly instead of flying in from the left.
            placed.current = true;
            capsuleX.value = target;
        } else {
            capsuleX.value = withSpring(target, SETTLE_SPRING);
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

    /** Index under an x offset within the bar. */
    const indexAt = useCallback((x: number) => {
        const { slot: s, count } = geom.current;
        if (!s) return 0;
        return Math.min(count - 1, Math.max(0, Math.floor(x / s)));
    }, []);

    const pan = useMemo(
        () =>
            PanResponder.create({
                // Never claim on touch-down: that would swallow the tap before the
                // tab button under the finger ever sees it. Only take over once
                // the gesture is clearly a horizontal drag.
                onStartShouldSetPanResponder: () => false,
                onMoveShouldSetPanResponder: (_e, g) =>
                    Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
                onPanResponderGrant: (e) => {
                    capsuleScale.value = withTiming(0.94, { duration: 110, easing: Easing.out(Easing.quad) });
                    const x = e.nativeEvent.locationX;
                    const { slot: s } = geom.current;
                    if (s) capsuleX.value = withSpring(indexAt(x) * s, SETTLE_SPRING);
                },
                onPanResponderMove: (e) => {
                    const { slot: s, count } = geom.current;
                    if (!s) return;
                    // Track the finger continuously — this is what makes the glass
                    // stretch between tabs rather than hop.
                    const raw = e.nativeEvent.locationX - s / 2;
                    capsuleX.value = Math.min(Math.max(raw, 0), (count - 1) * s);
                },
                onPanResponderRelease: (e) => {
                    capsuleScale.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
                    const { slot: s } = geom.current;
                    if (!s) return;
                    const idx = indexAt(e.nativeEvent.locationX);
                    capsuleX.value = withSpring(idx * s, SETTLE_SPRING);
                    go(idx);
                },
                onPanResponderTerminate: () => {
                    capsuleScale.value = withTiming(1, { duration: 160 });
                    const { slot: s } = geom.current;
                    if (s) capsuleX.value = withSpring(activeIndex * s, SETTLE_SPRING);
                },
            }),
        [go, indexAt, activeIndex]
    );

    const capsuleStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: capsuleX.value }, { scale: capsuleScale.value }],
    }));

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        setBarWidth(e.nativeEvent.layout.width);
    }, []);

    const capsule =
        slot > 0 ? (
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.capsuleWrap,
                    { width: slot - CAPSULE_INSET * 2, left: CAPSULE_INSET },
                    capsuleStyle,
                ]}>
                {useGlass ? (
                    <GlassView
                        glassEffectStyle="clear"
                        colorScheme="light"
                        isInteractive
                        style={styles.capsule}
                    />
                ) : (
                    <View style={[styles.capsule, styles.capsuleFallback]} />
                )}
            </Animated.View>
        ) : null;

    const row = (
        <View style={styles.row} {...pan.panHandlers}>
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
    );

    const body = (
        <>
            {capsule}
            {row}
        </>
    );

    return (
        <View
            pointerEvents="box-none"
            style={[styles.container, { bottom: BAR_BOTTOM + (isWeb ? 0 : insets.bottom * 0.35) }]}>
            {useGlass ? (
                // Siblings inside the container merge as they approach — the capsule
                // deforms into the bar instead of sliding over it.
                <GlassContainer spacing={GLASS_MERGE_SPACING} style={styles.bar} onLayout={onLayout}>
                    <GlassView
                        glassEffectStyle="regular"
                        colorScheme="light"
                        style={StyleSheet.absoluteFill}
                    />
                    {body}
                </GlassContainer>
            ) : (
                <View style={[styles.bar, styles.barFallback]} onLayout={onLayout}>
                    <BlurView
                        intensity={Platform.select({ ios: 40, android: 20, default: 16 })}
                        tint="light"
                        experimentalBlurMethod={
                            Platform.OS === 'android' ? 'dimezisBlurView' : undefined
                        }
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={[StyleSheet.absoluteFill, styles.fill]} />
                    {body}
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
    capsuleWrap: {
        position: 'absolute',
        top: CAPSULE_INSET,
        bottom: CAPSULE_INSET,
    },
    capsule: {
        flex: 1,
        borderRadius: (BAR_HEIGHT - CAPSULE_INSET * 2) / 2,
        overflow: 'hidden',
    },
    /** Off-glass platforms get a soft gold wash so the selection still reads. */
    capsuleFallback: {
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
