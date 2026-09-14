import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    TextInput,
    Alert,
    Platform,
    ActionSheetIOS,
    useWindowDimensions
} from 'react-native';
import { Text, SecondaryText, GlowView } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { FeedStore } from './FeedStore';
import { useAuth } from '../auth/AuthContext';
import { Post, Comment as SocialComment } from '@/types/social';
import { supabase } from '@/lib/supabase';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { VisualSystem } from '@/constants/VisualSystem';
import { SheetModal } from '@/components/ui/SheetModal';

interface CommentsModalProps {
    visible: boolean;
    postId: string | null;
    onClose: () => void;
    onCommentUpdated: () => void;
}

// Basic list of inappropriate words for client-side moderation
const BAD_WORDS = [
    'badword', 'racist', 'hate', 'stupid', 'idiot', 'ugly', 'fat',
    // Add more actual bad words here as needed for demonstration
];

export function CommentsModal({ visible, postId, onClose, onCommentUpdated }: CommentsModalProps) {
    const { user } = useAuth();
    const { height: windowHeight } = useWindowDimensions();
    const [comments, setComments] = useState<SocialComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && postId) {
            loadComments();
        }
    }, [visible, postId]);

    const loadComments = async () => {
        if (!postId) return;
        try {
            const { data, error } = await supabase
                .from('comments')
                .select('id, post_id, user_id, text, created_at, profiles(display_name, avatar)')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setComments((data ?? []).map((c: any) => ({
                id: c.id,
                userId: c.user_id,
                userName: c.profiles?.display_name ?? 'User',
                userImage: c.profiles?.avatar ?? undefined,
                text: c.text,
                createdAt: c.created_at,
            } as SocialComment)));
        } catch (e) {
            console.error('CommentsModal.loadComments error:', e);
        }
    };

    const isLocalClean = (text: string) => {
        const lowerText = text.toLowerCase();
        return !BAD_WORDS.some(word => lowerText.includes(word));
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        if (!user || !postId) return;

        if (!isLocalClean(newComment)) {
            Alert.alert(
                "Comment Blocked",
                "Your comment contains inappropriate language. Let's keep the community positive!"
            );
            return;
        }

        setLoading(true);
        try {
            const comment: SocialComment = {
                id: uuidv4(),
                userId: user.id,
                userName: user.displayName || user.name || 'Champion',
                userImage: user.avatar,
                text: newComment.trim(),
                createdAt: new Date().toISOString()
            };

            await FeedStore.addComment(postId, comment);
            setNewComment('');
            await loadComments();
            onCommentUpdated();
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to post comment.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!postId) return;
        Alert.alert(
            "Delete Comment",
            "Are you sure you want to delete this comment?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await FeedStore.deleteComment(postId, commentId);
                        await loadComments();
                        onCommentUpdated();
                    }
                }
            ]
        );
    };

    const showActionSheet = (comment: SocialComment) => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', 'Delete'],
                    destructiveButtonIndex: 1,
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) {
                        handleDeleteComment(comment.id);
                    }
                }
            );
        } else {
            // Android fallback ideally, or just use Alert directly
            handleDeleteComment(comment.id);
        }
    };

    const renderComment = ({ item }: { item: SocialComment }) => {
        const isOwnComment = user && item.userId === user.id;

        return (
            <View style={styles.commentItem}>
                <View style={styles.avatar}>
                    {item.userImage ? (
                        <Text style={styles.avatarText}>{item.userName.charAt(0)}</Text>
                        // ideally we put an image component here if we have a URL, using text as fallback/placeholder for now
                        // <Image source={{ uri: item.userImage }} style={{ width: '100%', height: '100%' }} /> 
                        // But since we store URI in userImage, let's try to verify if it is an image
                    ) : (
                        <Text style={styles.avatarText}>{item.userName.charAt(0)}</Text>
                    )}
                </View>
                <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                        <Text style={styles.commentUser}>{item.userName}</Text>
                        <SecondaryText style={styles.commentTime}>
                            {new Date(item.createdAt).toLocaleDateString()}
                        </SecondaryText>
                    </View>
                    <Text style={styles.commentText}>{item.text}</Text>
                </View>
                {isOwnComment && (
                    <TouchableOpacity onPress={() => showActionSheet(item)} style={styles.moreBtn}>
                        <FontAwesome name="ellipsis-v" size={14} color="#666" />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SheetModal visible={visible} onClose={onClose} bare dismissOnBackdrop={false}>
                <View style={[styles.modalContent, { height: windowHeight * 0.8 }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Comments</Text>
                        <TouchableOpacity accessibilityLabel="Close" onPress={onClose} style={styles.closeBtn}>
                            <FontAwesome name="times" size={20} color="#B0B0B0" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={comments}
                        renderItem={renderComment}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No comments yet.</Text>
                                <SecondaryText>Be the first to say something!</SecondaryText>
                            </View>
                        }
                    />

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Add a comment..."
                            placeholderTextColor={VisualSystem.colors.textTertiary}
                            value={newComment}
                            onChangeText={setNewComment}
                            multiline
                        />
                        <TouchableOpacity hitSlop={4}
                            style={[styles.sendBtn, !newComment.trim() && styles.sendBtnDisabled]}
                            onPress={handleAddComment}
                            disabled={!newComment.trim() || loading}
                        >
                            <FontAwesome name="paper-plane" size={20} color={newComment.trim() ? "#0C2340" : "#666"} />
                        </TouchableOpacity>
                    </View>
                </View>
        </SheetModal>
    );
}

const styles = StyleSheet.create({
    modalContent: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
            borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: VisualSystem.colors.borderSubtle,
        position: 'relative'
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
    },
    closeBtn: {
        position: 'absolute',
        right: 20,
        padding: 4
    },
    listContent: {
        padding: 16,
        paddingBottom: 32
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderGold
    },
    avatarText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '700',
        fontSize: 15
    },
    commentContent: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        padding: 8,
        borderRadius: 10,
        borderTopLeftRadius: 0,
    },
    commentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
        alignItems: 'center'
    },
    commentUser: {
        color: VisualSystem.colors.goldText,
        fontWeight: '700',
        fontSize: 13
    },
    commentTime: {
        fontSize: 11,
        color: '#888'
    },
    commentText: {
        color: '#E0E0E0',
        fontSize: 13,
        marginTop: 4,
        lineHeight: 20
    },
    moreBtn: {
        marginLeft: 8,
        padding: 4,
        justifyContent: 'center'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 32
    },
    emptyText: {
        color: '#666',
        marginBottom: 4
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 16,
        paddingBottom: 32, // Safe area
        backgroundColor: VisualSystem.colors.bgBase,
        borderTopWidth: 1,
        borderTopColor: VisualSystem.colors.borderSubtle,
        alignItems: 'center'
    },
    input: {
        flex: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 8,
        color: VisualSystem.colors.textPrimary,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    sendBtn: {
        marginLeft: 8,
        width: 40,
        height: 40,
        borderRadius: 22,
        backgroundColor: VisualSystem.colors.gold,
        justifyContent: 'center',
        alignItems: 'center'
    },
    sendBtnDisabled: {
        backgroundColor: '#333'
    }
});
