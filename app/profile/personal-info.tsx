import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity, Alert, Platform, Modal, Pressable, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';

import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { Tokens } from '@/constants/Tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { Gender, Goal, Gym, ActivityLevel, WeeklyGoalRate, TrainingSplit, Dorm, DEFAULT_GYMS } from '@/types/user';
import {
    getAllTrainingLocationNames,
    dormToGymProfileName,
    resolveTrainingLocation,
} from '@/lib/gymContext';
import { calculateAge } from '@/features/utils/DateUtils';
import { calculateTargets } from '@/lib/nutrition';
import { formatPhoneNumber } from '@/features/utils/FormattingUtils';
import { uploadProfileAvatar } from '@/features/profile/uploadProfileAvatar';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import type { ImagePickerAsset } from 'expo-image-picker';
import { VisualSystem } from '@/constants/VisualSystem';

const WEEKLY_GOAL_LABELS: Record<string, string> = {
    "lose_1_5_lb_per_week": "Lose 1.5 lbs / week",
    "lose_1_0_lb_per_week": "Lose 1.0 lbs / week",
    "lose_0_5_lb_per_week": "Lose 0.5 lbs / week",
    "maintain": "Maintain weight",
    "gain_0_5_lb_per_week": "Gain 0.5 lbs / week",
    "gain_1_0_lb_per_week": "Gain 1.0 lbs / week",
};

