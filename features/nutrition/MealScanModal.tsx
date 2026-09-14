import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { FoodItem, MealType } from '@/types/nutrition';
import { DiningLocation } from '@/features/nutrition/DiningUtils';
import { fetchLiveMenu } from '@/features/nutrition/NutrisliceService';
import {
    MealScanResult,
    NotFoodError,
    PreparedPhoto,
    ScanConfidence,
    ScannedItem,
    formatScale,
    prepareMealPhoto,
    scanMeal,
    scanTotals,
    scannedItemToFood,
} from '@/features/nutrition/MealScanService';
import { SwipeToDeleteRow } from '@/components/workout/SwipeToDeleteRow';
import { VisualSystem } from '@/constants/VisualSystem';

const C = VisualSystem.colors;
const T = VisualSystem.text;

type Where = DiningLocation | 'Elsewhere';
type Stage = 'capture' | 'analyzing' | 'result';

const LOG_MEALS: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const SCALE_STEP = 0.25;
const SCALE_MIN = 0.25;
const SCALE_MAX = 4;
/** Shown while the model works; there is no real progress to report. */
const ANALYZE_STAGES = ['Identifying foods', 'Measuring portions', 'Working out macros', 'Double-checking'];
const STAGE_MS = 3500;

const MACRO_COLOR = { protein: C.gold, carbs: '#4dabf7', fat: '#ff6b6b' } as const;

type Props = {
    visible: boolean;
    onClose: () => void;
    /** Meal the dining tab is on; the sheet lets the user change it. */
    meal: MealType;
    /** Dining hall the tab is showing, and its menu for today. */
    location: DiningLocation;
    menu: FoodItem[];
    /** YYYY-MM-DD, for fetching the other hall's menu if they switch. */
    today: string;
    onLog: (items: FoodItem[], meal: MealType) => Promise<void>;
};

