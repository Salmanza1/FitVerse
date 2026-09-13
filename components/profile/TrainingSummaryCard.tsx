import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Svg, Rect, Line, Circle, Text as SvgText } from 'react-native-svg';
import { VisualSystem } from '@/constants/VisualSystem';
import { safeImpact } from '@/lib/safeHaptics';
import {
    formatDuration,
    formatVolume,
    type TrainingTotals,
    type WeekBucket,
} from '@/features/profile/profileStats';

/**
 * The profile's training summary — this week's totals over a twelve week bar
 * chart, the way a training app opens rather than a grid of buttons.
 */

const C = VisualSystem.colors;

const CHART_HEIGHT = 132;
/** Room on the right for the axis values, which sit outside the plot. */
const VALUE_GUTTER = 46;
/** Room under the plot for month labels. */
const LABEL_BAND = 20;

type Metric = 'volume' | 'seconds' | 'workouts';

const METRICS: { key: Metric; label: string }[] = [
    { key: 'volume', label: 'Volume' },
    { key: 'seconds', label: 'Time' },
    { key: 'workouts', label: 'Sessions' },
];

function valueOf(week: WeekBucket, metric: Metric): number {
    if (metric === 'volume') return week.volume;
    if (metric === 'seconds') return week.seconds;
    return week.workouts;
}

function formatAxis(value: number, metric: Metric, unitLabel: string): string {
    if (metric === 'volume') return `${formatVolume(value)} ${unitLabel}`;
    if (metric === 'seconds') return formatDuration(value);
    return `${Math.round(value)}`;
}

