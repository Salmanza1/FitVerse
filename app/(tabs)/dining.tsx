import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Modal, FlatList, Alert, ImageBackground, Dimensions, Platform, Animated, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Themed';
import { useAuth } from '@/features/auth/AuthContext';
import { getDailyLog, addFoodToLog, removeFoodFromLog, getRecentLogs, updateFoodInLog } from '@/features/nutrition/NutritionStore';
import { FoodItem, DailyLog, MealType, LoggedFoodItem } from '@/types/nutrition';
import { getCurrentMealPeriod, getAvailableItems, DiningLocation, normalizeCategory } from '@/features/nutrition/DiningUtils';
import { fetchLiveMenu } from '@/features/nutrition/NutrisliceService';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { Tokens } from '@/constants/Tokens';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { StyledButton } from '@/components/ui/StyledButton';
import { StyledInput } from '@/components/ui/StyledInput';
import { StyledSelect } from '@/components/ui/StyledSelect';
import * as Haptics from 'expo-haptics';
import { calculateMultiplier, getAvailableUnits, formatAmount, UNITS } from '@/features/nutrition/NutritionUtils';
import { FoodScannerModal } from '@/features/nutrition/FoodScannerModal';
import { estimateFoodFromDescription, estimateToFoodItem } from '@/features/nutrition/NutritionAIService';
import { SwipeToDeleteRow } from '@/components/workout/SwipeToDeleteRow';
import { getNutritionBudgetView } from '@/lib/nutrition';
import { useFocusEffect } from 'expo-router';
import { Svg, Circle as SvgCircle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { VisualSystem } from '@/constants/VisualSystem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DISPLAY_MEALS: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const MEAL_ICONS: Record<string, string> = {
    Breakfast: 'coffee',
    Lunch: 'sun-o',
    Dinner: 'moon-o',
    Snack: 'leaf',
};

function itemsForDisplayMeal(meal: MealType, entries: (LoggedFoodItem & { mealType: MealType })[]) {
    if (meal === 'Breakfast') return entries.filter(e => e.mealType === 'Breakfast' || e.mealType === 'Brunch');
    if (meal === 'Lunch') return entries.filter(e => e.mealType === 'Lunch' || e.mealType === 'Late Lunch');
    return entries.filter(e => e.mealType === meal);
}

function mealKcalTotal(items: LoggedFoodItem[]) {
    return Math.round(items.reduce((acc, i) => acc + i.calories * (i.quantity || 1), 0));
}

function currentMealBucket(): MealType {
    const current = getCurrentMealPeriod();
    if (current === 'Brunch') return 'Breakfast';
    if (current === 'Late Lunch') return 'Lunch';
    if (current === 'Snack') return 'Snack';
    return current;
}