export function MealScanModal({ visible, onClose, meal, location, menu, today, onLog }: Props) {
    const insets = useSafeAreaInsets();

    const [stage, setStage] = useState<Stage>('capture');
    const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
    const [preparing, setPreparing] = useState(false);
    const [context, setContext] = useState('');
    const [where, setWhere] = useState<Where>(location);
    const [error, setError] = useState<string | null>(null);

    const [result, setResult] = useState<MealScanResult | null>(null);
    const [scale, setScale] = useState<Record<string, number>>({});
    const [removed, setRemoved] = useState<Set<string>>(new Set());
    const [logMeal, setLogMeal] = useState<MealType>(meal);
    const [refineText, setRefineText] = useState('');
    const [logging, setLogging] = useState(false);

    // A cancelled or superseded analysis must not land on the screen.
    const runId = useRef(0);
    const menuCache = useRef<Partial<Record<DiningLocation, FoodItem[]>>>({});

    useEffect(() => {
        if (visible) {
            setWhere(location);
            setLogMeal(LOG_MEALS.includes(meal) ? meal : 'Lunch');
            menuCache.current[location] = menu;
        }
    }, [visible, location, meal, menu]);

    const reset = useCallback(() => {
        runId.current += 1;
        setStage('capture');
        setPhoto(null);
        setPreparing(false);
        setContext('');
        setError(null);
        setResult(null);
        setScale({});
        setRemoved(new Set());
        setRefineText('');
        setLogging(false);
    }, []);

    const close = useCallback(() => {
        reset();
        onClose();
    }, [reset, onClose]);

    // ── Photo ────────────────────────────────────────────────────────────

    const acceptAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
        setPreparing(true);
        setError(null);
        try {
            const prepared = await prepareMealPhoto(asset.uri, { width: asset.width, height: asset.height });
            setPhoto(prepared);
            setResult(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {
            setError('That photo could not be read. Try another.');
        } finally {
            setPreparing(false);
        }
    }, []);

    const takePhoto = useCallback(async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Camera access needed', 'Allow the camera in Settings to scan a meal.');
            return;
        }
        const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 1,
            exif: false,
        });
        if (!res.canceled && res.assets[0]) await acceptAsset(res.assets[0]);
    }, [acceptAsset]);

    const pickPhoto = useCallback(async () => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
            exif: false,
            selectionLimit: 1,
        });
        if (!res.canceled && res.assets[0]) await acceptAsset(res.assets[0]);
    }, [acceptAsset]);

    // ── Analysis ─────────────────────────────────────────────────────────

    const resolveVenue = useCallback(async () => {
        if (where === 'Elsewhere') return null;
        let hallMenu = menuCache.current[where];
        if (!hallMenu) {
            try {
                hallMenu = await fetchLiveMenu(where, today);
            } catch {
                hallMenu = [];
            }
            menuCache.current[where] = hallMenu;
        }
        return { name: `${where} Dining Hall`, menu: hallMenu };
    }, [where, today]);

    const analyze = useCallback(
        async (notes: string) => {
            if (!photo) return;
            const id = ++runId.current;
            setStage('analyzing');
            setError(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
                const venue = await resolveVenue();
                const next = await scanMeal({
                    base64Jpeg: photo.base64,
                    meal: logMeal,
                    context: notes,
                    venue,
                });
                if (id !== runId.current) return;
                setResult(next);
                setScale({});
                setRemoved(new Set());
                setRefineText('');
                setStage('result');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
                if (id !== runId.current) return;
                setStage(result ? 'result' : 'capture');
                setError(
                    e instanceof NotFoodError
                        ? 'Nothing to log was found in that photo. Try the plate in frame, or the nutrition label straight on.'
                        : e?.message || 'The analysis did not go through. Check your connection and try again.'
                );
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        },
        [photo, resolveVenue, logMeal, result]
    );

    const cancelAnalysis = useCallback(() => {
        runId.current += 1;
        setStage(result ? 'result' : 'capture');
    }, [result]);

    const refine = useCallback(() => {
        const answer = refineText.trim();
        if (!answer) return;
        const merged = context.trim() ? `${context.trim()}\n${answer}` : answer;
        setContext(merged);
        analyze(merged);
    }, [refineText, context, analyze]);

    // ── Result editing ───────────────────────────────────────────────────

    const keptItems = useMemo(
        () => (result ? result.items.filter((it) => !removed.has(it.id)) : []),
        [result, removed]
    );
    const totals = useMemo(() => scanTotals(keptItems, scale), [keptItems, scale]);

    const bump = useCallback((id: string, dir: 1 | -1) => {
        setScale((prev) => {
            const cur = prev[id] ?? 1;
            const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round((cur + dir * SCALE_STEP) * 100) / 100));
            if (next === cur) return prev;
            Haptics.selectionAsync();
            return { ...prev, [id]: next };
        });
    }, []);

    const remove = useCallback((id: string) => {
        setRemoved((prev) => new Set(prev).add(id));
    }, []);

    const log = useCallback(async () => {
        if (!result || keptItems.length === 0 || logging) return;
        setLogging(true);
        try {
            const foods = keptItems.map((it) => scannedItemToFood(it, scale[it.id] ?? 1));
            await onLog(foods, logMeal);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            close();
        } catch {
            setLogging(false);
            Alert.alert('Could not log', 'Nothing was saved. Try again.');
        }
    }, [result, keptItems, logging, scale, onLog, logMeal, close]);

    // ── Render ───────────────────────────────────────────────────────────

    const photoBox = photo ? (
        <View style={styles.photoCard}>
            <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
            {stage === 'analyzing' ? (
                <ScanOverlay />
            ) : (
                <Pressable
                    style={({ pressed }) => [styles.retakePill, pressed && { opacity: 0.8 }]}
                    onPress={takePhoto}
                    hitSlop={6}
                >
                    <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.retakeText}>Retake</Text>
                </Pressable>
            )}
        </View>
    ) : (
        <Pressable
            style={({ pressed }) => [styles.photoCard, styles.photoEmpty, pressed && { opacity: 0.9 }]}
            onPress={takePhoto}
            disabled={preparing}
        >
            {preparing ? (
                <ActivityIndicator color={C.textSecondary} />
            ) : (
                <>
                    <View style={styles.cameraCircle}>
                        <Ionicons name="camera" size={26} color={C.navy} />
                    </View>
                    <Text style={styles.photoEmptyTitle}>Photograph your meal</Text>
                    <Text style={styles.photoEmptyHint}>
                        Straight down, good light, the whole plate in frame — or shoot the nutrition label for exact numbers
                    </Text>
                </>
            )}
        </Pressable>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
            <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.topBar}>
                    <Pressable onPress={close} hitSlop={10} style={styles.topBarSide}>
                        <Text style={styles.topBarAction}>Cancel</Text>
                    </Pressable>
                    <Text style={styles.topBarTitle}>Scan meal</Text>
                    <View style={styles.topBarSide} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {photoBox}

                    {stage === 'analyzing' && <AnalyzingStatus onCancel={cancelAnalysis} />}

                    {error && stage !== 'analyzing' && (
                        <View style={styles.errorCard}>
                            <Ionicons name="alert-circle" size={16} color={C.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {stage === 'capture' && (
                        <>
                            <Section title="Where are you eating?">
                                <View style={styles.pillRow}>
                                    {(['North', 'South', 'Elsewhere'] as Where[]).map((w) => (
                                        <Pill
                                            key={w}
                                            label={w === 'Elsewhere' ? 'Elsewhere' : `${w} Hall`}
                                            active={where === w}
                                            onPress={() => setWhere(w)}
                                        />
                                    ))}
                                </View>
                                {where !== 'Elsewhere' && (
                                    <Text style={styles.sectionHint}>
                                        Matched against today's {where} Hall menu for exact serving nutrition.
                                    </Text>
                                )}
                            </Section>

                            <Section title="Anything the photo can't show?" optional>
                                <TextInput
                                    style={styles.notes}
                                    value={context}
                                    onChangeText={setContext}
                                    placeholder="e.g. chicken thigh, cooked in oil, two scoops of rice, no dressing"
                                    placeholderTextColor={C.textTertiary}
                                    multiline
                                    textAlignVertical="top"
                                />
                                <Text style={styles.sectionHint}>
                                    Cooking oil, dressings, dairy fat and piece counts change the numbers most.
                                </Text>
                            </Section>
                        </>
                    )}

                    {stage === 'result' && result && (
                        <ResultBody
                            result={result}
                            items={keptItems}
                            scale={scale}
                            totals={totals}
                            logMeal={logMeal}
                            onMeal={setLogMeal}
                            onBump={bump}
                            onRemove={remove}
                            refineText={refineText}
                            onRefineText={setRefineText}
                            onRefine={refine}
                        />
                    )}
                </ScrollView>

                {stage !== 'analyzing' && (
                    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                        {stage === 'capture' ? (
                            photo ? (
                                <PrimaryButton
                                    icon="sparkles"
                                    label="Analyze meal"
                                    onPress={() => analyze(context)}
                                    disabled={preparing}
                                />
                            ) : (
                                <>
                                    <PrimaryButton icon="camera" label="Take photo" onPress={takePhoto} disabled={preparing} />
                                    <Pressable
                                        onPress={pickPhoto}
                                        disabled={preparing}
                                        style={({ pressed }) => [styles.tertiaryBtn, pressed && { opacity: 0.7 }]}
                                    >
                                        <Text style={styles.tertiaryText}>Choose from library</Text>
                                    </Pressable>
                                </>
                            )
                        ) : (
                            <PrimaryButton
                                icon="checkmark"
                                label={
                                    keptItems.length === 0
                                        ? 'Nothing to log'
                                        : `Log to ${logMeal} · ${Math.round(totals.calories)} kcal`
                                }
                                onPress={log}
                                disabled={keptItems.length === 0 || logging}
                                busy={logging}
                            />
                        )}
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ── Result ───────────────────────────────────────────────────────────────────

type ResultBodyProps = {
    result: MealScanResult;
    items: ScannedItem[];
    scale: Record<string, number>;
    totals: { calories: number; protein: number; carbs: number; fat: number };
    logMeal: MealType;
    onMeal: (m: MealType) => void;
    onBump: (id: string, dir: 1 | -1) => void;
    onRemove: (id: string) => void;
    refineText: string;
    onRefineText: (s: string) => void;
    onRefine: () => void;
};

function ResultBody({
    result,
    items,
    scale,
    totals,
    logMeal,
    onMeal,
    onBump,
    onRemove,
    refineText,
    onRefineText,
    onRefine,
}: ResultBodyProps) {
    const macroKcal = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
    const share = (g: number, perG: number) => (macroKcal > 0 ? (g * perG) / macroKcal : 0);
    const anyLabel = items.some((it) => it.fromLabel);
    const anyMenu = items.some((it) => it.menuMatch);
    const itemsLegend = anyLabel
        ? 'Label = read off the packet'
        : anyMenu
          ? 'Menu = on today’s hall menu'
          : undefined;

    return (
        <>
            <View style={styles.resultHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.mealName} numberOfLines={2}>
                        {result.mealName}
                    </Text>
                    <Text style={styles.rangeText}>
                        Likely {result.calorieRange.low}–{result.calorieRange.high} kcal
                    </Text>
                </View>
                <ConfidenceBadge level={result.confidence} />
            </View>

            <View style={styles.summaryCard}>
                <View style={styles.kcalRow}>
                    <Text style={styles.kcalValue}>{Math.round(totals.calories)}</Text>
                    <Text style={styles.kcalUnit}>kcal</Text>
                </View>
                <View style={styles.macroBar}>
                    <View style={[styles.macroSeg, { flex: share(totals.protein, 4) || 0.001, backgroundColor: MACRO_COLOR.protein }]} />
                    <View style={[styles.macroSeg, { flex: share(totals.carbs, 4) || 0.001, backgroundColor: MACRO_COLOR.carbs }]} />
                    <View style={[styles.macroSeg, { flex: share(totals.fat, 9) || 0.001, backgroundColor: MACRO_COLOR.fat }]} />
                </View>
                <View style={styles.macroRow}>
                    <Macro label="Protein" grams={totals.protein} color={MACRO_COLOR.protein} />
                    <Macro label="Carbs" grams={totals.carbs} color={MACRO_COLOR.carbs} />
                    <Macro label="Fat" grams={totals.fat} color={MACRO_COLOR.fat} />
                </View>
            </View>

            <Section title="Items" trailing={itemsLegend}>
                <View style={styles.list}>
                    {items.map((it, i) => (
                        <SwipeToDeleteRow key={it.id} enabled deleteLabel="Remove" onDelete={() => onRemove(it.id)}>
                            <ItemRow item={it} scale={scale[it.id] ?? 1} last={i === items.length - 1} onBump={onBump} />
                        </SwipeToDeleteRow>
                    ))}
                    {items.length === 0 && <Text style={styles.emptyList}>Every item was removed.</Text>}
                </View>
                <Text style={styles.sectionHint}>Adjust a portion with − and +, or swipe an item left to drop it.</Text>
            </Section>

            <Section title="Sharpen the estimate">
                {result.questions.map((q, i) => (
                    <View key={i} style={styles.questionRow}>
                        <Ionicons name="help-circle-outline" size={16} color={C.goldText} />
                        <Text style={styles.questionText}>{q}</Text>
                    </View>
                ))}
                <TextInput
                    style={[styles.notes, styles.notesShort]}
                    value={refineText}
                    onChangeText={onRefineText}
                    placeholder={result.questions.length > 0 ? 'Answer here, or add anything else' : 'Add a detail the photo can’t show'}
                    placeholderTextColor={C.textTertiary}
                    multiline
                    textAlignVertical="top"
                />
                <Pressable
                    onPress={onRefine}
                    disabled={!refineText.trim()}
                    style={({ pressed }) => [
                        styles.secondaryBtn,
                        !refineText.trim() && styles.secondaryBtnDisabled,
                        pressed && { opacity: 0.8 },
                    ]}
                >
                    <Ionicons name="refresh" size={15} color={C.goldText} />
                    <Text style={styles.secondaryText}>Update estimate</Text>
                </Pressable>
            </Section>

            {result.assumptions.length > 0 && (
                <Section title="Assumed">
                    {result.assumptions.map((a, i) => (
                        <View key={i} style={styles.assumptionRow}>
                            <View style={styles.assumptionDot} />
                            <Text style={styles.assumptionText}>{a}</Text>
                        </View>
                    ))}
                </Section>
            )}

            <Section title="Log to">
                <View style={styles.pillRow}>
                    {LOG_MEALS.map((m) => (
                        <Pill key={m} label={m} active={logMeal === m} onPress={() => onMeal(m)} />
                    ))}
                </View>
            </Section>
        </>
    );
}

function ItemRow({
    item,
    scale,
    last,
    onBump,
}: {
    item: ScannedItem;
    scale: number;
    last: boolean;
    onBump: (id: string, dir: 1 | -1) => void;
}) {
    const kcal = Math.round(item.calories * scale);
    const grams = Math.round(item.grams * scale);
    // The model's portion text usually carries its own grams ("1 breast
    // (~140 g)"); once scaled, the multiplier and the new weight are shown.
    const portion =
        scale === 1
            ? item.portion || (grams > 0 ? `~${grams} g` : '')
            : `${item.portion || 'Portion'} × ${formatScale(scale)}${grams > 0 ? ` · ~${grams} g` : ''}`;
    return (
        <View style={[styles.itemRow, !last && styles.itemRowDivider]}>
            <View style={styles.itemMain}>
                <View style={styles.itemTitleRow}>
                    <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item.fromLabel ? (
                        <View style={styles.labelTag}>
                            <Text style={styles.labelTagText}>Label</Text>
                        </View>
                    ) : item.menuMatch ? (
                        <View style={styles.menuTag}>
                            <Text style={styles.menuTagText}>Menu</Text>
                        </View>
                    ) : null}
                </View>
                {portion ? (
                    <Text style={styles.itemPortion} numberOfLines={1}>
                        {portion}
                    </Text>
                ) : null}
                <Text style={styles.itemMacros}>
                    P {Math.round(item.protein * scale)} · C {Math.round(item.carbs * scale)} · F {Math.round(item.fat * scale)}
                    {item.note ? `  ·  ${item.note}` : ''}
                </Text>
            </View>
            <View style={styles.itemSide}>
                <Text style={styles.itemKcal}>{kcal}</Text>
                <View style={styles.stepper}>
                    <Pressable onPress={() => onBump(item.id, -1)} hitSlop={8} style={styles.stepBtn}>
                        <Ionicons name="remove" size={16} color={C.navy} />
                    </Pressable>
                    <Text style={styles.stepValue}>×{formatScale(scale)}</Text>
                    <Pressable onPress={() => onBump(item.id, 1)} hitSlop={8} style={styles.stepBtn}>
                        <Ionicons name="add" size={16} color={C.navy} />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function Section({
    title,
    optional,
    trailing,
    children,
}: {
    title: string;
    optional?: boolean;
    trailing?: string;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                    {title}
                    {optional ? <Text style={styles.sectionOptional}>  Optional</Text> : null}
                </Text>
                {trailing ? <Text style={styles.sectionTrailing}>{trailing}</Text> : null}
            </View>
            {children}
        </View>
    );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return (
        <Pressable
            onPress={() => {
                Haptics.selectionAsync();
                onPress();
            }}
            style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && { opacity: 0.85 }]}
        >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
        </Pressable>
    );
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
    return (
        <View style={styles.macro}>
            <View style={[styles.macroDot, { backgroundColor: color }]} />
            <Text style={styles.macroValue}>{Math.round(grams)}g</Text>
            <Text style={styles.macroLabel}>{label}</Text>
        </View>
    );
}

function ConfidenceBadge({ level }: { level: ScanConfidence }) {
    const tone =
        level === 'high'
            ? { bg: C.successSoft, fg: C.success, text: 'High confidence' }
            : level === 'low'
              ? { bg: C.dangerSoft, fg: C.danger, text: 'Low confidence' }
              : { bg: C.warningSoft, fg: C.warning, text: 'Medium confidence' };
    return (
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.badgeText, { color: tone.fg }]}>{tone.text}</Text>
        </View>
    );
}

function PrimaryButton({
    icon,
    label,
    onPress,
    disabled,
    busy,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress: () => void;
    disabled?: boolean;
    busy?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [styles.primaryBtn, disabled && styles.primaryBtnDisabled, pressed && { opacity: 0.9 }]}
        >
            {busy ? (
                <ActivityIndicator color={C.textOnGold} />
            ) : (
                <>
                    <Ionicons name={icon} size={17} color={C.textOnGold} />
                    <Text style={styles.primaryText}>{label}</Text>
                </>
            )}
        </Pressable>
    );
}

/** Gold line sweeping the photo while the model works. */
function ScanOverlay() {
    const y = useRef(new Animated.Value(0)).current;
    const [height, setHeight] = useState(0);
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(y, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(y, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [y]);
    return (
        <View style={styles.scanScrim} pointerEvents="none" onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
            {height > 0 && (
                <Animated.View
                    style={[
                        styles.scanLine,
                        { transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }] },
                    ]}
                />
            )}
        </View>
    );
}

