import React, { useState, useEffect } from 'react';
import { dormToGymProfileName, getAllTrainingLocationNames } from '@/lib/gymContext';
import {
    StyleSheet,
    View,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    TextInput,
    Text as RNText,
} from 'react-native';
import { Text, SecondaryText } from '../../components/Themed';
import {
    UserProfile,
    Dorm,
    Goal,
    Gym,
    Gender,
    ActivityLevel,
    WeeklyGoalRate,
    DEFAULT_GYMS,
    WeightCheckDay,
    WEIGHT_CHECK_DAY_LABELS,
    WEIGHT_CHECK_TIME_OPTIONS,
    formatWeightCheckTime12h,
} from '../../types/user';
import { useAuth } from '../../features/auth/AuthContext';
import { calculateTargets } from '../../lib/nutrition';
import { StyledInput } from '../../components/ui/StyledInput';
import { StyledButton } from '../../components/ui/StyledButton';
import { StyledSelect } from '../../components/ui/StyledSelect';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { formatPhoneNumber } from '../../features/utils/FormattingUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tokens } from '../../constants/Tokens';
import { WebShell } from '@/components/ui/WebShell';
import { webRoot } from '@/constants/webLayout';

const generateId = () => Math.random().toString(36).substr(2, 9);

const WEEKLY_GOAL_LABELS: Record<string, string> = {
    [WeeklyGoalRate.LOSE_1_5_LB]: "Lose 1.5 lbs / week",
    [WeeklyGoalRate.LOSE_1_0_LB]: "Lose 1.0 lbs / week",
    [WeeklyGoalRate.LOSE_0_5_LB]: "Lose 0.5 lbs / week",
    [WeeklyGoalRate.MAINTAIN]: "Maintain weight",
    [WeeklyGoalRate.GAIN_0_5_LB]: "Gain 0.5 lbs / week",
    [WeeklyGoalRate.GAIN_1_0_LB]: "Gain 1.0 lbs / week",
};

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{title}</Text>
            <SecondaryText style={styles.stepSub}>{subtitle}</SecondaryText>
        </View>
    );
}

function HintText({ children, accent }: { children: string; accent?: boolean }) {
    return <RNText style={[styles.hint, accent && styles.hintAccent]}>{children}</RNText>;
}

const MACRO_COLORS = {
    protein: '#51cf66',
    carbs: '#4dabf7',
    fat: '#ff6b6b',
} as const;

function PlanMacroRow({
    label,
    letter,
    grams,
    color,
}: {
    label: string;
    letter: string;
    grams: number | undefined;
    color: string;
}) {
    return (
        <View style={styles.planMacroRow}>
            <View style={[styles.planMacroBadge, { borderColor: color, backgroundColor: `${color}18` }]}>
                <RNText style={[styles.planMacroBadgeLetter, { color }]}>{letter}</RNText>
            </View>
            <RNText style={styles.planMacroLabel}>{label}</RNText>
            <RNText style={styles.planMacroGrams}>{grams != null ? `${grams}g` : '—'}</RNText>
        </View>
    );
}

function PlanTargetsSummary({
    goal,
    weeklyLabel,
    calories,
    protein,
    carbs,
    fat,
}: {
    goal: string;
    weeklyLabel: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
}) {
    return (
        <View style={styles.planCard}>
            <View style={styles.planChipRow}>
                <View style={styles.planChip}>
                    <RNText style={styles.planChipText} numberOfLines={1}>{goal}</RNText>
                </View>
                <View style={styles.planChip}>
                    <RNText style={styles.planChipText} numberOfLines={1}>{weeklyLabel}</RNText>
                </View>
            </View>

            <View style={styles.planCalorieHero}>
                <RNText style={styles.planCalorieValue} adjustsFontSizeToFit numberOfLines={1}>
                    {calories != null ? calories.toLocaleString() : '—'}
                </RNText>
                <RNText style={styles.planCalorieUnit}>calories per day</RNText>
            </View>

            <View style={styles.planMacroSection}>
                <RNText style={styles.planMacroSectionTitle}>DAILY MACROS</RNText>
                <PlanMacroRow label="Protein" letter="P" grams={protein} color={MACRO_COLORS.protein} />
                <View style={styles.planMacroDivider} />
                <PlanMacroRow label="Carbs" letter="C" grams={carbs} color={MACRO_COLORS.carbs} />
                <View style={styles.planMacroDivider} />
                <PlanMacroRow label="Fat" letter="F" grams={fat} color={MACRO_COLORS.fat} />
            </View>

            <View style={styles.planBullets}>
                <View style={styles.planBulletRow}>
                    <FontAwesome name="check-circle" size={14} color="#D4AF37" />
                    <RNText style={styles.planBulletText}>Nutrition tab tracks meals against these targets</RNText>
                </View>
                <View style={styles.planBulletRow}>
                    <FontAwesome name="check-circle" size={14} color="#D4AF37" />
                    <RNText style={styles.planBulletText}>Leprechaun AI uses them for workout & fuel guidance</RNText>
                </View>
                <View style={styles.planBulletRow}>
                    <FontAwesome name="check-circle" size={14} color="#D4AF37" />
                    <RNText style={styles.planBulletText}>Weekly weigh-in on Profile tracks goal progress</RNText>
                </View>
                <View style={styles.planBulletRow}>
                    <FontAwesome name="check-circle" size={14} color="#D4AF37" />
                    <RNText style={styles.planBulletText}>Change goals anytime in Profile — no pressure</RNText>
                </View>
            </View>
        </View>
    );
}