export default function PersonalInfoScreen() {
    const insets = useSafeAreaInsets();
    const { user, updateProfile } = useAuth();

    if (!user) return null;

    // Local state for editing
    const [name, setName] = useState(user?.displayName || user?.name || '');
    const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);
    const [gender, setGender] = useState<Gender>(user?.gender || Gender.MALE);
    const [dob, setDob] = useState(user?.dob || '');
    const [heightCm, setHeightCm] = useState(user?.heightCm || 170);
    const [weightKg, setWeightKg] = useState(user?.weightKg || 70);
    const [goal, setGoal] = useState<Goal>(user?.goal || Goal.MAINTAIN);
    const [weeklyGoalRate, setWeeklyGoalRate] = useState<WeeklyGoalRate>(user?.weeklyGoalRate || WeeklyGoalRate.MAINTAIN);
    const [activityLevel, setActivityLevel] = useState<ActivityLevel>(user?.activityLevel || ActivityLevel.MODERATE);
    const [defaultGym, setDefaultGym] = useState<Gym>(user?.defaultGym || DEFAULT_GYMS.DUNCAN);
    const [phone, setPhone] = useState(formatPhoneNumber(user?.phone || ''));
    const [age, setAge] = useState<string>(user?.age ? user.age.toString() : '');
    const [trainingSplit, setTrainingSplit] = useState<TrainingSplit>(user?.trainingSplit || TrainingSplit.PPL);
    const [dorm, setDorm] = useState<Dorm>(user?.dorm || Dorm.SORIN);
    const [saving, setSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    // Height ft/in state
    const [heightFt, setHeightFt] = useState(Math.floor((user?.heightCm || 170) / 2.54 / 12));
    const [heightIn, setHeightIn] = useState(Math.round(((user?.heightCm || 170) / 2.54) % 12));

    // Weight lbs state
    const [weightLbs, setWeightLbs] = useState(Math.round((user?.weightKg || 70) * 2.20462));

    const isLbs = user?.weightUnitLbs !== false;
    const [isEditingDob, setIsEditingDob] = useState(false);
    const [editingPicker, setEditingPicker] = useState<'gender' | 'goal' | 'gym' | 'activityLevel' | 'weeklyGoalRate' | 'trainingSplit' | 'dorm' | null>(null);
    const [dobYear, setDobYear] = useState(user && user.dob ? user.dob.split('-')[0] : '2000');
    const [dobMonth, setDobMonth] = useState(user && user.dob ? user.dob.split('-')[1] : '01');
    const [dobDay, setDobDay] = useState(user && user.dob ? user.dob.split('-')[2] : '01');

    useEffect(() => {
        if (user) {
            setName(user.displayName || user.name || '');
            setAvatar(user.avatar || null);
            setGender(user.gender || Gender.MALE);
            setDob(user.dob || '');
            setHeightCm(user.heightCm || 170);
            setWeightKg(user.weightKg || 70);
            setHeightFt(Math.floor((user.heightCm || 170) / 2.54 / 12));
            setHeightIn(Math.round(((user.heightCm || 170) / 2.54) % 12));
            setWeightLbs(Math.round((user.weightKg || 70) * 2.20462));
            setGoal(user.goal || Goal.MAINTAIN);
            setWeeklyGoalRate(user.weeklyGoalRate || WeeklyGoalRate.MAINTAIN);
            setActivityLevel(user.activityLevel || ActivityLevel.MODERATE);
            setDefaultGym(resolveTrainingLocation(user));
            setPhone(formatPhoneNumber(user.phone || ''));
            setAge(user.age ? user.age.toString() : '');
            setTrainingSplit(user.trainingSplit || TrainingSplit.PPL);
            setDorm(user.dorm || Dorm.SORIN);

            if (user.dob) {
                const parts = user.dob.split('-');
                setDobYear(parts[0]);
                setDobMonth(parts[1]);
                setDobDay(parts[2]);
            }
        }
    }, [user]);

    const triggerHaptic = (type: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
        Haptics.impactAsync(type);
    };

    const savePickedAvatar = async (asset: ImagePickerAsset) => {
        if (!user) return;
        const localUri = asset.base64
            ? `data:image/jpeg;base64,${asset.base64}`
            : asset.uri;

        setAvatar(localUri);
        setAvatarUploading(true);
        try {
            const publicUrl = await uploadProfileAvatar(user.id, localUri);
            setAvatar(publicUrl);
            await updateProfile({ avatar: publicUrl });
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Photo updated', 'Your profile picture is saved.');
        } catch (error) {
            console.error('[Profile] avatar upload failed:', error);
            setAvatar(user.avatar || null);
            Alert.alert('Upload failed', 'Could not save your photo. Check your connection and try again.');
        } finally {
            setAvatarUploading(false);
        }
    };

    const pickImage = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
            base64: true,
        });

        if (!result.canceled) {
            await savePickedAvatar(result.assets[0]);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'We need camera access to take a profile photo.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
            base64: true,
        });

        if (!result.canceled) {
            await savePickedAvatar(result.assets[0]);
        }
    };

    const handleAvatarPress = () => {
        Alert.alert(
            "Profile Photo",
            "How would you like to update your avatar?",
            [
                { text: "Take Photo", onPress: takePhoto },
                { text: "Choose from Library", onPress: pickImage },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("Error", "Name cannot be empty.");
            return;
        }

        setSaving(true);
        try {
            const updates: any = {
                displayName: name.trim(),
                avatar,
                gender,
                heightCm,
                weightKg,
                goal,
                trainingSplit,
                defaultGym,
                phone: phone.replace(/\D/g, ''),
                dorm,
                activityLevel,
                weeklyGoalRate,
            };

            const ageNum = parseInt(age) || 20;
            updates.age = ageNum;

            if (dob) {
                updates.dob = dob;
            }

            const calculated = calculateTargets(
                gender,
                weightKg,
                heightCm,
                ageNum,
                activityLevel,
                goal,
                weeklyGoalRate
            );

            updates.calorieTarget = calculated.calories;
            updates.proteinTarget = calculated.protein;
            updates.carbTarget = calculated.carbs;
            updates.fatTarget = calculated.fat;

            await updateProfile(updates);
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert("Success", "Profile details updated!");
            router.back();
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    const updateHeightFromFtIn = (ft: number, inch: number) => {
        const cm = Math.round((ft * 12 + inch) * 2.54);
        setHeightCm(cm);
    };

    const updateWeightFromLbs = (lbs: number) => {
        const kg = Math.round(lbs / 2.20462 * 10) / 10;
        setWeightKg(kg);
    };

    const handleDobConfirm = () => {
        const newDob = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
        setDob(newDob);
        const newAge = calculateAge(newDob).toString();
        setAge(newAge);
        setIsEditingDob(false);
    };

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <FontAwesome name="chevron-left" size={18} color={FitVerseTheme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>PERSONAL INFO</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerSaveBtn}>
                <Text style={[styles.headerSaveText, saving && { opacity: 0.5 }]}>DONE</Text>
            </TouchableOpacity>
        </View>
    );

    const years = Array.from({ length: 100 }, (_, i) => (new Date().getFullYear() - i).toString());
    const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            {renderHeader()}
            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>

                <LinearGradient
                    colors={['rgba(212, 175, 55, 0.15)', 'rgba(0,0,0,0)']}
                    style={styles.heroSummary}
                >
                    <TouchableOpacity
                        style={styles.avatarLarge}
                        onPress={handleAvatarPress}
                        disabled={avatarUploading}
                    >
                        <ProfileAvatar uri={avatar} name={name} size={100} />
                        {avatarUploading && (
                            <View style={styles.avatarUploadingOverlay}>
                                <ActivityIndicator color={VisualSystem.colors.gold} />
                            </View>
                        )}
                        <View style={styles.avatarEditBadge}>
                            <FontAwesome name="camera" size={10} color={FitVerseTheme.colors.ndNavy} />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.heroName}>{name || 'Athlete'}</Text>
                    <Text style={styles.heroSubline}>
                        Member since {user && user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'March 2026'}
                    </Text>
                </LinearGradient>

                <Text style={styles.sectionTitle}>BASIC PROFILE</Text>
                <View style={styles.sectionContainer}>
                    <View style={styles.inputRow}>
                        <View style={styles.iconContainer}>
                            <FontAwesome name="user" size={14} color={FitVerseTheme.colors.accentGold} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowLabelSmall}>DISPLAY NAME</Text>
                            <TextInput
                                style={styles.textInput}
                                value={name}
                                onChangeText={setName}
                                placeholder="Full Name"
                                placeholderTextColor={FitVerseTheme.colors.textMuted}
                            />
                        </View>
                    </View>
                    <View style={styles.inputRow}>
                        <View style={styles.iconContainer}>
                            <FontAwesome name="phone" size={14} color={FitVerseTheme.colors.accentGold} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowLabelSmall}>PHONE NUMBER</Text>
                            <TextInput
                                style={styles.textInput}
                                value={phone}
                                onChangeText={(text) => setPhone(formatPhoneNumber(text))}
                                placeholder="(555) 123-4567"
                                placeholderTextColor={FitVerseTheme.colors.textMuted}
                                keyboardType="phone-pad"
                                maxLength={14}
                            />
                        </View>
                    </View>
                    <View style={styles.divider} />

                    <View style={styles.inputRow}>
                        <View style={styles.iconContainer}>
                            <FontAwesome name="calendar-o" size={14} color={FitVerseTheme.colors.accentGold} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowLabelSmall}>AGE</Text>
                            <TextInput
                                style={styles.textInput}
                                value={age}
                                onChangeText={setAge}
                                placeholder="Years"
                                placeholderTextColor={FitVerseTheme.colors.textMuted}
                                keyboardType="number-pad"
                                maxLength={3}
                            />
                        </View>
                    </View>
                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.inputRow} onPress={() => setIsEditingDob(true)}>
                        <View style={styles.iconContainer}>
                            <FontAwesome name="birthday-cake" size={14} color={FitVerseTheme.colors.accentGold} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowLabelSmall}>DATE OF BIRTH</Text>
                            <Text style={styles.inputText}>{dob ? new Date(dob).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Set Birthday'}</Text>
                        </View>
                        <FontAwesome name="chevron-right" size={12} color={FitVerseTheme.colors.textMuted} />
                    </TouchableOpacity>
                    <View style={styles.divider} />

                    {Platform.OS === 'ios' ? (
                        <TouchableOpacity style={styles.inputRow} onPress={() => setEditingPicker('gender')}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="venus-mars" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>GENDER</Text>
                                <Text style={styles.inputText}>{gender}</Text>
                            </View>
                            <FontAwesome name="chevron-right" size={12} color={FitVerseTheme.colors.textMuted} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pickerRow}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="venus-mars" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>GENDER</Text>
                                <Picker
                                    selectedValue={gender}
                                    onValueChange={(itemValue) => setGender(itemValue)}
                                    style={styles.picker}
                                    dropdownIconColor={FitVerseTheme.colors.textMuted}
                                >
                                    <Picker.Item label="Male" value={Gender.MALE} />
                                    <Picker.Item label="Female" value={Gender.FEMALE} />
                                </Picker>
                            </View>
                        </View>
                    )}
                    <View style={styles.divider} />

                    {Platform.OS === 'ios' ? (
                        <TouchableOpacity style={styles.inputRow} onPress={() => setEditingPicker('dorm')}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="building" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>CURRENT DORM</Text>
                                <Text style={styles.inputText}>{dorm}</Text>
                            </View>
                            <FontAwesome name="chevron-right" size={12} color={FitVerseTheme.colors.textMuted} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pickerRow}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="building" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>CURRENT DORM</Text>
                                <Picker
                                    selectedValue={dorm}
                                    onValueChange={(itemValue) => setDorm(itemValue)}
                                    style={styles.picker}
                                    dropdownIconColor={FitVerseTheme.colors.textMuted}
                                >
                                    {Object.values(Dorm).map(d => (
                                        <Picker.Item key={d} label={d} value={d} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    )}
                    <View style={styles.divider} />

                    {Platform.OS === 'ios' ? (
                        <TouchableOpacity style={styles.inputRow} onPress={() => setEditingPicker('activityLevel')}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="flash" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>ACTIVITY LEVEL</Text>
                                <Text style={styles.inputText}>{activityLevel.split(' (')[0]}</Text>
                            </View>
                            <FontAwesome name="chevron-right" size={12} color={FitVerseTheme.colors.textMuted} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pickerRow}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="flash" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>ACTIVITY LEVEL</Text>
                                <Picker
                                    selectedValue={activityLevel}
                                    onValueChange={(itemValue) => setActivityLevel(itemValue)}
                                    style={styles.picker}
                                    dropdownIconColor={FitVerseTheme.colors.textMuted}
                                >
                                    {Object.values(ActivityLevel).map(a => (
                                        <Picker.Item key={a} label={a} value={a} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    )}
                    <View style={styles.divider} />

                    {Platform.OS === 'ios' ? (
                        <TouchableOpacity style={styles.inputRow} onPress={() => setEditingPicker('weeklyGoalRate')}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="line-chart" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>WEEKLY RATE</Text>
                                <Text style={styles.inputText}>{WEEKLY_GOAL_LABELS[weeklyGoalRate] || weeklyGoalRate}</Text>
                            </View>
                            <FontAwesome name="chevron-right" size={12} color={FitVerseTheme.colors.textMuted} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pickerRow}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="line-chart" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>WEEKLY RATE</Text>
                                <Picker
                                    selectedValue={weeklyGoalRate}
                                    onValueChange={(itemValue) => setWeeklyGoalRate(itemValue)}
                                    style={styles.picker}
                                    dropdownIconColor={FitVerseTheme.colors.textMuted}
                                >
                                    {Object.entries(WEEKLY_GOAL_LABELS).map(([val, label]) => (
                                        <Picker.Item key={val} label={label} value={val} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    )}
                </View>

                <Text style={styles.sectionTitle}>TRAINING FOCUS</Text>
                <View style={styles.sectionContainer}>
                    {Platform.OS === 'ios' ? (
                        <TouchableOpacity style={styles.inputRow} onPress={() => setEditingPicker('trainingSplit')}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="list-alt" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>TRAINING SPLIT</Text>
                                <Text style={styles.inputText}>{trainingSplit}</Text>
                            </View>
                            <FontAwesome name="chevron-right" size={12} color={FitVerseTheme.colors.textMuted} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pickerRow}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="list-alt" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>TRAINING SPLIT</Text>
                                <Picker
                                    selectedValue={trainingSplit}
                                    onValueChange={(itemValue) => setTrainingSplit(itemValue)}
                                    style={styles.picker}
                                    dropdownIconColor={FitVerseTheme.colors.textMuted}
                                >
                                    {Object.values(TrainingSplit).map(s => (
                                        <Picker.Item key={s} label={s} value={s} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    )}
                    <View style={styles.divider} />

                    {Platform.OS === 'ios' ? (
                        <TouchableOpacity style={styles.inputRow} onPress={() => setEditingPicker('goal')}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="bullseye" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>FITNESS GOAL</Text>
                                <Text style={styles.inputText}>{goal}</Text>
                            </View>
                            <FontAwesome name="chevron-right" size={12} color={FitVerseTheme.colors.textMuted} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pickerRow}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="bullseye" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>FITNESS GOAL</Text>
                                <Picker
                                    selectedValue={goal}
                                    onValueChange={(itemValue) => setGoal(itemValue)}
                                    style={styles.picker}
                                    dropdownIconColor={FitVerseTheme.colors.textMuted}
                                >
                                    {Object.values(Goal).map(g => (
                                        <Picker.Item key={g} label={g} value={g} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    )}
                    <View style={styles.divider} />

                    {Platform.OS === 'ios' ? (
                        <TouchableOpacity style={styles.inputRow} onPress={() => setEditingPicker('gym')}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="building-o" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>PREFERRED GYM</Text>
                                <Text style={styles.inputText}>{defaultGym}</Text>
                            </View>
                            <FontAwesome name="chevron-right" size={12} color={FitVerseTheme.colors.textMuted} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pickerRow}>
                            <View style={styles.iconContainer}>
                                <FontAwesome name="building-o" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabelSmall}>PREFERRED GYM</Text>
                                <Picker
                                    selectedValue={defaultGym}
                                    onValueChange={(itemValue) => setDefaultGym(itemValue)}
                                    style={styles.picker}
                                    dropdownIconColor={FitVerseTheme.colors.textMuted}
                                >
                                    {getAllTrainingLocationNames().map((g) => (
                                        <Picker.Item key={g} label={g} value={g} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                    )}
                </View>

                <Text style={styles.sectionTitle}>ATHLETIC MEASUREMENTS</Text>
                <View style={styles.biometricsGrid}>
                    <View style={styles.bioCard}>
                        <View style={styles.bioHeader}>
                            <View style={styles.bioIconCircle}>
                                <FontAwesome name="arrows-v" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <Text style={styles.bioLabel}>HEIGHT</Text>
                        </View>
                        <View style={styles.bioInputGroup}>
                            <TextInput
                                style={styles.bioValue}
                                keyboardType="numeric"
                                value={heightFt.toString()}
                                onChangeText={(val) => {
                                    const ft = parseInt(val) || 0;
                                    setHeightFt(ft);
                                    updateHeightFromFtIn(ft, heightIn);
                                }}
                            />
                            <Text style={styles.bioUnit}>ft</Text>
                            <TextInput
                                style={styles.bioValue}
                                keyboardType="numeric"
                                value={heightIn.toString()}
                                onChangeText={(val) => {
                                    const inch = parseInt(val) || 0;
                                    setHeightIn(inch);
                                    updateHeightFromFtIn(heightFt, inch);
                                }}
                            />
                            <Text style={styles.bioUnit}>in</Text>
                        </View>
                        <View style={styles.bioStatusLine}>
                            <View style={[styles.bioStatusDot, { backgroundColor: FitVerseTheme.colors.accentGold }]} />
                            <Text style={styles.bioStatusText}>{heightCm} cm</Text>
                        </View>
                    </View>

                    <View style={styles.bioCard}>
                        <View style={styles.bioHeader}>
                            <View style={styles.bioIconCircle}>
                                <FontAwesome name="balance-scale" size={14} color={FitVerseTheme.colors.accentGold} />
                            </View>
                            <Text style={styles.bioLabel}>WEIGHT</Text>
                        </View>
                        <View style={styles.bioInputGroup}>
                            <TextInput
                                style={styles.bioValueLarge}
                                keyboardType="numeric"
                                value={isLbs ? weightLbs.toString() : weightKg.toString()}
                                onChangeText={(val) => {
                                    const num = parseFloat(val) || 0;
                                    if (isLbs) {
                                        setWeightLbs(num);
                                        updateWeightFromLbs(num);
                                    } else {
                                        setWeightKg(num);
                                        setWeightLbs(Math.round(num * 2.20462));
                                    }
                                }}
                            />
                            <Text style={styles.bioUnit}>{isLbs ? 'lbs' : 'kg'}</Text>
                        </View>
                        <View style={styles.bioStatusLine}>
                            <View style={[styles.bioStatusDot, { backgroundColor: FitVerseTheme.colors.accentGold }]} />
                            <Text style={styles.bioStatusText}>Sync with Health</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.infoBoxPremium}>
                    <LinearGradient colors={['rgba(212, 175, 55, 0.15)', 'rgba(0,0,0,0)']} style={styles.infoGradient}>
                        <FontAwesome name="info-circle" size={16} color={FitVerseTheme.colors.accentGold} style={{ marginRight: 12, marginTop: 2 }} />
                        <Text style={styles.infoTextPremium}>
                            Your biometrics are used to calibrate your performance targets. Keep them updated for the most accurate training insights.
                        </Text>
                    </LinearGradient>
                </View>

            </ScrollView>

            <Modal visible={isEditingDob} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderLine} />
                        <Text style={styles.modalTitle}>Set Birthday</Text>
                        <View style={styles.dobPickers}>
                            <Picker
                                selectedValue={dobYear}
                                onValueChange={setDobYear}
                                style={styles.dobPicker}
                                itemStyle={styles.pickerItem}
                            >
                                {years.map(y => <Picker.Item key={y} label={y} value={y} color={VisualSystem.colors.textPrimary} />)}
                            </Picker>
                            <Picker
                                selectedValue={dobMonth}
                                onValueChange={setDobMonth}
                                style={styles.dobPicker}
                                itemStyle={styles.pickerItem}
                            >
                                {months.map(m => <Picker.Item key={m} label={m} value={m} color={VisualSystem.colors.textPrimary} />)}
                            </Picker>
                            <Picker
                                selectedValue={dobDay}
                                onValueChange={setDobDay}
                                style={styles.dobPicker}
                                itemStyle={styles.pickerItem}
                            >
                                {days.map(d => <Picker.Item key={d} label={d} value={d} color={VisualSystem.colors.textPrimary} />)}
                            </Picker>
                        </View>
                        <TouchableOpacity style={styles.dobConfirmBtn} onPress={handleDobConfirm}>
                            <LinearGradient colors={['#D4AF37', '#B8860B']} style={styles.gradientBtn}>
                                <Text style={styles.dobConfirmText}>DONE</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dobCancelBtn} onPress={() => setIsEditingDob(false)}>
                            <Text style={styles.dobCancelText}>CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={editingPicker !== null} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderLine} />
                        <Text style={styles.modalTitle}>
                            {editingPicker === 'gender' ? 'Select Gender' :
                                editingPicker === 'goal' ? 'Select Fitness Goal' :
                                    editingPicker === 'activityLevel' ? 'Select Activity Level' :
                                        editingPicker === 'weeklyGoalRate' ? 'Select Weekly Rate' :
                                        editingPicker === 'trainingSplit' ? 'Select Training Split' :
                                        editingPicker === 'dorm' ? 'Select Your Dorm' :
                                            editingPicker === 'gym' ? 'Select Preferred Gym' : ''}
                        </Text>
                        <View style={{ height: 180, justifyContent: 'center' }}>
                            {editingPicker === 'gender' && (
                                <Picker selectedValue={gender} onValueChange={setGender} itemStyle={styles.pickerItem}>
                                    <Picker.Item label="Male" value={Gender.MALE} color={VisualSystem.colors.textPrimary} />
                                    <Picker.Item label="Female" value={Gender.FEMALE} color={VisualSystem.colors.textPrimary} />
                                </Picker>
                            )}
                            {editingPicker === 'goal' && (
                                <Picker selectedValue={goal} onValueChange={setGoal} itemStyle={styles.pickerItem}>
                                    {Object.values(Goal).map(g => <Picker.Item key={g} label={g} value={g} color={VisualSystem.colors.textPrimary} />)}
                                </Picker>
                            )}
                            {editingPicker === 'activityLevel' && (
                                <Picker selectedValue={activityLevel} onValueChange={setActivityLevel} itemStyle={styles.pickerItem}>
                                    {Object.values(ActivityLevel).map(a => <Picker.Item key={a} label={a} value={a} color={VisualSystem.colors.textPrimary} />)}
                                </Picker>
                            )}
                            {editingPicker === 'weeklyGoalRate' && (
                                <Picker selectedValue={weeklyGoalRate} onValueChange={setWeeklyGoalRate} itemStyle={styles.pickerItem}>
                                    {Object.entries(WEEKLY_GOAL_LABELS).map(([val, label]) => <Picker.Item key={val} label={label} value={val} color={VisualSystem.colors.textPrimary} />)}
                                </Picker>
                            )}
                            {editingPicker === 'trainingSplit' && (
                                <Picker selectedValue={trainingSplit} onValueChange={setTrainingSplit} itemStyle={styles.pickerItem}>
                                    {Object.values(TrainingSplit).map(s => <Picker.Item key={s} label={s} value={s} color={VisualSystem.colors.textPrimary} />)}
                                </Picker>
                            )}
                             {editingPicker === 'dorm' && (
                                <Picker
                                    selectedValue={dorm}
                                    onValueChange={(val) => {
                                        setDorm(val);
                                        setDefaultGym(dormToGymProfileName(val));
                                    }}
                                    itemStyle={styles.pickerItem}
                                >
                                    {Object.values(Dorm).map((d) => (
                                        <Picker.Item key={d} label={d} value={d} color={VisualSystem.colors.textPrimary} />
                                    ))}
                                </Picker>
                            )}
                            {editingPicker === 'gym' && (
                                <Picker selectedValue={defaultGym} onValueChange={setDefaultGym} itemStyle={styles.pickerItem}>
                                    {getAllTrainingLocationNames().map((g) => (
                                        <Picker.Item key={g} label={g} value={g} color={VisualSystem.colors.textPrimary} />
                                    ))}
                                </Picker>
                            )}
                        </View>
                        <TouchableOpacity style={styles.dobConfirmBtn} onPress={() => setEditingPicker(null)}>
                            <LinearGradient colors={['#D4AF37', '#B8860B']} style={styles.gradientBtn}>
                                <Text style={styles.dobConfirmText}>DONE</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Tokens.spacing.xl,
        paddingBottom: Tokens.spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212, 175, 55, 0.1)',
        backgroundColor: VisualSystem.colors.bgMid,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: Tokens.typography.md,
        fontWeight: '900',
        color: FitVerseTheme.colors.textPrimary,
        letterSpacing: 2,
    },
    headerSaveBtn: {
        paddingHorizontal: Tokens.spacing.md,
        paddingVertical: Tokens.spacing.xs,
    },
    headerSaveText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '900',
        fontSize: Tokens.typography.md,
        letterSpacing: 1,
    },
    scrollContent: {
        // No top padding needed as hero Summary fills it
    },
    heroSummary: {
        alignItems: 'center',
        paddingVertical: Tokens.spacing.xxl,
        marginBottom: Tokens.spacing.lg,
    },
    avatarUploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Tokens.spacing.lg,
        position: 'relative',
        overflow: 'hidden',
    },
    avatarImageLarge: {
        width: '100%',
        height: '100%',
    },
    avatarTextLarge: {
        color: VisualSystem.colors.goldText,
        fontSize: 40,
        fontWeight: 'bold',
    },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: FitVerseTheme.colors.accentGold,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: FitVerseTheme.colors.ndNavy,
    },
    heroName: {
        fontSize: Tokens.typography.xl,
        fontWeight: 'bold',
        color: FitVerseTheme.colors.textPrimary,
    },
    heroSubline: {
        fontSize: Tokens.typography.xs,
        color: FitVerseTheme.colors.textMuted,
        marginTop: 4,
        letterSpacing: 0.5,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: Tokens.spacing.md,
        marginHorizontal: Tokens.spacing.xl,
        color: VisualSystem.colors.goldText,
        opacity: 0.6,
        marginTop: Tokens.spacing.xl,
    },
    sectionContainer: {
        backgroundColor: FitVerseTheme.colors.surface,
        borderRadius: Tokens.radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: FitVerseTheme.colors.border,
        marginHorizontal: Tokens.spacing.xl,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Tokens.spacing.lg,
        paddingHorizontal: Tokens.spacing.lg,
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: Tokens.spacing.lg,
        height: 80, // Allow space for picker on iOS
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: VisualSystem.colors.bgMid,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Tokens.spacing.lg,
    },
    rowLabelSmall: {
        fontSize: 9,
        fontWeight: '900',
        color: FitVerseTheme.colors.textMuted,
        letterSpacing: 1,
        marginBottom: 2,
    },
    textInput: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: Tokens.typography.md,
        fontWeight: '600',
    },
    inputText: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: Tokens.typography.md,
        fontWeight: '600',
    },
    picker: {
        flex: 1,
        color: FitVerseTheme.colors.textPrimary,
        marginLeft: -10, // Adjust for picker padding
    },
    pickerItem: {
        fontSize: Tokens.typography.md,
        color: VisualSystem.colors.textPrimary,
    },
    divider: {
        height: 1,
        backgroundColor: FitVerseTheme.colors.border,
        marginLeft: 76,
    },
    biometricsGrid: {
        flexDirection: 'row',
        paddingHorizontal: Tokens.spacing.xl,
        gap: Tokens.spacing.md,
    },
    bioCard: {
        flex: 1,
        backgroundColor: FitVerseTheme.colors.surface,
        borderRadius: Tokens.radius.lg,
        padding: Tokens.spacing.lg,
        borderWidth: 1,
        borderColor: FitVerseTheme.colors.border,
    },
    bioHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Tokens.spacing.lg,
    },
    bioIconCircle: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: 'rgba(124, 255, 107, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    bioLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: FitVerseTheme.colors.textMuted,
        letterSpacing: 1,
    },
    bioInputGroup: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: Tokens.spacing.md,
    },
    bioValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: FitVerseTheme.colors.textPrimary,
        padding: 0,
        minWidth: 30,
    },
    bioValueLarge: {
        fontSize: 24,
        fontWeight: 'bold',
        color: FitVerseTheme.colors.textPrimary,
        padding: 0,
        minWidth: 50,
    },
    bioUnit: {
        fontSize: Tokens.typography.sm,
        color: FitVerseTheme.colors.textMuted,
        marginLeft: 4,
        marginRight: 8,
        fontWeight: '600',
    },
    bioStatusLine: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bioStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    bioStatusText: {
        fontSize: 9,
        color: FitVerseTheme.colors.textMuted,
        fontWeight: '600',
    },
    infoBoxPremium: {
        marginHorizontal: Tokens.spacing.xl,
        marginTop: Tokens.spacing.xxl,
        borderRadius: Tokens.radius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    infoGradient: {
        flexDirection: 'row',
        padding: Tokens.spacing.lg,
    },
    infoTextPremium: {
        flex: 1,
        color: FitVerseTheme.colors.textMuted,
        fontSize: Tokens.typography.xs,
        lineHeight: 18,
        fontStyle: 'italic',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderTopLeftRadius: Tokens.radius.lg,
        borderTopRightRadius: Tokens.radius.lg,
        padding: Tokens.spacing.xl,
        paddingBottom: 40,
        borderTopWidth: 1,
        borderTopColor: 'rgba(212, 175, 55, 0.3)',
    },
    modalHeaderLine: {
        width: 40,
        height: 4,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: Tokens.spacing.xl,
    },
    modalTitle: {
        fontSize: Tokens.typography.lg,
        fontWeight: '900',
        color: FitVerseTheme.colors.textPrimary,
        textAlign: 'center',
        letterSpacing: 2,
        marginBottom: Tokens.spacing.xl,
    },
    dobPickers: {
        flexDirection: 'row',
        justifyContent: 'center',
        height: 180,
    },
    dobPicker: {
        flex: 1,
    },
    dobConfirmBtn: {
        marginTop: Tokens.spacing.xl,
        borderRadius: Tokens.radius.md,
        overflow: 'hidden',
    },
    gradientBtn: {
        paddingVertical: Tokens.spacing.lg,
        alignItems: 'center',
    },
    dobConfirmText: {
        color: FitVerseTheme.colors.ndNavy,
        fontWeight: '900',
        fontSize: Tokens.typography.md,
        letterSpacing: 1,
    },
    dobCancelBtn: {
        paddingVertical: Tokens.spacing.lg,
        alignItems: 'center',
    },
    dobCancelText: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: Tokens.typography.sm,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});
