import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Svg, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { VisualSystem } from '@/constants/VisualSystem';
import { safeImpact } from '@/lib/safeHaptics';
import {
    DAYS_SHOWN,
    formatMetric,
    metricValue,
    type Metric,
    type NutritionSummary,
} from '@/features/nutrition/nutritionStats';

/**
 * Two weeks of intake against the day's target.
 *
 * Built to match the profile's training chart, down to the baseline dots and
 * the axis values outside the plot, so the two read as one family. The one
 * addition is the goal line: a day's number only means something next to what
 * it was aiming at.
 *
 * Only one metric is drawn at a time, so the bars are a single series and
 * carry no identity in their colour — the selected chip names them.
 */

const C = VisualSystem.colors;

const CHART_HEIGHT = 120;
/** Room on the right for the axis values, which sit outside the plot. */
const VALUE_GUTTER = 52;
/** Room under the plot for weekday letters. */
const LABEL_BAND = 18;
/** Headroom above the tallest mark so the goal line is never clipped. */
const HEADROOM = 1.08;

const METRICS: { key: Metric; label: string }[] = [
    { key: 'calories', label: 'Calories' },
    { key: 'protein', label: 'Protein' },
    { key: 'carbs', label: 'Carbs' },
    { key: 'fat', label: 'Fat' },
];

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function NutritionTrendCard({
    summary,
    loading,
}: {
    summary: NutritionSummary;
    loading?: boolean;
}) {
    const [metric, setMetric] = useState<Metric>('calories');
    const [plotWidth, setPlotWidth] = useState(0);

    const { days, goals, averages, loggedDays } = summary;
    const goal = goals[metric];

    const values = useMemo(() => days.map((d) => metricValue(d, metric)), [days, metric]);
    // The goal is part of the scale: if every day came in under it, a chart
    // topped out at the highest day would put the line off the top edge.
    const peak = useMemo(
        () => Math.max(...values, goal, 1) * HEADROOM,
        [values, goal]
    );

    const chartWidth = Math.max(0, plotWidth - VALUE_GUTTER);
    const slot = chartWidth / DAYS_SHOWN;
    const barWidth = Math.max(4, slot * 0.55);
    const goalY = CHART_HEIGHT - (goal / peak) * CHART_HEIGHT;

    const average = averages[metric];

    return (
        <View style={styles.card}>
            <View style={styles.metricRow}>
                {METRICS.map((m) => {
                    const active = m.key === metric;
                    return (
                        <Pressable
                            key={m.key}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            onPress={() => {
                                safeImpact();
                                setMetric(m.key);
                            }}
                            style={({ pressed }) => [
                                styles.metricChip,
                                active && styles.metricChipActive,
                                pressed && { opacity: 0.7 },
                            ]}>
                            <Text style={[styles.metricChipText, active && styles.metricChipTextActive]}>
                                {m.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.headingRow}>
                <View style={styles.headingText}>
                    <Text style={styles.title}>Daily average</Text>
                    <Text style={styles.subtitle}>
                        {loggedDays === 0
                            ? 'Log a meal to start the trend'
                            : `Over ${loggedDays} logged ${loggedDays === 1 ? 'day' : 'days'}`}
                    </Text>
                </View>
                <View style={styles.headingValue}>
                    <Text style={styles.average}>
                        {loading || loggedDays === 0 ? '—' : formatMetric(average, metric)}
                    </Text>
                    <Text style={styles.goalHint}>of {formatMetric(goal, metric)}</Text>
                </View>
            </View>

            <View onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}>
                {plotWidth > 0 && (
                    <Svg width={plotWidth} height={CHART_HEIGHT + LABEL_BAND}>
                        {/* Baseline. */}
                        <Line
                            x1={0}
                            y1={CHART_HEIGHT}
                            x2={chartWidth}
                            y2={CHART_HEIGHT}
                            stroke={C.borderStrong}
                            strokeWidth={1}
                        />

                        {/* The target. Dashed and recessive: it is a reference,
                            not a verdict, and nothing here goes red for a day
                            that ran over. */}
                        <Line
                            x1={0}
                            y1={goalY}
                            x2={chartWidth}
                            y2={goalY}
                            stroke={C.borderStrong}
                            strokeWidth={1}
                            strokeDasharray="3 4"
                        />
                        <SvgText
                            x={chartWidth + 8}
                            y={goalY + 4}
                            fill={C.textTertiary}
                            fontSize={11}
                            fontWeight="600">
                            {formatMetric(goal, metric)}
                        </SvgText>

                        <SvgText
                            x={chartWidth + 8}
                            y={CHART_HEIGHT + 4}
                            fill={C.textTertiary}
                            fontSize={11}
                            fontWeight="600">
                            0
                        </SvgText>

                        {/* A dot per day on the baseline. Without them a single
                            logged day is one bar in an empty box, which reads as
                            broken rather than as one day. */}
                        {days.map((day, i) => (
                            <Circle
                                key={`dot-${day.date.getTime()}`}
                                cx={i * slot + slot / 2}
                                cy={CHART_HEIGHT}
                                r={2}
                                fill={day.logged ? C.gold : C.borderStrong}
                            />
                        ))}

                        {days.map((day, i) => {
                            // An unlogged day draws nothing but its dot. A zero
                            // bar would claim they ate nothing.
                            if (!day.logged) return null;
                            const value = values[i];
                            if (value <= 0) return null;
                            const isToday = i === days.length - 1;
                            const height = Math.max(3, (value / peak) * CHART_HEIGHT);

                            return (
                                <Rect
                                    key={day.date.getTime()}
                                    x={i * slot + (slot - barWidth) / 2}
                                    y={CHART_HEIGHT - height}
                                    width={barWidth}
                                    height={height}
                                    rx={Math.min(4, barWidth / 2)}
                                    fill={isToday ? C.navy : C.gold}
                                    opacity={isToday ? 1 : 0.85}
                                />
                            );
                        })}

                        {days.map((day, i) => (
                            <SvgText
                                key={`label-${day.date.getTime()}`}
                                x={i * slot + slot / 2}
                                y={CHART_HEIGHT + 14}
                                fill={i === days.length - 1 ? C.textSecondary : C.textTertiary}
                                fontSize={9}
                                fontWeight={i === days.length - 1 ? '800' : '600'}
                                textAnchor="middle">
                                {WEEKDAY[day.date.getDay()]}
                            </SvgText>
                        ))}
                    </Svg>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: C.bgMid,
        borderRadius: VisualSystem.radius.md,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        padding: 16,
        marginBottom: 16,
    },
    metricRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 16,
    },
    metricChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: VisualSystem.radius.pill,
        backgroundColor: C.bgDeep,
    },
    metricChipActive: {
        backgroundColor: C.navy,
    },
    metricChipText: {
        color: C.textSecondary,
        fontSize: 11,
        fontWeight: '700',
    },
    metricChipTextActive: {
        color: C.textOnNavy,
    },
    headingRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
    },
    headingText: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        color: C.textPrimary,
        fontSize: 15,
        fontWeight: '700',
    },
    subtitle: {
        color: C.textTertiary,
        fontSize: 11,
        marginTop: 2,
    },
    headingValue: {
        alignItems: 'flex-end',
    },
    average: {
        color: C.textPrimary,
        fontSize: 24,
        fontWeight: '800',
    },
    goalHint: {
        color: C.textTertiary,
        fontSize: 11,
        marginTop: 1,
    },
});