function PasswordField({
    label,
    value,
    onChangeText,
    placeholder,
    visible,
    onToggleVisible,
    error,
    textContentType,
}: {
    label: string;
    value: string;
    onChangeText: (t: string) => void;
    placeholder?: string;
    visible: boolean;
    onToggleVisible: () => void;
    error?: string;
    textContentType?: 'oneTimeCode' | 'newPassword' | 'password';
}) {
    return (
        <View style={styles.passwordField}>
            <RNText style={styles.inputLabel}>{label.toUpperCase()}</RNText>
            <View style={[styles.passwordRow, error ? styles.passwordRowError : null]}>
                <TextInput
                    style={styles.passwordTextInput}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder ?? '••••••••'}
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    secureTextEntry={!visible}
                    textContentType={textContentType}
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                />
                <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={onToggleVisible}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <FontAwesome name={visible ? 'eye' : 'eye-slash'} size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
            </View>
            {!!error && <RNText style={styles.fieldError}>{error}</RNText>}
        </View>
    );
}

export default function SignupScreen() {
    const { signUp, isAuthLoading } = useAuth();
    const insets = useSafeAreaInsets();

    const [step, setStep] = useState(1);

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');

    const [gender, setGender] = useState<Gender>(Gender.MALE);
    const [age, setAge] = useState('');
    const [heightFt, setHeightFt] = useState('');
    const [heightIn, setHeightIn] = useState('');
    const [weight, setWeight] = useState('');

    const [activity, setActivity] = useState<ActivityLevel>(ActivityLevel.MODERATE);
    const [goal, setGoal] = useState<Goal>(Goal.LEAN_BULK);
    const [weeklyGoalRate, setWeeklyGoalRate] = useState<WeeklyGoalRate>(WeeklyGoalRate.MAINTAIN);
    const [dorm, setDorm] = useState<Dorm>(Dorm.DUNCAN);
    const [gym, setGym] = useState<Gym>(dormToGymProfileName(Dorm.DUNCAN));
    const [weightCheckDay, setWeightCheckDay] = useState<WeightCheckDay>(WeightCheckDay.SUNDAY);

    useEffect(() => {
        setGym(dormToGymProfileName(dorm));
    }, [dorm]);
    const [weightCheckTime, setWeightCheckTime] = useState('08:00');

    const [passwordType, setPasswordType] = useState<'oneTimeCode' | 'newPassword' | 'password'>('oneTimeCode');
    const [results, setResults] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);

    const calculate = () => {
        if (!age || !heightFt || !heightIn || !weight) {
            Alert.alert('Missing Info', 'Please fill in all stats to proceed.');
            return false;
        }

        const heightCm = parseInt(heightFt, 10) * 30.48 + parseInt(heightIn, 10) * 2.54;
        const weightKg = parseFloat(weight) * 0.453592;

        const calculated = calculateTargets(
            gender,
            weightKg,
            heightCm,
            parseInt(age, 10),
            activity,
            goal,
            weeklyGoalRate
        );

        setResults(calculated);
        return true;
    };

    const handleNext = async () => {
        if (step === 1) {
            if (!name.trim()) return Alert.alert('Required', 'Please enter your full name.');
            setStep(2);
        } else if (step === 2) {
            const emailValue = email.trim().toLowerCase();
            if (!emailValue.endsWith('@nd.edu')) {
                return Alert.alert('Invalid Email', 'You must use a valid @nd.edu email address.');
            }
            setStep(3);
        } else if (step === 3) {
            setPasswordError('');
            setConfirmPasswordError('');

            if (!username.trim() || !password || !confirmPassword) {
                return Alert.alert('Required', 'Please fill all fields.');
            }

            let hasError = false;
            const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
            if (password.length < 8 || !specialCharRegex.test(password)) {
                setPasswordError('Use at least 8 characters and 1 special character.');
                hasError = true;
            }
            if (password !== confirmPassword) {
                setConfirmPasswordError('Passwords do not match.');
                hasError = true;
            }
            if (hasError) return;

            const trimmedUsername = username.trim();
            let usernameTaken = false;

            const { data: isAvailable, error: rpcError } = await supabase.rpc('check_username_available', {
                p_username: trimmedUsername,
            });

            if (!rpcError && isAvailable === false) {
                usernameTaken = true;
            } else if (rpcError) {
                const { data: existingProfiles, error: checkError } = await supabase
                    .from('profiles')
                    .select('id')
                    .ilike('display_name', trimmedUsername)
                    .limit(1);

                if (checkError) {
                    if (__DEV__) console.warn('[Signup] Username check failed:', checkError.message);
                    Alert.alert(
                        'Connection issue',
                        "We couldn't verify this username. Check your connection and try again."
                    );
                    return;
                }
                usernameTaken = !!(existingProfiles && existingProfiles.length > 0);
            }

            if (usernameTaken) {
                Alert.alert('Username taken', 'This username is already in use. Please choose a different one.');
                return;
            }

            setPasswordType('newPassword');
            setTimeout(() => setStep(4), 100);
        } else if (step === 4) {
            if (calculate()) setStep(5);
        } else if (step === 5) {
            setStep(6);
        } else if (step === 6) {
            calculate();
            setStep(7);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
        else router.back();
    };

    const handleSignup = async () => {
        if (!results) return;

        const heightCm = parseInt(heightFt, 10) * 30.48 + parseInt(heightIn, 10) * 2.54;
        const weightKg = parseFloat(weight) * 0.453592;

        const newUser: UserProfile = {
            id: generateId(),
            email: email.trim().toLowerCase(),
            displayName: username,
            name,
            phone: phone.replace(/\D/g, ''),
            gender,
            age: parseInt(age, 10),
            heightCm,
            weightKg,
            activityLevel: activity,
            dorm,
            goal,
            weeklyGoalRate,
            enableNegativeAdjustments: false,
            defaultGym: gym,
            proteinTarget: results.protein,
            carbTarget: results.carbs,
            fatTarget: results.fat,
            calorieTarget: results.calories,
            createdAt: new Date().toISOString(),
            weightUnitLbs: true,
            distanceUnitMi: true,
            pushNotifications: true,
            emailRecaps: false,
            privateProfile: false,
            weeklyWeightCheckDay: weightCheckDay,
            weeklyWeightCheckTime: weightCheckTime,
            weightCheckEnabled: true,
        };

        try {
            await signUp(newUser, password, true);
        } catch (error: any) {
            const message = error?.message || 'An unexpected error occurred. Please try again.';
            const hint =
                message.includes('already registered') || message.includes('already exist')
                    ? '\n\nTip: Use Log In on step 1, or Forgot Password on the login screen.'
                    : message.includes('confirm')
                      ? '\n\nTip: Open the link in your @nd.edu inbox, then return and log in.'
                      : '';
            Alert.alert('Couldn’t finish signup', message + hint);
        }
    };

    const generatePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
        let newPass = '';
        for (let i = 0; i < 12; i++) newPass += chars.charAt(Math.floor(Math.random() * chars.length));
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPass)) newPass += '!';
        setPassword(newPass);
        setConfirmPassword(newPass);
        setShowPassword(true);
        setShowConfirmPassword(true);
        setPasswordError('');
        setConfirmPasswordError('');
    };

    const renderStep1 = () => (
        <View style={styles.stepBody}>
            <StepHeader
                title="Who are you?"
                subtitle="No perfect answers — just enough to personalize your experience."
            />
            <StyledInput label="Full Name" value={name} onChangeText={setName} placeholder="Notre Dame Student" autoCapitalize="words" />
            <StyledInput
                label="Phone Number (Optional)"
                value={phone}
                onChangeText={(text) => setPhone(formatPhoneNumber(text))}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
                maxLength={14}
            />
            <HintText>Adding a phone number helps friends find you via their contacts.</HintText>
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepBody}>
            <StepHeader title="Student Verification" subtitle="Your @nd.edu email keeps FitVerse a trusted campus space." />
            <StyledInput
                label="ND Email"
                value={email}
                onChangeText={setEmail}
                placeholder="irish@nd.edu"
                keyboardType="email-address"
                autoCapitalize="none"
            />
            <HintText accent>* Must end in @nd.edu</HintText>
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.stepBody}>
            <StepHeader title="Secure Account" subtitle="Create your login credentials." />
            <StyledInput
                label="Username"
                value={username}
                onChangeText={setUsername}
                placeholder="FightingIrish26"
                autoCapitalize="none"
                textContentType="username"
                autoComplete="username"
            />
            <HintText>Friends see this name. You can log in with your username or @nd.edu email.</HintText>

            <PasswordField
                label="Password"
                value={password}
                onChangeText={(val) => {
                    setPassword(val);
                    if (passwordError) setPasswordError('');
                }}
                visible={showPassword}
                onToggleVisible={() => setShowPassword(!showPassword)}
                error={passwordError}
                textContentType={passwordType}
            />

            <TouchableOpacity style={styles.generateBtn} onPress={generatePassword} activeOpacity={0.7}>
                <FontAwesome name="magic" size={12} color="#D4AF37" />
                <RNText style={styles.generateText}>Generate secure password</RNText>
            </TouchableOpacity>

            <PasswordField
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={(val) => {
                    setConfirmPassword(val);
                    if (confirmPasswordError) setConfirmPasswordError('');
                }}
                visible={showConfirmPassword}
                onToggleVisible={() => setShowConfirmPassword(!showConfirmPassword)}
                error={confirmPasswordError}
                textContentType={passwordType}
            />
        </View>
    );

    const renderStep4 = () => (
        <View style={styles.stepBody}>
            <StepHeader
                title="Body Metrics"
                subtitle="Rough estimates are fine — this only helps us suggest a starting plan, not judge you."
            />
            <StyledSelect label="Gender" value={gender} options={[Gender.MALE, Gender.FEMALE]} onSelect={setGender} />

            <View style={styles.fieldRow}>
                <View style={styles.fieldRowHalf}>
                    <StyledInput label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="21" maxLength={3} />
                </View>
                <View style={styles.fieldRowHalf}>
                    <StyledInput label="Weight (lbs)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="165" />
                </View>
            </View>

            <View style={styles.fieldRow}>
                <View style={styles.fieldRowHalf}>
                    <StyledInput label="Feet" value={heightFt} onChangeText={setHeightFt} keyboardType="number-pad" placeholder="5" maxLength={1} />
                </View>
                <View style={styles.fieldRowHalf}>
                    <StyledInput label="Inches" value={heightIn} onChangeText={setHeightIn} keyboardType="number-pad" placeholder="10" maxLength={2} />
                </View>
            </View>

            <StyledSelect label="Workout Frequency" value={activity} options={Object.values(ActivityLevel)} onSelect={setActivity} />
        </View>
    );

    const renderStep5 = () => (
        <View style={styles.stepBody}>
            <StepHeader
                title="Your Goals"
                subtitle="Where you live and train — we'll use this to guide you, not compare you."
            />
            <StyledSelect label="Main Fitness Goal" value={goal} options={Object.values(Goal)} onSelect={setGoal} />
            <StyledSelect
                label="Weekly Goal Rate"
                value={WEEKLY_GOAL_LABELS[weeklyGoalRate]}
                options={Object.values(WEEKLY_GOAL_LABELS)}
                onSelect={(val) => {
                    const key = Object.keys(WEEKLY_GOAL_LABELS).find((k) => WEEKLY_GOAL_LABELS[k] === val);
                    if (key) setWeeklyGoalRate(key as WeeklyGoalRate);
                }}
            />

            <View style={styles.sectionDivider} />
            <RNText style={styles.sectionTitle}>Your campus</RNText>
            <StyledSelect label="Dorm" value={dorm} options={Object.values(Dorm)} onSelect={setDorm} />
            <StyledSelect
                label="Training location"
                value={gym}
                options={getAllTrainingLocationNames()}
                onSelect={setGym}
            />
            <SecondaryText style={{ fontSize: 12, marginTop: -8, marginBottom: 8, lineHeight: 18 }}>
                Defaults to {dormToGymProfileName(dorm)} when you pick your dorm. Choose a campus center if you
                usually train elsewhere.
            </SecondaryText>
        </View>
    );

    const renderStep6 = () => (
        <View style={styles.stepBody}>
            <StepHeader
                title="Weekly weigh-in"
                subtitle="Pick one day and time each week to log your weight — we'll help you see if your plan is working."
            />
            <StyledSelect
                label="Weigh-in day"
                value={WEIGHT_CHECK_DAY_LABELS[weightCheckDay]}
                options={Object.values(WEIGHT_CHECK_DAY_LABELS)}
                onSelect={(val) => {
                    const key = (Object.keys(WEIGHT_CHECK_DAY_LABELS) as WeightCheckDay[]).find(
                        (k) => WEIGHT_CHECK_DAY_LABELS[k] === val
                    );
                    if (key) setWeightCheckDay(key);
                }}
            />
            <StyledSelect
                label="Reminder time"
                value={formatWeightCheckTime12h(weightCheckTime)}
                options={WEIGHT_CHECK_TIME_OPTIONS.map((t) => formatWeightCheckTime12h(t))}
                onSelect={(val) => {
                    const key = WEIGHT_CHECK_TIME_OPTIONS.find((t) => formatWeightCheckTime12h(t) === val);
                    if (key) setWeightCheckTime(key);
                }}
            />
            <HintText accent>
                We&apos;ll remind you once a week — same scale, same time works best.
            </HintText>
        </View>
    );

    const renderStep7 = () => (
        <View style={styles.stepBody}>
            <StepHeader
                title="Your Starting Plan"
                subtitle="Here's what we'll guide you toward — a starting point, not a grade."
            />

            <PlanTargetsSummary
                goal={goal}
                weeklyLabel={WEEKLY_GOAL_LABELS[weeklyGoalRate]}
                calories={results?.calories}
                protein={results?.protein}
                carbs={results?.carbs}
                fat={results?.fat}
            />
        </View>
    );

    const steps = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7];

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.screen, webRoot]}
            keyboardVerticalOffset={insets.top}
        >
            <ScrollView
                contentContainerStyle={[
                    styles.container,
                    { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
                    Platform.OS === 'web' && styles.containerWeb,
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <WebShell maxWidth={520}>
                <View style={styles.header}>
                    <RNText style={styles.welcomePill}>STEP {step} OF 7</RNText>
                    <RNText style={styles.logoText}>FitVerse</RNText>
                </View>

                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(step / 7) * 100}%` }]} />
                </View>

                <View style={styles.card}>
                    {steps[step - 1]()}

                    <View style={styles.actions}>
                        <View style={styles.backBtnWrap}>
                            <StyledButton title={step === 1 ? 'Login' : 'Back'} onPress={handleBack} variant="secondary" />
                        </View>
                        <View style={styles.nextBtnWrap}>
                            <StyledButton
                                title={step === 7 ? 'Join FitVerse' : 'Next'}
                                onPress={step === 7 ? handleSignup : handleNext}
                            />
                        </View>
                    </View>
                </View>
                {Platform.OS === 'web' && (
                    <RNText style={styles.webHint}>
                        Tip: use Incognito or another browser to run a second test account on the same computer.
                    </RNText>
                )}
                </WebShell>
            </ScrollView>

        </KeyboardAvoidingView>
    );
}

const FIELD_GAP = 4;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    container: {
        flexGrow: 1,
        paddingHorizontal: Tokens.spacing.lg,
    },
    containerWeb: {
        minHeight: '100vh' as unknown as number,
        justifyContent: 'center',
    },
    webHint: {
        marginTop: 16,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.45)',
        fontSize: 12,
        lineHeight: 18,
        paddingHorizontal: 8,
    },
    header: {
        alignItems: 'center',
        marginBottom: Tokens.spacing.lg,
    },
    welcomePill: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        color: '#D4AF37',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 8,
    },
    logoText: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -1,
    },
    progressBar: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 3,
        marginBottom: Tokens.spacing.lg,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#D4AF37',
        borderRadius: 3,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: Tokens.radius.xl,
        padding: Tokens.spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    stepBody: {
        width: '100%',
    },
    stepHeader: {
        marginBottom: Tokens.spacing.lg,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 6,
        color: '#F5F5F5',
        lineHeight: 30,
    },
    stepSub: {
        fontSize: 15,
        lineHeight: 22,
        color: '#E2E8F0',
    },
    hint: {
        fontSize: 12,
        lineHeight: 18,
        color: '#A0AEC0',
        marginTop: -12,
        marginBottom: Tokens.spacing.md,
        paddingHorizontal: Tokens.spacing.xs,
    },
    hintAccent: {
        color: '#D4AF37',
    },
    fieldRow: {
        flexDirection: 'row',
        gap: Tokens.spacing.md,
        marginBottom: FIELD_GAP,
    },
    fieldRowHalf: {
        flex: 1,
        minWidth: 0,
    },
    planCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: Tokens.radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        padding: Tokens.spacing.lg,
        marginBottom: Tokens.spacing.sm,
    },
    planChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Tokens.spacing.sm,
        marginBottom: Tokens.spacing.lg,
    },
    planChip: {
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        maxWidth: '100%',
    },
    planChipText: {
        color: '#D4AF37',
        fontSize: 12,
        fontWeight: '700',
    },
    planCalorieHero: {
        alignItems: 'center',
        paddingVertical: Tokens.spacing.lg,
        marginBottom: Tokens.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    planCalorieValue: {
        fontSize: 44,
        fontWeight: '800',
        color: '#D4AF37',
        letterSpacing: -1,
    },
    planCalorieUnit: {
        fontSize: 14,
        color: '#A0AEC0',
        marginTop: 4,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    planMacroSection: {
        marginBottom: Tokens.spacing.lg,
    },
    planMacroSectionTitle: {
        fontSize: Tokens.typography.xs,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 1.5,
        marginBottom: Tokens.spacing.md,
        marginLeft: 2,
    },
    planMacroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    planMacroBadge: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Tokens.spacing.md,
    },
    planMacroBadgeLetter: {
        fontSize: 13,
        fontWeight: '800',
    },
    planMacroLabel: {
        flex: 1,
        fontSize: Tokens.typography.md,
        color: '#E2E8F0',
        fontWeight: '600',
    },
    planMacroGrams: {
        fontSize: Tokens.typography.lg,
        fontWeight: '700',
        color: '#FFFFFF',
        minWidth: 56,
        textAlign: 'right',
    },
    planMacroDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        marginVertical: 2,
        marginLeft: 40,
    },
    planBullets: {
        gap: Tokens.spacing.md,
        paddingTop: Tokens.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    planBulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Tokens.spacing.sm,
    },
    planBulletText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 20,
        color: '#A0AEC0',
    },
    sectionDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: Tokens.spacing.lg,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1,
        color: '#E2E8F0',
        marginBottom: Tokens.spacing.md,
        textTransform: 'uppercase',
    },
    inputLabel: {
        fontSize: Tokens.typography.xs,
        fontWeight: '900',
        marginBottom: Tokens.spacing.sm,
        marginLeft: Tokens.spacing.xs,
        color: '#D4AF37',
        letterSpacing: 1.5,
    },
    passwordField: {
        marginBottom: Tokens.spacing.lg,
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: Tokens.radius.md,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    passwordRowError: {
        borderColor: '#ff6b6b',
    },
    passwordTextInput: {
        flex: 1,
        paddingHorizontal: Tokens.spacing.lg,
        paddingVertical: 14,
        fontSize: Tokens.typography.md,
        color: '#FFFFFF',
    },
    eyeBtn: {
        paddingHorizontal: Tokens.spacing.lg,
        paddingVertical: 14,
    },
    fieldError: {
        color: '#ff6b6b',
        fontSize: Tokens.typography.xs,
        marginTop: Tokens.spacing.xs,
        marginLeft: Tokens.spacing.xs,
        fontWeight: '600',
    },
    generateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: -8,
        marginBottom: Tokens.spacing.md,
        marginLeft: Tokens.spacing.xs,
        gap: 6,
        paddingVertical: 4,
    },
    generateText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#D4AF37',
    },
    actions: {
        flexDirection: 'row',
        marginTop: Tokens.spacing.xl,
        paddingTop: Tokens.spacing.lg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        gap: Tokens.spacing.md,
    },
    backBtnWrap: {
        flex: 1,
        minWidth: 0,
    },
    nextBtnWrap: {
        flex: 1.4,
        minWidth: 0,
    },
});
