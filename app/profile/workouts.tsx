import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { VisualSystem } from '@/constants/VisualSystem';
import { useAuth } from '@/features/auth/AuthContext';
import { getPerformedExercises, getExerciseProgress } from '@/features/workout/WorkoutStore';
import { Svg, Path, Circle, Line, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const C = VisualSystem.colors;

export default function WorkoutProgressScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [exercises, setExercises] = useState<string[]>([]);
    const [searchText, setSearchText] = useState('');
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
    const [progressData, setProgressData] = useState<{ date: string, maxWeight: number, volume: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) loadInitialData();
    }, [user]);

    useEffect(() => {
        if (selectedExercise && user) loadExerciseProgress();
    }, [selectedExercise]);

    const loadInitialData = async () => {
        setLoading(true);
        if (!user) return;
        const exers = await getPerformedExercises(user.id);
        setExercises(exers);
        if (exers.length > 0) setSelectedExercise(exers[0]);
        setLoading(false);
    };

    const loadExerciseProgress = async () => {
        if (!user || !selectedExercise) return;
        const data = await getExerciseProgress(user.id, selectedExercise);
        setProgressData(data);
    };

    const triggerHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const filteredExercises = useMemo(() => {
        return exercises.filter(ex => ex.toLowerCase().includes(searchText.toLowerCase()));
    }, [exercises, searchText]);

    const peakWeight = progressData.length > 0 ? Math.max(...progressData.map(d => d.maxWeight)) : 0;
    const latestWeight = progressData.length > 0 ? progressData[progressData.length - 1].maxWeight : 0;
    const weightUnit = user?.weightUnitLbs !== false ? 'lbs' : 'kg';

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator color={C.gold} size="large" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <FontAwesome name="chevron-left" size={18} color={C.gold} />
                </Pressable>
                <Text style={styles.headerTitle}>Progress Lab</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <FontAwesome name="search" size={14} color={C.textTertiary} />
                        <TextInput 
                            style={styles.searchInput}
                            placeholder="Find exercise..."
                            placeholderTextColor={C.textTertiary}
                            value={searchText}
                            onChangeText={setSearchText}
                        />
                        {searchText.length > 0 && (
                            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
                                <FontAwesome name="times-circle" size={16} color={C.textTertiary} />
                            </Pressable>
                        )}
                    </View>

                    {searchText.length > 0 && (
                        <View style={styles.searchResults}>
                            {filteredExercises.map(ex => (
                                <Pressable 
                                    key={ex} 
                                    onPress={() => { 
                                        setSelectedExercise(ex); 
                                        setSearchText(''); 
                                        triggerHaptic(); 
                                    }}
                                    style={styles.searchItem}
                                >
                                    <Text style={styles.searchItemText} numberOfLines={1}>{ex}</Text>
                                    {selectedExercise === ex && <FontAwesome name="check" size={12} color={C.gold} />}
                                </Pressable>
                            ))}
                            {filteredExercises.length === 0 && (
                                <Text style={styles.noResultsText}>No recorded data for that exercise.</Text>
                            )}
                        </View>
                    )}
                </View>

                {exercises.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
                        {exercises.slice(0, 12).map(ex => (
                            <Pressable
                                key={ex}
                                onPress={() => { setSelectedExercise(ex); triggerHaptic(); }}
                                style={[styles.chip, selectedExercise === ex && styles.chipActive]}
                            >
                                <Text style={[styles.chipText, selectedExercise === ex && styles.chipTextActive]} numberOfLines={1}>
                                    {ex}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}

                {selectedExercise ? (
                    <View style={styles.mainView}>
                        <View style={styles.selectedExHeader}>
                            <Text style={styles.selectedExLabel}>Tracking</Text>
                            <Text style={styles.selectedExName} numberOfLines={2}>{selectedExercise}</Text>
                        </View>

                        {progressData.length > 0 ? (
                            <>
                                <View style={styles.statsRow}>
                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>Peak</Text>
                                        <Text style={styles.statValue}>{peakWeight}</Text>
                                        <Text style={styles.statUnit}>{weightUnit}</Text>
                                    </View>
                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>Latest</Text>
                                        <Text style={styles.statValue}>{latestWeight}</Text>
                                        <Text style={styles.statUnit}>{weightUnit}</Text>
                                    </View>
                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>Sessions</Text>
                                        <Text style={styles.statValue}>{progressData.length}</Text>
                                        <Text style={styles.statUnit}>logged</Text>
                                    </View>
                                </View>

                                <View style={styles.chartWrapper}>
                                    <View style={styles.chartHeader}>
                                        <Text style={styles.chartTitle}>Strength Growth</Text>
                                        <Text style={styles.chartUnit}>{weightUnit}</Text>
                                    </View>
                                    <SimpleLineChart data={progressData} field="maxWeight" color={C.gold} />
                                </View>

                                <View style={styles.chartWrapper}>
                                    <View style={styles.chartHeader}>
                                        <Text style={styles.chartTitle}>Volume Intensity</Text>
                                        <Text style={styles.chartUnit}>total vol</Text>
                                    </View>
                                    <SimpleLineChart data={progressData} field="volume" color={C.textSecondary} />
                                </View>

                                <View style={styles.logSection}>
                                    <Text style={styles.sectionTitle}>Session Registry</Text>
                                    {progressData.slice().reverse().map((item, i) => (
                                        <View key={i} style={styles.logCard}>
                                            <View style={styles.logLeft}>
                                                <Text style={styles.logDate}>
                                                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </Text>
                                                <Text style={styles.logSub}>Session #{progressData.length - i}</Text>
                                            </View>
                                            <View style={styles.logRight}>
                                                <View style={styles.logValBox}>
                                                    <Text style={styles.logValLab}>Max</Text>
                                                    <Text style={styles.logVal}>{item.maxWeight}</Text>
                                                </View>
                                                <View style={styles.logValDivider} />
                                                <View style={styles.logValBox}>
                                                    <Text style={styles.logValLab}>Vol</Text>
                                                    <Text style={styles.logVal}>{formatVolume(item.volume)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </>
                        ) : (
                            <View style={styles.emptyProgress}>
                                <FontAwesome name="line-chart" size={36} color={C.goldMuted} />
                                <Text style={styles.emptyProgressText}>
                                    Start logging sessions for this exercise to generate insights.
                                </Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.noExSelected}>
                        <FontAwesome name="search" size={40} color={C.goldMuted} />
                        <Text style={styles.noExSelectedText}>
                            Search or pick an exercise above to analyze your performance.
                        </Text>
                    </View>
                )}
                
                <View style={{ height: 120 }} />
            </ScrollView>
        </View>
    );
}

function formatVolume(vol: number) {
    if (vol >= 1000) return `${Math.round(vol / 100) / 10}k`;
    return String(Math.round(vol));
}

function SimpleLineChart({ data, field, color }: { data: { date: string, maxWeight: number, volume: number }[], field: 'maxWeight' | 'volume', color: string }) {
    const width = Dimensions.get('window').width - 72;
    const height = 170;
    const paddingX = 32;
    const paddingY = 28;

    const values = data.map(d => d[field]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const normalizedPoints = data.map((d, i) => {
        const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * (width - 2 * paddingX) + paddingX;
        const y = height - ((d[field] - min) / range) * (height - 2 * paddingY) - paddingY;
        return { x, y };
    });

    const pathData = normalizedPoints.map((p, i) => 
        (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)
    ).join(' ');

    const fillData = `L ${normalizedPoints[normalizedPoints.length - 1].x} ${height - paddingY} L ${normalizedPoints[0].x} ${height - paddingY} Z`;
    const gradId = `grad-${field}`;

    return (
        <View style={styles.svgContainer}>
            <Svg width={width} height={height}>
                <Defs>
                    <SvgGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color} stopOpacity="0.22" />
                        <Stop offset="1" stopColor={color} stopOpacity="0" />
                    </SvgGradient>
                </Defs>

                {[0, 0.5, 1].map(v => (
                    <Line 
                        key={v}
                        x1={paddingX} 
                        y1={paddingY + (height - 2 * paddingY) * v} 
                        x2={width - paddingX} 
                        y2={paddingY + (height - 2 * paddingY) * v} 
                        stroke={C.borderSubtle}
                        strokeDasharray="4 4"
                    />
                ))}

                {data.length > 1 && (
                    <>
                        <Path d={pathData + fillData} fill={`url(#${gradId})`} />
                        <Path
                            d={pathData}
                            fill="none"
                            stroke={color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </>
                )}

                {normalizedPoints.map((p, i) => (
                    <React.Fragment key={i}>
                        <Circle cx={p.x} cy={p.y} r="4" fill={C.bgMid} stroke={color} strokeWidth="2" />
                        {(i === 0 || i === normalizedPoints.length - 1 || data[i][field] === max) && (
                            <SvgText 
                                x={p.x} 
                                y={p.y - 10} 
                                fill={color} 
                                fontSize="10" 
                                fontWeight="bold" 
                                textAnchor="middle"
                            >
                                {Math.round(data[i][field])}
                            </SvgText>
                        )}
                    </React.Fragment>
                ))}
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgBase },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 56,
        marginBottom: 8,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: C.goldMuted,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    headerTitle: {
        color: C.textTertiary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    content: { flex: 1, paddingHorizontal: 20 },
    searchContainer: { zIndex: 100, marginBottom: 14 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.glassFill,
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 48,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        gap: 10,
    },
    searchInput: { flex: 1, color: C.textPrimary, fontSize: 15, fontWeight: '600' },
    searchResults: {
        position: 'absolute',
        top: 54,
        left: 0,
        right: 0,
        backgroundColor: C.bgElevated,
        borderRadius: 14,
        padding: 8,
        borderWidth: 1,
        borderColor: C.borderGold,
        maxHeight: 280,
        ...VisualSystem.shadow.card,
    },
    searchItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.borderSubtle,
        gap: 10,
    },
    searchItemText: { color: C.textPrimary, fontWeight: '600', fontSize: 14, flex: 1 },
    noResultsText: { color: C.textTertiary, textAlign: 'center', padding: 20, fontSize: 13 },
    chipScroll: { marginBottom: 18 },
    chipRow: { gap: 8, paddingRight: 8 },
    chip: {
        maxWidth: 160,
        backgroundColor: C.bgElevated,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    chipActive: {
        backgroundColor: C.goldMuted,
        borderColor: C.borderGold,
    },
    chipText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: C.gold, fontWeight: '800' },
    mainView: { flex: 1 },
    selectedExHeader: { marginBottom: 16 },
    selectedExLabel: {
        color: C.gold,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    selectedExName: { color: C.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: {
        flex: 1,
        backgroundColor: C.bgElevated,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    statLabel: {
        color: C.textTertiary,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    statValue: { color: C.gold, fontSize: 18, fontWeight: '900' },
    statUnit: { color: C.textTertiary, fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
    chartWrapper: {
        backgroundColor: C.glassFill,
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
        marginBottom: 6,
    },
    chartTitle: { color: C.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
    chartUnit: { color: C.textTertiary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    svgContainer: { alignItems: 'center', marginTop: 4 },
    logSection: { marginTop: 8 },
    sectionTitle: {
        color: C.textTertiary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    logCard: {
        flexDirection: 'row',
        backgroundColor: C.glassFill,
        borderRadius: 14,
        padding: 14,
        marginBottom: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    logLeft: { flex: 1 },
    logDate: { color: C.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
    logSub: { color: C.textTertiary, fontSize: 11, fontWeight: '600' },
    logRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logValBox: { alignItems: 'center', minWidth: 44 },
    logValDivider: { width: 1, height: 28, backgroundColor: C.borderSubtle },
    logValLab: { color: C.textTertiary, fontSize: 9, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5 },
    logVal: { color: C.gold, fontSize: 15, fontWeight: '900' },
    emptyProgress: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: C.glassFill,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        gap: 14,
    },
    emptyProgressText: { color: C.textSecondary, textAlign: 'center', lineHeight: 20, fontSize: 14 },
    noExSelected: {
        alignItems: 'center',
        padding: 48,
        marginTop: 24,
        backgroundColor: C.glassFill,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        gap: 14,
    },
    noExSelectedText: { color: C.textSecondary, textAlign: 'center', fontSize: 15, fontWeight: '600', lineHeight: 22 },
});