export default function NutritionDashboard() {
    const { user } = useAuth();
    const [log, setLog] = useState<DailyLog | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedMeal, setSelectedMeal] = useState<MealType>(getCurrentMealPeriod());
    const [selectedLocation, setSelectedLocation] = useState<DiningLocation>('North');
    
    // Inline Editor State
    const [expandedFoodId, setExpandedFoodId] = useState<string | null>(null);
    const [itemToLog, setItemToLog] = useState<FoodItem | null>(null);
    const [logAmount, setLogAmount] = useState('1');
    const [logUnit, setLogUnit] = useState('serving');

    // UI State
    const [loading, setLoading] = useState(false);
    const [modalSearch, setModalSearch] = useState('');
    const [liveMenu, setLiveMenu] = useState<FoodItem[]>([]);
    const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>(() => {
        const active = currentMealBucket();
        return Object.fromEntries(DISPLAY_MEALS.map(meal => [meal, meal === active]));
    });
    
    // Core State: Single source of truth array for UI convenience
    const [foodEntries, setFoodEntries] = useState<(LoggedFoodItem & { mealType: MealType; entryIndex?: number })[]>([]);

    // Interaction State
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [isScannerVisible, setIsScannerVisible] = useState(false);
    const [quickLogText, setQuickLogText] = useState('');
    const [quickLogging, setQuickLogging] = useState(false);
    const [lastAiLogMessage, setLastAiLogMessage] = useState<string | null>(null);
    const aiLogInputRef = useRef<TextInput>(null);
    const [expandedStations, setExpandedStations] = useState<Record<string, boolean>>({});
    
    // Dynamic Date Handling: Resets strictly every 24 hours
    const today = useMemo(() => new Date().toISOString().split('T')[0], [
        new Date().getDate() 
    ]);

    const loadLog = async () => {
        if (!user) return;
        const data = await getDailyLog(user.id, today, user);
        setLog(data);
        
        const flattened: (LoggedFoodItem & { mealType: MealType })[] = [];
        Object.entries(data.meals || {}).forEach(([mealType, items]) => {
            if (Array.isArray(items)) {
                items.forEach(item => {
                    flattened.push({ ...item, mealType: mealType as MealType });
                });
            }
        });
        setFoodEntries(flattened);

        const activeMeal = currentMealBucket();
        setExpandedMeals(prev => {
            if (Object.keys(prev).length === 0) {
                const initial: Record<string, boolean> = {};
                DISPLAY_MEALS.forEach(meal => {
                    const count = itemsForDisplayMeal(meal, flattened).length;
                    initial[meal] = count > 0 || meal === activeMeal;
                });
                return initial;
            }
            return prev;
        });
    };

    const loadLiveMenu = async () => {
        if (loading) return; 
        setLoading(true);
        try {
            const meals = await fetchLiveMenu(selectedLocation, today);
            setLiveMenu(meals || []);
        } catch (e) {
            console.error('[Nutrition] Live fetch failed:', e);
        } finally {
            setLoading(false);
        }
    };

    const scrollY = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();
    
    // Header Animation Values
    const HEADER_MAX_HEIGHT = 280;
    const HEADER_MIN_HEIGHT = insets.top + 70;
    const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

    const headerHeight = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
        extrapolate: 'clamp',
    });

    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [0, 0],
        extrapolate: 'clamp',
    });

    const imageOpacity = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
        outputRange: [1, 1, 0.4],
        extrapolate: 'clamp',
    });

    const imageTranslateY = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [0, -50],
        extrapolate: 'clamp',
    });

    const headerBgOpacity = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const titleScale = scrollY.interpolate({
        inputRange: [-100, 0, HEADER_SCROLL_DISTANCE],
        outputRange: [1.1, 1, 0.85],
        extrapolate: 'clamp',
    });

    useEffect(() => { 
        loadLog(); 
    }, [today, user]);

    useFocusEffect(
        useCallback(() => {
            loadLog();
        }, [user, today])
    );

    useEffect(() => {
        loadLiveMenu();
    }, [selectedLocation, today]);

    const toggleExpand = (item: FoodItem, existingId?: string) => {
        if (expandedFoodId === item.id && (!existingId || editingEntryId === existingId)) {
            setExpandedFoodId(null);
            setEditingEntryId(null);
            setItemToLog(null);
        } else {
            setExpandedFoodId(item.id);
            setEditingEntryId(existingId || null);
            setItemToLog(item);
            if (existingId) {
                const entry = foodEntries.find(e => e.id === existingId);
                setLogAmount(entry?.amount.toString() || '1');
                setLogUnit(entry?.unit || item.baseUnit || 'serving');
            } else {
                setLogAmount('1');
                setLogUnit(item.baseUnit || 'serving');
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const confirmAddOrEdit = async () => {
        if (!itemToLog || !user || loading) return;
        setLoading(true);
        const amount = parseFloat(logAmount);
        
        if (isNaN(amount) || amount <= 0) {
            Alert.alert("Invalid Amount", "Please enter a positive numeric quantity.");
            setLoading(false);
            return;
        }

        const multiplier = calculateMultiplier(amount, logUnit, itemToLog.baseAmount || 1, itemToLog.baseUnit || 'serving');
        
        try {
            if (editingEntryId) {
                const entry = foodEntries.find(e => e.id === editingEntryId);
                if (entry) {
                    const mealItems = foodEntries.filter(e => e.mealType === entry.mealType);
                    const indexInMeal = mealItems.findIndex(e => e.id === entry.id);
                    await updateFoodInLog(user.id, today, entry.mealType, indexInMeal, {
                        quantity: multiplier,
                        amount: amount,
                        unit: logUnit
                    }, user);
                }
            } else {
                await addFoodToLog(user.id, today, selectedMeal, itemToLog, multiplier, amount, logUnit, user);
            }
            
            await loadLog();
            setExpandedMeals(prev => ({ ...prev, [selectedMeal]: true }));
            setExpandedFoodId(null);
            setItemToLog(null);
            setEditingEntryId(null);
            
            if (modalVisible) {
                setTimeout(() => setModalVisible(false), 500);
            }
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            Alert.alert("Error", "Could not save entry.");
        } finally {
            setLoading(false);
        }
    };

    const handleScannerAddItem = async (item: FoodItem, quantity: number, amount: number, unit: string, meal: MealType) => {
        if (!user) return;
        setLoading(true);
        try {
            await addFoodToLog(user.id, today, meal, item, quantity, amount, unit, user);
            await loadLog();
            setExpandedMeals(prev => ({ ...prev, [meal]: true }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            Alert.alert("Error", "Could not log scanned item.");
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAiLog = async () => {
        const text = quickLogText.trim();
        if (!text || !user || quickLogging) return;

        const meal = currentMealBucket();
        setQuickLogging(true);
        setLastAiLogMessage(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const result = await estimateFoodFromDescription(text);
            const item = estimateToFoodItem(result);
            await addFoodToLog(user.id, today, meal, item, 1, 1, item.baseUnit || 'serving', user);
            await loadLog();
            setExpandedMeals(prev => ({ ...prev, [meal]: true }));
            setQuickLogText('');
            setLastAiLogMessage(`Logged ${result.name} · ~${result.calories} kcal to ${meal}`);
            setTimeout(() => setLastAiLogMessage(null), 3500);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e: any) {
            Alert.alert('Could not log', e?.message || 'Try adding a bit more detail about what you ate.');
        } finally {
            setQuickLogging(false);
        }
    };

    const focusQuickAiLog = () => {
        aiLogInputRef.current?.focus();
    };

    const handleRemove = async (meal: MealType, entryId: string) => {
        if (!user) return;
        try {
            const mealItems = foodEntries.filter(e => e.mealType === meal);
            const indexInMeal = mealItems.findIndex(e => e.id === entryId);
            if (indexInMeal === -1) return;

            await removeFoodFromLog(user.id, today, meal, indexInMeal, user);
            await loadLog();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (e) {
            Alert.alert("Error", "Could not remove item.");
        }
    };

    const toggleMeal = (meal: string) => {
        setExpandedMeals(prev => ({ ...prev, [meal]: !prev[meal] }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const aiRecommendation = useMemo(() => {
        if (!user || !log) return "";
        const targets = log.totals;
        const budget = getNutritionBudgetView(targets, true);
        const calorieProgress = targets.calories / (budget.effectiveGoal || 1);
        const proteinProgress = targets.protein / (targets.protein_goal_g || 1);
        const remainingCals = budget.remaining;
        const meal = getCurrentMealPeriod();
        const workoutNote = budget.workoutBurn > 0
            ? ` Your gym session added ~${budget.workoutBurn} kcal to today's budget.`
            : '';

        if (targets.calories === 0 && budget.workoutBurn > 0) {
            return `Nice work in the gym — you've got ~${remainingCals} kcal to fuel recovery. Log ${meal} when you're ready.`;
        }
        if (targets.calories === 0) {
            return `Starting fresh for ${meal} — any log is a win. A mix of protein and carbs is a simple place to begin.`;
        }
        if (budget.isOverBudget) {
            return `You're about ${budget.overBy} kcal over today — one lighter meal or a walk can balance things out. No stress.`;
        }
        if (remainingCals < 50) {
            return "You're around your target for today. Hydration and rest count too — no need to force more food.";
        }
        if (proteinProgress < 0.4 && calorieProgress > 0.5) {
            return `A light protein add at your next meal could help — chicken, eggs, yogurt, or dining hall lean options.${workoutNote}`;
        }
        if (remainingCals > 400) {
            return `About ${remainingCals} kcal left in your plan — steady pacing beats trying to catch up all at once.`;
        }
        return `You're on your way today.${workoutNote} Small, consistent choices beat perfect days.`;
    }, [log, user]);

    function renderTodayView() {
        if (!user) return null;
        if (!log) {
            return (
                <View style={styles.loadingCard}>
                    <ActivityIndicator color={VisualSystem.colors.gold} />
                    <Text style={styles.loadingText}>Loading nutrition...</Text>
                </View>
            );
        }
        const targets = log.totals;
        const budget = getNutritionBudgetView(targets, true);
        const ringSize = 150;
        const ringRadius = 66;
        const ringCenter = ringSize / 2;
        const ringCircumference = 2 * Math.PI * ringRadius;

        return (
            <>
                <View style={[styles.dashboardCard, { paddingBottom: 16 }]}>
                    {budget.burned > 0 && (
                        <View style={styles.budgetBreakdown}>
                            <View style={styles.budgetRow}>
                                <Text style={styles.budgetLabel}>Daily goal</Text>
                                <Text style={styles.budgetValue}>{budget.goal}</Text>
                            </View>
                            {budget.workoutBurn > 0 && (
                                <View style={styles.budgetRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <FontAwesome name="heartbeat" size={10} color="#40c057" />
                                        <Text style={styles.budgetLabelGreen}>From gym</Text>
                                    </View>
                                    <Text style={styles.budgetValueGreen}>+{budget.workoutBurn}</Text>
                                </View>
                            )}
                            {budget.burned > budget.workoutBurn && (
                                <View style={styles.budgetRow}>
                                    <Text style={styles.budgetLabel}>Other activity</Text>
                                    <Text style={styles.budgetValueGreen}>+{budget.burned - budget.workoutBurn}</Text>
                                </View>
                            )}
                            <View style={[styles.budgetRow, styles.budgetRowTotal]}>
                                <Text style={styles.budgetLabelTotal}>Today's budget</Text>
                                <Text style={styles.budgetValueTotal}>{budget.effectiveGoal}</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.topDashboard}>
                        <View style={styles.glowCircleContainer}>
                            <Svg width={ringSize} height={ringSize} style={{ position: 'absolute' }}>
                                <Defs>
                                    <SvgGradient id="ringGrad" x1="0" y1="0" x2="0" y2="1">
                                        <Stop offset="0" stopColor={FitVerseTheme.colors.ndGold} />
                                        <Stop offset="1" stopColor="#A68926" />
                                    </SvgGradient>
                                </Defs>
                                {/* Background Ring */}
                                <SvgCircle 
                                    cx={ringCenter} cy={ringCenter} r={ringRadius} 
                                    stroke="rgba(255,255,255,0.05)" 
                                    strokeWidth="7" 
                                    fill="none" 
                                />
                                {/* Progress Ring */}
                                <SvgCircle 
                                    cx={ringCenter} cy={ringCenter} r={ringRadius} 
                                    stroke="url(#ringGrad)" 
                                    strokeWidth="7" 
                                    strokeDasharray={`${ringCircumference}`}
                                    strokeDashoffset={`${ringCircumference * (1 - budget.ringProgress)}`}
                                    strokeLinecap="round"
                                    fill="none"
                                    transform={`rotate(-90 ${ringCenter} ${ringCenter})`}
                                />
                            </Svg>
                            <View style={styles.glowCircleInner}>
                                <Text
                                    style={[styles.remainingVal, budget.isOverBudget && styles.remainingValOver]}
                                    adjustsFontSizeToFit
                                    numberOfLines={1}
                                >
                                    {budget.isOverBudget ? budget.overBy : budget.remaining}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.remainingLabel, budget.isOverBudget && styles.remainingLabelOver]}>
                                        {budget.isOverBudget ? 'OVER ' : 'REMAINING '}
                                    </Text>
                                    <FontAwesome
                                        name={budget.isOverBudget ? 'exclamation-circle' : 'leaf'}
                                        size={10}
                                        color={budget.isOverBudget ? VisualSystem.colors.danger : VisualSystem.colors.gold}
                                    />
                                </View>
                                {budget.workoutBurn > 0 && (
                                    <Text style={styles.exerciseNoteGreen}>+{budget.workoutBurn} gym</Text>
                                )}
                            </View>
                        </View>
                        <View style={styles.dashStatsCol}>
                            <View style={styles.miniStatBox}>
                                <Text style={styles.miniLabel}>FOOD LOGGED</Text>
                                <Text style={styles.miniValueGold} adjustsFontSizeToFit numberOfLines={1}>{Math.round(targets.calories)}</Text>
                            </View>
                            <View style={styles.miniStatBox}>
                                <Text style={styles.miniLabel}>CALORIES BURNED</Text>
                                <Text style={styles.miniValueGreen} adjustsFontSizeToFit numberOfLines={1}>{budget.burned}</Text>
                                {budget.workoutBurn > 0 && (
                                    <Text style={styles.workoutBurnNote}>FitVerse gym</Text>
                                )}
                            </View>
                        </View>
                    </View>
                    
                    <View style={styles.macroList}>
                        <MacroRow label="PROTEIN" current={targets.protein} target={targets.protein_goal_g || 150} icon="bolt" color={VisualSystem.colors.gold} />
                        <MacroRow label="CARBS" current={targets.carbs} target={targets.carb_goal_g || 200} icon="leaf" color="#4dabf7" />
                        <MacroRow label="FAT" current={targets.fat} target={targets.fat_goal_g || 60} icon="fire" color="#ff6b6b" />
                    </View>
                </View>

                <View style={styles.aiCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <FontAwesome name="magic" size={14} color={FitVerseTheme.colors.ndGold} />
                        <Text style={styles.aiTitle}> TODAY'S NUDGE</Text>
                    </View>
                    <Text style={styles.aiMessage}>"{aiRecommendation}"</Text>
                </View>

                <View style={styles.logSection}>
                    <View style={styles.logSectionHeader}>
                        <Text style={styles.logSectionTitle}>Today's log</Text>
                        <Text style={styles.logSectionMeta}>
                            {foodEntries.length === 0 ? 'Nothing logged yet' : `${foodEntries.length} item${foodEntries.length === 1 ? '' : 's'}`}
                        </Text>
                    </View>

                    <View style={styles.aiLogBar}>
                        <FontAwesome name="magic" size={14} color={VisualSystem.colors.gold} style={{ marginRight: 8 }} />
                        <TextInput
                            ref={aiLogInputRef}
                            style={styles.aiLogInput}
                            value={quickLogText}
                            onChangeText={setQuickLogText}
                            placeholder="Type what you ate — AI logs the estimate"
                            placeholderTextColor={VisualSystem.colors.textTertiary}
                            returnKeyType="done"
                            onSubmitEditing={handleQuickAiLog}
                            editable={!quickLogging}
                        />
                        <TouchableOpacity
                            style={[styles.aiLogBtn, (!quickLogText.trim() || quickLogging) && styles.aiLogBtnDisabled]}
                            onPress={handleQuickAiLog}
                            disabled={!quickLogText.trim() || quickLogging}
                        >
                            {quickLogging ? (
                                <ActivityIndicator size="small" color="#0C2340" />
                            ) : (
                                <Text style={styles.aiLogBtnText}>Log</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.aiLogHint, lastAiLogMessage && styles.aiLogHintSuccess]}>
                        {lastAiLogMessage || `Not from the dining hall? Just type it — logs to ${currentMealBucket()}.`}
                    </Text>

                    <View style={styles.mealList}>
                        {DISPLAY_MEALS.map(meal => (
                            <MealSection
                                key={meal}
                                type={meal}
                                mealItems={itemsForDisplayMeal(meal, foodEntries)}
                                isExpanded={!!expandedMeals[meal]}
                                isActiveMeal={meal === currentMealBucket()}
                                expandedId={expandedFoodId}
                                loading={loading}
                                onToggle={() => toggleMeal(meal)}
                                onAdd={() => {
                                    setSelectedMeal(meal);
                                    setModalSearch('');
                                    setModalVisible(true);
                                }}
                                onRemove={handleRemove}
                                onEdit={toggleExpand}
                                confirmEdit={confirmAddOrEdit}
                                logAmount={logAmount}
                                setLogAmount={setLogAmount}
                                logUnit={logUnit}
                                setLogUnit={setLogUnit}
                            />
                        ))}
                    </View>
                </View>
            </>
        );
    }

    return (
        <View style={styles.container}>
            {/* Animated Header */}
            <Animated.View 
                style={[
                    styles.heroContainer, 
                    { 
                        height: headerHeight,
                        transform: [{ translateY: headerTranslateY }],
                        zIndex: 10,
                    }
                ]}
            >
                <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: imageTranslateY }], opacity: imageOpacity }]}>
                    <ImageBackground source={require('@/assets/images/nutrition_hero_fitverse.png')} style={styles.heroImage}>
                        <LinearGradient colors={['rgba(12,35,64,0.1)', 'rgba(12,35,64,0.95)']} style={StyleSheet.absoluteFill} />
                    </ImageBackground>
                </Animated.View>

                {/* Navbar Background (Fades in) */}
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            // Fades in over the hero photo behind light type, so it
                            // stays dark even though the page is light.
                            backgroundColor: 'rgba(12, 35, 64, 0.88)',
                            opacity: headerBgOpacity,
                            borderBottomWidth: 1,
                            borderBottomColor: VisualSystem.colors.borderSubtle,
                        }
                    ]}
                />

                <View style={[styles.heroContent, { paddingTop: insets.top + 10 }]}>
                    <Animated.View style={{ transform: [{ scale: titleScale }] }}>
                        <View style={styles.headerRow}>
                            <View>
                                <Text style={styles.heroTitle}>FUEL & FLOW</Text>
                                <Text style={styles.heroSubtitle}>NUTRITION DASHBOARD</Text>
                            </View>
                            <View style={styles.headerActions}>
                                <TouchableOpacity style={styles.scanBtn} onPress={focusQuickAiLog}>
                                    <FontAwesome name="magic" size={13} color={VisualSystem.colors.goldBright} />
                                    <Text style={styles.scanText}>AI</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.scanBtn} onPress={() => setIsScannerVisible(true)}>
                                    <FontAwesome name="camera" size={13} color={FitVerseTheme.colors.ndGold} />
                                    <Text style={styles.scanText}>SCAN</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>
                </View>
            </Animated.View>

            <Animated.ScrollView 
                contentContainerStyle={{ paddingBottom: 32, paddingTop: HEADER_MAX_HEIGHT }} 
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    {renderTodayView()}
                </View>
            </Animated.ScrollView>

            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
                 <View style={styles.modalBg}>
                     <View style={styles.modalHeader}>
                         <View>
                             <Text style={styles.modalTitle}>Add {selectedMeal}</Text>
                             <Text style={styles.modalSubtitle}>Today's Fresh Selection</Text>
                         </View>
                         <TouchableOpacity accessibilityLabel="Close" hitSlop={6} onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                             <FontAwesome name="times" size={16} color={VisualSystem.colors.textPrimary} />
                         </TouchableOpacity>
                     </View>
                     
                     <View style={styles.modalSearchContainer}>
                        <StyledInput placeholder={`Search ${selectedLocation} Hall...`} value={modalSearch} onChangeText={setModalSearch} />
                     </View>

                     <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                        <View style={styles.locTabs}>
                            {['North', 'South'].map((loc) => (
                                <TouchableOpacity 
                                    key={loc}
                                    style={[styles.locTab, selectedLocation === loc && styles.locTabOn]} 
                                    onPress={() => setSelectedLocation(loc as any)}
                                >
                                    <Text style={[styles.locTabText, selectedLocation === loc && styles.locTabTextOn]}>{loc} Hall</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {(() => {
                            const items = liveMenu.filter(i => 
                                (i.name.toLowerCase().includes(modalSearch.toLowerCase()) || i.category?.toLowerCase().includes(modalSearch.toLowerCase())) &&
                                (i.mealTypes?.includes(selectedMeal) || (selectedMeal === 'Dinner' && i.mealTypes?.includes('Snack')))
                            );
                            const grouped: Record<string, FoodItem[]> = {};
                            items.forEach(item => {
                                const cat = normalizeCategory(item.category);
                                if (!grouped[cat]) grouped[cat] = [];
                                grouped[cat].push(item);
                            });

                            return Object.entries(grouped).map(([station, stationItems]) => (
                                <View key={station} style={styles.stationAccordion}>
                                    <TouchableOpacity 
                                        style={styles.stationHeader} 
                                        onPress={() => setExpandedStations(prev => ({ ...prev, [station]: !prev[station] }))}
                                    >
                                        <Text style={styles.stationName}>{station.toUpperCase()}</Text>
                                        <FontAwesome name={expandedStations[station] ? "chevron-up" : "plus"} size={14} color={VisualSystem.colors.textTertiary} />
                                    </TouchableOpacity>
                                    {expandedStations[station] && (
                                        <View style={styles.stationContent}>
                                            {stationItems.map(item => (
                                                <FoodItemCard 
                                                    key={item.id} 
                                                    item={item} 
                                                    isExpanded={expandedFoodId === item.id}
                                                    onToggle={() => toggleExpand(item)}
                                                    logAmount={logAmount}
                                                    setLogAmount={setLogAmount}
                                                    logUnit={logUnit}
                                                    setLogUnit={setLogUnit}
                                                    onConfirm={confirmAddOrEdit}
                                                    loading={loading}
                                                />
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ));
                        })()}
                        <View style={{ height: 100 }} />
                     </ScrollView>
                 </View>
            </Modal>
         
            <FoodScannerModal visible={isScannerVisible} onClose={() => setIsScannerVisible(false)} onAddItem={handleScannerAddItem} currentMeal={selectedMeal} />
        </View>
    );
}

// ── Shared Sub-Components ──

const MacroRow = ({ label, current, target, icon, color }: any) => {
    const percent = Math.min(Math.max((current / target) * 100, 0), 100);
    return (
        <View style={styles.macroRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={[styles.macroIconCircle, { backgroundColor: `${color}20` }]}>
                    <FontAwesome name={icon} size={10} color={color} />
                </View>
                <Text style={styles.macroRowLabel}>{label}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.macroRowStats}><Text style={{ color: VisualSystem.colors.textPrimary }}>{Math.round(current)}g</Text> / {target}g</Text>
            </View>
            <View style={styles.macroBarContainer}>
                <View style={[styles.macroBarFill, { backgroundColor: color, width: `${percent}%` }]} />
            </View>
        </View>
    );
};

const UnitChipPicker = ({
    options,
    value,
    onSelect,
}: {
    options: string[];
    value: string;
    onSelect: (unit: string) => void;
}) => (
    <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.unitChipRow}
        keyboardShouldPersistTaps="handled"
    >
        {options.map(opt => (
            <TouchableOpacity
                key={opt}
                onPress={() => onSelect(opt)}
                style={[styles.unitChip, value === opt && styles.unitChipActive]}
                activeOpacity={0.8}
            >
                <Text style={[styles.unitChipText, value === opt && styles.unitChipTextActive]}>{opt}</Text>
            </TouchableOpacity>
        ))}
    </ScrollView>
);

const CompactPortionEditor = ({
    item,
    logAmount,
    setLogAmount,
    logUnit,
    setLogUnit,
    onConfirm,
    loading,
    confirmLabel = 'Save',
}: {
    item: FoodItem;
    logAmount: string;
    setLogAmount: (v: string) => void;
    logUnit: string;
    setLogUnit: (v: string) => void;
    onConfirm: () => void;
    loading: boolean;
    confirmLabel?: string;
}) => {
    const amt = parseFloat(logAmount) || 0;
    const mult = calculateMultiplier(amt, logUnit, item.baseAmount || 1, item.baseUnit || 'serving');
    const previewKcal = Math.round((item.calories || 0) * mult);
    const units = getAvailableUnits(item.baseUnit);

    return (
        <View style={styles.portionEditor}>
            <Text style={styles.portionLabel}>Amount</Text>
            <TextInput
                value={logAmount}
                onChangeText={setLogAmount}
                keyboardType="decimal-pad"
                style={styles.portionAmountField}
                placeholderTextColor={VisualSystem.colors.textTertiary}
                selectTextOnFocus
            />
            <Text style={styles.portionLabel}>Unit</Text>
            <UnitChipPicker
                options={units}
                value={logUnit || item.baseUnit || 'serving'}
                onSelect={setLogUnit}
            />
            <View style={styles.portionEditorFooter}>
                <Text style={styles.portionPreview}>{previewKcal} kcal</Text>
                <TouchableOpacity onPress={onConfirm} style={styles.portionSaveBtn} disabled={loading}>
                    <Text style={styles.portionSaveText}>{loading ? '...' : confirmLabel}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const FoodItemCard = ({ item, isExpanded, onToggle, logAmount, setLogAmount, logUnit, setLogUnit, onConfirm, loading }: any) => {
    return (
        <View style={[styles.menuItemWrap, isExpanded && styles.menuItemWrapExpanded]}>
            <TouchableOpacity style={styles.menuItem} onPress={onToggle} activeOpacity={0.75}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.menuName, isExpanded && { color: FitVerseTheme.colors.ndGold }]} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.menuSub}>{item.calories} kcal · {item.servingSize || 'serving'}</Text>
                </View>
                <FontAwesome name={isExpanded ? 'chevron-up' : 'plus'} size={14} color={isExpanded ? 'rgba(255,255,255,0.35)' : FitVerseTheme.colors.ndGold} />
            </TouchableOpacity>
            {isExpanded && (
                <CompactPortionEditor
                    item={item}
                    logAmount={logAmount}
                    setLogAmount={setLogAmount}
                    logUnit={logUnit}
                    setLogUnit={setLogUnit}
                    onConfirm={onConfirm}
                    loading={loading}
                    confirmLabel="Add"
                />
            )}
        </View>
    );
};

const LoggedFoodRow = ({
    item,
    mealType,
    isEditing,
    onPress,
    onRemove,
    logAmount,
    setLogAmount,
    logUnit,
    setLogUnit,
    onConfirm,
    loading,
}: any) => {
    const kcal = Math.round(item.calories * (item.quantity || 1));

    return (
        <View style={[styles.logRowWrap, isEditing && styles.logRowWrapEditing]}>
            <SwipeToDeleteRow
                onDelete={() => onRemove(mealType, item.id)}
                enabled={!isEditing}
                deleteLabel="Remove"
                contentBackgroundColor={isEditing ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.03)'}
            >
                <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.logRow}>
                    <View style={styles.logRowMain}>
                        <Text style={[styles.logRowName, isEditing && styles.logRowNameEditing]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Text style={styles.logRowMeta} numberOfLines={1}>
                                {formatAmount(item.amount)} {item.unit}
                            </Text>
                            {(item.tags?.includes('AI Estimate') || item.id?.startsWith('ai-')) && (
                                <View style={styles.aiEstBadge}>
                                    <Text style={styles.aiEstBadgeText}>AI</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={styles.logRowRight}>
                        <Text style={styles.logRowKcal}>{kcal}</Text>
                        <Text style={styles.logRowKcalUnit}>kcal</Text>
                    </View>
                </TouchableOpacity>
            </SwipeToDeleteRow>
            {isEditing && (
                <CompactPortionEditor
                    item={item}
                    logAmount={logAmount}
                    setLogAmount={setLogAmount}
                    logUnit={logUnit}
                    setLogUnit={setLogUnit}
                    onConfirm={onConfirm}
                    loading={loading}
                />
            )}
        </View>
    );
};

const MealSection = ({
    type,
    mealItems,
    isExpanded,
    isActiveMeal,
    expandedId,
    loading,
    onToggle,
    onAdd,
    onRemove,
    onEdit,
    confirmEdit,
    logAmount,
    setLogAmount,
    logUnit,
    setLogUnit,
}: any) => {
    const totalKcal = mealKcalTotal(mealItems);
    const hasItems = mealItems.length > 0;

    return (
        <View style={[styles.mealSectionCard, isActiveMeal && styles.mealSectionCardActive]}>
            <View style={styles.mealHeaderRow}>
                <TouchableOpacity onPress={onToggle} style={styles.mealHeaderTap} activeOpacity={0.75}>
                    <View style={styles.mealHeaderLeft}>
                        <View style={[styles.mealIconCircle, isActiveMeal && styles.mealIconCircleActive]}>
                            <FontAwesome name={MEAL_ICONS[type] as any} size={11} color={isActiveMeal ? '#D4AF37' : 'rgba(255,255,255,0.5)'} />
                        </View>
                        <View>
                            <Text style={[styles.mealSectionTitle, isActiveMeal && styles.mealSectionTitleActive]}>{type}</Text>
                            {!isExpanded && hasItems && (
                                <Text style={styles.mealCollapsedHint}>
                                    {mealItems.length} item{mealItems.length === 1 ? '' : 's'}
                                </Text>
                            )}
                            {!isExpanded && !hasItems && (
                                <Text style={styles.mealCollapsedHint}>Nothing logged</Text>
                            )}
                        </View>
                    </View>
                    <View style={styles.mealHeaderRight}>
                        {totalKcal > 0 && (
                            <View style={styles.mealKcalPill}>
                                <Text style={styles.mealKcalPillText}>{totalKcal}</Text>
                            </View>
                        )}
                        <FontAwesome
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={10}
                            color={VisualSystem.colors.textTertiary}
                            style={{ marginRight: 4 }}
                        />
                    </View>
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="Add" onPress={onAdd} style={styles.mealAddBtn} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <FontAwesome name="plus" size={13} color="#0C2340" />
                </TouchableOpacity>
            </View>

            {isExpanded && (
                <View style={styles.mealBody}>
                    {hasItems ? (
                        mealItems.map((item: any) => (
                            <LoggedFoodRow
                                key={item.id}
                                item={item}
                                mealType={item.mealType}
                                isEditing={expandedId === item.id}
                                onPress={() => onEdit(item, item.id)}
                                onRemove={onRemove}
                                logAmount={logAmount}
                                setLogAmount={setLogAmount}
                                logUnit={logUnit}
                                setLogUnit={setLogUnit}
                                onConfirm={confirmEdit}
                                loading={loading}
                            />
                        ))
                    ) : (
                        <TouchableOpacity onPress={onAdd} style={styles.mealEmptyTap} activeOpacity={0.8}>
                            <FontAwesome name="plus-circle" size={14} color="rgba(212,175,55,0.7)" />
                            <Text style={styles.mealEmptyText}>Add {type.toLowerCase()}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: VisualSystem.colors.bgBase },
    heroContainer: { 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 280, 
        zIndex: 10,
        overflow: 'hidden',
    },
    heroImage: { width: '100%', height: '100%' },
    heroContent: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    heroTitle: { fontSize: 32, fontWeight: '800', color: VisualSystem.colors.goldBright, letterSpacing: 1 },
    heroSubtitle: { fontSize: 13, fontWeight: '700', color: VisualSystem.colors.textOnNavy, marginTop: -2, opacity: 0.9 },
    headerActions: { flexDirection: 'row', gap: 8 },
    scanBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: VisualSystem.colors.goldBright, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 4, gap: 4 },
    scanText: { color: VisualSystem.colors.textOnNavy, fontSize: 11, fontWeight: '800' },
    aiLogBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212,175,55,0.08)',
        borderRadius: 16,
        paddingLeft: 12,
        paddingRight: 4,
        paddingVertical: 4,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.25)',
    },
    aiLogInput: {
        flex: 1,
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        fontWeight: '600',
        paddingVertical: 8,
        paddingRight: 8,
    },
    aiLogBtn: {
        backgroundColor: VisualSystem.colors.gold,
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
        minWidth: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiLogBtnDisabled: { opacity: 0.45 },
    aiLogBtnText: { color: VisualSystem.colors.textPrimary, fontWeight: '800', fontSize: 13 },
    aiLogHint: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 11,
        marginBottom: 12,
        lineHeight: 15,
    },
    aiLogHintSuccess: { color: 'rgba(64, 192, 87, 0.9)', fontWeight: '700' },
    dashboardCard: { backgroundColor: VisualSystem.colors.bgMid, borderRadius: 28, padding: 24, paddingBottom: 24, marginBottom: 16, borderWidth: 1, borderColor: VisualSystem.colors.borderSubtle },
    budgetBreakdown: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(64,192,87,0.15)',
        gap: 4,
    },
    budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    budgetRowTotal: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: VisualSystem.colors.borderSubtle },
    budgetLabel: { fontSize: 11, fontWeight: '700', color: VisualSystem.colors.textSecondary },
    budgetLabelGreen: { fontSize: 11, fontWeight: '700', color: 'rgba(64,192,87,0.8)' },
    budgetLabelTotal: { fontSize: 11, fontWeight: '800', color: VisualSystem.colors.textPrimary, letterSpacing: 0.5 },
    budgetValue: { fontSize: 13, fontWeight: '800', color: VisualSystem.colors.textSecondary },
    budgetValueGreen: { fontSize: 13, fontWeight: '800', color: VisualSystem.colors.success },
    budgetValueTotal: { fontSize: 15, fontWeight: '800', color: VisualSystem.colors.goldText },
    topDashboard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    glowCircleContainer: { width: 150, height: 150, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    glowCircleInner: { width: 118, height: 118, borderRadius: 59, backgroundColor: VisualSystem.colors.bgMid, borderWidth: 1, borderColor: VisualSystem.colors.borderSubtle, justifyContent: 'center', alignItems: 'center', shadowColor: VisualSystem.colors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 10 },
    remainingVal: { fontSize: 40, fontWeight: '800', color: VisualSystem.colors.textPrimary },
    remainingValOver: { color: VisualSystem.colors.danger },
    remainingLabel: { fontSize: 11, fontWeight: '800', color: VisualSystem.colors.textSecondary, letterSpacing: 1.5 },
    remainingLabelOver: { color: VisualSystem.colors.danger },
    exerciseNoteGreen: { fontSize: 11, color: 'rgba(64,192,87,0.8)', fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },
    workoutBurnNote: { fontSize: 11, color: 'rgba(64,192,87,0.65)', fontWeight: '800', marginTop: 4, letterSpacing: 0.3 },
    dashStatsCol: { gap: 12, flex: 1, marginLeft: 16, minWidth: 0 },
    miniStatBox: { backgroundColor: VisualSystem.colors.bgMid, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: VisualSystem.colors.borderSubtle, position: 'relative' },
    miniLabel: { fontSize: 11, color: VisualSystem.colors.textTertiary, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
    miniValueGold: { fontSize: 17, fontWeight: '800', color: VisualSystem.colors.goldText },
    miniValueGreen: { fontSize: 17, fontWeight: '800', color: VisualSystem.colors.success },
    macroList: { gap: 16 },
    macroRow: { marginBottom: 4 },
    macroIconCircle: { width: 22, height: 22, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    macroRowLabel: { color: VisualSystem.colors.textPrimary, fontWeight: '800', fontSize: 13, marginLeft: 8 },
    macroRowStats: { color: VisualSystem.colors.textTertiary, fontWeight: '700', fontSize: 13 },
    macroBarContainer: { height: 6, backgroundColor: VisualSystem.colors.bgMid, borderRadius: 6, overflow: 'hidden' },
    macroBarFill: { height: '100%', borderRadius: 6 },
    aiCard: { backgroundColor: VisualSystem.colors.bgMid, borderRadius: 22, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: VisualSystem.colors.borderSubtle },
    aiTitle: { fontSize: 11, fontWeight: '800', color: VisualSystem.colors.goldText, letterSpacing: 1 },
    aiMessage: { color: VisualSystem.colors.textPrimary, fontSize: 13, lineHeight: 22, fontWeight: '600' },
    logSection: { marginBottom: 8 },
    logSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
    logSectionTitle: { fontSize: 15, fontWeight: '800', color: VisualSystem.colors.textPrimary, letterSpacing: 0.3 },
    logSectionMeta: { fontSize: 11, fontWeight: '600', color: VisualSystem.colors.textTertiary },
    mealList: { gap: 8 },
    mealSectionCard: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        overflow: 'hidden',
    },
    mealSectionCardActive: {
        borderColor: 'rgba(212,175,55,0.2)',
        backgroundColor: 'rgba(212,175,55,0.04)',
    },
    mealHeaderRow: { flexDirection: 'row', alignItems: 'stretch', paddingRight: 12, minHeight: 56 },
    mealHeaderTap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingLeft: 12, paddingRight: 8 },
    mealHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    mealHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mealIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mealIconCircleActive: { backgroundColor: 'rgba(212,175,55,0.12)' },
    mealSectionTitle: { color: VisualSystem.colors.textPrimary, fontWeight: '700', fontSize: 13 },
    mealSectionTitleActive: { color: VisualSystem.colors.textPrimary },
    mealCollapsedHint: { color: VisualSystem.colors.textTertiary, fontSize: 11, fontWeight: '600', marginTop: 4 },
    mealKcalPill: {
        backgroundColor: 'rgba(212,175,55,0.12)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        minWidth: 36,
        alignItems: 'center',
    },
    mealKcalPillText: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '800',
    },
    mealAddBtn: {
        width: 34,
        height: 34,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.gold,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginLeft: 4,
    },
    mealBody: { paddingHorizontal: 8, paddingBottom: 12, gap: 4 },
    mealEmptyTap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        borderStyle: 'dashed',
        marginHorizontal: 4,
    },
    mealEmptyText: { color: VisualSystem.colors.textSecondary, fontSize: 13, fontWeight: '600' },
    logRowWrap: {
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    logRowWrapEditing: { borderColor: 'rgba(212,175,55,0.25)', backgroundColor: 'rgba(212,175,55,0.04)' },
    logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, minHeight: 52 },
    logRowMain: { flex: 1, paddingRight: 8 },
    logRowName: { color: VisualSystem.colors.textPrimary, fontSize: 13, fontWeight: '600' },
    logRowNameEditing: { color: VisualSystem.colors.goldText },
    logRowMeta: { color: VisualSystem.colors.textTertiary, fontSize: 11, fontWeight: '600' },
    aiEstBadge: {
        backgroundColor: 'rgba(212,175,55,0.15)',
        paddingHorizontal: 4,
        paddingVertical: 4,
        borderRadius: 6,
    },
    aiEstBadgeText: { color: VisualSystem.colors.goldText, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    logRowRight: { alignItems: 'flex-end' },
    logRowKcal: { color: VisualSystem.colors.textPrimary, fontSize: 15, fontWeight: '800' },
    logRowKcalUnit: { color: VisualSystem.colors.textTertiary, fontSize: 11, fontWeight: '700', marginTop: 4 },
    portionEditor: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4, gap: 8 },
    portionLabel: { fontSize: 11, fontWeight: '800', color: VisualSystem.colors.textTertiary, letterSpacing: 0.8, marginTop: 4 },
    portionAmountField: {
        height: 42,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        backgroundColor: VisualSystem.colors.bgMid,
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        fontWeight: '700',
        paddingHorizontal: 12,
    },
    unitChipRow: { gap: 8, paddingVertical: 4 },
    unitChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    unitChipActive: {
        backgroundColor: 'rgba(212,175,55,0.14)',
        borderColor: 'rgba(212,175,55,0.45)',
    },
    unitChipText: { color: VisualSystem.colors.textSecondary, fontSize: 13, fontWeight: '600' },
    unitChipTextActive: { color: VisualSystem.colors.goldText, fontWeight: '800' },
    portionEditorFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    portionPreview: { color: VisualSystem.colors.goldText, fontSize: 13, fontWeight: '800' },
    portionSaveBtn: { backgroundColor: VisualSystem.colors.gold, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
    portionSaveText: { color: VisualSystem.colors.textPrimary, fontWeight: '800', fontSize: 11 },
    modalBg: { flex: 1, backgroundColor: VisualSystem.colors.bgMid, paddingTop: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: VisualSystem.colors.borderSubtle },
    modalTitle: { color: VisualSystem.colors.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: 1 },
    modalSubtitle: { color: VisualSystem.colors.textTertiary, fontSize: 11, fontWeight: '700', marginTop: 4 },
    modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: VisualSystem.colors.bgMid, justifyContent: 'center', alignItems: 'center' },
    modalSearchContainer: { padding: 16, backgroundColor: VisualSystem.colors.bgMid },
    locTabs: { flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginBottom: 16 },
    locTab: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: VisualSystem.colors.bgMid, alignItems: 'center', borderWidth: 1, borderColor: VisualSystem.colors.borderSubtle },
    locTabOn: { backgroundColor: 'rgba(212, 175, 55, 0.1)', borderColor: VisualSystem.colors.borderGold },
    locTabText: { fontSize: 11, fontWeight: '800', color: VisualSystem.colors.textTertiary, letterSpacing: 1 },
    locTabTextOn: { color: VisualSystem.colors.goldText },
    stationAccordion: { marginBottom: 4 },
    stationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, backgroundColor: VisualSystem.colors.bgMid, borderTopWidth: 1, borderTopColor: VisualSystem.colors.borderSubtle },
    stationName: { color: VisualSystem.colors.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
    stationContent: { backgroundColor: VisualSystem.colors.bgMid, paddingHorizontal: 12, paddingVertical: 8 },
    menuItemWrap: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        overflow: 'hidden',
    },
    menuItemWrapExpanded: { borderColor: 'rgba(212,175,55,0.2)', backgroundColor: 'rgba(212,175,55,0.05)' },
    menuItem: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    menuSelected: { borderColor: VisualSystem.colors.borderGold, backgroundColor: 'rgba(212,175,55,0.08)' },
    menuName: { color: VisualSystem.colors.textPrimary, fontSize: 15, fontWeight: '700' },
    menuSub: { color: VisualSystem.colors.textTertiary, fontSize: 11, fontWeight: '600', marginTop: 4 },
    loadingCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    loadingText: { color: VisualSystem.colors.textSecondary, textAlign: 'center', fontWeight: '700', fontSize: 13 },
    stationTitle: { color: VisualSystem.colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    stationCount: { color: VisualSystem.colors.textTertiary, fontSize: 11, fontWeight: '700' }
});