export function TrainingSummaryCard({
    weeks,
    thisWeek,
    unitLabel,
    loading,
}: {
    weeks: WeekBucket[];
    thisWeek: TrainingTotals;
    /** 'lb' or 'kg', matching how the rest of the app reports volume. */
    unitLabel: string;
    loading?: boolean;
}) {
    // null until the reader picks one, so the default can follow the data.
    const [chosenMetric, setChosenMetric] = useState<Metric | null>(null);
    const [plotWidth, setPlotWidth] = useState(0);

    /**
     * Volume is the headline for lifting, but a run or a plank records none —
     * and neither does a first session that was either. Falling back to a
     * metric the data can answer stops a real session reading as no session.
     */
    const suggestedMetric = useMemo<Metric>(() => {
        if (weeks.some((w) => w.volume > 0)) return 'volume';
        if (weeks.some((w) => w.seconds > 0)) return 'seconds';
        return 'workouts';
    }, [weeks]);

    const metric = chosenMetric ?? suggestedMetric;
    const setMetric = setChosenMetric;

    const values = useMemo(() => weeks.map((w) => valueOf(w, metric)), [weeks, metric]);
    const peak = useMemo(() => Math.max(...values, 0), [values]);
    const loggedWeeks = useMemo(() => weeks.filter((w) => w.workouts > 0).length, [weeks]);

    const monthTicks = useMemo(() => {
        // Label a week only where its month differs from the week before, so the
        // axis reads JUL / AUG / SEP rather than twelve repeats.
        return weeks.map((week, i) => {
            const previous = weeks[i - 1];
            if (previous && previous.start.getMonth() === week.start.getMonth()) return null;
            return week.start.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
        });
    }, [weeks]);

    const chartWidth = Math.max(0, plotWidth - VALUE_GUTTER);
    const slot = weeks.length > 0 ? chartWidth / weeks.length : 0;
    const barWidth = Math.max(4, slot * 0.52);
    const hasData = peak > 0;

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

            <Text style={styles.title}>This week</Text>

            <View style={styles.statRow}>
                <Stat label="Sessions" value={loading ? '—' : `${thisWeek.workouts}`} />
                <Stat label="Time" value={loading ? '—' : formatDuration(thisWeek.seconds)} />
                <Stat
                    label="Volume"
                    value={loading ? '—' : formatVolume(thisWeek.volume)}
                    suffix={thisWeek.volume > 0 ? unitLabel : undefined}
                />
            </View>

            <Text style={styles.chartLabel}>Past 12 weeks</Text>

            <View onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}>
                {plotWidth > 0 && (
                    <Svg width={plotWidth} height={CHART_HEIGHT + LABEL_BAND}>
                        {/* Baseline, plus a ceiling line once there is a peak to draw it at. */}
                        <Line
                            x1={0}
                            y1={CHART_HEIGHT}
                            x2={chartWidth}
                            y2={CHART_HEIGHT}
                            stroke={C.borderStrong}
                            strokeWidth={1}
                        />
                        {hasData && (
                            <>
                                <Line
                                    x1={0}
                                    y1={4}
                                    x2={chartWidth}
                                    y2={4}
                                    stroke={C.borderSubtle}
                                    strokeWidth={1}
                                />
                                <SvgText
                                    x={chartWidth + 8}
                                    y={9}
                                    fill={C.textTertiary}
                                    fontSize={11}
                                    fontWeight="600">
                                    {formatAxis(peak, metric, unitLabel)}
                                </SvgText>
                            </>
                        )}
                        <SvgText
                            x={chartWidth + 8}
                            y={CHART_HEIGHT + 4}
                            fill={C.textTertiary}
                            fontSize={11}
                            fontWeight="600">
                            0
                        </SvgText>

                        {/* A dot per week on the baseline. Without them a
                            lone session is one bar in an empty box, which
                            reads as broken rather than as one session. */}
                        {weeks.map((week, i) => (
                            <Circle
                                key={`tick-dot-${week.start.getTime()}`}
                                cx={i * slot + slot / 2}
                                cy={CHART_HEIGHT}
                                r={2}
                                fill={values[i] > 0 ? C.gold : C.borderStrong}
                            />
                        ))}

                        {weeks.map((week, i) => {
                            const value = values[i];
                            if (value <= 0) return null;
                            const isCurrent = i === weeks.length - 1;
                            // Anything logged keeps a visible stub, so a light
                            // week reads as light rather than as nothing at all.
                            const height = Math.max(3, (value / peak) * (CHART_HEIGHT - 10));

                            return (
                                <Rect
                                    key={week.start.getTime()}
                                    x={i * slot + (slot - barWidth) / 2}
                                    y={CHART_HEIGHT - height}
                                    width={barWidth}
                                    height={height}
                                    rx={Math.min(4, barWidth / 2)}
                                    fill={isCurrent ? C.navy : C.gold}
                                    opacity={isCurrent ? 1 : 0.85}
                                />
                            );
                        })}

                        {weeks.map((week, i) =>
                            monthTicks[i] ? (
                                <SvgText
                                    key={`tick-${week.start.getTime()}`}
                                    x={i * slot + slot / 2}
                                    y={CHART_HEIGHT + 15}
                                    fill={C.textTertiary}
                                    fontSize={10}
                                    fontWeight="700"
                                    textAnchor="middle">
                                    {monthTicks[i]}
                                </SvgText>
                            ) : null
                        )}
                    </Svg>
                )}
            </View>

            {!loading && !hasData && (
                <Text style={styles.empty}>
                    {loggedWeeks > 0
                        ? 'Nothing to chart for this measure yet — try Sessions.'
                        : 'Log a session and it shows up here the same day.'}
                </Text>
            )}
        </View>
    );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statLabel}>{label}</Text>
            <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{value}</Text>
                {!!suffix && <Text style={styles.statSuffix}>{suffix}</Text>}
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
        padding: VisualSystem.spacing.lg,
        ...VisualSystem.shadow.card,
    },
    metricRow: {
        flexDirection: 'row',
        gap: VisualSystem.spacing.sm,
        marginBottom: VisualSystem.spacing.lg,
    },
    metricChip: {
        paddingHorizontal: VisualSystem.spacing.md,
        paddingVertical: 6,
        borderRadius: VisualSystem.radius.pill,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    metricChipActive: {
        borderColor: C.borderGold,
        backgroundColor: C.goldMuted,
    },
    metricChipText: {
        fontSize: VisualSystem.text.small,
        fontWeight: '700',
        color: C.textSecondary,
    },
    metricChipTextActive: { color: C.goldText },
    title: {
        fontSize: VisualSystem.text.title,
        fontWeight: '800',
        color: C.textPrimary,
        letterSpacing: -0.3,
    },
    statRow: {
        flexDirection: 'row',
        marginTop: VisualSystem.spacing.md,
        marginBottom: VisualSystem.spacing.xl,
    },
    stat: { flex: 1 },
    statLabel: {
        fontSize: VisualSystem.text.small,
        color: C.textSecondary,
        marginBottom: 2,
    },
    statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    statValue: {
        fontSize: VisualSystem.text.heading,
        fontWeight: '800',
        color: C.textPrimary,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums'],
    },
    statSuffix: {
        fontSize: VisualSystem.text.small,
        fontWeight: '700',
        color: C.textSecondary,
    },
    chartLabel: {
        fontSize: VisualSystem.text.small,
        color: C.textSecondary,
        marginBottom: VisualSystem.spacing.md,
    },
    empty: {
        fontSize: VisualSystem.text.small,
        color: C.textTertiary,
        marginTop: VisualSystem.spacing.md,
    },
});
