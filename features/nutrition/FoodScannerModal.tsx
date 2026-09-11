import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView, Modal, Switch, Dimensions, TextInput } from 'react-native';
import { Text } from '@/components/Themed';
import * as ImagePicker from 'expo-image-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { Tokens } from '@/constants/Tokens';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { FoodItem, MealType } from '@/types/nutrition';
import { fetchLiveMenu } from '@/features/nutrition/NutrisliceService';
import { calculateMultiplier, getAvailableUnits, UNITS } from '@/features/nutrition/NutritionUtils';
import { SmartSegmentedControl } from '@/components/ui/SegmentedControl';
import { VisualSystem } from '@/constants/VisualSystem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FoodScannerModalProps {
    visible: boolean;
    onClose: () => void;
    onAddItem: (item: FoodItem, quantity: number, amount: number, unit: string, meal: MealType) => void;
    currentMeal: MealType;
}

export function FoodScannerModal({ visible, onClose, onAddItem, currentMeal }: FoodScannerModalProps) {
    const [image, setImage] = useState<string | null>(null);
    const [imageMetadata, setImageMetadata] = useState<{ base64?: string }>({});
    const [userDescription, setUserDescription] = useState('');
    const [scanning, setScanning] = useState(false);
    const [isDiningHall, setIsDiningHall] = useState(true);
    const [selectedLocation, setSelectedLocation] = useState<'North' | 'South'>('North');
    const [identifiedItem, setIdentifiedItem] = useState<FoodItem | null>(null);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [amountStr, setAmountStr] = useState('1');
    const [logUnit, setLogUnit] = useState('serving');

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
            setImageMetadata({ base64: result.assets[0].base64 || undefined });
            setIdentifiedItem(null); 
        }
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission", "Camera access is needed to scan food.");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
            setImageMetadata({ base64: result.assets[0].base64 || undefined });
            setIdentifiedItem(null);
        }
    };

    const analyzeImage = async () => {
        if (!imageMetadata.base64) return;
        
        setScanning(true);
        setIdentifiedItem(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        
        try {
            const result = await (await import('@/features/nutrition/NutritionAIService')).analyzePlateImage(
                imageMetadata.base64, 
                userDescription
            );

            if (result.items && result.items.length > 0) {
                const item = result.items[0];
                setIdentifiedItem({
                    id: `ai-${Date.now()}`,
                    name: item.name || 'AI Item',
                    calories: item.calories || 0,
                    protein: item.protein || 0,
                    carbs: item.carbs || 0,
                    fat: item.fat || 0,
                    baseUnit: item.baseUnit || 'serving',
                    baseAmount: item.baseAmount || 1
                });
                setAiInsight(result.insight);
                setAmountStr('1');
                setLogUnit(item.baseUnit || 'serving');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Alert.alert("AI Confusion", "Couldn't quite catch that. Try a clearer photo or more description!");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("AI Error", "The Irish magic is offline. Try again shortly!");
        } finally {
            setScanning(false);
        }
    };

    const handleReset = () => {
        setImage(null);
        setImageMetadata({});
        setUserDescription('');
        setIdentifiedItem(null);
        setAiInsight(null);
        setScanning(false);
    };

    const handleConfirm = () => {
        if (!identifiedItem) return;
        const amt = parseFloat(amountStr) || 1;
        const mult = calculateMultiplier(amt, logUnit || identifiedItem.baseUnit || 'serving', identifiedItem.baseAmount || 1, identifiedItem.baseUnit || 'serving');
        onAddItem(identifiedItem, mult, amt, logUnit || identifiedItem.baseUnit || 'serving', currentMeal);
        handleReset();
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>AI Vision Scanner</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <FontAwesome name="times" size={20} color={VisualSystem.colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    {!image ? (
                        <View style={styles.emptyState}>
                            <FontAwesome name="camera-retro" size={60} color={VisualSystem.colors.textTertiary} />
                            <Text style={styles.emptyText}>Place your meal clearly in frame</Text>
                            
                            <TouchableOpacity style={styles.mainActionBtn} onPress={handleTakePhoto}>
                                <LinearGradient colors={[FitVerseTheme.colors.ndGold, '#B8860B']} style={styles.gradientBtn}>
                                    <FontAwesome name="camera" size={18} color="#000" style={{marginRight: 10}} />
                                    <Text style={styles.btnText}>TAKE PHOTO</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.secondaryActionBtn} onPress={handlePickImage}>
                                <Text style={styles.secondaryBtnText}>CHOOSE FROM GALLERY</Text>
                            </TouchableOpacity>

                            <View style={styles.optionRow}>
                                <View style={{flex: 1}}>
                                    <Text style={styles.optionLabel}>DINING HALL MODE</Text>
                                    <Text style={styles.optionSub}>Search live ND menus</Text>
                                </View>
                                <Switch 
                                    value={isDiningHall} 
                                    onValueChange={setIsDiningHall}
                                    trackColor={{ false: "#333", true: FitVerseTheme.colors.ndGold }}
                                    thumbColor={isDiningHall ? "#fff" : "#666"}
                                />
                            </View>

                            {isDiningHall && (
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
                            )}
                        </View>
                    ) : (
                        <View style={styles.content}>
                            <View style={styles.imageCard}>
                                <Image source={{ uri: image }} style={styles.previewImage} />
                                {scanning && (
                                    <View style={styles.scanOverlay}>
                                        <ActivityIndicator color={FitVerseTheme.colors.ndGold} size="large" />
                                        <Text style={styles.scanLabel}>Analzying Dish...</Text>
                                    </View>
                                )}
                            </View>

                            {aiInsight && identifiedItem && (
                                <View style={styles.aiInsightBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                        <FontAwesome name="magic" size={10} color={FitVerseTheme.colors.ndGold} />
                                        <Text style={styles.aiInsightTitle}> AI INSIGHT</Text>
                                    </View>
                                    <Text style={styles.aiInsightText}>{aiInsight}</Text>
                                </View>
                            )}

                            {identifiedItem && (
                                <View style={styles.resultCard}>
                                    <View style={styles.resultHeader}>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.resultLabel}>AI IDENTIFIED AS:</Text>
                                            <Text style={styles.itemName}>{identifiedItem.name}</Text>
                                            <Text style={styles.itemLoc}>{identifiedItem.category || 'General'} @ {selectedLocation} Hall</Text>
                                        </View>
                                        <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                                            <FontAwesome name="refresh" size={12} color={FitVerseTheme.colors.ndGold} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.macroStats}>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statVal}>{identifiedItem.calories}</Text>
                                            <Text style={styles.statLabel}>CALORIES</Text>
                                        </View>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statVal}>{identifiedItem.protein}g</Text>
                                            <Text style={styles.statLabel}>PROTEIN</Text>
                                        </View>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statVal}>{identifiedItem.carbs}g</Text>
                                            <Text style={styles.statLabel}>CARBS</Text>
                                        </View>
                                    </View>

                                    <View style={styles.quantitySection}>
                                        <View style={styles.qtyLabelRow}>
                                            <Text style={styles.qtyLabel}>ESTIMATED QUANTITY</Text>
                                            <View style={styles.qtyInputBox}>
                                                <TextInput 
                                                    value={amountStr} 
                                                    onChangeText={setAmountStr}
                                                    keyboardType="decimal-pad"
                                                    style={styles.textInputNative}
                                                    placeholderTextColor={VisualSystem.colors.textTertiary}
                                                />
                                            </View>
                                        </View>
                                        
                                        <Text style={[styles.qtyLabel, { marginTop: 22, marginBottom: 12 }]}>SELECT SERVING UNIT</Text>
                                        <SmartSegmentedControl 
                                            options={getAvailableUnits(identifiedItem.baseUnit)}
                                            value={logUnit}
                                            onSelect={setLogUnit}
                                        />
                                    </View>

                                    <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                                        <LinearGradient colors={[FitVerseTheme.colors.ndGold, '#B8860B']} style={styles.gradientBtn}>
                                            <Text style={styles.btnText}>LOG TO {currentMeal.toUpperCase()}</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {!identifiedItem && !scanning && (
                                <View style={{ gap: 20 }}>
                                    <View style={styles.descriptionSection}>
                                        <Text style={styles.resultLabel}>OPTIONAL: DESCRIBE THE PORTIONS</Text>
                                        <View style={styles.descriptionInputBox}>
                                            <TextInput 
                                                value={userDescription}
                                                onChangeText={setUserDescription}
                                                placeholder="e.g. 'one scoop of brown rice and a grilled chicken breast'"
                                                placeholderTextColor={VisualSystem.colors.textTertiary}
                                                style={styles.descriptionInput}
                                                multiline
                                            />
                                        </View>
                                    </View>

                                    <TouchableOpacity style={styles.confirmBtn} onPress={analyzeImage}>
                                        <LinearGradient colors={[FitVerseTheme.colors.ndGold, '#B8860B']} style={styles.gradientBtn}>
                                            <FontAwesome name="magic" size={16} color="#000" style={{ marginRight: 10 }} />
                                            <Text style={styles.btnText}>ANALYZE PLATE</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity style={styles.retryBtn} onPress={handleReset}>
                                        <Text style={styles.retryText}>PICK DIFFERENT PHOTO</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: VisualSystem.colors.textPrimary,
        letterSpacing: 1,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: VisualSystem.colors.bgMid,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scroll: {
        paddingBottom: 40,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 30,
    },
    emptyText: {
        color: VisualSystem.colors.textTertiary,
        marginTop: 20,
        marginBottom: 40,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    mainActionBtn: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
        marginBottom: 16,
    },
    gradientBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: {
        fontWeight: '900',
        color: '#000',
        fontSize: 14,
        letterSpacing: 1,
    },
    secondaryActionBtn: {
        paddingVertical: 12,
    },
    secondaryBtnText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 1,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: VisualSystem.colors.bgMid,
        width: '100%',
        padding: 20,
        borderRadius: 20,
        marginTop: 40,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    optionLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: VisualSystem.colors.textPrimary,
        letterSpacing: 1,
        marginBottom: 4,
    },
    optionSub: {
        fontSize: 12,
        color: VisualSystem.colors.textTertiary,
    },
    locTabs: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 12,
    },
    locTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    locTabOn: {
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderColor: FitVerseTheme.colors.ndGold,
    },
    locTabText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: VisualSystem.colors.textTertiary,
        letterSpacing: 1,
    },
    locTabTextOn: {
        color: VisualSystem.colors.goldText,
    },
    content: {
        padding: 20,
    },
    imageCard: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 30,
        overflow: 'hidden',
        backgroundColor: '#000',
        marginBottom: 24,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    scanOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: VisualSystem.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanLabel: {
        color: VisualSystem.colors.goldText,
        fontWeight: '900',
        letterSpacing: 1,
        marginTop: 16,
    },
    resultCard: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    resultLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: VisualSystem.colors.goldText,
        letterSpacing: 1,
        marginBottom: 8,
    },
    itemName: {
        fontSize: 22,
        fontWeight: '900',
        color: VisualSystem.colors.textPrimary,
    },
    itemLoc: {
        fontSize: 12,
        color: VisualSystem.colors.textTertiary,
        marginTop: 4,
    },
    resetBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    macroStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: VisualSystem.colors.bgMid,
        padding: 12,
        borderRadius: 16,
        marginHorizontal: 4,
    },
    statVal: {
        fontSize: 18,
        fontWeight: '900',
        color: VisualSystem.colors.textPrimary,
    },
    statLabel: {
        fontSize: 8,
        fontWeight: '700',
        color: VisualSystem.colors.textTertiary,
        marginTop: 4,
    },
    quantitySection: {
        marginBottom: 30,
    },
    qtyLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    qtyLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: VisualSystem.colors.textSecondary,
        letterSpacing: 1,
    },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    qtyInputBox: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        paddingHorizontal: 16,
        height: 50,
        width: 100,
        justifyContent: 'center',
    },
    textInputNative: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    unitText: {
        marginLeft: 16,
        fontSize: 16,
        fontWeight: 'bold',
        color: VisualSystem.colors.textPrimary,
    },
    confirmBtn: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
    },
    retryBtn: {
        alignItems: 'center',
        padding: 20,
    },
    retryText: {
        fontSize: 11,
        fontWeight: '900',
        color: VisualSystem.colors.goldText,
        letterSpacing: 1,
    },
    descriptionSection: {
        backgroundColor: VisualSystem.colors.bgMid,
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    descriptionInputBox: {
        marginTop: 12,
        minHeight: 80,
    },
    descriptionInput: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
        textAlignVertical: 'top',
    },
    aiInsightBox: {
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    aiInsightTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: VisualSystem.colors.goldText,
        letterSpacing: 1,
    },
    aiInsightText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '500',
        opacity: 0.8,
    }
});
