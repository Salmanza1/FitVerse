import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, Pressable, KeyboardAvoidingView, Platform, ScrollView, TextInput, Alert, Modal, FlatList, LayoutAnimation, UIManager, Image, PanResponder, ActivityIndicator, InteractionManager, Dimensions, Animated as RNAnimated } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Exercise, Set as WorkoutSet, Workout, SetType, ExerciseType } from '@/types/workout';
import { getTemplates, saveWorkout, getWorkoutHistory, saveTemplate, deleteTemplate, getLastWorkoutByName, getRecentWorkouts, getWorkoutHistoryCount, getLatestSetsForExercise, getExerciseProgress, getPerformedExercises } from '@/features/workout/WorkoutStore';
import { setWorkoutActive, updateWorkoutProgress, clearWorkoutActive } from '@/features/workout/WorkoutPresenceStore';
import { resolveExerciseStickyNote, saveExerciseStickyNote } from '@/features/workout/exerciseStickyNotes';
import { addWorkoutCaloriesToLog } from '@/features/nutrition/NutritionStore';
import { getLocalDateString } from '@/features/utils/DateUtils';
import { useAuth } from '@/features/auth/AuthContext';
import { useColorScheme } from 'react-native';
import { TrainingSplit, Goal, Gym } from '@/types/user';
import { GYM_PROFILES, resolveTrainingLocation } from '@/lib/gymContext';
import { TrainingLocationSection } from '@/components/workout/TrainingLocationSection';
import { WorkoutHeroHeader } from '@/components/workout/WorkoutHeroHeader';
import { Text, SecondaryText, Card, View, GlowView } from '@/components/Themed';
import { FeedStore } from '@/features/feed/FeedStore';
import { CreatePostModal } from '@/features/feed/CreatePostModal';
import { getWorkoutPostPreview, publishWorkoutPost } from '@/features/feed/workoutPostUtils';
import { detectWorkoutMilestones, WorkoutMilestone } from '@/features/workout/workoutMilestones';
import { estimateWorkoutCaloriesBurn } from '@/features/workout/workoutCalorieBurn';
import { estimateActivityFromDescription } from '@/features/workout/ActivityLogAIService';
import {
    activityEstimateToWorkout,
    estimateActivityCaloriesBurn,
    formatActivityLogSuccess,
} from '@/features/workout/activityLogUtils';
import { Post } from '@/types/social';
import * as Haptics from 'expo-haptics';
import { glassSurface, glassSurfaceGold, VisualSystem } from '@/constants/VisualSystem';

const LOG = VisualSystem.colors;

/** Identifier for the pending "rest is over" alert. */
const REST_NOTIFICATION_ID = 'fitverse-rest-complete';

type RestTimerState = {
    exerciseIdx: number;
    setIdx: number;
    /** Absolute wall-clock end, so the countdown survives a suspended tick. */
    endsAt: number;
    remaining: number;
    total: number;
    status: 'running' | 'finished';
};
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideInUp, Easing } from 'react-native-reanimated';
import { getLeprechaunResponseWithTools, Message as AiMessage } from '@/lib/openai';
import {
    EXERCISE_LIBRARY,
    CANONICAL_EXERCISES,
    workoutFromAIPlan,
    formatExerciseDisplayName,
} from '@/features/workout/exerciseLibrary';
import { ExerciseLibraryPanel } from '@/components/workout/ExerciseLibraryPanel';
import {
    STARTER_TEMPLATES,
    starterDetail,
    workoutFromStarter,
} from '@/features/workout/starterTemplates';
import { BetweenSetRestRow } from '@/components/workout/BetweenSetRestRow';
import { SwipeToDeleteRow } from '@/components/workout/SwipeToDeleteRow';
import { WorkoutCompleteModal } from '@/components/workout/WorkoutCompleteModal';
import { getRestAfterSetSeconds } from '@/features/workout/restTimerUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import { AlphabetIndexBar } from '@/components/workout/AlphabetIndexBar';
import {
    ExercisePickerRow,
    ExercisePickerSectionHeader,
    exercisePickerListStyles,
} from '@/components/workout/ExercisePickerRow';
import {
    buildExercisePickerRows,
    headerIndexForLetter,
    getPickerItemLayout,
    resolvePickerScrollLetter,
    ALPHABET_INDEX,
    EXERCISE_PICKER_HEADER_HEIGHT,
    EXERCISE_PICKER_ROW_HEIGHT,
    type ExercisePickerListItem,
} from '@/features/workout/sectionListScroll';
import { Svg, Path, Circle, Line, Text as SvgText, LinearGradient as SvgGradient, Stop, Defs } from 'react-native-svg';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

function sanitizeWeightText(raw: string): string {
    let cleaned = raw.replace(/[^0-9.]/g, '');
    const dot = cleaned.indexOf('.');
    if (dot !== -1) {
        cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
    }
    return cleaned;
}

function parseWeightValue(text: string): number {
    const cleaned = sanitizeWeightText(text);
    if (cleaned === '' || cleaned === '.') return 0;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
}

function formatWeightDisplay(weight: number): string {
    if (!weight) return '';
    const rounded = Math.round(weight * 100) / 100;
    return String(rounded);
}

function resolveExerciseId(exercise: { id?: string; name?: string }): string {
    const id = exercise.id?.trim();
    if (id) return id;
    const name = exercise.name?.trim() || 'unknown-exercise';
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const HISTORY_INITIAL_LIMIT = 6;
const HISTORY_SHOW_MORE_STEP = 8;
const SESSION_LOG_INITIAL = 4;

function getHistoryGroupLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const workoutDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today.getTime() - workoutDay.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return 'This Week';
    if (diffDays < 30) return 'This Month';
    return 'Earlier';
}

const HISTORY_GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];

function groupWorkoutsByDate(workouts: Workout[]): { label: string; items: Workout[] }[] {
    const buckets = new Map<string, Workout[]>();
    for (const w of workouts) {
        const label = getHistoryGroupLabel(w.date);
        if (!buckets.has(label)) buckets.set(label, []);
        buckets.get(label)!.push(w);
    }
    return HISTORY_GROUP_ORDER
        .filter((label) => buckets.has(label))
        .map((label) => ({ label, items: buckets.get(label)! }));
}

