import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FlatList,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { VisualSystem } from '@/constants/VisualSystem';
import { safeImpact } from '@/lib/safeHaptics';

/**
 * A scrolling ruler for a single number.
 *
 * Typing a weight into a text field means a keyboard, a number pad that covers
 * half the screen, and no sense of where the value sits in a range. Dragging a
 * ruler gives a reading and a scale at once, and detents make it feel like a
 * dial rather than a slider.
 *
 * Drawn rather than using @react-native-picker/picker: that renders the iOS
 * system wheel, which can't take the app's type or colour.
 */

const C = VisualSystem.colors;

/** Distance between detents. Wide enough to land on deliberately. */
const TICK_SPACING = 14;
const MINOR_HEIGHT = 14;
const MAJOR_HEIGHT = 26;
const RULER_HEIGHT = 62;
/** Both edges fade, so the strip reads as continuous past the cut. */
const FADE_WIDTH = 44;

export function RulerPicker({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    unit,
    formatValue,
    majorEvery = 5,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    /** Shown beside the reading, e.g. 'lb'. Omit when formatValue carries it. */
    unit?: string;
    formatValue?: (value: number) => string;
    /** Every Nth detent gets a taller tick and a label. */
    majorEvery?: number;
}) {
    const listRef = useRef<FlatList<number>>(null);
    const [width, setWidth] = useState(0);
    const lastIndex = useRef(-1);
    const initialised = useRef(false);

    const ticks = useMemo(() => {
        const count = Math.floor((max - min) / step) + 1;
        return Array.from({ length: count }, (_, i) => min + i * step);
    }, [min, max, step]);

    const indexOf = useCallback(
        (v: number) => Math.min(ticks.length - 1, Math.max(0, Math.round((v - min) / step))),
        [ticks.length, min, step]
    );

    const read = formatValue ? formatValue(value) : `${value}`;

    // Park the ruler on the starting value once the width is known — the
    // centring padding depends on it, so there is nothing to scroll to before.
    useEffect(() => {
        if (width === 0 || initialised.current) return;
        initialised.current = true;
        lastIndex.current = indexOf(value);
        listRef.current?.scrollToOffset({ offset: indexOf(value) * TICK_SPACING, animated: false });
    }, [width, value, indexOf]);

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!initialised.current) return;
        const index = Math.min(
            ticks.length - 1,
            Math.max(0, Math.round(e.nativeEvent.contentOffset.x / TICK_SPACING))
        );
        if (index === lastIndex.current) return;
        lastIndex.current = index;
        safeImpact(Haptics.ImpactFeedbackStyle.Light);
        onChange(ticks[index]);
    };

    const nudge = (delta: number) => {
        const next = indexOf(value) + delta;
        if (next < 0 || next >= ticks.length) return;
        lastIndex.current = next;
        listRef.current?.scrollToOffset({ offset: next * TICK_SPACING, animated: true });
        onChange(ticks[next]);
    };

    return (
        <View style={styles.wrap}>
            <View style={styles.readingRow}>
                <Text style={styles.label}>{label}</Text>
                <View style={styles.reading}>
                    <Text style={styles.readingValue}>{read}</Text>
                    {!!unit && <Text style={styles.readingUnit}>{unit}</Text>}
                </View>
            </View>

            <View
                style={styles.ruler}
                onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={label}
                accessibilityValue={{ text: unit ? `${read} ${unit}` : read }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) => {
                    if (e.nativeEvent.actionName === 'increment') nudge(1);
                    if (e.nativeEvent.actionName === 'decrement') nudge(-1);
                }}>
                {width > 0 && (
                    <FlatList
                        ref={listRef}
                        data={ticks}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(t) => `${t}`}
                        getItemLayout={(_, index) => ({
                            length: TICK_SPACING,
                            offset: TICK_SPACING * index,
                            index,
                        })}
                        // Centring padding: at offset 0 the first detent sits
                        // under the indicator rather than against the edge.
                        contentContainerStyle={{ paddingHorizontal: (width - TICK_SPACING) / 2 }}
                        snapToInterval={TICK_SPACING}
                        decelerationRate="fast"
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        renderItem={({ item }) => {
                            // Keyed off the value, not the index, so labels
                            // land on 15/20/25 rather than wherever min fell.
                            const major = item % (majorEvery * step) === 0;
                            return (
                                <View style={styles.tickSlot}>
                                    <View
                                        style={[
                                            styles.tick,
                                            major ? styles.tickMajor : styles.tickMinor,
                                        ]}
                                    />
                                    {major && (
                                        <Text style={styles.tickLabel} numberOfLines={1}>
                                            {formatValue ? formatValue(item) : item}
                                        </Text>
                                    )}
                                </View>
                            );
                        }}
                    />
                )}

                <LinearGradient
                    pointerEvents="none"
                    colors={[C.bgMid, 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.fade, { left: 0, width: FADE_WIDTH }]}
                />
                <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0)', C.bgMid]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.fade, { right: 0, width: FADE_WIDTH }]}
                />

                <View pointerEvents="none" style={styles.indicator} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        backgroundColor: C.bgMid,
        borderRadius: VisualSystem.radius.md,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        paddingTop: VisualSystem.spacing.md,
        paddingBottom: VisualSystem.spacing.sm,
        overflow: 'hidden',
    },
    readingRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingHorizontal: VisualSystem.spacing.lg,
        marginBottom: VisualSystem.spacing.xs,
    },
    label: {
        fontSize: VisualSystem.text.small,
        fontWeight: '700',
        color: C.textSecondary,
    },
    reading: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    readingValue: {
        fontSize: VisualSystem.text.display,
        fontWeight: '800',
        color: C.textPrimary,
        letterSpacing: -1,
        fontVariant: ['tabular-nums'],
    },
    readingUnit: {
        fontSize: VisualSystem.text.body,
        fontWeight: '700',
        color: C.textSecondary,
    },
    ruler: {
        height: RULER_HEIGHT,
        justifyContent: 'center',
    },
    tickSlot: {
        width: TICK_SPACING,
        height: RULER_HEIGHT,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 8,
        overflow: 'visible',
    },
    tick: { width: 2, borderRadius: 1 },
    tickMinor: { height: MINOR_HEIGHT, backgroundColor: C.borderStrong },
    tickMajor: { height: MAJOR_HEIGHT, backgroundColor: C.textTertiary },
    tickLabel: {
        position: 'absolute',
        top: MAJOR_HEIGHT + 12,
        width: 56,
        left: TICK_SPACING / 2 - 28,
        textAlign: 'center',
        fontSize: VisualSystem.text.caption,
        fontWeight: '700',
        color: C.textTertiary,
    },
    fade: {
        position: 'absolute',
        top: 0,
        bottom: 0,
    },
    indicator: {
        position: 'absolute',
        alignSelf: 'center',
        top: 4,
        width: 3,
        height: MAJOR_HEIGHT + 10,
        borderRadius: 2,
        backgroundColor: C.goldVivid,
    },
});
