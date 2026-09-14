import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    Image,
    TextInput,
    Alert,
    ActivityIndicator,
    ScrollView,
    Switch,
} from 'react-native';
import { Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { FeedStore } from './FeedStore';
import { useAuth } from '../auth/AuthContext';
import { Post } from '@/types/social';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { VisualSystem } from '@/constants/VisualSystem';
import { SheetModal } from '@/components/ui/SheetModal';
import * as Haptics from 'expo-haptics';
import { buildWorkoutPostCaption, publishWorkoutPost, WorkoutPostPreview } from './workoutPostUtils';

interface CreatePostModalProps {
    visible: boolean;
    onClose: () => void;
    onPostCreated: () => void;
    initialWorkoutData?: WorkoutPostPreview | null;
}

const C = VisualSystem.colors;

function formatWorkoutDuration(seconds: number): string {
    const mins = Math.max(1, Math.round(seconds / 60));
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function CreatePostModal({ visible, onClose, onPostCreated, initialWorkoutData }: CreatePostModalProps) {
    const { user } = useAuth();
    const [image, setImage] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [shareToCommunity, setShareToCommunity] = useState(false);
    const [loading, setLoading] = useState(false);
    const isWorkoutPost = !!initialWorkoutData;

    React.useEffect(() => {
        if (visible) {
            setShareToCommunity(false);
            if (initialWorkoutData) {
                setCaption(buildWorkoutPostCaption(initialWorkoutData));
            } else {
                setCaption('');
                setImage(null);
            }
        }
    }, [visible, initialWorkoutData]);

    const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
        Haptics.impactAsync(style);
    };

    const pickImage = async () => {
        triggerHaptic();
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
            setImage(uri);
        }
    };

    const takePhoto = async () => {
        triggerHaptic();
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera access is required to add a photo.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
            setImage(uri);
        }
    };

    const handleClose = () => {
        triggerHaptic();
        setImage(null);
        setCaption('');
        setShareToCommunity(false);
        onClose();
    };

    const handlePost = async () => {
        if (!user) return;

        if (!isWorkoutPost && !image) {
            Alert.alert('Add a photo', 'Pick or take a photo to post.');
            return;
        }

        const finalCaption = caption.trim() || (initialWorkoutData ? buildWorkoutPostCaption(initialWorkoutData) : '');
        if (!finalCaption && !image && !isWorkoutPost) {
            Alert.alert('Add a caption', 'Write something for your post.');
            return;
        }

        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            if (isWorkoutPost && initialWorkoutData) {
                await publishWorkoutPost(user, initialWorkoutData, {
                    caption: finalCaption,
                    image: image || undefined,
                    shareToCommunity,
                });
            } else {
                const newPost: Post = {
                    id: uuidv4(),
                    userId: user.id,
                    userName: user.displayName || user.name || 'FitVerse User',
                    userImage: user.avatar,
                    userDorm: user.dorm,
                    type: 'photo',
                    content: {
                        description: finalCaption,
                        image: image || undefined,
                    },
                    likes: [],
                    comments: [],
                    createdAt: new Date().toISOString(),
                    isPublic: shareToCommunity,
                };
                await FeedStore.savePost(newPost);
            }
            onPostCreated();
            handleClose();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to create post.');
        } finally {
            setLoading(false);
        }
    };

    const canPost = isWorkoutPost || !!image;

    return (
        <SheetModal visible={visible} onClose={handleClose}>
            <View style={styles.header}>
                <Pressable accessibilityLabel="Close"
                    onPress={handleClose}
                    style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.6 : 1 }]}
                >
                    <FontAwesome name="times" size={22} color={C.textTertiary} />
                </Pressable>
                <Text style={styles.title}>{isWorkoutPost ? 'Share Workout' : 'New Post'}</Text>
                <Pressable
                    onPress={handlePost}
                    disabled={loading || !canPost}
                    style={({ pressed }) => [
                        styles.postBtnWrap,
                        (!canPost || loading) && { opacity: 0.4 },
                        pressed && canPost && { opacity: 0.7 },
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color={C.gold} />
                    ) : (
                        <Text style={styles.postButton}>Post</Text>
                    )}
                </Pressable>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
            >
                {isWorkoutPost && initialWorkoutData && (
                    <View style={styles.workoutCard}>
                        <View style={styles.workoutCardBadge}>
                            <FontAwesome name="heartbeat" size={11} color={C.gold} />
                            <Text style={styles.workoutCardBadgeText}>Workout preview</Text>
                        </View>
                        <Text style={styles.workoutCardTitle} numberOfLines={2}>
                            {initialWorkoutData.title}
                        </Text>
                        <View style={styles.workoutStatsGrid}>
                            <View style={styles.workoutStatCol}>
                                <Text style={styles.workoutStatNum}>
                                    {formatWorkoutDuration(initialWorkoutData.duration)}
                                </Text>
                                <Text style={styles.workoutStatLbl}>Time</Text>
                            </View>
                            <View style={styles.workoutStatDivider} />
                            <View style={styles.workoutStatCol}>
                                <Text style={styles.workoutStatNum}>{initialWorkoutData.setsCompleted}</Text>
                                <Text style={styles.workoutStatLbl}>Sets</Text>
                            </View>
                            <View style={styles.workoutStatDivider} />
                            <View style={styles.workoutStatCol}>
                                <Text style={styles.workoutStatNum}>
                                    {initialWorkoutData.totalVolume > 0
                                        ? initialWorkoutData.totalVolume.toLocaleString()
                                        : '—'}
                                </Text>
                                <Text style={styles.workoutStatLbl}>lbs</Text>
                            </View>
                        </View>
                        {(initialWorkoutData.milestones?.length ?? 0) > 0 && (
                            <View style={styles.milestoneChips}>
                                {initialWorkoutData.milestones!.map((m, i) => (
                                    <View key={`${m.type}-${i}`} style={styles.milestoneChip}>
                                        <Text style={styles.milestoneChipText}>{m.label}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.photoSection}>
                    <Text style={styles.photoSectionLabel}>
                        {isWorkoutPost ? 'Photo (optional)' : 'Photo'}
                    </Text>
                    {image ? (
                        <View style={styles.previewWrapper}>
                            <Image source={{ uri: image }} style={styles.previewImage} resizeMode="cover" />
                            <Pressable accessibilityLabel="Delete" hitSlop={6}
                                style={({ pressed }) => [styles.removeImageBtn, { opacity: pressed ? 0.8 : 1 }]}
                                onPress={() => {
                                    triggerHaptic();
                                    setImage(null);
                                }}
                            >
                                <FontAwesome name="trash" size={16} color={VisualSystem.colors.textPrimary} />
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.photoActions}>
                            <Pressable
                                style={({ pressed }) => [styles.photoActionBtn, pressed && { opacity: 0.75 }]}
                                onPress={takePhoto}
                            >
                                <FontAwesome name="camera" size={20} color={C.gold} />
                                <Text style={styles.photoActionText}>Camera</Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [styles.photoActionBtn, pressed && { opacity: 0.75 }]}
                                onPress={pickImage}
                            >
                                <FontAwesome name="image" size={20} color={C.gold} />
                                <Text style={styles.photoActionText}>Library</Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                <Text style={styles.captionLabel}>
                    {isWorkoutPost ? 'Caption (optional)' : 'Caption'}
                </Text>
                <TextInput
                    style={styles.input}
                    placeholder={
                        isWorkoutPost
                            ? 'Add a note — stats show on the card automatically'
                            : 'Write a caption…'
                    }
                    placeholderTextColor={C.textTertiary}
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                />

                <View style={styles.shareRow}>
                    <View style={styles.shareRowText}>
                        <Text style={styles.shareRowTitle}>Share to Community</Text>
                        <Text style={styles.shareRowHint}>
                            Off = friends only. On = visible to everyone on campus.
                        </Text>
                    </View>
                    <Switch
                        value={shareToCommunity}
                        onValueChange={(v) => {
                            triggerHaptic();
                            setShareToCommunity(v);
                        }}
                        trackColor={{ false: C.borderSubtle, true: C.goldMuted }}
                        thumbColor={shareToCommunity ? C.gold : '#f4f3f4'}
                    />
                </View>
            </ScrollView>
        </SheetModal>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingBottom: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        color: C.textPrimary,
        letterSpacing: 0.3,
    },
    postBtnWrap: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    postButton: {
        fontSize: 15,
        fontWeight: '800',
        color: C.goldText,
    },
    workoutCard: {
        backgroundColor: C.goldMuted,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.borderGold,
    },
    workoutCardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        marginBottom: 8,
    },
    workoutCardBadgeText: {
        color: C.goldText,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    workoutCardTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: C.textPrimary,
        marginBottom: 12,
        lineHeight: 24,
    },
    workoutStatsGrid: {
        flexDirection: 'row',
        backgroundColor: C.bgElevated,
        borderRadius: 10,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    workoutStatCol: {
        flex: 1,
        alignItems: 'center',
    },
    workoutStatDivider: {
        width: 1,
        backgroundColor: C.borderSubtle,
        marginVertical: 4,
    },
    workoutStatNum: {
        color: C.textPrimary,
        fontSize: 15,
        fontWeight: '800',
    },
    workoutStatLbl: {
        color: C.textTertiary,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
        marginTop: 4,
    },
    milestoneChips: {
        gap: 4,
        marginTop: 12,
    },
    milestoneChip: {
        backgroundColor: C.goldMuted,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: C.borderGold,
    },
    milestoneChipText: {
        color: C.textPrimary,
        fontSize: 11,
        fontWeight: '700',
        lineHeight: 15,
    },
    photoSection: {
        marginBottom: 12,
    },
    photoSectionLabel: {
        color: C.textTertiary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
        marginBottom: 8,
    },
    photoActions: {
        flexDirection: 'row',
        gap: 8,
    },
    photoActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: C.glassFill,
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    photoActionText: {
        color: C.textPrimary,
        fontSize: 13,
        fontWeight: '700',
    },
    previewWrapper: {
        height: 200,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.borderSubtle,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    removeImageBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(180, 55, 55, 0.9)',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    captionLabel: {
        color: C.textTertiary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
        marginBottom: 8,
    },
    input: {
        color: C.textPrimary,
        fontSize: 15,
        minHeight: 100,
        textAlignVertical: 'top',
        padding: 12,
        backgroundColor: C.glassFill,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        marginBottom: 16,
    },
    shareRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: 12,
        backgroundColor: C.glassFill,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderSubtle,
        marginBottom: 24,
    },
    shareRowText: {
        flex: 1,
    },
    shareRowTitle: {
        color: C.textPrimary,
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 4,
    },
    shareRowHint: {
        color: C.textTertiary,
        fontSize: 11,
        lineHeight: 16,
    },
});