// STYLES DEFINITION moved to top for better scope availability
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        paddingTop: 32,
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        alignItems: 'center'
    },
    headerTag: {
        color: VisualSystem.colors.goldText,
        fontWeight: '800',
        fontSize: 11,
        marginBottom: 8,
        letterSpacing: 0.2,
        textShadowColor: 'rgba(212, 175, 55, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10
    },
    headerTitle: { fontSize: 32, fontWeight: '800', color: VisualSystem.colors.textPrimary, letterSpacing: 0.2 },
    scroll: { padding: 16, paddingBottom: 32 },
    circleStartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 32,
        marginBottom: 32,
    },
    circleStartBtn: {
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: VisualSystem.colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: VisualSystem.colors.gold,
        boxShadow: '0px 10px 30px rgba(212, 175, 55, 0.5)',
        elevation: 15,
    },
    circleStartGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 110,
        alignItems: 'center',
        justifyContent: 'center',
    },
    circleStartText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 17,
        fontWeight: '800',
        marginTop: 16,
        letterSpacing: 0.2,
    },
    circleStartSub: {
        fontSize: 11,
        color: VisualSystem.colors.textTertiary,
        marginTop: 4,
        fontWeight: '700',
    },
    sectionHeader: { fontSize: 11, fontWeight: '800', marginBottom: 12, color: LOG.textTertiary, letterSpacing: 0.2, textTransform: 'uppercase' },

    // Templates
    blockTitle: { fontSize: 20, fontWeight: '700', color: VisualSystem.colors.textPrimary },
    iconBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: VisualSystem.colors.bgMid, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
    subHeader: { fontSize: 13, fontWeight: '700', color: '#999', marginTop: 8, marginBottom: 8 },
    templateCard: {
        width: '100%',
        height: 150,
        marginRight: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        backgroundColor: LOG.glassFill,
        justifyContent: 'space-between',
    },
    templateTitle: {
        fontWeight: '800',
        fontSize: 15,
        color: LOG.textPrimary,
        lineHeight: 20,
        marginBottom: 4,
    },
    templateDetail: {
        fontSize: 11,
        color: LOG.textSecondary,
        lineHeight: 17,
        flex: 1,
    },
    templateFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: LOG.borderSubtle,
    },
    templateStartBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    templateStartText: {
        color: LOG.goldText,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    templateRemoveText: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 11,
        fontWeight: '600',
    },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: LOG.overlay, justifyContent: 'center', padding: 16 },
    modalContent: { 
        backgroundColor: LOG.bgMid, 
        borderRadius: 22, 
        padding: 16, 
        borderWidth: 1, 
        borderColor: LOG.borderGold,
        shadowColor: VisualSystem.colors.navy,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: LOG.textPrimary },
    modeBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: LOG.borderSubtle },
    modeIcon: { width: 40, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    modeTitle: { fontSize: 15, fontWeight: '700', color: LOG.textPrimary, marginBottom: 4 },

    // Active Workout
    activeHeader: {
        paddingTop: 32,
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 6,
        backgroundColor: VisualSystem.colors.bgMid,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCancelBtn: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 68, 68, 0.3)',
    },
    headerCancelText: {
        color: VisualSystem.colors.danger,
        fontWeight: '700',
        fontSize: 13,
    },
    finishBtnTheme: {
        backgroundColor: VisualSystem.colors.gold,
        paddingHorizontal: 24,
        paddingVertical: 8,
        borderRadius: 10,
    },
    titleEllipsisBtn: {
        width: 28,
        height: 28,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    metaText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 15,
        fontWeight: '600',
    },
    finishText: {
        fontWeight: '700', fontSize: 15, color: VisualSystem.colors.textPrimary
    },
    activeWorkoutTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
        marginRight: 8,
    },
    menuIconBtn: {
        backgroundColor: VisualSystem.colors.bgMid,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    metaIcon: {
        marginRight: 8,
        width: 16,
    },
    metaTextSecondary: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 15,
        fontWeight: '600',
    },
    activeActionsRow: {
        gap: 12,
        marginBottom: 32,
    },
    actionBtnBlue: {
        backgroundColor: VisualSystem.colors.bgMid,
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderGold,
    },
    actionBtnRed: {
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 68, 68, 0.2)',
    },
    actionBtnText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '700',
        fontSize: 15,
    },
    actionBtnTextRed: {
        color: VisualSystem.colors.danger,
        fontWeight: '700',
        fontSize: 15,
    },
    stickyNoteContainer: {
        backgroundColor: '#FCF3CF',
        padding: 8,
        borderRadius: 6,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#F1C40F'
    },
    stickyNoteInput: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 13,
        fontFamily: 'System',
    },
    menuContent: {
        backgroundColor: LOG.bgElevated,
        borderRadius: 22,
        padding: 4,
        width: '85%',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: LOG.borderGold,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: LOG.borderSubtle,
    },
    menuItemIcon: {
        width: 25,
        marginRight: 12,
    },
    menuItemText: {
        color: LOG.textPrimary,
        fontSize: 15,
        fontWeight: '600',
    },
    restModalContent: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 22,
        padding: 24,
        width: '90%',
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        shadowColor: VisualSystem.colors.navy,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
    },
    restModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
        textAlign: 'center',
        marginBottom: 8
    },
    restModalSub: {
        textAlign: 'center',
        color: VisualSystem.colors.textSecondary,
        fontSize: 13,
        marginBottom: 24,
        lineHeight: 18
    },
    restInputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    restInputLabel: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        fontWeight: '600'
    },
    restInputBox: {
        backgroundColor: VisualSystem.colors.bgDeep,
        borderRadius: 10,
        width: 110,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)'
    },
    restInputText: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '700',
        fontSize: 15
    },
    restSubmitBtn: {
        backgroundColor: VisualSystem.colors.gold,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8
    },
    restSubmitText: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '700',
        fontSize: 15
    },
    notesInput: {
        backgroundColor: VisualSystem.colors.bgMid,
        color: VisualSystem.colors.textPrimary,
        padding: 16,
        borderRadius: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        height: 60,
        textAlignVertical: 'top'
    },
    exerciseContainer: {
        marginBottom: 32,
    },
    exHeaderSimple: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    exNameBlue: {
        fontSize: 17,
        fontWeight: '700',
        color: VisualSystem.colors.goldText,
    },
    actionIconBtn: {
        marginLeft: 16,
        padding: 4,
    },
    setLabelsRow: {
        flexDirection: 'row',
        paddingHorizontal: 4,
        marginBottom: 8,
        alignItems: 'center',
    },
    labelSet: { color: VisualSystem.colors.textSecondary, fontSize: 13, fontWeight: '700', width: 40, textAlign: 'center' },
    labelPrev: { color: VisualSystem.colors.textSecondary, fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'center' },
    labelInput: { color: VisualSystem.colors.textSecondary, fontSize: 13, fontWeight: '700', width: 75, textAlign: 'center' },

    setRowSimple: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    setRowCompletedSimple: {
        opacity: 1, // Keep visible
    },
    setIndexBox: {
        width: 40,
        height: 30,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)'
    },
    setIndexText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '700',
        fontSize: 15,
    },
    prevPerformanceText: {
        flex: 1,
        color: VisualSystem.colors.textSecondary,
        textAlign: 'center',
        fontSize: 15,
        fontWeight: '600'
    },
    setInlineInput: {
        width: 75,
        height: 38,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 6,
        color: VisualSystem.colors.textPrimary,
        textAlign: 'center',
        fontWeight: '700',
        fontSize: 17,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)'
    },
    checkCircle: {
        width: 32,
        height: 32,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        backgroundColor: VisualSystem.colors.bgMid,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    checkCircleActive: {
        borderColor: VisualSystem.colors.borderGold,
        backgroundColor: VisualSystem.colors.gold,
    },

    inlineRestBarContainer: {
        height: 24,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 6,
        overflow: 'hidden',
        marginTop: 4,
        position: 'relative',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        marginHorizontal: 32
    },
    inlineRestBarFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: VisualSystem.colors.goldSoft,
    },
    inlineRestText: {
        color: VisualSystem.colors.goldText,
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
        zIndex: 1,
    },
    addSetFullBtn: {
        width: '100%',
        paddingVertical: 12,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8,
    },
    addSetFullText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '700',
        fontSize: 13,
    },
    exerciseCard: { marginBottom: 16, padding: 16, backgroundColor: VisualSystem.colors.bgMid, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.15)' },
    exHeader: { marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' },
    exName: { fontSize: 17, fontWeight: '700', color: VisualSystem.colors.textPrimary },
    setRow_Header: { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 4 },
    col_Set: { width: 40, fontSize: 11, fontWeight: '700', color: VisualSystem.colors.textSecondary, textAlign: 'center' },
    col_Prev: { flex: 1, fontSize: 11, fontWeight: '700', color: VisualSystem.colors.textSecondary, textAlign: 'center' },
    col_Input: { width: 60, fontSize: 11, fontWeight: '700', color: VisualSystem.colors.textSecondary, textAlign: 'center' },
    setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: VisualSystem.colors.bgMid, padding: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.1)' },
    setRowCompleted: { backgroundColor: 'rgba(212, 175, 55, 0.1)' }, // GOLD TINT
    setNumberBadge: { width: 40, alignItems: 'center' },
    setNumberText: { color: VisualSystem.colors.goldText, fontWeight: '700' },
    inputContainer: { width: 60, alignItems: 'center' },
    inputText: { color: VisualSystem.colors.textPrimary, fontWeight: '700', fontSize: 15 },
    checkBtn: { width: 30, height: 30, borderRadius: 6, backgroundColor: VisualSystem.colors.bgMid, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
    checkBtnActive: { backgroundColor: VisualSystem.colors.gold, borderColor: VisualSystem.colors.borderGold },
    addSetBtn: { alignItems: 'center', padding: 8, borderTopWidth: 1, borderTopColor: 'rgba(212, 175, 55, 0.1)', marginTop: 4 },
    addSetText: { color: VisualSystem.colors.goldText, fontWeight: '700', fontSize: 11 },

    addExerciseBtnAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        marginTop: 16,
    },
    addExerciseTextAction: { color: VisualSystem.colors.goldText, fontWeight: '700', fontSize: 15 },
    cancelBtnAction: {
        padding: 16,
        alignItems: 'center',
        backgroundColor: 'rgba(255, 68, 68, 0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 68, 68, 0.2)',
    },
    cancelTextAction: { color: VisualSystem.colors.danger, fontWeight: '700', fontSize: 15 },
    modalFullContainer: { flex: 1, backgroundColor: VisualSystem.colors.bgMid },
    addExerciseLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    addExerciseLoadingText: {
        color: VisualSystem.colors.goldText,
        fontSize: 13,
        fontWeight: '700',
    },
    modalHeader: { padding: 16, paddingTop: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: VisualSystem.colors.bgMid, borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.1)' },
    searchContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: VisualSystem.colors.bgMid, 
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 16, 
        borderWidth: 1, 
        borderColor: VisualSystem.colors.borderSubtle,
    },
    searchInput: { color: VisualSystem.colors.textPrimary, fontSize: 17, flex: 1, fontWeight: '600' },

    // Rest Timer
    restTimerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: VisualSystem.colors.bgMid, borderTopWidth: 1, borderTopColor: VisualSystem.colors.borderGold, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    restTimerText: { color: VisualSystem.colors.goldText, fontWeight: '700', fontSize: 17, fontFamily: 'System' },
    timerControlBtn: { backgroundColor: VisualSystem.colors.bgMid, borderWidth: 1, borderColor: VisualSystem.colors.borderGold, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
    timerControlText: { color: VisualSystem.colors.textPrimary, fontWeight: '700' },
    startRestBtn: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 28, backgroundColor: VisualSystem.colors.gold, justifyContent: 'center', alignItems: 'center', shadowColor: VisualSystem.colors.navy, boxShadow: '0px 4px 4.65px rgba(0,0,0,0.3)', elevation: 8 },

    quickStartBtn: {
        borderRadius: 22,
        overflow: 'hidden',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    quickStartGradient: {
        paddingVertical: 32,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickStartText: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '800',
        fontSize: 17,
        letterSpacing: 0.5,
    },
    quickStartSub: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
        opacity: 0.7,
    },
    emptyAcademy: {
        marginTop: 32,
        alignItems: 'center',
        padding: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
        marginBottom: 8,
    },
    emptyTemplates: {
        padding: 16,
        backgroundColor: VisualSystem.colors.bgDeep,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.1)',
    },

    // --- Active workout log UI ---
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 8,
        paddingHorizontal: 16,
        backgroundColor: LOG.bgBase,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: LOG.borderSubtle,
    },
    headerIconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: LOG.dangerSoft,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(198, 47, 47, 0.28)',
    },
    headerFinishButton: {
        backgroundColor: LOG.gold,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: VisualSystem.radius.pill,
        borderWidth: 1,
        borderColor: LOG.borderGold,
    },
    headerFinishText: {
        color: LOG.textOnGold,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    logTimerContainer: {
        alignItems: 'center',
    },
    logTimerLabel: {
        color: LOG.textSecondary,
        fontSize: VisualSystem.text.caption,
        fontWeight: '800',
        letterSpacing: 0.2,
        marginBottom: 2,
    },
    logTimerText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: VisualSystem.text.title,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    logWorkoutTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: LOG.textPrimary,
        marginBottom: 4,
        letterSpacing: -0.3,
        paddingHorizontal: 0,
    },
    logSessionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 12,
    },
    logSessionMetaText: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '600',
    },
    logSessionMetaDot: {
        color: LOG.textTertiary,
        fontSize: 11,
        opacity: 0.5,
    },
    logNotesToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 12,
        borderRadius: 10,
        backgroundColor: LOG.glassFill,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    logNotesToggleText: {
        color: LOG.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    logNotesInput: {
        fontSize: 13,
        color: LOG.textSecondary,
        marginBottom: 12,
        padding: 8,
        backgroundColor: LOG.glassFill,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        minHeight: 36,
        maxHeight: 72,
    },
    logExContainer: {
        backgroundColor: LOG.glassFill,
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    logExHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    logExName: {
        flex: 1,
        fontSize: 15,
        fontWeight: '800',
        color: LOG.textPrimary,
    },
    logExCategory: {
        fontSize: 11,
        color: VisualSystem.colors.textSecondary,
        letterSpacing: 0.2,
        fontWeight: '700',
        marginTop: 4,
    },
    logExMenuBtn: {
        padding: 4,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logStickyNote: {
        backgroundColor: LOG.goldMuted,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: LOG.borderGold,
    },
    logStickyNoteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    logStickyNoteHeaderSpacer: {
        flex: 1,
    },
    logStickyNoteClose: {
        padding: 4,
    },
    logStickyNoteLabel: {
        color: LOG.goldText,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    logStickyNoteInput: {
        color: LOG.textPrimary,
        fontSize: 13,
        lineHeight: 20,
        minHeight: 36,
        padding: 0,
    },
    logTableLabels: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: LOG.borderSubtle,
    },
    logLabel: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    logSetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        marginBottom: 0,
        borderRadius: 6,
        gap: 4,
    },
    logSetRowCompleted: {
        backgroundColor: LOG.goldMuted,
    },
    logSetRowWarmup: {
        opacity: 1,
    },
    logSetRowDropset: {
        opacity: 1,
    },
    logSetIndex: {
        width: 26,
        height: 26,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: LOG.bgElevated,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    logSetIndexText: {
        color: LOG.goldText,
        fontWeight: '800',
        fontSize: 11,
    },
    logPrevText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    logInput: {
        height: 32,
        backgroundColor: LOG.bgElevated,
        borderRadius: 6,
        color: LOG.textPrimary,
        textAlign: 'center',
        fontSize: 15,
        fontWeight: '700',
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    logCheckBtn: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: LOG.bgElevated,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    logCheckBtnActive: {
        backgroundColor: VisualSystem.colors.successSoft,
        borderColor: VisualSystem.colors.success,
    },
    logRestTimerBar: {
        height: 20,
        backgroundColor: VisualSystem.colors.bgDeep,
        borderRadius: 6,
        marginTop: 4,
        marginBottom: 8,
        overflow: 'hidden',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(46, 204, 113, 0.2)',
    },
    logRestTimerFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: VisualSystem.colors.successSoft,
    },
    logRestTimerText: {
        color: VisualSystem.colors.success,
        fontSize: 11,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    logAddSetBtn: {
        flexDirection: 'row',
        marginTop: 8,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
    },
    logAddSetText: {
        color: LOG.goldText,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    logAddExBtn: {
        backgroundColor: 'transparent',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: LOG.borderGold,
    },
    logAddExText: {
        color: LOG.goldText,
        fontWeight: '800',
        fontSize: 13,
        letterSpacing: 0.2,
    },
    premiumCancelWorkoutBtn: {
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 32,
        backgroundColor: 'rgba(255, 68, 68, 0.03)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 68, 68, 0.15)',
    },
    premiumCancelWorkoutText: {
        color: VisualSystem.colors.danger,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    historySearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: LOG.glassFill,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    historySearchInput: {
        flex: 1,
        color: LOG.textPrimary,
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 8,
    },
    historyTabRow: {
        flexDirection: 'row',
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 10,
        padding: 4,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    historyTab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
    },
    historyTabActive: {
        backgroundColor: LOG.goldMuted,
        borderWidth: 1,
        borderColor: LOG.borderGold,
    },
    historyTabText: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '700',
    },
    historyTabTextActive: {
        color: LOG.goldText,
        fontWeight: '800',
    },
    historyGroupHeader: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
        marginBottom: 8,
        marginTop: 4,
    },
    historyCard: {
        backgroundColor: LOG.glassFill,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        overflow: 'hidden',
    },
    historyCardBody: {
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    historyCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    historyCardMain: {
        flex: 1,
    },
    historyName: {
        color: LOG.textPrimary,
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
        letterSpacing: -0.2,
    },
    historyMetaLine: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '600',
    },
    historyVolumeInline: {
        color: LOG.goldText,
        fontWeight: '800',
    },
    historyRepeatBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: LOG.goldMuted,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: LOG.borderGold,
    },
    historyExpandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        borderTopWidth: 1,
        borderTopColor: LOG.borderSubtle,
        gap: 4,
    },
    historyExpandText: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    historyExercisesList: {
        paddingHorizontal: 12,
        paddingBottom: 8,
        gap: 4,
        borderTopWidth: 1,
        borderTopColor: LOG.borderSubtle,
        paddingTop: 8,
    },
    historyShowMoreBtn: {
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 4,
        marginBottom: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        backgroundColor: LOG.bgElevated,
    },
    historyShowMoreText: {
        color: LOG.textSecondary,
        fontSize: 11,
        fontWeight: '700',
    },
    historyCountBadge: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 8,
    },
    historyExChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    historyExDot: {
        width: 5,
        height: 5,
        borderRadius: 6,
        backgroundColor: LOG.gold,
        opacity: 0.7,
    },
    historyExText: {
        color: LOG.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    historyExMore: {
        color: LOG.textTertiary,
        fontSize: 11,
        marginLeft: 12,
        fontWeight: '600',
    },
    // Coach UI styles
    coachCard: {
        marginHorizontal: 0,
        marginBottom: 24,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    coachGradient: {
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    coachIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    coachCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: VisualSystem.colors.goldText,
        letterSpacing: 0.2,
    },
    coachCardSub: {
        fontSize: 11,
        color: VisualSystem.colors.textSecondary,
    },
    coachBadge: {
        backgroundColor: VisualSystem.colors.gold,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 12,
    },
    coachBadgeText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 11,
        fontWeight: '800',
    },
    coachChatContainer: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgBase,
    },
    coachChatHeader: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: VisualSystem.colors.bgMid,
        borderBottomWidth: 1,
        borderBottomColor: VisualSystem.colors.borderSubtle,
    },
    coachChatClose: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    coachChatTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
        letterSpacing: 0.2,
    },
    coachChatScroll: {
        flex: 1,
    },
    msgBubble: {
        flexDirection: 'row',
        marginBottom: 16,
        maxWidth: '85%',
    },
    msgAI: {
        alignSelf: 'flex-start',
    },
    msgUser: {
        alignSelf: 'flex-end',
        flexDirection: 'row-reverse',
    },
    msgAIAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: VisualSystem.colors.gold,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
        marginRight: 8,
    },
    msgTextContainer: {
        padding: 12,
        borderRadius: 16,
    },
    msgTextAI: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderTopLeftRadius: 4,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    msgTextUser: {
        backgroundColor: VisualSystem.colors.goldVivid,
        borderTopRightRadius: 4,
    },
    msgText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        lineHeight: 22,
    },
    msgTextUserText: {
        color: VisualSystem.colors.textOnGold,
        fontWeight: '600',
    },
    coachChatInputArea: {
        flexDirection: 'row',
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 20 : 15,
        backgroundColor: VisualSystem.colors.bgMid,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: VisualSystem.colors.borderSubtle,
        alignItems: 'flex-end',
    },
    coachChatInput: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgDeep,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 8,
        paddingTop: 8,
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    coachSendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: VisualSystem.colors.goldVivid,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    planPreviewInBubble: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(212, 175, 55, 0.2)',
    },
    planPreviewLine: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 11,
        lineHeight: 18,
        marginBottom: 4,
    },
    coachPlanActions: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: LOG.bgDeep,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: LOG.borderSubtle,
    },
    coachPlanActionsTitle: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    coachPlanBtnRow: {
        flexDirection: 'row',
        gap: 8,
    },
    coachPlanBtnPrimary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: VisualSystem.colors.gold,
        paddingVertical: 12,
        borderRadius: 10,
    },
    coachPlanBtnPrimaryText: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '800',
        fontSize: 13,
    },
    coachPlanBtnSecondary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: VisualSystem.colors.bgMid,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.35)',
    },
    coachPlanBtnSecondaryText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '700',
        fontSize: 13,
    },
    coachPlanSaveLink: {
        alignItems: 'center',
        marginTop: 8,
    },
    coachPlanSaveLinkText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    coachPlanHint: {
        color: VisualSystem.colors.textTertiary,
        fontSize: 11,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 15,
    },
    coachBtnDisabled: {
        opacity: 0.45,
    },
    coachSendBtnDisabled: {
        backgroundColor: VisualSystem.colors.bgDeep,
    },
    coachPreparingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: LOG.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    coachPreparingText: {
        color: LOG.goldBright,
        fontSize: 13,
        fontWeight: '600',
        marginTop: 12,
    },
    workoutPreparingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: LOG.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    workoutPreparingText: {
        color: LOG.textOnNavy,
        fontSize: 15,
        fontWeight: '600',
        marginTop: 12,
    },

    dashboardScroll: {
        flexGrow: 1,
        paddingBottom: 32,
    },
    dashboardContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
        gap: 24,
    },
    dashboardSection: {
        gap: 8,
    },
    /**
     * Section headers read as headers, not as shouted labels. The tiny
     * letter-spaced uppercase treatment was on every group in the app and is
     * what made screens feel like forms.
     */
    dashboardSectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: LOG.textPrimary,
        letterSpacing: -0.2,
        marginLeft: 4,
        marginBottom: 4,
    },
    logExSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    supersetChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: VisualSystem.radius.xs,
        backgroundColor: LOG.goldMuted,
        borderWidth: 1,
        borderColor: LOG.borderGold,
    },
    supersetChipText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.4,
        color: LOG.goldText,
    },
    dashboardSectionSub: {
        fontSize: VisualSystem.text.small,
        color: LOG.textSecondary,
        marginLeft: 4,
        marginBottom: 10,
    },
    missionPanel: {
        ...glassSurface,
        borderRadius: 22,
        padding: 16,
        gap: 12,
        borderColor: LOG.borderSubtle,
        backgroundColor: LOG.glassFill,
    },
    missionHeader: {
        alignItems: 'center',
        gap: 4,
        paddingBottom: 4,
    },
    missionEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        color: LOG.goldText,
        letterSpacing: 0.2,
        opacity: 0.85,
    },
    missionTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: LOG.textPrimary,
        letterSpacing: 0.2,
    },
    missionSub: {
        fontSize: 13,
        color: LOG.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 8,
    },
    toolCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        backgroundColor: LOG.glassFill,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        gap: 12,
    },
    toolCardIcon: {
        backgroundColor: LOG.goldMuted,
    },
    toolCardTitle: {
        color: LOG.textPrimary,
        fontSize: 15,
        fontWeight: '800',
    },
    toolCardSub: {
        fontSize: 11,
        marginTop: 4,
        lineHeight: 16,
    },
    templateScroll: {
        gap: 12,
        paddingRight: 4,
    },
    templateSlide: {
        width: 260,
    },
    locationCard: {
        ...glassSurfaceGold,
        padding: 16,
        marginBottom: 16,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    locationIcon: {
        width: 40,
        height: 40,
        borderRadius: 22,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationLabel: {
        fontSize: 11,
        color: VisualSystem.colors.textSecondary,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    locationName: {
        fontSize: 15,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
    },
    changeButton: {
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    changeButtonText: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '700',
    },
    locationDivider: {
        height: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        marginVertical: 12,
    },
    refreshLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    refreshText: {
        color: '#A9A9A9',
        fontSize: 11,
    },
    startActions: {
        gap: 8,
    },
    /** Primary action: solid, full-width, unmistakable. */
    startCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: LOG.gold,
        height: 52,
        borderRadius: 16,
        marginBottom: 24,
    },
    startCtaText: {
        color: LOG.textOnGold,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    /** One container, hairline-separated rows — not a card per item. */
    group: {
        backgroundColor: LOG.bgMid,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        overflow: 'hidden',
    },
    groupDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: LOG.borderSubtle,
        marginLeft: 16,
    },
    groupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    groupRowText: { flex: 1, minWidth: 0 },
    groupRowTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: LOG.textPrimary,
    },
    groupRowSub: {
        fontSize: 13,
        color: LOG.textSecondary,
        marginTop: 1,
    },
    startWorkoutCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.35)',
        ...VisualSystem.shadow.goldGlow,
    },
    startWorkoutIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: VisualSystem.colors.goldMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    startWorkoutTitle: {
        color: LOG.textOnGold,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    startWorkoutSub: {
        fontSize: 11,
        marginTop: 4,
        lineHeight: 16,
        color: 'rgba(12, 35, 64, 0.72)',
    },
    aiCoachCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        backgroundColor: LOG.glassFill,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        gap: 12,
    },
    aiCoachIcon: {
        backgroundColor: LOG.goldMuted,
    },
    aiCoachTitle: {
        color: LOG.textPrimary,
        fontSize: 15,
        fontWeight: '800',
    },
    aiCoachSub: {
        fontSize: 11,
        marginTop: 4,
        lineHeight: 16,
    },
    activityLogBlock: {
        gap: 8,
        paddingTop: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: LOG.borderSubtle,
    },
    activityLogLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: LOG.textTertiary,
        letterSpacing: 0.2,
        marginLeft: 4,
    },
    activityLogBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212,175,55,0.06)',
        borderRadius: 16,
        paddingLeft: 12,
        paddingRight: 4,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
    },
    activityLogInput: {
        flex: 1,
        color: LOG.textPrimary,
        fontSize: 13,
        fontWeight: '600',
        paddingVertical: 8,
        paddingRight: 8,
    },
    activityLogBtn: {
        backgroundColor: LOG.goldVivid,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityLogBtnDisabled: {
        backgroundColor: LOG.bgDeep,
    },
    activityLogBtnText: {
        color: LOG.textOnGold,
        fontWeight: '800',
        fontSize: 13,
    },
    activityLogBtnTextDisabled: {
        color: LOG.textTertiary,
    },
    activityLogHint: {
        fontSize: 11,
        color: LOG.textTertiary,
        lineHeight: 15,
        marginLeft: 4,
    },
    activityLogHintSuccess: {
        color: LOG.goldText,
        fontWeight: '600',
    },
    choiceModalOverlay: {
        flex: 1,
        backgroundColor: VisualSystem.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    choiceModalContent: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 22,
        padding: 24,
        width: '100%',
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderGold,
    },
    choiceTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
        textAlign: 'center',
        marginBottom: 8,
    },
    choiceSubTitle: {
        fontSize: 13,
        color: VisualSystem.colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    choiceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 12,
        gap: 16,
    },
    choiceBtnText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 17,
        fontWeight: '700',
    },
    choiceClose: {
        marginTop: 8,
        padding: 8,
        alignItems: 'center',
    },
    choiceCloseText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    gymPickerItem: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212, 175, 55, 0.1)',
    },
    gymPickerText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        fontWeight: '700',
    },
    historyMetricContainer: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 8,
    },
    pillText: {
        fontSize: 11,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
        letterSpacing: 0.5,
    },
    pillTextActive: {
        color: VisualSystem.colors.textPrimary,
    },
    // New Exercise Modal Styles
    newExLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: VisualSystem.colors.goldText,
        marginLeft: 16,
        marginTop: 16,
        marginBottom: 8,
        letterSpacing: 0.2,
    },
    newExInput: {
        backgroundColor: VisualSystem.colors.bgDeep,
        borderRadius: 10,
        marginHorizontal: 16,
        padding: 16,
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    newExChipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    newExChip: {
        backgroundColor: VisualSystem.colors.bgDeep,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 22,
        margin: 4,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.1)',
    },
    newExChipActive: {
        backgroundColor: VisualSystem.colors.gold,
        borderColor: VisualSystem.colors.borderGold,
    },
    newExChipText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    newExChipTextActive: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '700',
    },
    newExDropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: VisualSystem.colors.bgDeep,
        borderRadius: 10,
        marginHorizontal: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        marginBottom: 32,
    },
    newExDropdownText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        fontWeight: '600',
    },
    newExSaveBtn: {
        color: VisualSystem.colors.goldText,
        fontWeight: '800',
        fontSize: 15,
    },
    newExSaveBtnDisabled: {
        color: VisualSystem.colors.textTertiary,
    },
    // Alphabetical Index Styles
    historyCardMini: {
        backgroundColor: LOG.glassFill,
        borderRadius: 16,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    historyCardMiniDate: {
        color: LOG.textPrimary,
        fontWeight: '700',
        fontSize: 13,
        marginBottom: 4,
    },
    historyCardMiniVol: {
        color: LOG.textTertiary,
        fontSize: 11,
    },
    historyCardMiniWeight: {
        color: LOG.goldText,
        fontWeight: '800',
        fontSize: 17,
    },
    historyCardMiniUnit: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '700',
    },
    progressPanel: {
        ...glassSurface,
        borderRadius: 16,
        overflow: 'hidden',
        padding: 12,
        backgroundColor: LOG.glassFill,
        borderColor: LOG.borderSubtle,
    },
    logEmptyState: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: LOG.glassFill,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        borderStyle: 'dashed',
    },
    logEmptyIcon: {
        width: 48,
        height: 48,
        borderRadius: 22,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    logEmptyTitle: {
        color: LOG.textPrimary,
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 4,
    },
    logEmptySub: {
        textAlign: 'center',
        lineHeight: 18,
        fontSize: 13,
    },
    logActionsFooter: {
        marginTop: 8,
        gap: 12,
        paddingTop: 8,
    },
    logStickyFooter: {
        paddingHorizontal: 16,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: LOG.borderSubtle,
        backgroundColor: LOG.bgBase,
    },
    logAddExBtnPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: LOG.gold,
        borderRadius: 10,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.4)',
    },
    logAddExBtnPrimaryText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    logCancelLink: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    logCancelLinkText: {
        color: 'rgba(255, 100, 100, 0.75)',
        fontSize: 13,
        fontWeight: '700',
    },
    progressSelector: {
        backgroundColor: LOG.bgElevated,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: LOG.borderGold,
        marginBottom: 12,
    },
    selectorText: {
        color: LOG.textPrimary,
        fontSize: 15,
        fontWeight: '700',
        flex: 1,
    },
    selectorPlaceholder: {
        color: LOG.textTertiary,
        fontWeight: '600',
    },
    selectorDropdown: {
        backgroundColor: LOG.bgElevated,
        borderRadius: 16,
        padding: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: LOG.borderGold,
        ...VisualSystem.shadow.card,
    },
    selectorSearchInput: {
        backgroundColor: LOG.glassFill,
        borderRadius: 10,
        padding: 12,
        color: LOG.textPrimary,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        fontSize: 13,
    },
    selectorItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: LOG.borderSubtle,
    },
    selectorItemText: {
        color: LOG.textPrimary,
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    progressStatsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    progressStatCard: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    progressStatLabel: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
        marginBottom: 4,
    },
    progressStatValue: {
        color: LOG.goldText,
        fontSize: 17,
        fontWeight: '800',
    },
    progressStatUnit: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '700',
        marginTop: 4,
    },
    graphContainer: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        marginBottom: 4,
    },
    graphHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 8,
    },
    graphTitle: {
        color: LOG.textSecondary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    graphVal: {
        color: LOG.goldText,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    graphDateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 4,
        paddingHorizontal: 4,
    },
    graphDateText: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '600',
    },
    emptyGraph: {
        minHeight: 140,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
        marginBottom: 4,
    },
    progressSubsection: {
        marginTop: 16,
        marginBottom: 8,
    },
    progressSubsectionTitle: {
        color: LOG.textTertiary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
        marginBottom: 8,
    },
    historySectionLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    historySectionLabelText: {
        color: LOG.textTertiary,
        fontWeight: '800',
        fontSize: 11,
        letterSpacing: 0.2,
    },
    historyEmpty: {
        paddingVertical: 32,
        paddingHorizontal: 16,
        alignItems: 'center',
        backgroundColor: LOG.glassFill,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    historyCollapsedHint: {
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
        backgroundColor: LOG.glassFill,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: LOG.borderSubtle,
    },
    historyCollapsedCount: {
        color: LOG.textPrimary,
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 4,
    },
    progressSectionToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 4,
    },
    progressSectionHint: {
        marginTop: 4,
        fontSize: 11,
    },
    sessionsToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    sessionsCollapsedHint: {
        fontSize: 11,
        marginBottom: 8,
    },
    indexSidebar: {
        width: 30,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: VisualSystem.colors.bgMid,
        paddingVertical: 8,
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(212, 175, 55, 0.1)',
        height: '100%',
    },
    indexLetter: {
        fontSize: 11,
        fontWeight: '800',
        color: VisualSystem.colors.goldText,
        paddingVertical: 4,
        opacity: 0.8,
    },
});


