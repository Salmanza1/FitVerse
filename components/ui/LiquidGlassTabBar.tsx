import React, { useCallback, useState } from 'react';
import {
    LayoutChangeEvent,
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { VisualSystem } from '@/constants/VisualSystem';
import { safeImpact } from '@/lib/safeHaptics';

/**
 * Floating "liquid glass" tab bar.
 *
 * Built from layered translucency rather than a solid fill: a blur base, a white
 * tint, and a specular highlight along the top edge, with a gold pill that
 * springs between tabs. Geometry matches the previous bar (68pt tall, 18pt
 * inset, 22pt off the bottom) so screens keep their existing ~100-120pt of
 * scroll padding.
 */

const BAR_HEIGHT = 68;
const BAR_INSET = 18;
const BAR_BOTTOM = 22;
const WEB_MAX_WIDTH = 520;
const INDICATOR_INSET = 6;

/** Spring tuned to glide and settle without overshooting into a bounce. */
const INDICATOR_SPRING = {
    damping: 18,
    stiffness: 180,
    mass: 0.9,
} as const;

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
    const focus = useSharedValue(focused ? 1 : 0);

    React.useEffect(() => {
        focus.value = withSpring(focused ? 1 : 0, INDICATOR_SPRING);
    }, [focused]);

    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: 1 + focus.value * 0.08 - pressed.value * 0.12 },
            { translateY: -focus.value * 1.5 },
        ],
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
                pressed.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) });
            }}
            onPressOut={() => {
                pressed.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
            }}
            style={styles.tabItem}>
            <Animated.View style={[styles.tabItemInner, iconStyle]}>
                {icon}
                <Text numberOfLines={1} style={[styles.label, { color }]}>
                    {label}
                </Text>
            </Animated.View>
        </Pressable>
    );
}

export function LiquidGlassTabBar({
    state,
    descriptors,
    navigation,
}: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const [barWidth, setBarWidth] = useState(0);

    // Routes react-navigation has told us to hide are dropped before we measure,
    // so the indicator maths stays in step with what's actually rendered.
    const routes = state.routes.filter((route) => {
        // `href: null` is expo-router's way of hiding a route from the tab bar;
        // it isn't part of the base react-navigation options type.
        const options = descriptors[route.key]?.options as
            | { href?: string | null }
            | undefined;
        return options?.href !== null;
    });
    const activeIndex = Math.max(
        0,
        routes.findIndex((route) => route.key === state.routes[state.index]?.key)
    );

    const slotWidth = routes.length > 0 ? barWidth / routes.length : 0;
    const indicatorX = useSharedValue(0);
    const hasPositioned = React.useRef(false);

    React.useEffect(() => {
        if (slotWidth === 0) return; // nothing measured yet
        const target = activeIndex * slotWidth;

        // The app restores your last tab on launch, so the first paint can land on
        // any index. Place the pill instantly that first time (and whenever the bar
        // is re-measured, e.g. rotation) rather than sliding it in from the far left.
        if (!hasPositioned.current) {
            hasPositioned.current = true;
            indicatorX.value = target;
        } else {
            indicatorX.value = withSpring(target, INDICATOR_SPRING);
        }
    }, [activeIndex, slotWidth]);

    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: indicatorX.value }],
    }));

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        setBarWidth(e.nativeEvent.layout.width);
    }, []);

    return (
        <View
            pointerEvents="box-none"
            style={[
                styles.container,
                { bottom: BAR_BOTTOM + (isWeb ? 0 : insets.bottom * 0.35) },
            ]}>
            <View style={styles.bar} onLayout={onLayout}>
                {/* Layer 1 — the refraction base. */}
                <BlurView
                    intensity={Platform.select({ ios: 60, android: 40, default: 30 })}
                    tint="light"
                    // Without this Android renders a flat semi-transparent box.
                    experimentalBlurMethod={
                        Platform.OS === 'android' ? 'dimezisBlurView' : undefined
                    }
                    style={StyleSheet.absoluteFill}
                />

                {/* Layer 2 — white tint. Heavier off-iOS, where blur is weaker. */}
                <View style={[StyleSheet.absoluteFill, styles.tint]} />

                {/* Layer 3 — specular highlight along the top edge. */}
                <LinearGradient
                    colors={[
                        'rgba(255, 255, 255, 0.85)',
                        'rgba(255, 255, 255, 0.30)',
                        'transparent',
                    ]}
                    locations={[0, 0.35, 1]}
                    style={styles.specular}
                    pointerEvents="none"
                />

                {/* Layer 4 — the gold pill that tracks the active tab. */}
                {slotWidth > 0 && (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.indicator,
                            {
                                width: slotWidth - INDICATOR_INSET * 2,
                                left: INDICATOR_INSET,
                            },
                            indicatorStyle,
                        ]}>
                        <LinearGradient
                            colors={[
                                'rgba(201, 151, 0, 0.26)',
                                'rgba(201, 151, 0, 0.13)',
                            ]}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                )}

                <View style={styles.row}>
                    {routes.map((route, index) => {
                        const { options } = descriptors[route.key];
                        const focused = index === activeIndex;
                        // Plain gold fails contrast on a light bar, so the active
                        // tab uses the darker gold that passes on this background.
                        const color = focused
                            ? VisualSystem.colors.goldText
                            : VisualSystem.colors.textSecondary;

                        const label =
                            typeof options.tabBarLabel === 'string'
                                ? options.tabBarLabel
                                : options.title ?? route.name;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });
                            if (!focused && !event.defaultPrevented) {
                                safeImpact();
                                navigation.navigate(route.name, route.params);
                            }
                        };

                        const onLongPress = () => {
                            navigation.emit({ type: 'tabLongPress', target: route.key });
                        };

                        return (
                            <TabItem
                                key={route.key}
                                focused={focused}
                                color={color}
                                label={label}
                                accessibilityLabel={options.tabBarAccessibilityLabel}
                                testID={options.tabBarButtonTestID}
                                onPress={onPress}
                                onLongPress={onLongPress}
                                icon={options.tabBarIcon?.({
                                    focused,
                                    color,
                                    size: focused ? 22 : 20,
                                })}
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
        borderRadius: VisualSystem.radius.pill,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        // Lifts the bar off the content so the blur reads as depth, not haze.
        // Navy-tinted and soft: a black shadow on a light page reads as grime.
        shadowColor: VisualSystem.colors.navy,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 22,
        elevation: 10,
    },
    tint: {
        backgroundColor: Platform.select({
            ios: 'rgba(255, 255, 255, 0.58)',
            android: 'rgba(255, 255, 255, 0.82)',
            default: 'rgba(255, 255, 255, 0.72)',
        }),
    },
    specular: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: BAR_HEIGHT * 0.55,
    },
    indicator: {
        position: 'absolute',
        top: INDICATOR_INSET,
        bottom: INDICATOR_INSET,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(201, 151, 0, 0.38)',
    },
    row: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabItem: {
        flex: 1,
        // Without this, a long label ("Leaderboard") sets a min-content floor on
        // web and pushes the row wider than the bar we measured, which throws the
        // indicator out of alignment.
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
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
        maxWidth: '100%',
    },
});