function AnalyzingStatus({ onCancel }: { onCancel: () => void }) {
    const [step, setStep] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setStep((s) => Math.min(s + 1, ANALYZE_STAGES.length - 1)), STAGE_MS);
        return () => clearInterval(id);
    }, []);
    return (
        <View style={styles.analyzing}>
            <ActivityIndicator color={C.goldAccent} />
            <Text style={styles.analyzingText}>{ANALYZE_STAGES[step]}…</Text>
            <Pressable onPress={onCancel} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                <Text style={styles.analyzingCancel}>Cancel</Text>
            </Pressable>
        </View>
    );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bgMid },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
    },
    topBarSide: { minWidth: 60 },
    topBarAction: { color: C.goldText, fontSize: T.body, fontWeight: VisualSystem.weight.medium },
    topBarTitle: { color: C.textPrimary, fontSize: T.emphasis, fontWeight: VisualSystem.weight.semibold },
    scroll: { paddingHorizontal: 16, paddingBottom: 24 },

    photoCard: {
        width: '100%',
        aspectRatio: 4 / 3,
        borderRadius: VisualSystem.radius.lg,
        overflow: 'hidden',
        backgroundColor: C.bgDeep,
        marginBottom: 16,
    },
    photoEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    photo: { width: '100%', height: '100%' },
    cameraCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: C.bgMid,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        ...VisualSystem.shadow.card,
    },
    photoEmptyTitle: { color: C.textPrimary, fontSize: T.emphasis, fontWeight: VisualSystem.weight.semibold },
    photoEmptyHint: {
        color: C.textSecondary,
        fontSize: T.small,
        marginTop: 4,
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    retakePill: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: VisualSystem.radius.pill,
        backgroundColor: 'rgba(12, 35, 64, 0.55)',
    },
    retakeText: { color: '#FFFFFF', fontSize: T.caption, fontWeight: VisualSystem.weight.semibold },
    scanScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12, 35, 64, 0.28)' },
    scanLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: -2,
        height: 2,
        backgroundColor: C.goldVivid,
        ...VisualSystem.shadow.goldGlow,
    },

    analyzing: { alignItems: 'center', gap: 10, paddingVertical: 8, marginBottom: 8 },
    analyzingText: { color: C.textPrimary, fontSize: T.body, fontWeight: VisualSystem.weight.medium },
    analyzingCancel: { color: C.textTertiary, fontSize: T.small, fontWeight: VisualSystem.weight.medium },

    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.dangerSoft,
        borderRadius: VisualSystem.radius.sm,
        padding: 12,
        marginBottom: 16,
    },
    errorText: { flex: 1, color: C.danger, fontSize: T.small, fontWeight: VisualSystem.weight.medium, lineHeight: 18 },

    section: { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
    sectionTitle: { color: C.textPrimary, fontSize: T.body, fontWeight: VisualSystem.weight.semibold },
    sectionOptional: { color: C.textTertiary, fontSize: T.caption, fontWeight: VisualSystem.weight.medium },
    sectionTrailing: { color: C.textTertiary, fontSize: T.caption },
    sectionHint: { color: C.textTertiary, fontSize: T.caption, marginTop: 8, lineHeight: 15 },

    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: VisualSystem.radius.pill,
        backgroundColor: C.bgDeep,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    pillActive: { backgroundColor: C.navy, borderColor: C.navy },
    pillText: { color: C.textPrimary, fontSize: T.small, fontWeight: VisualSystem.weight.medium },
    pillTextActive: { color: C.textOnNavy },

    notes: {
        minHeight: 84,
        backgroundColor: C.bgDeep,
        borderRadius: VisualSystem.radius.sm,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: C.textPrimary,
        fontSize: T.body,
        lineHeight: 21,
    },
    notesShort: { minHeight: 60, marginTop: 4 },

    resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    mealName: { color: C.textPrimary, fontSize: T.heading, fontWeight: VisualSystem.weight.bold, lineHeight: 30 },
    rangeText: { color: C.textSecondary, fontSize: T.small, marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: VisualSystem.radius.pill, marginTop: 4 },
    badgeText: { fontSize: T.caption, fontWeight: VisualSystem.weight.semibold },

    summaryCard: {
        backgroundColor: C.bgMid,
        borderRadius: VisualSystem.radius.md,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        padding: 16,
        marginBottom: 20,
        ...VisualSystem.shadow.card,
    },
    kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 12 },
    kcalValue: { color: C.textPrimary, fontSize: T.hero, fontWeight: VisualSystem.weight.bold, letterSpacing: -0.5 },
    kcalUnit: { color: C.textSecondary, fontSize: T.body, fontWeight: VisualSystem.weight.medium },
    macroBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: C.bgDeep, gap: 2 },
    macroSeg: { height: '100%' },
    macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    macro: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    macroDot: { width: 8, height: 8, borderRadius: 4 },
    macroValue: { color: C.textPrimary, fontSize: T.body, fontWeight: VisualSystem.weight.semibold },
    macroLabel: { color: C.textSecondary, fontSize: T.small },

    list: {
        backgroundColor: C.bgMid,
        borderRadius: VisualSystem.radius.md,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        overflow: 'hidden',
    },
    emptyList: { color: C.textTertiary, fontSize: T.small, padding: 16, textAlign: 'center' },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12, backgroundColor: C.bgMid },
    itemRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderSubtle },
    itemMain: { flex: 1, minWidth: 0 },
    itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    itemName: { flexShrink: 1, color: C.textPrimary, fontSize: T.body, fontWeight: VisualSystem.weight.medium },
    itemPortion: { color: C.textSecondary, fontSize: T.small, marginTop: 2 },
    itemMacros: { color: C.textTertiary, fontSize: T.caption, marginTop: 3 },
    menuTag: { backgroundColor: C.goldMuted, borderRadius: VisualSystem.radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
    menuTagText: { color: C.goldText, fontSize: 10, fontWeight: VisualSystem.weight.semibold },
    labelTag: { backgroundColor: C.successSoft, borderRadius: VisualSystem.radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
    labelTagText: { color: C.success, fontSize: 10, fontWeight: VisualSystem.weight.semibold },
    itemSide: { alignItems: 'flex-end', gap: 6 },
    itemKcal: { color: C.textPrimary, fontSize: T.emphasis, fontWeight: VisualSystem.weight.semibold, fontVariant: ['tabular-nums'] },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.bgDeep,
        borderRadius: VisualSystem.radius.pill,
        paddingHorizontal: 4,
        height: 28,
    },
    stepBtn: { width: 26, height: 28, alignItems: 'center', justifyContent: 'center' },
    stepValue: { minWidth: 40, textAlign: 'center', color: C.textPrimary, fontSize: T.small, fontWeight: VisualSystem.weight.semibold, fontVariant: ['tabular-nums'] },

    questionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
    questionText: { flex: 1, color: C.textPrimary, fontSize: T.small, lineHeight: 19 },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 10,
        paddingVertical: 11,
        borderRadius: VisualSystem.radius.md,
        borderWidth: 1,
        borderColor: C.borderGold,
        backgroundColor: C.goldMuted,
    },
    secondaryBtnDisabled: { opacity: 0.45 },
    secondaryText: { color: C.goldText, fontSize: T.small, fontWeight: VisualSystem.weight.semibold },

    assumptionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
    assumptionDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.textTertiary, marginTop: 8 },
    assumptionText: { flex: 1, color: C.textSecondary, fontSize: T.small, lineHeight: 19 },

    footer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: C.borderSubtle,
        backgroundColor: C.bgMid,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: C.gold,
        paddingVertical: 12,
        borderRadius: VisualSystem.radius.md,
        minHeight: 50,
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryText: { color: C.textOnGold, fontSize: T.body, fontWeight: VisualSystem.weight.bold },
    tertiaryBtn: { alignItems: 'center', paddingVertical: 12 },
    tertiaryText: { color: C.goldText, fontSize: T.small, fontWeight: VisualSystem.weight.semibold },
});