export default function GymScreen() {
    const colorScheme = useColorScheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    // The native tab bar is translucent and content runs under it, so anything
    // anchored to the bottom has to clear it or it can't be tapped.
    const tabBarHeight = useBottomTabBarHeight();
    const { user, updateProfile } = useAuth();

    // State management
    const [allExercises, setAllExercises] = useState<string[]>([]);
    const [selectedProgressEx, setSelectedProgressEx] = useState<string | null>(null);
    const [progressData, setProgressData] = useState<{ date: string, maxWeight: number, volume: number }[]>([]);
    const [isProgressLoading, setIsProgressLoading] = useState(false);

    useEffect(() => {
        if (user) {
            getPerformedExercises(user.id).then(setAllExercises);
        }
    }, [user]);

    const handleSelectProgressEx = async (name: string) => {
        if (!user) return;
        setSelectedProgressEx(name);
        setIsProgressLoading(true);
        const data = await getExerciseProgress(user.id, name);
        setProgressData(data);
        setIsProgressLoading(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const [viewMode, setViewMode] = useState<'Dashboard' | 'ActiveLogging'>('Dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [addExerciseVisible, setAddExerciseVisible] = useState(false);
    const [addingExercise, setAddingExercise] = useState(false);
    const [createExerciseVisible, setCreateExerciseVisible] = useState(false);
    const [newExName, setNewExName] = useState('');
    const [newExBodyPart, setNewExBodyPart] = useState('Arms');
    const [newExType, setNewExType] = useState('Barbell');
    const [showExTypeDropdown, setShowExTypeDropdown] = useState(false);
    const [libraryBrowseVisible, setLibraryBrowseVisible] = useState(false);
    const [aiContext, setAiContext] = useState('');
    const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
    const dashboardScrollY = useRef(new RNAnimated.Value(0)).current;
    const exercisePickerListRef = useRef<FlatList<ExercisePickerListItem>>(null);
    const pickerRowHeightRef = useRef(EXERCISE_PICKER_ROW_HEIGHT);
    const pickerHeaderHeightRef = useRef(EXERCISE_PICKER_HEADER_HEIGHT);
    const coachModalVisibleRef = useRef(false); // Helper to track modal visibility outside render if needed
    const stickyNoteSaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
    const stickyNoteInputRefs = useRef<Record<string, TextInput | null>>({});
    const [coachModalVisible, setCoachModalVisible] = useState(false);
    type CoachMessage = {
        id: string;
        text: string;
        sender: 'user' | 'ai';
        pendingWorkout?: Workout;
    };
    const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
    const [coachDraftWorkout, setCoachDraftWorkout] = useState<Workout | null>(null);
    const [coachInput, setCoachInput] = useState('');
    const [isAiTyping, setIsAiTyping] = useState(false);
    const [isPreparingWorkout, setIsPreparingWorkout] = useState(false);
    const canSendCoachMessage = coachInput.trim().length > 0 && !isAiTyping && !isPreparingWorkout;
    const [timer, setTimer] = useState(0);
    const workoutStartAtRef = useRef<number | null>(null);
    const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);
    const [plateCalcVisible, setPlateCalcVisible] = useState(false);
    const [warmupCalcVisible, setWarmupCalcVisible] = useState(false);
    const [calcTargetWeight, setCalcTargetWeight] = useState(0);

    // Sharing State
    const [createPostVisible, setCreatePostVisible] = useState(false);
    const [justFinishedWorkout, setJustFinishedWorkout] = useState<Workout | null>(null);
    const [workoutMilestones, setWorkoutMilestones] = useState<WorkoutMilestone[]>([]);
    const [workoutCaloriesBurned, setWorkoutCaloriesBurned] = useState<number | null>(null);
    const [isQuickPosting, setIsQuickPosting] = useState(false);
    const [workoutSummaryVisible, setWorkoutSummaryVisible] = useState(false);
    const [activityLogText, setActivityLogText] = useState('');
    const [activityLogging, setActivityLogging] = useState(false);
    const [lastActivityLogMessage, setLastActivityLogMessage] = useState<string | null>(null);

    // Exercise Specific State
    const [menuExerciseIdx, setMenuExerciseIdx] = useState<number | null>(null);
    const [restModalExerciseIdx, setRestModalExerciseIdx] = useState<number | null>(null);
    const [editingRest, setEditingRest] = useState<{ exIdx: number; setIdx: number } | null>(null);
    const [visibleExerciseNotes, setVisibleExerciseNotes] = useState<Set<string>>(new Set());
    const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});
    const [workoutNotesExpanded, setWorkoutNotesExpanded] = useState(false);

    // In-line Rest Timer State
    const [setRestTimer, _setSetRestTimer] = useState<RestTimerState | null>(null);

    /**
     * Set the rest timer and arm (or disarm) its notification.
     *
     * The alert is scheduled for endsAt when the timer starts rather than fired
     * when the countdown reaches zero. iOS suspends JS timers the moment the
     * app leaves the foreground, so a tick-fired alert never arrives — and
     * leaving the app is exactly when you are relying on being told.
     */
    const setSetRestTimer = useCallback((next: RestTimerState | null) => {
        setSetRestTimer(next);
        Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID).catch(() => {});
        if (next?.status === 'running' && next.endsAt > Date.now()) {
            Notifications.scheduleNotificationAsync({
                identifier: REST_NOTIFICATION_ID,
                content: {
                    title: 'Rest complete',
                    body: 'Time for your next set.',
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: new Date(next.endsAt),
                },
            }).catch(() => {});
        }
    }, []);

    // Nothing should be left armed once the screen goes away.
    useEffect(
        () => () => {
            Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID).catch(() => {});
        },
        []
    );

    // Data State
    const [templates, setTemplates] = useState<Workout[]>([]);
    const [historyCount, setHistoryCount] = useState(0);
    const [progressHistoryExpanded, setProgressHistoryExpanded] = useState(false);

    // Timer Effects
    useEffect(() => {
        loadWorkouts();
        requestNotificationPermissions();
    }, []);

    /** Fix saved gyms from older builds (e.g. "Home / No Gym", wrong dorm hall names). */
    useEffect(() => {
        if (!user) return;
        const saved = user.defaultGym?.trim();
        if (saved && !GYM_PROFILES[saved]) {
            updateProfile({ defaultGym: resolveTrainingLocation(user) });
        }
    }, [user?.id, user?.defaultGym, user?.dorm]);

    const requestNotificationPermissions = async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
            // Silence failure
        }
    };

    useEffect(() => {
        if (viewMode !== 'ActiveLogging' || !activeWorkout || !workoutStartAtRef.current) {
            if (viewMode === 'Dashboard') {
                workoutStartAtRef.current = null;
            }
            return;
        }
        const tick = () => {
            setTimer(Math.max(0, Math.floor((Date.now() - workoutStartAtRef.current!) / 1000)));
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [viewMode, activeWorkout?.id]);

    useEffect(() => {
        if (activeWorkout?.notes?.trim()) {
            setWorkoutNotesExpanded(true);
        } else if (!activeWorkout) {
            setWorkoutNotesExpanded(false);
        }
    }, [activeWorkout?.id]);

    useEffect(() => {
        if (!setRestTimer || setRestTimer.status !== 'running') return;
        const tick = () => {
            _setSetRestTimer((prev) => {
                if (!prev || prev.status !== 'running') return prev;
                const remaining = Math.max(0, Math.ceil((prev.endsAt - Date.now()) / 1000));
                if (remaining <= 0) {
                    // The scheduled alert covers being told; this is the
                    // in-hand confirmation when the app is already open.
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    return { ...prev, remaining: 0, status: 'finished' };
                }
                if (remaining === prev.remaining) return prev;
                return { ...prev, remaining };
            });
        };
        tick();
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    }, [setRestTimer?.endsAt, setRestTimer?.status, setRestTimer?.exerciseIdx, setRestTimer?.setIdx]);

    const loadWorkouts = async () => {
        if (!user) return;
        const t = await getTemplates(user.id);
        const h = await getWorkoutHistory(user.id);
        setTemplates(t);
        setHistoryCount(h.length);
    };

    /** Copy a finished session into saved routines, with its ticks cleared. */
    const handleSaveHistoryAsTemplate = async (workout: Workout) => {
        if (!user) return;
        try {
            await saveTemplate(
                {
                    ...workout,
                    id: Math.random().toString(36).slice(2, 11),
                    // A routine carries the plan, not the performance: the
                    // weights stay as a starting point, but the completed flags
                    // go, or the next session opens already finished.
                    exercises: workout.exercises.map((ex) => ({
                        ...ex,
                        sets: ex.sets.map((set) => ({ ...set, completed: false })),
                    })),
                },
                user.id
            );
            await loadWorkouts();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Saved', workout.name + ' is now one of your routines.');
        } catch {
            Alert.alert('Could not save', 'That routine could not be saved. Try again.');
        }
    };

    const handleDeleteTemplate = (template: Workout) => {
        Alert.alert(
            'Delete routine?',
            `"${template.name}" will be removed from your saved routines.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteTemplate(template.id);
                            setTemplates((prev) => prev.filter((t) => t.id !== template.id));
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch {
                            Alert.alert('Could not delete', 'Try again in a moment.');
                        }
                    },
                },
            ]
        );
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Filtered Exercises
    const filteredExercises = EXERCISE_LIBRARY.filter(ex =>
        (ex.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ex.category || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- ACTIONS ---
    const openCoachChat = () => {
        setCoachDraftWorkout(null);
        setCoachModalVisible(true);
        setCoachMessages([
            {
                id: 'ai-start',
                text: `☘️ Tell me your focus (push, pull, legs), how many minutes, and any injuries — I'll build a plan using our ${CANONICAL_EXERCISES.length}+ exercise library for ${user ? resolveTrainingLocation(user) : 'Duncan Student Center'} (equipment at your active location).\n\nWhen your plan is ready, you can start right away, edit it first, or keep chatting to change anything.`,
                sender: 'ai',
            },
        ]);
    };

    const formatPlanSummaryLines = (workout: Workout) =>
        workout.exercises.map((ex) => {
            const sets = ex.sets.length;
            const reps = ex.sets[0]?.reps ?? 10;
            return `• ${ex.name} — ${sets}×${reps}`;
        }).join('\n');

    const prepareActiveWorkout = async (workout: Workout): Promise<Workout | null> => {
        if (!user) return null;
        const enhancedWorkout = { ...workout, id: workout.id || Math.random().toString() };

        const updatedExercises = await Promise.all(
            workout.exercises.map(async (ex) => {
                const [prevSets, stickyNote] = await Promise.all([
                    getLatestSetsForExercise(user.id, ex.id, ex.name),
                    resolveExerciseStickyNote(user.id, ex.id, ex.name, ex.stickyNote),
                ]);

                let sets = ex.sets;
                if (prevSets) {
                    sets = ex.sets.map((s, idx) => {
                        const prevSet = prevSets[idx];
                        const perf = prevSet ? `${prevSet.weight} x ${prevSet.reps}` : undefined;
                        return {
                            ...s,
                            previousPerformance: perf,
                            weight: s.weight === 0 && prevSet ? prevSet.weight : s.weight,
                            reps: s.reps === 0 && prevSet ? prevSet.reps : s.reps,
                        };
                    });
                }
                return { ...ex, sets, stickyNote };
            })
        );

        return { ...enhancedWorkout, exercises: updatedExercises };
    };

    const enterActiveWorkoutSession = (workout: Workout) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        workoutStartAtRef.current = Date.now();
        setActiveWorkout(workout);
        setTimer(0);
        setSetRestTimer(null);
        setEditingRest(null);
        setVisibleExerciseNotes(new Set());
        setWeightDrafts({});
        setViewMode('ActiveLogging');
        if (user) {
            setWorkoutActive(user.id, workout.name || 'Workout');
        }
    };

    const syncLiveWorkoutProgress = (workout: Workout, exerciseIdx: number) => {
        if (!user) return;
        const setsCompleted = workout.exercises.reduce(
            (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
            0
        );
        const exerciseName = workout.exercises[exerciseIdx]?.name || 'Exercise';
        updateWorkoutProgress(user.id, workout.name || 'Workout', exerciseName, setsCompleted);
    };

    const transitionFromCoachToWorkout = async (workout: Workout) => {
        if (isPreparingWorkout) return;
        setIsPreparingWorkout(true);
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const prepared = await prepareActiveWorkout(workout);
            if (!prepared) return;
            setCoachDraftWorkout(null);
            setCoachModalVisible(false);
            await new Promise<void>((resolve) => {
                InteractionManager.runAfterInteractions(() => {
                    requestAnimationFrame(() => {
                        enterActiveWorkoutSession(prepared);
                        resolve();
                    });
                });
            });
        } finally {
            setIsPreparingWorkout(false);
        }
    };

    const startCoachDraftWorkout = async () => {
        if (!coachDraftWorkout || isPreparingWorkout) return;
        await transitionFromCoachToWorkout(coachDraftWorkout);
    };

    const editCoachDraftWorkout = () => startCoachDraftWorkout();

    const saveCoachDraftAsTemplate = async () => {
        if (!coachDraftWorkout || !user) return;
        await saveTemplate(coachDraftWorkout, user.id);
        loadWorkouts();
        Alert.alert('Saved', `"${coachDraftWorkout.name}" is in your templates.`);
    };

    /** Start an empty session — add exercises anytime via ADD EXERCISE */
    const startQuickWorkout = async () => {
        await startActiveWorkout({
            id: 'new',
            name: 'Workout',
            date: new Date().toISOString(),
            duration: 0,
            exercises: [],
            notes: '',
        });
    };

    const handleActivityQuickLog = async () => {
        const text = activityLogText.trim();
        if (!text || !user || activityLogging) return;

        setActivityLogging(true);
        setLastActivityLogMessage(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const estimate = await estimateActivityFromDescription(text);
            const workout = activityEstimateToWorkout(estimate, user.weightKg || 75);
            const calories =
                estimate.caloriesBurned ??
                estimateActivityCaloriesBurn(
                    estimate.durationMinutes,
                    estimate.met,
                    user.weightKg || 75
                );

            await saveWorkout(workout, user.id);

            const todayStr = getLocalDateString();
            try {
                await addWorkoutCaloriesToLog(user.id, todayStr, calories, user);
            } catch (err) {
                console.warn('[Gym] Activity log nutrition sync failed:', err);
            }

            setActivityLogText('');
            setLastActivityLogMessage(formatActivityLogSuccess(estimate, calories));
            setTimeout(() => setLastActivityLogMessage(null), 4000);
            await loadWorkouts();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e: unknown) {
            const message =
                e instanceof Error ? e.message : 'Try adding duration, e.g. "basketball for 40 minutes".';
            Alert.alert('Could not log activity', message);
        } finally {
            setActivityLogging(false);
        }
    };

    // --- ACTIVE LOGGING LOGIC ---
    const startActiveWorkout = async (workout: Workout) => {
        if (!user || isPreparingWorkout) return;
        setIsPreparingWorkout(true);
        try {
            const prepared = await prepareActiveWorkout(workout);
            if (!prepared) return;
            enterActiveWorkoutSession(prepared);
        } finally {
            setIsPreparingWorkout(false);
        }
    };

    const updateNotes = (text: string) => {
        if (!activeWorkout) return;
        setActiveWorkout({ ...activeWorkout, notes: text });
    }

    const toggleSet = (exIdx: number, setIdx: number) => {
        if (!activeWorkout) return;
        const newExercises = [...activeWorkout.exercises];
        const set = newExercises[exIdx].sets[setIdx];
        set.completed = !set.completed;

        // Trigger rest timer if completing a set
        if (set.completed) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const exercise = newExercises[exIdx];
            syncLiveWorkoutProgress({ ...activeWorkout, exercises: newExercises }, exIdx);
            // The point of a superset is going straight to the paired
            // movement, so rest is owed only after the last one in the group.
            const pairedNext = newExercises[exIdx + 1];
            const restDuration =
                exercise.supersetId && pairedNext?.supersetId === exercise.supersetId
                    ? 0
                    : getRestAfterSetSeconds(exercise, set);
            setEditingRest(null);
            if (restDuration > 0) {
                const endsAt = Date.now() + restDuration * 1000;
                setSetRestTimer({
                    exerciseIdx: exIdx,
                    setIdx: setIdx,
                    endsAt,
                    remaining: restDuration,
                    total: restDuration,
                    status: 'running',
                });
            } else {
                setSetRestTimer(null);
            }
        } else {
            // Clear rest timer if unchecking
            if (setRestTimer?.exerciseIdx === exIdx && setRestTimer?.setIdx === setIdx) {
                setSetRestTimer(null);
            }
        }

        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    /**
     * Pair an exercise with the one after it, or break it out of its pair.
     *
     * A superset is stored as a shared supersetId on adjacent exercises, so
     * reordering or removing one leaves the rest of the group intact.
     */
    const toggleSuperset = (idx: number) => {
        if (!activeWorkout) return;
        const exercises = [...activeWorkout.exercises];
        const current = exercises[idx];
        if (!current) return;

        if (current.supersetId) {
            const leaving = current.supersetId;
            exercises[idx] = { ...current, supersetId: undefined };
            // A group of one is not a superset; release the straggler too.
            const remaining = exercises.filter((e) => e.supersetId === leaving);
            if (remaining.length === 1) {
                const lone = exercises.findIndex((e) => e.supersetId === leaving);
                exercises[lone] = { ...exercises[lone], supersetId: undefined };
            }
        } else {
            const next = exercises[idx + 1];
            if (!next) {
                Alert.alert(
                    'Nothing to pair with',
                    'A superset needs an exercise after this one. Add or move one below it first.'
                );
                return;
            }
            const groupId = next.supersetId ?? Math.random().toString(36).slice(2, 10);
            exercises[idx] = { ...current, supersetId: groupId };
            exercises[idx + 1] = { ...next, supersetId: groupId };
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveWorkout({ ...activeWorkout, exercises });
    };

    const updateSetRestAfter = (exIdx: number, setIdx: number, seconds: number) => {
        if (!activeWorkout) return;
        const newExercises = [...activeWorkout.exercises];
        newExercises[exIdx].sets[setIdx] = {
            ...newExercises[exIdx].sets[setIdx],
            restAfterSeconds: seconds,
        };
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const updateSetData = (exIdx: number, setIdx: number, field: 'weight' | 'reps', val: string) => {
        if (!activeWorkout) return;
        const newExercises = [...activeWorkout.exercises];
        const numVal = field === 'weight' ? parseWeightValue(val) : parseInt(val, 10);
        newExercises[exIdx].sets[setIdx][field] = Number.isFinite(numVal) ? numVal : 0;
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const handleWeightChange = (exIdx: number, setIdx: number, setId: string, raw: string) => {
        if (!activeWorkout) return;
        const cleaned = sanitizeWeightText(raw);
        setWeightDrafts((prev) => ({ ...prev, [setId]: cleaned }));

        if (cleaned === '' || cleaned === '.' || cleaned.endsWith('.')) {
            if (cleaned === '') updateSetData(exIdx, setIdx, 'weight', '0');
            return;
        }

        const newExercises = [...activeWorkout.exercises];
        newExercises[exIdx].sets[setIdx].weight = parseWeightValue(cleaned);
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const commitWeightDraft = (exIdx: number, setIdx: number, setId: string) => {
        const draft = weightDrafts[setId];
        if (draft !== undefined) {
            updateSetData(exIdx, setIdx, 'weight', draft);
            setWeightDrafts((prev) => {
                const next = { ...prev };
                delete next[setId];
                return next;
            });
        }
    };

    const getWeightInputValue = (set: WorkoutSet, setId: string) => {
        if (weightDrafts[setId] !== undefined) return weightDrafts[setId];
        return formatWeightDisplay(set.weight);
    };

    const cycleSetType = (exIdx: number, setIdx: number) => {
        if (!activeWorkout) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newExercises = [...activeWorkout.exercises];
        const set = newExercises[exIdx].sets[setIdx];
        const types: SetType[] = ['normal', 'warmup', 'dropset', 'failure'];
        const currentIdx = types.indexOf(set.type);
        set.type = types[(currentIdx + 1) % types.length];
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const reorderExercise = (index: number, direction: 'up' | 'down') => {
        if (!activeWorkout) return;
        const newExercises = [...activeWorkout.exercises];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newExercises.length) return;
        
        const [moved] = newExercises.splice(index, 1);
        newExercises.splice(newIndex, 0, moved);
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleReplaceExercise = (index: number) => {
        setMenuExerciseIdx(index);
        setViewMode('ActiveLogging'); // Ensure we stay here
        setAddExerciseVisible(true);
        // We'll need to flag that we are replacing, not adding
        // For simplicity in this phase, I'll just keep it as 'Add' for now 
        // but the user can then delete the old one. Proper replace needs one more state.
    };

    const openAddExerciseModal = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setAddExerciseVisible(true);
    };

    const addExerciseToActive = async (exercise: typeof EXERCISE_LIBRARY[0]) => {
        if (addingExercise) return;

        if (!user) {
            Alert.alert('Sign in required', 'Please sign in to add exercises.');
            return;
        }

        const exerciseId = resolveExerciseId(exercise);
        const exerciseName = exercise.name?.trim() || 'Unknown Exercise';

        setAddingExercise(true);
        try {
            let initialSets: WorkoutSet[] = [
                { id: Math.random().toString(), reps: 0, weight: 0, completed: false, type: 'normal' },
            ];
            let stickyNote = '';

            try {
                const [prevSets, note] = await Promise.all([
                    getLatestSetsForExercise(user.id, exerciseId, exerciseName),
                    resolveExerciseStickyNote(user.id, exerciseId, exerciseName),
                ]);
                if (prevSets && prevSets.length > 0) {
                    initialSets = prevSets.slice(0, 4).map((ps) => ({
                        id: Math.random().toString(),
                        reps: ps.reps,
                        weight: ps.weight,
                        completed: false,
                        type: ps.type || 'normal',
                        previousPerformance: `${ps.weight} x ${ps.reps}`,
                    }));
                }
                stickyNote = note;
            } catch (historyErr) {
                console.warn('[gym] exercise history lookup failed:', historyErr);
            }

            const newExercise: Exercise = {
                id: exerciseId,
                name: exerciseName,
                category: exercise.category || 'Other',
                type: 'weight_reps',
                primaryMuscles: exercise.primaryMuscles || [],
                secondaryMuscles: exercise.secondaryMuscles || [],
                sets: initialSets,
                stickyNote,
            };

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setActiveWorkout((prev) => {
                if (!prev) return prev;
                return { ...prev, exercises: [...prev.exercises, newExercise] };
            });

            setAddExerciseVisible(false);
            setSearchQuery('');
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            console.error('[gym] addExerciseToActive failed:', e);
            Alert.alert('Could not add exercise', 'Check your connection and try again.');
        } finally {
            setAddingExercise(false);
        }
    };

    const saveCustomExercise = async () => {
        if (!newExName || !user) return;
        
        const newEx = {
            id: 'custom_' + Date.now(),
            name: newExName.trim(),
            category: newExBodyPart,
            type: 'weight_reps',
            primaryMuscles: [newExBodyPart.toLowerCase()]
        };

        const updatedCustom = [...(user.customExercises || []), newEx];
        
        await updateProfile({
            customExercises: updatedCustom
        });

        // Close and clear the Create Modal, keeping the user in the Add Exercise List 
        // to find their newly sorted exercise alphabetically as requested.
        setCreateExerciseVisible(false);
        setNewExName('');
        setNewExBodyPart('Arms');
        setNewExType('Barbell');
    };

    const dismissFinishedWorkout = () => {
        workoutStartAtRef.current = null;
        setActiveWorkout(null);
        setViewMode('Dashboard');
        setTimer(0);
        setSetRestTimer(null);
        setEditingRest(null);
        setVisibleExerciseNotes(new Set());
        setWeightDrafts({});
        setJustFinishedWorkout(null);
        setWorkoutMilestones([]);
        setWorkoutCaloriesBurned(null);
        setIsQuickPosting(false);
        setWorkoutSummaryVisible(false);
        setCreatePostVisible(false);
    };

    const removeSet = (exIdx: number, setIdx: number) => {
        if (!activeWorkout) return;
        const sets = activeWorkout.exercises[exIdx]?.sets ?? [];
        if (sets.length <= 1) {
            Alert.alert('Keep one set', 'Each exercise needs at least one set.');
            return;
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const newExercises = [...activeWorkout.exercises];
        newExercises[exIdx] = {
            ...newExercises[exIdx],
            sets: newExercises[exIdx].sets.filter((_, i) => i !== setIdx),
        };

        if (setRestTimer?.exerciseIdx === exIdx) {
            if (setRestTimer.setIdx === setIdx) {
                setSetRestTimer(null);
            } else if (setRestTimer.setIdx > setIdx) {
                setSetRestTimer({ ...setRestTimer, setIdx: setRestTimer.setIdx - 1 });
            }
        }
        if (editingRest?.exIdx === exIdx) {
            if (editingRest.setIdx === setIdx) {
                setEditingRest(null);
            } else if (editingRest.setIdx > setIdx) {
                setEditingRest({ exIdx, setIdx: editingRest.setIdx - 1 });
            }
        }

        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const addSet = async (exerciseIndex: number) => {
        const workout = activeWorkout;
        if (!workout || !user) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        const exercise = workout.exercises[exerciseIndex];
        const nextSetIdx = exercise.sets.length;
        const lastSet = exercise.sets[nextSetIdx - 1];

        // Fetch previous performance to see if it has data for this set #
        const prevSets = await getLatestSetsForExercise(user.id, exercise.id, exercise.name);
        const prevSet = prevSets && prevSets[nextSetIdx];

        const updated = { ...workout };
        updated.exercises[exerciseIndex].sets.push({
            id: Math.random().toString(),
            reps: prevSet ? prevSet.reps : (lastSet ? lastSet.reps : 0),
            weight: prevSet ? prevSet.weight : (lastSet ? lastSet.weight : 0),
            completed: false,
            type: lastSet ? lastSet.type : 'normal' as SetType,
            previousPerformance: prevSet ? `${prevSet.weight} x ${prevSet.reps}` : undefined
        });
        setActiveWorkout(updated);
    };

    // --- AI COACH LOGIC ---
    const chatScrollRef = useRef<ScrollView>(null);

    // Auto-scroll when messages change
    useEffect(() => {
        if (!coachModalVisible) return;
        const frame = requestAnimationFrame(() => {
            chatScrollRef.current?.scrollToEnd({ animated: true });
        });
        return () => cancelAnimationFrame(frame);
    }, [coachMessages, isAiTyping, coachDraftWorkout, coachModalVisible]);

    const sendCoachMessage = async () => {
        if (!coachInput.trim() || !user || isAiTyping || isPreparingWorkout) return;
        
        const userMsg = coachInput.trim();
        const newMsg: CoachMessage = { id: Math.random().toString(), text: userMsg, sender: 'user' };
        setCoachMessages(prev => [...prev, newMsg]);
        setCoachInput('');
        setIsAiTyping(true);

        const wantsStartNow =
            coachDraftWorkout &&
            /^\s*(start|begin|go|let'?s go|lets go|start workout|start it|ready)\s*\.?!?\s*$/i.test(userMsg);

        if (wantsStartNow && coachDraftWorkout) {
            const workoutToStart = coachDraftWorkout;
            setIsAiTyping(false);
            setCoachMessages(prev => [
                ...prev,
                {
                    id: Math.random().toString(),
                    text: `☘️ Let's go — starting "${workoutToStart.name}" now. You've got this!`,
                    sender: 'ai',
                },
            ]);
            await transitionFromCoachToWorkout(workoutToStart);
            return;
        }

        try {
            const currentHistory = [...coachMessages, newMsg];
            const history: AiMessage[] = currentHistory.slice(-12).map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.text
            }));

            const userContextStats = {
                displayName: user.displayName,
                goal: user.goal,
                trainingSplit: user.trainingSplit,
                defaultGym: user.defaultGym,
                dorm: user.dorm,
                activeTrainingLocation: resolveTrainingLocation(user),
                experienceLevel: user.experienceLevel,
                injuries: user.injuries,
                likedExercises: user.likedExercises?.join(', '),
                dislikedExercises: user.dislikedExercises?.join(', '),
                recentHistoryCount: historyCount,
                pendingWorkout: coachDraftWorkout
                    ? {
                          name: coachDraftWorkout.name,
                          exercises: coachDraftWorkout.exercises.map((ex) => ({
                              name: ex.name,
                              sets: ex.sets.length,
                              targetReps: String(ex.sets[0]?.reps ?? 10),
                          })),
                      }
                    : null,
            };

            const response = await getLeprechaunResponseWithTools(history, userContextStats);
            setIsAiTyping(false);

            if (response.type === 'action') {
                if (response.functionName === 'start_workout') {
                    const { workoutType, location, durationMinutes, workoutPlan } = response.args;
                    const { workout, unresolved } = workoutFromAIPlan(workoutPlan, {
                        workoutType,
                        location,
                        durationMinutes,
                    });

                    setCoachDraftWorkout(workout);

                    const planLines = formatPlanSummaryLines(workout);
                    const extra =
                        unresolved.length > 0
                            ? `\n\n(${unresolved.length} exercise name(s) matched to our library.)`
                            : '';
                    const confirmMsg = `☘️ Here's your plan: **${workout.name}** (${workout.exercises.length} exercises)${extra}\n\n${planLines}\n\nStart now, tap **Edit** to tweak sets in the logger, or keep chatting to change anything — say "start" when you're ready.`;

                    setCoachMessages((prev) => [
                        ...prev.map((m) => ({ ...m, pendingWorkout: undefined })),
                        {
                            id: Math.random().toString(),
                            text: confirmMsg.replace(/\*\*/g, ''),
                            sender: 'ai',
                            pendingWorkout: workout,
                        },
                    ]);
                } else {
                    const aiContent = response.content || `☘️ I've updated that for you, lad!`;
                    setCoachMessages(prev => [...prev, { id: Math.random().toString(), text: aiContent, sender: 'ai' as const }]);
                    
                    if (response.functionName === 'update_fitness_goal') await updateProfile({ goal: response.args.goal });
                    if (response.functionName === 'update_gym') await updateProfile({ defaultGym: response.args.gym });
                    if (response.functionName === 'update_training_split') await updateProfile({ trainingSplit: response.args.split });
                }
            } else {
                setCoachMessages(prev => [...prev, { id: Math.random().toString(), text: response.content || "☘️", sender: 'ai' as const }]);
            }
        } catch (e: any) {
            console.error("❌ Leprechaun AI Chat Error:", e);
            console.error("   Details:", e?.message || "No message");
            setIsAiTyping(false);
            setCoachMessages(prev => [...prev, { id: Math.random().toString(), text: `☘️ Och! The magic is weak: ${e?.message || 'Check logs'}`, sender: 'ai' as const }]);
        }
    };

    const renderCoachChatModal = () => (
        <Modal
            visible={coachModalVisible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => !isPreparingWorkout && setCoachModalVisible(false)}
        >
            <View style={{ flex: 1, backgroundColor: VisualSystem.colors.bgBase }}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    style={styles.coachChatContainer}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <View style={styles.coachChatHeader}>
                        <Pressable accessibilityLabel="Collapse"
                            onPress={() => setCoachModalVisible(false)}
                            disabled={isPreparingWorkout}
                            style={({ pressed }) => [styles.coachChatClose, pressed && { opacity: 0.6 }]}
                        >
                            <FontAwesome name="chevron-down" size={20} color={VisualSystem.colors.textPrimary} />
                        </Pressable>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={styles.coachChatTitle}>Leprechaun coach</Text>
                            <SecondaryText style={{ fontSize: 11, color: VisualSystem.colors.goldText }}>Online & gaining</SecondaryText>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView 
                        ref={chatScrollRef}
                        style={styles.coachChatScroll}
                        contentContainerStyle={{ padding: 16 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {coachMessages.map((msg, index) => (
                            <Animated.View
                                key={msg.id}
                                entering={FadeIn.duration(280).delay(Math.min(index * 40, 200))}
                                style={[
                                    styles.msgBubble,
                                    msg.sender === 'user' ? styles.msgUser : styles.msgAI,
                                ]}
                            >
                                {msg.sender === 'ai' && (
                                    <View style={styles.msgAIAvatar}>
                                        <FontAwesome name="magic" size={10} color="#0C2340" />
                                    </View>
                                )}
                                <View style={[
                                    styles.msgTextContainer,
                                    msg.sender === 'user' ? [styles.msgTextContainer, styles.msgTextUser] : [styles.msgTextContainer, styles.msgTextAI]
                                ]}>
                                    <Text style={[
                                        styles.msgText,
                                        msg.sender === 'user' && styles.msgTextUserText
                                    ]}>{msg.text}</Text>
                                    {msg.pendingWorkout && msg.pendingWorkout.exercises.length > 0 && (
                                        <View style={styles.planPreviewInBubble}>
                                            {msg.pendingWorkout.exercises.map((ex, idx) => (
                                                <Text key={`${ex.id}-${idx}`} style={styles.planPreviewLine}>
                                                    {ex.name} · {ex.sets.length} sets
                                                </Text>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </Animated.View>
                        ))}
                        {isAiTyping && (
                            <Animated.View entering={FadeIn.duration(200)} style={[styles.msgBubble, styles.msgAI]}>
                                <View style={styles.msgAIAvatar}>
                                    <FontAwesome name="magic" size={10} color="#0C2340" />
                                </View>
                                <View style={[styles.msgTextContainer, styles.msgTextAI]}>
                                    <Text style={[styles.msgText, { opacity: 0.5 }]}>Thinking... ☘️</Text>
                                </View>
                            </Animated.View>
                        )}
                    </ScrollView>

                    {coachDraftWorkout && (
                        <Animated.View
                            entering={SlideInUp.springify().damping(20).stiffness(180)}
                            style={styles.coachPlanActions}
                        >
                            <Text style={styles.coachPlanActionsTitle} numberOfLines={1}>
                                Ready: {coachDraftWorkout.name} · {coachDraftWorkout.exercises.length} exercises
                            </Text>
                            <View style={styles.coachPlanBtnRow}>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.coachPlanBtnPrimary,
                                        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                                        isPreparingWorkout && styles.coachBtnDisabled,
                                    ]}
                                    disabled={isPreparingWorkout}
                                    onPress={startCoachDraftWorkout}
                                >
                                    {isPreparingWorkout ? (
                                        <ActivityIndicator size="small" color="#0C2340" />
                                    ) : (
                                        <FontAwesome name="play" size={14} color="#0C2340" />
                                    )}
                                    <Text style={styles.coachPlanBtnPrimaryText}>
                                        {isPreparingWorkout ? 'Preparing…' : 'Start Workout'}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.coachPlanBtnSecondary,
                                        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                                        isPreparingWorkout && styles.coachBtnDisabled,
                                    ]}
                                    disabled={isPreparingWorkout}
                                    onPress={editCoachDraftWorkout}
                                >
                                    <FontAwesome name="pencil" size={14} color={VisualSystem.colors.gold} />
                                    <Text style={styles.coachPlanBtnSecondaryText}>Open Logger</Text>
                                </Pressable>
                            </View>
                            <Pressable
                                onPress={saveCoachDraftAsTemplate}
                                disabled={isPreparingWorkout}
                                style={({ pressed }) => [
                                    styles.coachPlanSaveLink,
                                    pressed && { opacity: 0.7 },
                                    isPreparingWorkout && styles.coachBtnDisabled,
                                ]}
                            >
                                <Text style={styles.coachPlanSaveLinkText}>Save as template</Text>
                            </Pressable>
                            <Text style={styles.coachPlanHint}>
                                Keep chatting to swap exercises or adjust volume — then tap Start or say "start"
                            </Text>
                        </Animated.View>
                    )}

                    <View style={styles.coachChatInputArea}>
                        <TextInput
                            style={styles.coachChatInput}
                            placeholder="e.g. Build me a 45 min push day for Duncan..."
                            placeholderTextColor="rgba(212, 175, 55, 0.4)"
                            value={coachInput}
                            onChangeText={setCoachInput}
                            multiline
                            editable={!isAiTyping && !isPreparingWorkout}
                        />
                        <Pressable
                            style={({ pressed }) => [
                                styles.coachSendBtn,
                                !canSendCoachMessage && styles.coachSendBtnDisabled,
                                pressed && canSendCoachMessage && { opacity: 0.85 },
                            ]}
                            disabled={!canSendCoachMessage}
                            onPress={sendCoachMessage}
                        >
                            <FontAwesome
                                name="paper-plane"
                                size={18}
                                color={
                                    canSendCoachMessage
                                        ? VisualSystem.colors.textOnGold
                                        : VisualSystem.colors.textTertiary
                                }
                            />
                        </Pressable>
                    </View>

                    {isPreparingWorkout && (
                        <View style={styles.coachPreparingOverlay}>
                            <ActivityIndicator size="large" color={VisualSystem.colors.gold} />
                            <Text style={styles.coachPreparingText}>Getting your session ready…</Text>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );

    const finishWorkout = async () => {
        if (!activeWorkout || !user) return;

        const elapsedSeconds = workoutStartAtRef.current
            ? Math.max(0, Math.floor((Date.now() - workoutStartAtRef.current) / 1000))
            : timer;
        workoutStartAtRef.current = null;

        // Calculate deeper metrics for every exercise and set
        const updatedExercises = activeWorkout.exercises.map(ex => ({
            ...ex,
            sets: ex.sets.map(s => {
                if (!s.completed) return s;
                const weight = s.weight || 0;
                const reps = s.reps || 0;
                const volume = weight * reps;
                // Epley Formula for 1RM: weight * (1 + reps/30)
                const estimated1RM = reps > 1 ? weight * (1 + (reps / 30)) : weight;
                return { ...s, volume, estimated1RM };
            })
        }));

        const totalVolume = updatedExercises.reduce((acc, ex) =>
            acc + ex.sets.reduce((sAcc, s) => sAcc + (s.volume || 0), 0), 0
        );

        const finishedWorkout: Workout = {
            ...activeWorkout,
            exercises: updatedExercises,
            duration: elapsedSeconds,
            date: new Date().toISOString(),
            totalVolume,
        };

        let priorHistory: Workout[] = [];
        try {
            priorHistory = await getWorkoutHistory(user.id);
            await saveWorkout(finishedWorkout, user.id);
        } catch (e: any) {
            console.error("Save Workout Error:", e);
            Alert.alert("Error", "Could not save workout. Please check your connection.");
            return;
        }
        
        // --- SYNC TO NUTRITION (overall session burn) ---
        const userWeightKg = user.weightKg || 75;
        const estBurn = estimateWorkoutCaloriesBurn(finishedWorkout, userWeightKg);
        setWorkoutCaloriesBurned(estBurn);

        const todayStr = getLocalDateString();
        try {
            await addWorkoutCaloriesToLog(user.id, todayStr, estBurn, user);
        } catch (err) {
            console.warn('[Gym] Failed to sync workout calories to nutrition:', err);
        }
        
        // --- TRAINING PROGRESSION LOGIC ---
        if (user?.aiCoachData?.customSchedule) {
            const currentIdx = user.aiCoachData.trainingDayIndex || 0;
            const scheduleLength = user.aiCoachData.customSchedule.length;
            const nextIdx = (currentIdx + 1) % scheduleLength;
            
            await updateProfile({
                aiCoachData: {
                    ...user.aiCoachData,
                    trainingDayIndex: nextIdx
                }
            });
        }

        loadWorkouts(); // Refresh counts
        clearWorkoutActive(user.id);

        const milestones = detectWorkoutMilestones(finishedWorkout, priorHistory);
        setWorkoutMilestones(milestones);
        setJustFinishedWorkout(finishedWorkout);
        setActiveWorkout(null);
        setViewMode('Dashboard');
        setTimer(0);
        setSetRestTimer(null);
        setEditingRest(null);

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setWorkoutSummaryVisible(true);
    };

    const cancelWorkout = () => {
        setConfirmCancelVisible(true);
    };

    const confirmCancel = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        workoutStartAtRef.current = null;
        if (user) clearWorkoutActive(user.id);
        setActiveWorkout(null);
        setViewMode('Dashboard');
        setTimer(0);
        setSetRestTimer(null);
        setEditingRest(null);
        setVisibleExerciseNotes(new Set());
        setWeightDrafts({});
        setConfirmCancelVisible(false);
    };

    // Exercise Menu Actions
    const openExerciseNote = (idx: number) => {
        if (!activeWorkout) return;
        const ex = activeWorkout.exercises[idx];
        if (!ex) return;
        setVisibleExerciseNotes((prev) => new Set(prev).add(ex.id));
        setMenuExerciseIdx(null);
        requestAnimationFrame(() => {
            stickyNoteInputRefs.current[ex.id]?.focus();
        });
    };

    const closeExerciseNote = (exerciseId: string) => {
        setVisibleExerciseNotes((prev) => {
            const next = new Set(prev);
            next.delete(exerciseId);
            return next;
        });
    };

    const updateStickyNote = (exIdx: number, text: string) => {
        if (!activeWorkout) return;
        const newExercises = [...activeWorkout.exercises];
        newExercises[exIdx] = { ...newExercises[exIdx], stickyNote: text };
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });

        if (!user) return;
        const ex = newExercises[exIdx];
        const prior = stickyNoteSaveTimers.current[exIdx];
        if (prior) clearTimeout(prior);
        stickyNoteSaveTimers.current[exIdx] = setTimeout(() => {
            saveExerciseStickyNote(user.id, ex.id, ex.name, text);
        }, 450);
    };

    const handleRemoveExercise = (idx: number) => {
        if (!activeWorkout) return;
        const exName = activeWorkout.exercises[idx].name;
        Alert.alert(
            "Remove Exercise",
            `Are you sure you want to remove ${exName}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        const newExercises = [...activeWorkout.exercises];
                        newExercises.splice(idx, 1);
                        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
                        setVisibleExerciseNotes((prev) => {
                            const next = new Set(prev);
                            next.delete(activeWorkout.exercises[idx].id);
                            return next;
                        });
                        setMenuExerciseIdx(null);
                    }
                }
            ]
        );
    };

    const updateExerciseRestTimers = (idx: number, timers: { work: number; warmup: number; dropset: number }) => {
        if (!activeWorkout) return;
        const newExercises = [...activeWorkout.exercises];
        newExercises[idx].restTimers = timers;
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
        setRestModalExerciseIdx(null);
    };

    const onPostSuccess = (hadMilestones = false) => {
        Alert.alert(
            'Posted',
            hadMilestones
                ? 'Your workout and milestones are on the feed.'
                : 'Your workout is on the feed — nice work showing up.'
        );
        setCreatePostVisible(false);
        dismissFinishedWorkout();
    };

    const handleQuickPost = async () => {
        if (!user || !justFinishedWorkout || isQuickPosting) return;
        setIsQuickPosting(true);
        try {
            const preview = getWorkoutPostPreview(justFinishedWorkout, workoutMilestones);
            await publishWorkoutPost(user, preview);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onPostSuccess(workoutMilestones.length > 0);
        } catch (e) {
            console.error('Quick post failed:', e);
            Alert.alert('Could not post', 'Check your connection and try again, or customize your post.');
        } finally {
            setIsQuickPosting(false);
        }
    };

    // --- RENDERS ---

    const renderActiveLogging = () => {
        const workout = activeWorkout;
        if (!workout) return null;

        const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
        const showNotesField =
            workout.exercises.length === 0 ||
            workoutNotesExpanded ||
            Boolean(workout.notes?.trim());

        return (
            <Animated.View 
                entering={FadeIn.duration(420).easing(Easing.out(Easing.cubic))}
                style={{ flex: 1, backgroundColor: LOG.bgBase }}
            >
                <Animated.View entering={SlideInUp.duration(360).easing(Easing.out(Easing.cubic))}>
                <View style={[styles.logHeader, { paddingTop: insets.top + 8 }]}>
                    <Pressable accessibilityLabel="Close" hitSlop={4}
                        onPress={cancelWorkout}
                        style={({ pressed }) => [styles.headerIconButton, pressed && { opacity: 0.65 }]}
                    >
                        <FontAwesome name="times" size={20} color={LOG.danger} />
                    </Pressable>
                    <View style={styles.logTimerContainer}>
                        <Text style={styles.logTimerLabel}>Logging workout</Text>
                        <Text style={styles.logTimerText}>{formatTime(timer)}</Text>
                    </View>
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            finishWorkout();
                        }}
                        style={({ pressed }) => [styles.headerFinishButton, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                    >
                        <Text style={styles.headerFinishText}>Finish</Text>
                    </Pressable>
                </View>
                </Animated.View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: tabBarHeight + 88 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                        <TextInput
                            style={styles.logWorkoutTitle}
                            value={workout.name}
                            onChangeText={(t) => setActiveWorkout({ ...workout, name: t })}
                            placeholder="Workout Title"
                            placeholderTextColor={LOG.textTertiary}
                        />

                        {workout.exercises.length > 0 && (
                            <View style={styles.logSessionMeta}>
                                <Text style={styles.logSessionMetaText}>
                                    {workout.exercises.length} exercise{workout.exercises.length === 1 ? '' : 's'}
                                </Text>
                                <Text style={styles.logSessionMetaDot}>·</Text>
                                <Text style={styles.logSessionMetaText}>
                                    {totalSets} set{totalSets === 1 ? '' : 's'}
                                </Text>
                            </View>
                        )}

                        {!showNotesField && workout.exercises.length > 0 ? (
                            <Pressable
                                style={({ pressed }) => [
                                    styles.logNotesToggle,
                                    pressed && { opacity: 0.8 },
                                ]}
                                onPress={() => setWorkoutNotesExpanded(true)}
                            >
                                <FontAwesome name="pencil" size={12} color={LOG.textTertiary} />
                                <Text style={styles.logNotesToggleText}>Add workout notes</Text>
                            </Pressable>
                        ) : showNotesField ? (
                            <TextInput
                                style={styles.logNotesInput}
                                placeholder="Workout notes (optional)…"
                                placeholderTextColor={LOG.textTertiary}
                                multiline
                                value={workout.notes}
                                onChangeText={updateNotes}
                            />
                        ) : null}

                        {workout.exercises.length === 0 && (
                            <View style={styles.logEmptyState}>
                                <View style={styles.logEmptyIcon}>
                                    <FontAwesome name="heartbeat" size={22} color={LOG.gold} />
                                </View>
                                <Text style={styles.logEmptyTitle}>Your session is live</Text>
                                <SecondaryText style={styles.logEmptySub}>
                                    Add exercises as you go — no plan required.
                                </SecondaryText>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.addExerciseBtnAction,
                                        pressed && { opacity: 0.85 },
                                    ]}
                                    onPress={openAddExerciseModal}
                                >
                                    <FontAwesome name="plus" size={14} color={VisualSystem.colors.gold} style={{ marginRight: 8 }} />
                                    <Text style={styles.addExerciseTextAction}>Add your first exercise</Text>
                                </Pressable>
                            </View>
                        )}

                        {workout.exercises.map((ex, exIdx) => (
                            <Animated.View
                                key={`${ex.id}_${exIdx}`}
                                entering={FadeIn.duration(320).delay(Math.min(exIdx * 60, 360)).easing(Easing.out(Easing.cubic))}
                                style={styles.logExContainer}
                            >
                                <View style={styles.logExHeader}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Pressable
                                                onPress={() => handleReplaceExercise(exIdx)}
                                                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.7 }]}
                                            >
                                                <Text style={styles.logExName} numberOfLines={1} ellipsizeMode="tail">
                                                    {formatExerciseDisplayName(ex.name, ex.category)}
                                                </Text>
                                                <FontAwesome name="exchange" size={12} color="#5C7A99" style={{ marginLeft: 8 }} />
                                            </Pressable>
                                        </View>
                                        <View style={styles.logExSubRow}>
                                            <Text style={styles.logExCategory}>{ex.category}</Text>
                                            {!!ex.supersetId && (
                                                <View style={styles.supersetChip}>
                                                    <FontAwesome
                                                        name="bars"
                                                        size={9}
                                                        color={LOG.goldText}
                                                    />
                                                    <Text style={styles.supersetChipText}>SUPERSET</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <TouchableOpacity hitSlop={6} style={styles.logExMenuBtn} onPress={() => setMenuExerciseIdx(exIdx)}>
                                        <FontAwesome name="ellipsis-h" size={18} color="#5C7A99" />
                                    </TouchableOpacity>
                                </View>

                                {visibleExerciseNotes.has(ex.id) && (
                                    <View style={styles.logStickyNote}>
                                        <View style={styles.logStickyNoteHeader}>
                                            <FontAwesome name="sticky-note-o" size={12} color={VisualSystem.colors.gold} />
                                            <Text style={styles.logStickyNoteLabel}>Exercise note</Text>
                                            <View style={styles.logStickyNoteHeaderSpacer} />
                                            <Pressable accessibilityLabel="Close"
                                                onPress={() => closeExerciseNote(ex.id)}
                                                hitSlop={8}
                                                style={styles.logStickyNoteClose}
                                            >
                                                <FontAwesome name="times" size={14} color="rgba(212, 175, 55, 0.7)" />
                                            </Pressable>
                                        </View>
                                        <TextInput
                                            ref={(ref) => {
                                                stickyNoteInputRefs.current[ex.id] = ref;
                                            }}
                                            style={styles.logStickyNoteInput}
                                            value={ex.stickyNote ?? ''}
                                            onChangeText={(t) => updateStickyNote(exIdx, t)}
                                            onEndEditing={(e) => {
                                                if (!user) return;
                                                saveExerciseStickyNote(
                                                    user.id,
                                                    ex.id,
                                                    ex.name,
                                                    e.nativeEvent.text
                                                );
                                            }}
                                            multiline
                                            placeholder="Form cues, weight goals, injury notes…"
                                            placeholderTextColor="rgba(212, 175, 55, 0.35)"
                                        />
                                    </View>
                                )}

                                <View style={styles.logTableLabels}>
                                    <Text style={[styles.logLabel, { width: 26, textAlign: 'center' }]}>#</Text>
                                    <Text style={[styles.logLabel, { flex: 0.85, textAlign: 'center' }]}>Prev</Text>
                                    <Text style={[styles.logLabel, { flex: 1, textAlign: 'center' }]}>Lbs</Text>
                                    <Text style={[styles.logLabel, { flex: 1, textAlign: 'center' }]}>Reps</Text>
                                    <View style={{ width: 30 }} />
                                </View>

                                {ex.sets.map((set, setIdx) => {
                                    const isResting =
                                        setRestTimer?.exerciseIdx === exIdx && setRestTimer?.setIdx === setIdx;
                                    const isEditingRest =
                                        editingRest?.exIdx === exIdx && editingRest?.setIdx === setIdx;
                                    const restSeconds = getRestAfterSetSeconds(ex, set);
                                    const showRestRow =
                                        isResting ||
                                        isEditingRest ||
                                        (set.completed && restSeconds > 0);
                                    return (
                                        <View key={set.id}>
                                            <SwipeToDeleteRow
                                                enabled={ex.sets.length > 1}
                                                onDelete={() => removeSet(exIdx, setIdx)}
                                            >
                                            <View style={[
                                                styles.logSetRow,
                                                set.completed && styles.logSetRowCompleted,
                                            ]}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.logSetIndex,
                                                        set.type === 'warmup' && { backgroundColor: 'rgba(230, 126, 34, 0.2)' },
                                                        set.type === 'dropset' && { backgroundColor: 'rgba(155, 89, 182, 0.2)' },
                                                        set.type === 'failure' && { backgroundColor: 'rgba(231, 76, 60, 0.2)' },
                                                        set.completed && { backgroundColor: VisualSystem.colors.gold, borderColor: VisualSystem.colors.borderGold }
                                                    ]}
                                                    onPress={() => cycleSetType(exIdx, setIdx)}
                                                >
                                                    <Text style={[
                                                        styles.logSetIndexText, 
                                                        set.completed && { color: VisualSystem.colors.textPrimary },
                                                        set.type === 'warmup' && !set.completed && { color: '#E67E22' },
                                                        set.type === 'dropset' && !set.completed && { color: '#9B59B6' },
                                                        set.type === 'failure' && !set.completed && { color: '#E74C3C' }
                                                    ]}>
                                                        {set.type === 'warmup' ? 'W' : set.type === 'dropset' ? 'D' : set.type === 'failure' ? 'F' : setIdx + 1}
                                                    </Text>
                                                </TouchableOpacity>

                                                <View style={{ flex: 0.85, alignItems: 'center' }}>
                                                    <Text style={styles.logPrevText} numberOfLines={1}>
                                                        {set.previousPerformance || '—'}
                                                    </Text>
                                                </View>

                                                <TextInput
                                                    style={[styles.logInput, { flex: 1 }]}
                                                    keyboardType="decimal-pad"
                                                    value={getWeightInputValue(set, set.id)}
                                                    placeholder="0"
                                                    placeholderTextColor={LOG.textTertiary}
                                                    onChangeText={(t) => handleWeightChange(exIdx, setIdx, set.id, t)}
                                                    onBlur={() => commitWeightDraft(exIdx, setIdx, set.id)}
                                                    selectTextOnFocus
                                                />

                                                <TextInput
                                                    style={[styles.logInput, { flex: 1 }]}
                                                    keyboardType="numeric"
                                                    value={set.reps ? String(set.reps) : ''}
                                                    placeholder="0"
                                                    placeholderTextColor={LOG.textTertiary}
                                                    onChangeText={(t) => updateSetData(exIdx, setIdx, 'reps', t)}
                                                    selectTextOnFocus
                                                />

                                                <Pressable accessibilityLabel="Confirm" hitSlop={7}
                                                    style={({ pressed }) => [
                                                        styles.logCheckBtn,
                                                        set.completed && styles.logCheckBtnActive,
                                                        pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
                                                    ]}
                                                    onPress={() => toggleSet(exIdx, setIdx)}
                                                >
                                                    <FontAwesome name="check" size={16} color={set.completed ? '#0C2340' : '#5C7A99'} />
                                                </Pressable>
                                            </View>
                                            </SwipeToDeleteRow>

                                            {showRestRow ? (
                                                <BetweenSetRestRow
                                                    exercise={ex}
                                                    set={set}
                                                    isActive={isResting}
                                                    activeTimer={
                                                        isResting && setRestTimer
                                                            ? {
                                                                  remaining: setRestTimer.remaining,
                                                                  total: setRestTimer.total,
                                                                  status: setRestTimer.status,
                                                              }
                                                            : null
                                                    }
                                                    isEditing={isEditingRest}
                                                    onStartEdit={() =>
                                                        setEditingRest({ exIdx, setIdx })
                                                    }
                                                    onSaveRest={(seconds) => {
                                                        updateSetRestAfter(exIdx, setIdx, seconds);
                                                        setEditingRest(null);
                                                    }}
                                                    onCancelEdit={() => setEditingRest(null)}
                                                />
                                            ) : null}
                                        </View>
                                    );
                                })}

                                <TouchableOpacity 
                                    style={styles.logAddSetBtn} 
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        addSet(exIdx);
                                    }}
                                >
                                    <FontAwesome name="plus" size={12} color={VisualSystem.colors.gold} style={{ marginRight: 4 }} />
                                    <Text style={styles.logAddSetText}>Add set</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}
                    </View>
                </ScrollView>

                <View style={[styles.logStickyFooter, { paddingBottom: tabBarHeight + 8 }]}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.logAddExBtnPrimary,
                            pressed && { opacity: 0.88 },
                        ]}
                        onPress={openAddExerciseModal}
                    >
                        <FontAwesome name="plus" size={14} color="#0C2340" />
                        <Text style={styles.logAddExBtnPrimaryText}>Add exercise</Text>
                    </Pressable>
                </View>
            </Animated.View>
        );
    };

    const renderDashboard = () => (
        <View style={{ flex: 1 }}>
            <WorkoutHeroHeader
                scrollY={dashboardScrollY}
                onCoachPress={openCoachChat}
                onLibraryPress={() => setLibraryBrowseVisible(true)}
            />
            <RNAnimated.ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.dashboardScroll, { paddingBottom: tabBarHeight + 24 }]}
                showsVerticalScrollIndicator={false}
                onScroll={RNAnimated.event(
                    [{ nativeEvent: { contentOffset: { y: dashboardScrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                <View style={styles.dashboardContent}>
                    {renderStartSessionSection()}

                    <View style={styles.dashboardSection}>
                        <Text style={styles.dashboardSectionTitle}>Exercise library</Text>
                        <TouchableOpacity
                            style={styles.toolCard}
                            onPress={() => setLibraryBrowseVisible(true)}
                            activeOpacity={0.88}
                        >
                            <View style={[styles.startWorkoutIcon, styles.toolCardIcon]}>
                                <FontAwesome name="list" size={16} color={LOG.gold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.toolCardTitle}>Browse exercises</Text>
                                <SecondaryText style={styles.toolCardSub}>
                                    {CANONICAL_EXERCISES.length}+ movements with muscle tags
                                </SecondaryText>
                            </View>
                            <FontAwesome name="chevron-right" size={13} color={LOG.textTertiary} />
                        </TouchableOpacity>
                    </View>

                    {templates.length > 0 && (
                        <View style={styles.dashboardSection}>
                            <Text style={styles.dashboardSectionTitle}>Saved routines</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.templateScroll}
                            >
                                {templates.map(t => (
                                    <View key={t.id} style={styles.templateSlide}>
                                        <TemplateCard
                                            title={t.name}
                                            detail={t.exercises.map(e => e.name).join(', ')}
                                            onPress={() => {
                                                const repeated = {
                                                    ...t,
                                                    id: Math.random().toString(),
                                                    date: new Date().toISOString(),
                                                    duration: 0,
                                                    exercises: t.exercises.map(ex => ({
                                                        ...ex,
                                                        sets: ex.sets.map(s => ({
                                                            ...s,
                                                            completed: false,
                                                        })),
                                                    })),
                                                };
                                                startActiveWorkout(repeated);
                                            }}
                                            onDelete={() => handleDeleteTemplate(t)}
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    <View style={styles.dashboardSection}>
                        <Text style={styles.dashboardSectionTitle}>Starter routines</Text>
                        <Text style={styles.dashboardSectionSub}>
                            Tap one to start it. Save your own version once you have run it.
                        </Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.templateScroll}
                        >
                            {STARTER_TEMPLATES.map((t) => (
                                <View key={t.id} style={styles.templateSlide}>
                                    <TemplateCard
                                        title={t.name}
                                        detail={starterDetail(t)}
                                        onPress={() => startActiveWorkout(workoutFromStarter(t))}
                                    />
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.dashboardSection}>
                        <TouchableOpacity
                            style={styles.progressSectionToggle}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setProgressHistoryExpanded((v) => !v);
                            }}
                            activeOpacity={0.85}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.dashboardSectionTitle}>Progress & history</Text>
                                {!progressHistoryExpanded && (
                                    <SecondaryText style={styles.progressSectionHint}>
                                        {historyCount > 0
                                            ? `${historyCount} workout${historyCount === 1 ? '' : 's'} saved · search to find one`
                                            : 'Charts and past sessions'}
                                    </SecondaryText>
                                )}
                            </View>
                            <FontAwesome
                                name={progressHistoryExpanded ? 'chevron-up' : 'chevron-down'}
                                size={12}
                                color={LOG.textTertiary}
                            />
                        </TouchableOpacity>
                        {progressHistoryExpanded && (
                            <View style={styles.progressPanel}>
                                <ProgressView
                                    userId={user?.id}
                                    allExercises={allExercises}
                                    selectedEx={selectedProgressEx}
                                    onSelectEx={handleSelectProgressEx}
                                    progressData={progressData}
                                    isLoading={isProgressLoading}
                                    onSaveTemplate={handleSaveHistoryAsTemplate}
                                    onRepeat={(w) => {
                                        const repeated = {
                                            ...w,
                                            id: Math.random().toString(),
                                            date: new Date().toISOString(),
                                            duration: 0,
                                            exercises: w.exercises.map(ex => ({
                                                ...ex,
                                                sets: ex.sets.map(s => ({
                                                    ...s,
                                                    completed: false,
                                                })),
                                            })),
                                        };
                                        startActiveWorkout(repeated);
                                    }}
                                />
                            </View>
                        )}
                    </View>
                </View>
            </RNAnimated.ScrollView>
        </View>
    );

    const renderStartSessionSection = () => (
        <View style={styles.missionPanel}>
            {/* The one thing you came here to do: a real button, not a card. */}
            <Pressable
                onPress={startQuickWorkout}
                style={({ pressed }) => [styles.startCta, pressed && { opacity: 0.9 }]}
            >
                <FontAwesome name="play" size={15} color={LOG.textOnGold} />
                <Text style={styles.startCtaText}>Start workout</Text>
            </Pressable>

            {/* One grouped list with dividers, rather than a box per row. */}
            <View style={styles.group}>
                <TrainingLocationSection embedded />
                <View style={styles.groupDivider} />
                <TouchableOpacity
                    style={styles.groupRow}
                    onPress={openCoachChat}
                    activeOpacity={0.7}
                >
                    <Ionicons name="sparkles-outline" size={20} color={LOG.textSecondary} />
                    <View style={styles.groupRowText}>
                        <Text style={styles.groupRowTitle}>Leprechaun AI coach</Text>
                        <Text style={styles.groupRowSub}>Build a plan for today's session</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={LOG.textTertiary} />
                </TouchableOpacity>
            </View>

            <View style={styles.activityLogBlock}>
                <Text style={styles.activityLogLabel}>Log other activity</Text>
                <View style={styles.activityLogBar}>
                    <FontAwesome name="heartbeat" size={13} color={LOG.gold} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.activityLogInput}
                        value={activityLogText}
                        onChangeText={setActivityLogText}
                        placeholder="e.g. played basketball 45 min"
                        placeholderTextColor={LOG.textTertiary}
                        returnKeyType="done"
                        onSubmitEditing={handleActivityQuickLog}
                        editable={!activityLogging}
                    />
                    <Pressable
                        style={[
                            styles.activityLogBtn,
                            (!activityLogText.trim() || activityLogging) && styles.activityLogBtnDisabled,
                        ]}
                        onPress={handleActivityQuickLog}
                        disabled={!activityLogText.trim() || activityLogging}
                    >
                        {activityLogging ? (
                            <ActivityIndicator size="small" color={LOG.textOnGold} />
                        ) : (
                            <Text
                                style={[
                                    styles.activityLogBtnText,
                                    !activityLogText.trim() && styles.activityLogBtnTextDisabled,
                                ]}>
                                Log
                            </Text>
                        )}
                    </Pressable>
                </View>
                <Text
                    style={[
                        styles.activityLogHint,
                        lastActivityLogMessage && styles.activityLogHintSuccess,
                    ]}
                >
                    {lastActivityLogMessage ||
                        'Sports, cardio, yoga, hikes — not lifting? Type it and AI logs the session.'}
                </Text>
            </View>
        </View>
    );


    // --- MODALS FOR EXERCISE ACTIONS ---

    const renderExerciseMenuModal = () => (
        <Modal
            visible={menuExerciseIdx !== null}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setMenuExerciseIdx(null)}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setMenuExerciseIdx(null)}
            >
                <View style={styles.menuContent}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => menuExerciseIdx !== null && openExerciseNote(menuExerciseIdx)}>
                        <FontAwesome name="sticky-note-o" size={18} color={VisualSystem.colors.goldText} style={styles.menuItemIcon} />
                        <Text style={styles.menuItemText}>Exercise Note</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { setRestModalExerciseIdx(menuExerciseIdx); setMenuExerciseIdx(null); }}>
                        <FontAwesome name="history" size={18} color={VisualSystem.colors.goldText} style={styles.menuItemIcon} />
                        <Text style={styles.menuItemText}>Update Rest Timers</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={() => { 
                            if (menuExerciseIdx !== null) {
                                setCalcTargetWeight(activeWorkout?.exercises[menuExerciseIdx].sets[0]?.weight || 0);
                                setPlateCalcVisible(true);
                            }
                            setMenuExerciseIdx(null); 
                        }}
                    >
                        <FontAwesome name="calculator" size={18} color={VisualSystem.colors.goldText} style={styles.menuItemIcon} />
                        <Text style={styles.menuItemText}>Plate Calculator</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={() => { 
                            if (menuExerciseIdx !== null) {
                                setCalcTargetWeight(activeWorkout?.exercises[menuExerciseIdx].sets[0]?.weight || 0);
                                setWarmupCalcVisible(true);
                            }
                            setMenuExerciseIdx(null); 
                        }}
                    >
                        <FontAwesome name="fire" size={18} color={VisualSystem.colors.goldText} style={styles.menuItemIcon} />
                        <Text style={styles.menuItemText}>Warm-up Calculator</Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LOG.borderSubtle }}>
                        <TouchableOpacity 
                            style={[styles.menuItem, { flex: 1, borderBottomWidth: 0 }]} 
                            onPress={() => {
                                if (menuExerciseIdx !== null) reorderExercise(menuExerciseIdx, 'up');
                                setMenuExerciseIdx(null);
                            }}
                        >
                            <FontAwesome name="arrow-up" size={18} color={VisualSystem.colors.goldText} style={styles.menuItemIcon} />
                            <Text style={styles.menuItemText}>Move Up</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.menuItem, { flex: 1, borderBottomWidth: 0 }]} 
                            onPress={() => {
                                if (menuExerciseIdx !== null) reorderExercise(menuExerciseIdx, 'down');
                                setMenuExerciseIdx(null);
                            }}
                        >
                            <FontAwesome name="arrow-down" size={18} color={VisualSystem.colors.goldText} style={styles.menuItemIcon} />
                            <Text style={styles.menuItemText}>Move Down</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { if (menuExerciseIdx !== null) handleReplaceExercise(menuExerciseIdx); setMenuExerciseIdx(null); }}>
                        <FontAwesome name="exchange" size={18} color={VisualSystem.colors.goldText} style={styles.menuItemIcon} />
                        <Text style={styles.menuItemText}>Replace Exercise</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomWidth: 0 }]}
                        onPress={() => {
                            if (menuExerciseIdx !== null) toggleSuperset(menuExerciseIdx);
                            setMenuExerciseIdx(null);
                        }}
                    >
                        <FontAwesome name="bars" size={18} color={VisualSystem.colors.goldText} style={styles.menuItemIcon} />
                        <Text style={styles.menuItemText}>
                            {menuExerciseIdx !== null && activeWorkout?.exercises[menuExerciseIdx]?.supersetId
                                ? 'Leave Superset'
                                : 'Create Superset'}
                        </Text>
                    </TouchableOpacity>

                    <View style={{ height: 1, backgroundColor: LOG.borderSubtle, marginVertical: 8 }} />

                    <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => menuExerciseIdx !== null && handleRemoveExercise(menuExerciseIdx)}>
                        <FontAwesome name="times" size={18} color={LOG.danger} style={styles.menuItemIcon} />
                        <Text style={[styles.menuItemText, { color: LOG.danger }]}>Remove Exercise</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );

    const renderRestTimerModal = () => {
        if (restModalExerciseIdx === null || !activeWorkout) return null;
        return (
            <RestTimerModal
                exerciseIndex={restModalExerciseIdx}
                workout={activeWorkout}
                onClose={() => setRestModalExerciseIdx(null)}
                onSave={(idx, timers) => updateExerciseRestTimers(idx, timers)}
            />
        );
    };

    const renderCreatePostModal = () => {
        if (!justFinishedWorkout) return null;

        return (
            <CreatePostModal
                visible={createPostVisible}
                onClose={() => {
                    setCreatePostVisible(false);
                    if (justFinishedWorkout) {
                        setWorkoutSummaryVisible(true);
                    }
                }}
                onPostCreated={() => onPostSuccess(workoutMilestones.length > 0)}
                initialWorkoutData={getWorkoutPostPreview(justFinishedWorkout, workoutMilestones)}
            />
        );
    };


    const renderCancelConfirmationModal = () => (
        <Modal
            visible={confirmCancelVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setConfirmCancelVisible(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { borderColor: VisualSystem.colors.danger }]}>
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <View style={{ width: 50, height: 50, borderRadius: 22, backgroundColor: 'rgba(255, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            <FontAwesome name="exclamation-triangle" size={24} color="#FF4444" />
                        </View>
                        <Text style={[styles.modalTitle, { textAlign: 'center' }]}>Cancel Workout?</Text>
                        <SecondaryText style={{ textAlign: 'center', marginTop: 8 }}>
                            Are you sure you want to cancel this workout just in case it's clicked by mistake?
                        </SecondaryText>
                    </View>

                    <TouchableOpacity
                        style={[styles.restSubmitBtn, { backgroundColor: VisualSystem.colors.dangerSoft }]}
                        onPress={confirmCancel}
                    >
                        <Text style={[styles.restSubmitText, { color: VisualSystem.colors.textPrimary }]}>Yes, Cancel Workout</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ marginTop: 16, alignItems: 'center', padding: 8 }}
                        onPress={() => setConfirmCancelVisible(false)}
                    >
                        <SecondaryText style={{ color: VisualSystem.colors.goldText, fontWeight: '700' }}>No, Go Back</SecondaryText>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    const renderAddExerciseModal = () => {
        const userExercises = user?.customExercises || [];
        const combinedLibrary = [...EXERCISE_LIBRARY, ...userExercises];
        
        const filtered = combinedLibrary.filter(ex => 
            ex.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ex.category?.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        const sections: { title: string; data: any[] }[] = [];
        
        if (!searchQuery) {
            alphabet.forEach(letter => {
                const data = filtered.filter(ex => (ex.name || "").toUpperCase().startsWith(letter));
                if (data.length > 0) {
                    sections.push({ title: letter, data });
                }
            });
        }

        const pickerRows = buildExercisePickerRows(sections);

        const availableLetters = new Set(sections.map((s) => s.title));

        const scrollToLetter = (letter: string) => {
            const target = resolvePickerScrollLetter(letter, availableLetters);
            if (!target || !exercisePickerListRef.current) return;

            const index = headerIndexForLetter(pickerRows, target);
            if (index < 0) return;

            exercisePickerListRef.current.scrollToIndex({
                index,
                animated: false,
                viewOffset: 0,
            });
        };

        return (
            <Modal
                visible={addExerciseVisible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setAddExerciseVisible(false)}
            >
                <View style={[styles.modalFullContainer, { paddingTop: insets.top }]}>
                    <View style={styles.modalHeader}>
                        <Pressable accessibilityLabel="Close" onPress={() => setAddExerciseVisible(false)} hitSlop={12}>
                            <FontAwesome name="times" size={24} color={VisualSystem.colors.gold} />
                        </Pressable>
                        <Text style={styles.modalTitle}>Add Exercise</Text>
                        <Pressable onPress={() => setCreateExerciseVisible(true)} hitSlop={8}>
                            <Text style={{ color: VisualSystem.colors.goldText, fontWeight: '700' }}>New</Text>
                        </Pressable>
                    </View>

                    <View style={styles.searchContainer}>
                        <FontAwesome name="search" size={18} color="rgba(212,175,55,0.4)" style={{ marginRight: 16 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search exercises..."
                            placeholderTextColor="rgba(160, 180, 203, 0.4)"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {addingExercise ? (
                        <View style={styles.addExerciseLoading}>
                            <ActivityIndicator size="large" color={VisualSystem.colors.gold} />
                            <Text style={styles.addExerciseLoadingText}>Adding exercise…</Text>
                        </View>
                    ) : null}

                    <View style={{ flex: 1, flexDirection: 'row', opacity: addingExercise ? 0.45 : 1 }}>
                        {searchQuery ? (
                            <FlatList
                                data={filtered}
                                keyExtractor={(item) => (item.id || item.name || '') + '_flat'}
                                renderItem={({ item }) => (
                                    <ExercisePickerRow
                                        item={item}
                                        disabled={addingExercise}
                                        onPress={() => void addExerciseToActive(item as typeof EXERCISE_LIBRARY[0])}
                                    />
                                )}
                                contentContainerStyle={exercisePickerListStyles.listContent}
                                keyboardShouldPersistTaps="always"
                            />
                        ) : (
                            <>
                                <View style={{ flex: 1 }}>
                                    <FlatList
                                        ref={exercisePickerListRef}
                                        data={pickerRows}
                                        keyExtractor={(row) => row.key}
                                        getItemLayout={(_, index) =>
                                            getPickerItemLayout(
                                                pickerRows,
                                                index,
                                                pickerHeaderHeightRef.current,
                                                pickerRowHeightRef.current
                                            )
                                        }
                                        initialNumToRender={40}
                                        maxToRenderPerBatch={40}
                                        windowSize={11}
                                        contentContainerStyle={exercisePickerListStyles.listContent}
                                        keyboardShouldPersistTaps="always"
                                        showsVerticalScrollIndicator={false}
                                        onScrollToIndexFailed={(info) => {
                                            setTimeout(() => {
                                                exercisePickerListRef.current?.scrollToIndex({
                                                    index: info.index,
                                                    animated: false,
                                                });
                                            }, 80);
                                        }}
                                        renderItem={({ item: row }) => {
                                            if (row.kind === 'header') {
                                                return (
                                                    <ExercisePickerSectionHeader
                                                        title={row.title}
                                                        onLayout={(h) => {
                                                            pickerHeaderHeightRef.current = h;
                                                        }}
                                                    />
                                                );
                                            }
                                            const item = row.item as {
                                                id?: string;
                                                name?: string;
                                                category?: string;
                                            };
                                            return (
                                                <ExercisePickerRow
                                                    item={item}
                                                    disabled={addingExercise}
                                                    onPress={() => void addExerciseToActive(item as typeof EXERCISE_LIBRARY[0])}
                                                    onLayout={(h) => {
                                                        pickerRowHeightRef.current = h;
                                                    }}
                                                />
                                            );
                                        }}
                                    />
                                </View>
                                {!searchQuery ? (
                                    <AlphabetIndexBar
                                        letters={ALPHABET_INDEX}
                                        enabledLetters={availableLetters}
                                        onLetterSelect={scrollToLetter}
                                        active={addExerciseVisible}
                                    />
                                ) : null}
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        );
    };

    const renderCreateNewExerciseModal = () => {
        const bodyParts = ["Arms", "Back", "Cardio", "Chest", "Core", "Full Body", "Legs", "Olympic", "Other", "Shoulders"];
        const exTypes = ["Barbell", "Dumbbell", "Machine / Other", "Weighted Bodyweight", "Assisted Bodyweight", "Reps Only", "Cardio", "Duration"];

        return (
            <Modal
                visible={createExerciseVisible}
                animationType="slide"
                transparent
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '80%', padding: 0 }]}>
                        <View style={[styles.modalHeader, { backgroundColor: 'transparent', paddingTop: 16 }]}>
                            <TouchableOpacity accessibilityLabel="Close" onPress={() => setCreateExerciseVisible(false)}>
                                <FontAwesome name="times" size={24} color={VisualSystem.colors.textPrimary} />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Create New Exercise</Text>
                            <TouchableOpacity 
                                onPress={saveCustomExercise}
                                disabled={!newExName}
                            >
                                <Text style={[styles.newExSaveBtn, !newExName && styles.newExSaveBtnDisabled]}>Save</Text>
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.newExLabel}>Name</Text>
                                <TextInput
                                    style={styles.newExInput}
                                    placeholder="Add Name"
                                    placeholderTextColor="rgba(160, 180, 203, 0.4)"
                                    value={newExName}
                                    onChangeText={setNewExName}
                                />

                                <Text style={styles.newExLabel}>Body Part</Text>
                                <View style={styles.newExChipContainer}>
                                    {bodyParts.map(part => (
                                        <TouchableOpacity 
                                            key={part} 
                                            style={[styles.newExChip, newExBodyPart === part && styles.newExChipActive]}
                                            onPress={() => setNewExBodyPart(part)}
                                        >
                                            <Text style={[styles.newExChipText, newExBodyPart === part && styles.newExChipTextActive]}>{part}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.newExLabel}>Category</Text>
                                <TouchableOpacity 
                                    style={styles.newExDropdown}
                                    onPress={() => setShowExTypeDropdown(!showExTypeDropdown)}
                                >
                                    <Text style={styles.newExDropdownText}>{newExType || 'Select an Option'}</Text>
                                    <FontAwesome name={showExTypeDropdown ? "chevron-up" : "chevron-down"} size={14} color={VisualSystem.colors.gold} />
                                </TouchableOpacity>

                                {showExTypeDropdown && (
                                    <View style={{ backgroundColor: VisualSystem.colors.bgDeep, marginHorizontal: 16, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                                        {exTypes.map(type => (
                                            <TouchableOpacity 
                                                key={type}
                                                style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: VisualSystem.colors.borderSubtle }}
                                                onPress={() => {
                                                    setNewExType(type);
                                                    setShowExTypeDropdown(false);
                                                }}
                                            >
                                                <Text style={{ color: VisualSystem.colors.textPrimary, fontWeight: newExType === type ? 'bold' : 'normal' }}>{type}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderPlateCalculatorModal = () => (
        plateCalcVisible && (
            <PlateCalculator 
                targetWeight={calcTargetWeight} 
                onClose={() => setPlateCalcVisible(false)} 
            />
        )
    );

    const renderWarmupCalculatorModal = () => (
        warmupCalcVisible && menuExerciseIdx !== null && (
            <WarmupCalculator 
                targetWeight={calcTargetWeight}
                onSave={(wSets) => {
                    if (!activeWorkout || menuExerciseIdx === null) return;
                    const updated = { ...activeWorkout };
                    updated.exercises[menuExerciseIdx].sets = [...wSets, ...updated.exercises[menuExerciseIdx].sets];
                    setActiveWorkout(updated);
                    setWarmupCalcVisible(false);
                    setMenuExerciseIdx(null);
                }}
                onClose={() => {
                    setWarmupCalcVisible(false);
                    setMenuExerciseIdx(null);
                }}
            />
        )
    );

    return (
        <View style={styles.container}>
            {/* Common Modals available in all states */}
            {renderExerciseMenuModal()}
            {renderRestTimerModal()}
            {renderCreatePostModal()}
            {renderCancelConfirmationModal()}
            {renderCoachChatModal()}
            <WorkoutCompleteModal
                visible={workoutSummaryVisible}
                workout={justFinishedWorkout}
                milestones={workoutMilestones}
                caloriesBurned={workoutCaloriesBurned}
                isQuickPosting={isQuickPosting}
                onQuickPost={handleQuickPost}
                onCustomizePost={() => {
                    setWorkoutSummaryVisible(false);
                    setCreatePostVisible(true);
                }}
                onSaveTemplate={async () => {
                    if (user && justFinishedWorkout) {
                        await saveTemplate(justFinishedWorkout, user.id);
                        loadWorkouts();
                        Alert.alert('Saved', `"${justFinishedWorkout.name}" is in your templates. You can still post to the feed.`);
                    }
                }}
                onDone={dismissFinishedWorkout}
            />
            {renderPlateCalculatorModal()}
            {renderWarmupCalculatorModal()}
            {renderAddExerciseModal()}
            {renderCreateNewExerciseModal()}

            <ExerciseLibraryPanel
                visible={libraryBrowseVisible}
                onClose={() => setLibraryBrowseVisible(false)}
            />

            {/* View Switching Logic */}
            {viewMode === 'ActiveLogging' ? renderActiveLogging() : renderDashboard()}

            {isPreparingWorkout && viewMode === 'Dashboard' && (
                <View style={styles.workoutPreparingOverlay}>
                    <ActivityIndicator size="large" color={VisualSystem.colors.gold} />
                    <Text style={styles.workoutPreparingText}>Loading your workout…</Text>
                </View>
            )}
        </View>
    );
}

function RestTimerModal({
    exerciseIndex,
    workout,
    onClose,
    onSave
}: {
    exerciseIndex: number;
    workout: Workout;
    onClose: () => void;
    onSave: (idx: number, timers: { work: number; warmup: number; dropset: number }) => void;
}) {
    const ex = workout.exercises[exerciseIndex];
    const initialTimers = ex.restTimers || { work: 120, warmup: 0, dropset: 0 };
    const [localTimers, setLocalTimers] = useState(initialTimers);

    const handleSave = () => onSave(exerciseIndex, localTimers);

    const formatSeconds = (s: number) => {
        if (s === 0) return "0:00";
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const parseTime = (text: string) => {
        const parts = text.split(':');
        if (parts.length === 2) {
            return parseInt(parts[0]) * 60 + (parseInt(parts[1]) || 0);
        }
        return parseInt(text) || 0;
    };

    return (
        <Modal
            visible={true}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.restModalContent}>
                    <Text style={styles.restModalTitle}>Update Rest Timers</Text>
                    <SecondaryText style={styles.restModalSub}>
                        Sets default rest for this exercise in this workout. Tap rest between sets to customize one gap. Per-set edits are kept unless you change them.
                    </SecondaryText>

                    <View style={styles.restInputRow}>
                        <Text style={styles.restInputLabel}>Work Set</Text>
                        <View style={styles.restInputBox}>
                            <TextInput
                                style={styles.restInputText}
                                defaultValue={formatSeconds(localTimers.work)}
                                keyboardType="numbers-and-punctuation"
                                onEndEditing={(e) => setLocalTimers({ ...localTimers, work: parseTime(e.nativeEvent.text) })}
                            />
                        </View>
                    </View>

                    <View style={styles.restInputRow}>
                        <Text style={styles.restInputLabel}>Warm-up Set</Text>
                        <View style={styles.restInputBox}>
                            <TextInput
                                style={styles.restInputText}
                                defaultValue={formatSeconds(localTimers.warmup)}
                                keyboardType="numbers-and-punctuation"
                                onEndEditing={(e) => setLocalTimers({ ...localTimers, warmup: parseTime(e.nativeEvent.text) })}
                            />
                        </View>
                    </View>

                    <View style={styles.restInputRow}>
                        <Text style={styles.restInputLabel}>Drop Set</Text>
                        <View style={styles.restInputBox}>
                            <TextInput
                                style={styles.restInputText}
                                defaultValue={formatSeconds(localTimers.dropset)}
                                keyboardType="numbers-and-punctuation"
                                onEndEditing={(e) => setLocalTimers({ ...localTimers, dropset: parseTime(e.nativeEvent.text) })}
                            />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.restSubmitBtn} onPress={handleSave}>
                        <Text style={styles.restSubmitText}>Update Rest Timers</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={onClose}>
                        <SecondaryText style={{ color: VisualSystem.colors.goldText, fontSize: 15 }}>Cancel</SecondaryText>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function PlateCalculator({ targetWeight, onClose }: { targetWeight: number, onClose: () => void }) {
    const barWeight = 45;
    const plates = [45, 35, 25, 10, 5, 2.5];
    const sideWeight = Math.max(0, (targetWeight - barWeight) / 2);
    
    let remaining = sideWeight;
    const result: Record<number, number> = {};
    
    plates.forEach(p => {
        const count = Math.floor(remaining / p);
        if (count > 0) {
            result[p] = count;
            remaining -= count * p;
        }
    });

    return (
        <Modal visible={true} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <FontAwesome name="calculator" size={32} color={VisualSystem.colors.gold} style={{ marginBottom: 16 }} />
                        <Text style={styles.modalTitle}>Plate Calculator</Text>
                        <SecondaryText style={{ color: VisualSystem.colors.goldText, fontWeight: '700' }}>{targetWeight} LBS TOTAL</SecondaryText>
                    </View>

                    <View style={{ backgroundColor: VisualSystem.colors.bgMid, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                        <Text style={{ fontWeight: '700', fontSize: 11, color: VisualSystem.colors.textTertiary, marginBottom: 8, textTransform: 'uppercase' }}>Plates Per Side</Text>
                        {Object.keys(result).length > 0 ? (
                            Object.entries(result).sort((a,b) => Number(b[0]) - Number(a[0])).map(([weight, count]) => (
                                <View key={weight} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.1)' }}>
                                    <Text style={{ color: VisualSystem.colors.textPrimary, fontSize: 17, fontWeight: '800' }}>{weight} LB</Text>
                                    <Text style={{ color: VisualSystem.colors.goldText, fontSize: 17, fontWeight: '800' }}>x {count}</Text>
                                </View>
                            ))
                        ) : (
                            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                                <Text style={{ color: VisualSystem.colors.textSecondary, fontWeight: '600' }}>45 LB BAR ONLY</Text>
                            </View>
                        )}
                    </View>
                    
                    <TouchableOpacity style={styles.restSubmitBtn} onPress={onClose}>
                        <Text style={styles.restSubmitText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

function TemplateCard({
    title,
    detail,
    onPress,
    onDelete,
}: {
    title: string;
    detail: string;
    onPress?: () => void;
    onDelete?: () => void;
}) {
    return (
        <View style={styles.templateCard}>
            <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={{ flex: 1 }}>
                <Text style={styles.templateTitle} numberOfLines={2}>{title}</Text>
                <Text style={styles.templateDetail} numberOfLines={3}>{detail}</Text>
            </TouchableOpacity>
            <View style={styles.templateFooter}>
                <TouchableOpacity
                    onPress={onPress}
                    activeOpacity={0.75}
                    style={styles.templateStartBtn}
                >
                    <FontAwesome name="play" size={10} color={LOG.gold} />
                    <Text style={styles.templateStartText}>Start</Text>
                </TouchableOpacity>
                {onDelete ? (
                    <Pressable
                        onPress={onDelete}
                        hitSlop={10}
                        style={({ pressed }) => pressed && { opacity: 0.55 }}
                    >
                        <Text style={styles.templateRemoveText}>Remove</Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

function WarmupCalculator({ targetWeight, onSave, onClose }: { targetWeight: number, onSave: (sets: WorkoutSet[]) => void, onClose: () => void }) {
    const percentages = [0.4, 0.6, 0.8];
    const repsList = [10, 8, 5];
    
    const warmupSets: WorkoutSet[] = percentages.map((p, i) => ({
        id: Math.random().toString(),
        weight: Math.round((targetWeight * p) / 5) * 5, // Round to nearest 5
        reps: repsList[i],
        completed: false,
        type: 'warmup'
    }));

    return (
        <Modal visible={true} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <FontAwesome name="fire" size={32} color="#E67E22" style={{ marginBottom: 16 }} />
                        <Text style={styles.modalTitle}>Warm-up Calculator</Text>
                        <SecondaryText style={{ textAlign: 'center', marginTop: 8 }}>Generate warm-up progression for {targetWeight} LBS</SecondaryText>
                    </View>

                    <View style={{ backgroundColor: VisualSystem.colors.bgMid, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                        {warmupSets.map((s, i) => (
                            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.1)' }}>
                                <View>
                                    <Text style={{ color: '#E67E22', fontSize: 11, fontWeight: '700' }}>WARM-UP {i+1}</Text>
                                    <Text style={{ color: VisualSystem.colors.textPrimary, fontSize: 17, fontWeight: '800' }}>{s.weight} LBS</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ color: VisualSystem.colors.textTertiary, fontSize: 11, fontWeight: '700' }}>Reps</Text>
                                    <Text style={{ color: VisualSystem.colors.textPrimary, fontSize: 17, fontWeight: '800' }}>{s.reps}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                    
                    <TouchableOpacity style={styles.restSubmitBtn} onPress={() => onSave(warmupSets)}>
                        <Text style={styles.restSubmitText}>Add warm-up sets</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={onClose}>
                        <SecondaryText style={{ color: '#E67E22', fontWeight: '700' }}>Cancel</SecondaryText>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

function ProgressView({ 
    userId, 
    allExercises, 
    selectedEx, 
    onSelectEx, 
    progressData, 
    isLoading,
    onRepeat,
    onSaveTemplate
}: {
    userId?: string,
    allExercises: string[],
    selectedEx: string | null,
    onSelectEx: (name: string) => void,
    progressData: { date: string, maxWeight: number, volume: number }[],
    isLoading: boolean,
    onRepeat: (workout: Workout) => void,
    onSaveTemplate: (workout: Workout) => void
}) {
    const [search, setSearch] = useState('');
    const [showSelector, setShowSelector] = useState(false);
    const [activeTab, setActiveTab] = useState<'workouts' | 'progress'>('workouts');
    const [showAllSessions, setShowAllSessions] = useState(false);
    const [sessionsLogExpanded, setSessionsLogExpanded] = useState(false);

    const filteredExercises = allExercises.filter(ex => 
        ex.toLowerCase().includes(search.toLowerCase())
    );

    const peakWeight = progressData.length > 0 ? Math.max(...progressData.map(d => d.maxWeight)) : 0;
    const latestWeight = progressData.length > 0 ? progressData[progressData.length - 1].maxWeight : 0;
    const sessionCount = progressData.length;

    const renderGraph = () => {
        if (progressData.length < 2) return (
            <View style={styles.emptyGraph}>
                <FontAwesome name="line-chart" size={32} color={LOG.gold} style={{ marginBottom: 8 }} />
                <SecondaryText style={{ textAlign: 'center', lineHeight: 18 }}>
                    Log a few more sessions for {selectedEx} to see your strength trend.
                </SecondaryText>
            </View>
        );

        const chartWidth = Dimensions.get('window').width - 116;
        const height = 160;
        const paddingX = 28;
        const paddingY = 24;

        const maxW = Math.max(...progressData.map(d => d.maxWeight));
        const minW = Math.min(...progressData.map(d => d.maxWeight));
        const diff = maxW - minW || 1;

        const points = progressData.map((d, i) => {
            const x = paddingX + (i / (progressData.length - 1)) * (chartWidth - 2 * paddingX);
            const y = height - paddingY - ((d.maxWeight - minW) / diff) * (height - 2 * paddingY);
            return { x, y, weight: d.maxWeight };
        });

        let dStr = `M ${points[0].x} ${points[0].y}`;
        points.slice(1).forEach(p => {
            dStr += ` L ${p.x} ${p.y}`;
        });

        return (
            <View style={styles.graphContainer}>
                <View style={styles.graphHeader}>
                    <Text style={styles.graphTitle}>Max Weight Trend</Text>
                    <Text style={styles.graphVal}>PEAK {peakWeight} LBS</Text>
                </View>
                <Svg width={chartWidth} height={height}>
                    <Defs>
                        <SvgGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={LOG.gold} stopOpacity="0.28" />
                            <Stop offset="1" stopColor={LOG.gold} stopOpacity="0" />
                        </SvgGradient>
                    </Defs>
                    {[0, 0.5, 1].map(v => (
                        <Line
                            key={v}
                            x1={paddingX}
                            y1={paddingY + (height - 2 * paddingY) * v}
                            x2={chartWidth - paddingX}
                            y2={paddingY + (height - 2 * paddingY) * v}
                            stroke={LOG.borderSubtle}
                            strokeDasharray="4 4"
                        />
                    ))}
                    <Path
                        d={`${dStr} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`}
                        fill="url(#progressGrad)"
                    />
                    <Path d={dStr} fill="none" stroke={LOG.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {points.map((p, i) => (
                        <Circle key={i} cx={p.x} cy={p.y} r="4" fill={LOG.bgMid} stroke={LOG.gold} strokeWidth="2" />
                    ))}
                </Svg>
                <View style={styles.graphDateRow}>
                    <Text style={styles.graphDateText}>
                        {new Date(progressData[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={styles.graphDateText}>
                        {new Date(progressData[progressData.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                </View>
            </View>
        );
    };

    const reversedSessions = progressData.slice().reverse();
    const visibleSessions = !sessionsLogExpanded
        ? []
        : showAllSessions
            ? reversedSessions
            : reversedSessions.slice(0, SESSION_LOG_INITIAL);
    const hiddenSessionCount = sessionsLogExpanded
        ? Math.max(0, reversedSessions.length - SESSION_LOG_INITIAL)
        : reversedSessions.length;

    return (
        <View>
            <View style={styles.historyTabRow}>
                <Pressable
                    style={[styles.historyTab, activeTab === 'workouts' && styles.historyTabActive]}
                    onPress={() => { setActiveTab('workouts'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                    <Text style={[styles.historyTabText, activeTab === 'workouts' && styles.historyTabTextActive]}>
                        Workouts
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.historyTab, activeTab === 'progress' && styles.historyTabActive]}
                    onPress={() => { setActiveTab('progress'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                    <Text style={[styles.historyTabText, activeTab === 'progress' && styles.historyTabTextActive]}>
                        Exercise Progress
                    </Text>
                </Pressable>
            </View>

            {activeTab === 'workouts' ? (
                <HistoryListView userId={userId} onRepeat={onRepeat} onSaveTemplate={onSaveTemplate} />
            ) : (
                <View>
                    <TouchableOpacity 
                        style={styles.progressSelector}
                        onPress={() => setShowSelector(!showSelector)}
                        activeOpacity={0.85}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <FontAwesome name="line-chart" size={14} color={LOG.gold} style={{ marginRight: 8 }} />
                            <Text style={[styles.selectorText, !selectedEx && styles.selectorPlaceholder]} numberOfLines={1}>
                                {selectedEx || 'Pick an exercise…'}
                            </Text>
                        </View>
                        <FontAwesome name={showSelector ? 'chevron-up' : 'chevron-down'} size={12} color={LOG.textTertiary} />
                    </TouchableOpacity>

                    {showSelector && (
                        <View style={styles.selectorDropdown}>
                            <TextInput 
                                style={styles.selectorSearchInput}
                                placeholder="Search exercises..."
                                placeholderTextColor={LOG.textTertiary}
                                value={search}
                                onChangeText={setSearch}
                                autoFocus
                            />
                            <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                                {filteredExercises.map(ex => (
                                    <TouchableOpacity 
                                        key={ex} 
                                        style={styles.selectorItem}
                                        onPress={() => {
                                            onSelectEx(ex);
                                            setShowSelector(false);
                                            setSearch('');
                                            setShowAllSessions(false);
                                            setSessionsLogExpanded(false);
                                        }}
                                    >
                                        <Text style={styles.selectorItemText} numberOfLines={1}>{ex}</Text>
                                        {selectedEx === ex && <FontAwesome name="check" size={12} color={LOG.gold} />}
                                    </TouchableOpacity>
                                ))}
                                {filteredExercises.length === 0 && (
                                    <SecondaryText style={{ padding: 16, textAlign: 'center' }}>No exercises found.</SecondaryText>
                                )}
                            </ScrollView>
                        </View>
                    )}

                    {isLoading ? (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                            <ActivityIndicator color={LOG.gold} />
                        </View>
                    ) : !selectedEx ? (
                        <View style={styles.historyEmpty}>
                            <FontAwesome name="line-chart" size={24} color={LOG.gold} style={{ marginBottom: 8 }} />
                            <SecondaryText style={{ textAlign: 'center', lineHeight: 18 }}>
                                Select an exercise above to view your strength trend and session history.
                            </SecondaryText>
                        </View>
                    ) : (
                        <View>
                            {progressData.length > 0 && (
                                <View style={styles.progressStatsRow}>
                                    <View style={styles.progressStatCard}>
                                        <Text style={styles.progressStatLabel}>Peak</Text>
                                        <Text style={styles.progressStatValue}>{peakWeight}</Text>
                                        <Text style={styles.progressStatUnit}>lbs</Text>
                                    </View>
                                    <View style={styles.progressStatCard}>
                                        <Text style={styles.progressStatLabel}>Latest</Text>
                                        <Text style={styles.progressStatValue}>{latestWeight}</Text>
                                        <Text style={styles.progressStatUnit}>lbs</Text>
                                    </View>
                                    <View style={styles.progressStatCard}>
                                        <Text style={styles.progressStatLabel}>Sessions</Text>
                                        <Text style={styles.progressStatValue}>{sessionCount}</Text>
                                        <Text style={styles.progressStatUnit}>Logged</Text>
                                    </View>
                                </View>
                            )}

                            {renderGraph()}

                            {progressData.length > 0 && (
                                <View style={styles.progressSubsection}>
                                    <TouchableOpacity
                                        style={styles.sessionsToggleRow}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setSessionsLogExpanded((v) => !v);
                                            if (sessionsLogExpanded) setShowAllSessions(false);
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={[styles.progressSubsectionTitle, { marginBottom: 0 }]}>
                                            Session log ({reversedSessions.length})
                                        </Text>
                                        <FontAwesome
                                            name={sessionsLogExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={10}
                                            color={LOG.textTertiary}
                                        />
                                    </TouchableOpacity>
                                    {!sessionsLogExpanded && (
                                        <SecondaryText style={styles.sessionsCollapsedHint}>
                                            Tap to expand individual session entries.
                                        </SecondaryText>
                                    )}
                                    {visibleSessions.map((d, i) => (
                                        <TouchableOpacity 
                                            key={`${d.date}-${i}`}
                                            style={styles.historyCardMini}
                                            onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                Alert.alert(
                                                    'Session Detail',
                                                    `${new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\n\nMax: ${d.maxWeight} lbs\nVolume: ${Math.round(d.volume).toLocaleString()} lbs`,
                                                    [{ text: 'OK' }]
                                                );
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.historyCardMiniDate}>
                                                    {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </Text>
                                                <Text style={styles.historyCardMiniVol}>
                                                    {Math.round(d.volume).toLocaleString()} lbs volume
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.historyCardMiniWeight}>{d.maxWeight}</Text>
                                                <Text style={styles.historyCardMiniUnit}>LBS max</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                    {sessionsLogExpanded && hiddenSessionCount > 0 && !showAllSessions && (
                                        <TouchableOpacity
                                            style={styles.historyShowMoreBtn}
                                            onPress={() => setShowAllSessions(true)}
                                        >
                                            <Text style={styles.historyShowMoreText}>
                                                Show {hiddenSessionCount} more session{hiddenSessionCount === 1 ? '' : 's'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

function HistoryListView({
    userId,
    onRepeat,
    onSaveTemplate,
}: {
    userId?: string;
    onRepeat: (workout: Workout) => void;
    onSaveTemplate: (workout: Workout) => void;
}) {
    const [history, setHistory] = useState<Workout[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [visibleCount, setVisibleCount] = useState(HISTORY_INITIAL_LIMIT);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (userId) loadHistory();
    }, [userId]);

    useEffect(() => {
        setVisibleCount(HISTORY_INITIAL_LIMIT);
    }, [search]);

    const loadHistory = async () => {
        const h = await getWorkoutHistory(userId!);
        setHistory(h);
        setLoading(false);
    };

    const filtered = history.filter(w => 
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.exercises.some(ex => ex.name.toLowerCase().includes(search.toLowerCase()))
    );

    const visibleWorkouts = filtered.slice(0, visibleCount);
    const grouped = groupWorkoutsByDate(visibleWorkouts);
    const remaining = Math.max(0, filtered.length - visibleCount);

    const toggleExpanded = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (loading) return (
        <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator color={LOG.gold} />
        </View>
    );

    return (
        <View>
            <View style={styles.historySearchContainer}>
                <FontAwesome name="search" size={14} color={LOG.textTertiary} />
                <TextInput 
                    style={styles.historySearchInput}
                    placeholder="Search workouts or exercises..."
                    placeholderTextColor={LOG.textTertiary}
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity accessibilityLabel="Close" onPress={() => setSearch('')} hitSlop={8}>
                        <FontAwesome name="times-circle" size={16} color={LOG.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {!search.trim() ? (
                history.length === 0 ? (
                    <View style={styles.historyEmpty}>
                        <FontAwesome name="history" size={24} color={LOG.gold} style={{ marginBottom: 8 }} />
                        <SecondaryText style={{ textAlign: 'center', lineHeight: 18 }}>
                            No history yet. Finish a session to see it here.
                        </SecondaryText>
                    </View>
                ) : (
                    <View style={styles.historyCollapsedHint}>
                        <FontAwesome name="history" size={22} color={LOG.gold} style={{ marginBottom: 8 }} />
                        <Text style={styles.historyCollapsedCount}>
                            {history.length} workout{history.length === 1 ? '' : 's'} logged
                        </Text>
                        <SecondaryText style={{ textAlign: 'center', lineHeight: 18 }}>
                            Search above by workout name or exercise to pull up a session.
                        </SecondaryText>
                    </View>
                )
            ) : filtered.length === 0 ? (
                <View style={styles.historyEmpty}>
                    <FontAwesome name="search" size={24} color={LOG.gold} style={{ marginBottom: 8 }} />
                    <SecondaryText style={{ textAlign: 'center', lineHeight: 18 }}>
                        No workouts match your search.
                    </SecondaryText>
                </View>
            ) : (
                <>
                    {grouped.map((group) => (
                        <View key={group.label}>
                            <Text style={styles.historyGroupHeader}>{group.label}</Text>
                            {group.items.map((workout) => {
                                const workoutDate = new Date(workout.date);
                                const dateLabel = workoutDate.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                });
                                const durationMin = Math.max(1, Math.round(workout.duration / 60));
                                const volume = Math.round(workout.totalVolume || 0).toLocaleString();
                                const isExpanded = expandedIds.has(workout.id);
                                const hasExercises = workout.exercises.length > 0;

                                return (
                                    <View key={workout.id} style={styles.historyCard}>
                                        <View style={styles.historyCardBody}>
                                            <View style={styles.historyCardTop}>
                                                <Pressable
                                                    style={styles.historyCardMain}
                                                    onPress={() => hasExercises && toggleExpanded(workout.id)}
                                                >
                                                    <Text style={styles.historyName} numberOfLines={1}>{workout.name}</Text>
                                                    <Text style={styles.historyMetaLine}>
                                                        {dateLabel} · {durationMin}m · {workout.exercises.length} ex ·{' '}
                                                        <Text style={styles.historyVolumeInline}>{volume} lbs</Text>
                                                    </Text>
                                                </Pressable>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={'Save ' + workout.name + ' as a routine'}
                                                    style={({ pressed }) => [
                                                        styles.historyRepeatBtn,
                                                        pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                                                    ]}
                                                    onPress={() => {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                        onSaveTemplate(workout);
                                                    }}
                                                    hitSlop={4}
                                                >
                                                    <FontAwesome name="bookmark-o" size={14} color={LOG.goldText} />
                                                </Pressable>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={'Repeat ' + workout.name}
                                                    style={({ pressed }) => [
                                                        styles.historyRepeatBtn,
                                                        pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                                                    ]}
                                                    onPress={() => {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                        onRepeat(workout);
                                                    }}
                                                    hitSlop={4}
                                                >
                                                    <FontAwesome name="repeat" size={14} color={LOG.goldText} />
                                                </Pressable>
                                            </View>
                                        </View>

                                        {hasExercises && (
                                            <Pressable
                                                style={styles.historyExpandRow}
                                                onPress={() => toggleExpanded(workout.id)}
                                            >
                                                <Text style={styles.historyExpandText}>
                                                    {isExpanded ? 'Hide exercises' : `View ${workout.exercises.length} exercises`}
                                                </Text>
                                                <FontAwesome
                                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                    size={10}
                                                    color={LOG.textTertiary}
                                                />
                                            </Pressable>
                                        )}

                                        {isExpanded && (
                                            <View style={styles.historyExercisesList}>
                                                {workout.exercises.map((ex, i) => (
                                                    <View key={`${workout.id}-${i}`} style={styles.historyExChip}>
                                                        <View style={styles.historyExDot} />
                                                        <Text style={styles.historyExText} numberOfLines={1}>
                                                            {ex.sets.length}× {ex.name}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    ))}

                    {remaining > 0 && (
                        <TouchableOpacity
                            style={styles.historyShowMoreBtn}
                            onPress={() => setVisibleCount((c) => c + HISTORY_SHOW_MORE_STEP)}
                        >
                            <Text style={styles.historyShowMoreText}>
                                Show {Math.min(remaining, HISTORY_SHOW_MORE_STEP)} more workout{remaining === 1 ? '' : 's'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </>
            )}
        </View>
    );
}
