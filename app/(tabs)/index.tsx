import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, View, Text as RNText, Image, RefreshControl, Alert, TextInput, Modal, Pressable, Animated, ImageBackground, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '@/features/auth/AuthContext';
import { FeedStore } from '@/features/feed/FeedStore';
import { CreatePostModal } from '@/features/feed/CreatePostModal';
import { CommentsModal } from '@/features/feed/CommentsModal';
import { Post } from '@/types/social';
import { UserProfile, Dorm } from '@/types/user';
import { SocialStore } from '@/features/social/SocialStore';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DormLogo } from '@/components/DormLogo';
import { Tokens } from '@/constants/Tokens';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { MemberProfileModal } from '@/features/social/MemberProfileModal';
import * as Haptics from 'expo-haptics';
import { safeImpact } from '@/lib/safeHaptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatsListScreen } from '@/features/chat/ChatsListScreen';
import { ChatStore } from '@/features/chat/ChatStore';
import { shouldShowWorkoutPostCaption } from '@/features/feed/workoutPostUtils';
import { webFeedColumn } from '@/constants/webLayout';
import { VisualSystem } from '@/constants/VisualSystem';

type FriendUiStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

function resolveFriendStatus(
    targetUserId: string,
    currentUser: UserProfile,
    localOverrides: Record<string, FriendUiStatus>
): FriendUiStatus {
    if (localOverrides[targetUserId]) return localOverrides[targetUserId];
    if (currentUser.friends?.includes(targetUserId)) return 'friends';
    if (currentUser.friendRequestsSent?.includes(targetUserId)) return 'pending_sent';
    if (currentUser.friendRequestsReceived?.includes(targetUserId)) return 'pending_received';
    return 'none';
}

export default function FeedScreen() {
    const { user, refreshProfile } = useAuth();
    const insets = useSafeAreaInsets();
    const [posts, setPosts] = useState<Post[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const scrollY = useRef(new Animated.Value(0)).current;

    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [isCommentsModalVisible, setCommentsModalVisible] = useState(false);
    const [activePostId, setActivePostId] = useState<string | null>(null);

    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedPostForMenu, setSelectedPostForMenu] = useState<Post | null>(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editDescription, setEditDescription] = useState('');

    const [feedFilter, setFeedFilter] = useState<'community' | 'friends' | 'mine'>('community');
    const [loading, setLoading] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [friendBusyId, setFriendBusyId] = useState<string | null>(null);
    const [localFriendState, setLocalFriendState] = useState<Record<string, FriendUiStatus>>({});

    // Image Preview State
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    // Chat State
    const [chatVisible, setChatVisible] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Poll unread count every 5s
    useEffect(() => {
        const refresh = async () => {
            if (!user) return;
            const count = await ChatStore.getTotalUnread(user.id);
            setUnreadCount(count);
        };
        refresh();
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [user?.id]);

    const loadFeed = useCallback(async (pageNum = 1, shouldAppend = false) => {
        if (!user) return;
        
        const fetchedPosts = await FeedStore.getPosts(
            user.id,
            user.friends || [],
            pageNum,
            20,
            feedFilter
        );

        if (fetchedPosts.length < 20) setHasMore(false);
        else setHasMore(true);

        if (shouldAppend) {
            setPosts(prev => {
                const newPosts = fetchedPosts.filter(np => !prev.some(p => p.id === np.id));
                return [...prev, ...newPosts];
            });
        } else {
            setPosts(fetchedPosts);
            setPage(1);
        }
    }, [user?.id, user?.friends, feedFilter]);

    useEffect(() => {
        setLoading(true);
        loadFeed(1, false).finally(() => setLoading(false));
    }, [feedFilter, loadFeed]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadFeed(1, false).finally(() => setRefreshing(false));
    }, [loadFeed]);

    if (!user) return null;

    const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
        safeImpact(style);
    };

    const openMessages = () => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setChatVisible(true);
    };

    const handleLoadMore = () => {
        if (!refreshing && hasMore) {
            setPage(prev => prev + 1);
            loadFeed(page + 1, true);
        }
    };

    const handleCommunityFriend = async (targetUserId: string) => {
        if (!user || friendBusyId) return;
        const status = resolveFriendStatus(targetUserId, user, localFriendState);
        if (status === 'friends' || status === 'pending_sent') return;

        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        setFriendBusyId(targetUserId);
        try {
            const result =
                status === 'pending_received'
                    ? await SocialStore.acceptFriendRequest(user.id, targetUserId)
                    : await SocialStore.sendFriendRequest(user.id, targetUserId);

            if (!result.ok) {
                Alert.alert('Could not update', result.error || 'Please try again.');
                return;
            }

            setLocalFriendState((prev) => ({
                ...prev,
                [targetUserId]: status === 'pending_received' ? 'friends' : 'pending_sent',
            }));
            await refreshProfile();
        } finally {
            setFriendBusyId(null);
        }
    };


    const handleLike = async (postId: string) => {
        if (!user) return;
        const post = posts.find(p => p.id === postId);
        await FeedStore.likePost(postId, user.id);
        const isAlreadyLiked = post?.likes.includes(user.id);
        if (!isAlreadyLiked && post) {
            Alert.alert("Notification Sent", `You liked ${post.userName}'s post!`);
        }
        loadFeed();
    };

    const openMenu = (post: Post) => {
        setSelectedPostForMenu(post);
        setMenuVisible(true);
    };

    const handleEditStart = () => {
        if (selectedPostForMenu) {
            setEditDescription(selectedPostForMenu.content.description);
            setMenuVisible(false);
            setEditModalVisible(true);
        }
    };

    const handleEditSave = async () => {
        if (selectedPostForMenu) {
            await FeedStore.updatePost(selectedPostForMenu.id, editDescription);
            setEditModalVisible(false);
            setSelectedPostForMenu(null);
            loadFeed();
            Alert.alert("Success", "Post updated!");
        }
    };

    const handleDelete = (postId: string) => {
        setMenuVisible(false);

        Alert.alert(
            "Delete Post",
            "Are you sure you want to delete this post?",
            [
                {
                    text: "Cancel",
                    style: "cancel",
                    onPress: () => setSelectedPostForMenu(null)
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

                            // 1. Optimistic UI update - remove from local state immediately
                            setPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
                            setSelectedPostForMenu(null);

                            // 2. Persistent storage update
                            await FeedStore.deletePost(postId);

                            // No need to call loadFeed() here as setPosts already updated the UI.
                            // This avoids potential flicker or race conditions.
                        } catch (error) {
                            console.error("Delete failed:", error);
                            Alert.alert("Error", "Failed to delete post.");
                            // Re-fetch only if something went wrong to restore state
                            loadFeed(1, false);
                        }
                    }
                }
            ]
        );
    };



    const HEADER_MAX_HEIGHT = Platform.OS === 'web' ? 200 : 280;
    const isWeb = Platform.OS === 'web';
    const HEADER_MIN_HEIGHT = insets.top + 60;
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
        outputRange: [1, 1, 0.8],
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
        outputRange: [1.2, 1, 0.8],
        extrapolate: 'clamp',
    });

    const titleTranslateY = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [0, 5],
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.container}>
            <CreatePostModal
                visible={isCreateModalVisible}
                onClose={() => setCreateModalVisible(false)}
                onPostCreated={loadFeed}
            />

            <CommentsModal
                visible={isCommentsModalVisible}
                postId={activePostId}
                onClose={() => {
                    setCommentsModalVisible(false);
                    setActivePostId(null);
                }}
                onCommentUpdated={loadFeed}
            />

            {/* Post Menu Modal */}
            <Modal
                visible={menuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setMenuVisible(false)}
                >
                    <View style={styles.menuContainer}>
                        <View style={styles.menuHeader}>
                            <RNText style={styles.menuTitle}>Post Options</RNText>
                        </View>

                        <Pressable
                            style={({ pressed }) => [styles.menuOption, { opacity: pressed ? 0.6 : 1 }]}
                            onPress={() => {
                                triggerHaptic();
                                handleEditStart();
                            }}
                        >
                            <FontAwesome name="pencil" size={20} color={FitVerseTheme.colors.accentGold} style={{ width: 30 }} />
                            <RNText style={styles.menuText}>Edit Post</RNText>
                        </Pressable>

                        <View style={styles.menuDivider} />

                        <Pressable
                            style={({ pressed }) => [styles.menuOption, { opacity: pressed ? 0.6 : 1 }]}
                            onPress={() => {
                                if (selectedPostForMenu) {
                                    handleDelete(selectedPostForMenu.id);
                                }
                            }}
                        >
                            <FontAwesome name="trash" size={20} color="#ff4d4d" style={{ width: 30 }} />
                            <RNText style={[styles.menuText, { color: VisualSystem.colors.danger }]}>Delete Post</RNText>
                        </Pressable>

                        <View style={styles.menuDivider} />

                        <Pressable
                            style={({ pressed }) => [styles.menuOption, { justifyContent: 'center', opacity: pressed ? 0.6 : 1 }]}
                            onPress={() => {
                                triggerHaptic();
                                setMenuVisible(false);
                            }}
                        >
                            <RNText style={{ color: FitVerseTheme.colors.textMuted, fontWeight: 'bold' }}>Cancel</RNText>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            {/* Edit Post Modal */}
            <Modal
                visible={editModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.editModalContent}>
                        <RNText style={styles.editModalTitle}>Edit Caption</RNText>
                        <TextInput
                            style={styles.editInput}
                            value={editDescription}
                            onChangeText={setEditDescription}
                            multiline
                            placeholder="Update your caption..."
                            placeholderTextColor={FitVerseTheme.colors.textMuted}
                        />
                        <View style={styles.modalActions}>
                            <Pressable
                                style={({ pressed }) => [styles.modalBtnCancel, { opacity: pressed ? 0.7 : 1 }]}
                                onPress={() => {
                                    triggerHaptic();
                                    setEditModalVisible(false);
                                }}
                            >
                                <RNText style={styles.modalBtnTextCancel}>Cancel</RNText>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [styles.modalBtnSave, { opacity: pressed ? 0.7 : 1 }]}
                                onPress={() => {
                                    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                                    handleEditSave();
                                }}
                            >
                                <RNText style={styles.modalBtnTextSave}>Save</RNText>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Animated Sticky Header */}
            <Animated.View
                pointerEvents="box-none"
                style={[
                    styles.heroContainer,
                    isWeb && styles.heroContainerWeb,
                    {
                        height: headerHeight,
                        transform: [{ translateY: headerTranslateY }],
                        zIndex: 10,
                    }
                ]}
            >
                <Animated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, { transform: [{ translateY: imageTranslateY }], opacity: imageOpacity }]}
                >
                    <ImageBackground
                        // Was a remote Unsplash URL, which left the header blank
                        // whenever the fetch was slow or blocked. Every other hero
                        // uses a bundled asset; this one ships with the app too.
                        source={require('@/assets/images/community_hero_fitverse.png')}
                        style={styles.heroImage}
                    >
                        <LinearGradient
                            colors={['rgba(12, 35, 64, 0.4)', 'rgba(12, 35, 64, 0.8)']}
                            style={StyleSheet.absoluteFill}
                        />
                    </ImageBackground>
                </Animated.View>

                <Animated.View
                    pointerEvents="none"
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

                <View style={[styles.headerContent, { paddingTop: insets.top + 10, zIndex: 20 }]}>
                    <Animated.View style={[styles.headerRow, { transform: [{ scale: titleScale }, { translateY: titleTranslateY }] }]}>
                        <View>
                            <RNText style={[styles.headerTitle, isWeb && styles.headerTitleWeb]}>FITVERSE</RNText>
                            <RNText style={styles.userSubline}>{user!.displayName || user!.name}</RNText>
                        </View>
                        <View style={styles.headerActionsSpace}>
                            <Pressable
                                style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.7 : 1 }]}
                                onPress={() => {
                                    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                                    setCreateModalVisible(true);
                                }}
                            >
                                <FontAwesome name="plus-square" size={Tokens.typography.lg} color={FitVerseTheme.colors.accentGold} />
                            </Pressable>
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={openMessages}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Open messages"
                            >
                                <FontAwesome name="comments" size={Tokens.typography.lg} color={FitVerseTheme.colors.accentGold} />
                                {unreadCount > 0 && (
                                    <View style={styles.chatBadge}>
                                        <RNText style={styles.chatBadgeText}>
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </RNText>
                                    </View>
                                )}
                            </TouchableOpacity>

                        </View>
                    </Animated.View>
                </View>
            </Animated.View>

            <Animated.FlatList
                style={styles.scrollView}
                contentContainerStyle={[
                    { paddingTop: HEADER_MAX_HEIGHT, paddingBottom: isWeb ? 120 : 100 },
                    isWeb && styles.flatListContentWeb,
                ]}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                data={posts}
                keyExtractor={(item: Post) => item.id}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={FitVerseTheme.colors.accentGold}
                        progressViewOffset={HEADER_MAX_HEIGHT}
                    />
                }
                ListHeaderComponent={
                    <View style={[styles.scrollContent, webFeedColumn]}>
                        <View style={{ marginBottom: 20 }}>
                            <View style={styles.filterContainer}>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.filterBtn,
                                        styles.filterBtnFlex,
                                        feedFilter === 'community' && styles.filterBtnActive,
                                        { opacity: pressed ? 0.7 : 1 }
                                    ]}
                                    onPress={() => {
                                        triggerHaptic();
                                        setFeedFilter('community');
                                    }}
                                >
                                    <RNText style={[styles.filterText, feedFilter === 'community' && styles.filterTextActive]}>Community</RNText>
                                </Pressable>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.filterBtn,
                                        styles.filterBtnFlex,
                                        feedFilter === 'friends' && styles.filterBtnActive,
                                        { opacity: pressed ? 0.7 : 1 }
                                    ]}
                                    onPress={() => {
                                        triggerHaptic();
                                        setFeedFilter('friends');
                                    }}
                                >
                                    <RNText style={[styles.filterText, feedFilter === 'friends' && styles.filterTextActive]}>Friends</RNText>
                                </Pressable>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.filterBtn,
                                        styles.filterBtnFlex,
                                        feedFilter === 'mine' && styles.filterBtnActive,
                                        { opacity: pressed ? 0.7 : 1 }
                                    ]}
                                    onPress={() => {
                                        triggerHaptic();
                                        setFeedFilter('mine');
                                    }}
                                >
                                    <RNText style={[styles.filterText, feedFilter === 'mine' && styles.filterTextActive]}>Mine</RNText>
                                </Pressable>
                            </View>
                            {feedFilter === 'community' && (
                                <RNText style={styles.feedHint}>
                                    Discover campus workouts — tap Add on a post to connect.
                                </RNText>
                            )}
                        </View>

                        {posts.length === 0 && (
                            <View style={styles.emptyContainer}>
                                <FontAwesome
                                    name={feedFilter === 'community' ? 'globe' : 'users'}
                                    size={64}
                                    color={FitVerseTheme.colors.surface}
                                />
                                <RNText style={styles.emptyText}>
                                    {feedFilter === 'friends' && 'No posts from friends yet.'}
                                    {feedFilter === 'community' && 'No community posts yet.'}
                                    {feedFilter === 'mine' && 'No posts yet.'}
                                </RNText>
                                <RNText style={styles.emptySubText}>
                                    {feedFilter === 'friends' && 'Add friends to see their workouts here. Your posts still show for friends.'}
                                    {feedFilter === 'community' && 'Turn on "Share to Community" when you post to show up here.'}
                                    {feedFilter === 'mine' && 'Complete a workout or share a photo to get started.'}
                                </RNText>
                                <Pressable
                                    style={({ pressed }) => [styles.ctaButton, { opacity: pressed ? 0.8 : 1 }]}
                                    onPress={() => {
                                        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                                        setCreateModalVisible(true);
                                    }}
                                >
                                    <RNText style={styles.ctaText}>Create Post</RNText>
                                </Pressable>
                            </View>
                        )}
                    </View>
                }
                renderItem={({ item }) => {
                    const post = item as Post;
                    const friendStatus =
                        post.userId !== user.id
                            ? resolveFriendStatus(post.userId, user, localFriendState)
                            : ('self' as const);
                    return (
                    <View style={[webFeedColumn, { paddingHorizontal: Tokens.spacing.xl }]}>
                        <PostCard
                            post={post}
                            onLike={() => {
                                triggerHaptic();
                                handleLike((item as Post).id);
                            }}
                            onComment={() => {
                                triggerHaptic();
                                setActivePostId((item as Post).id);
                                setCommentsModalVisible(true);
                            }}
                            currentUserId={user.id}
                            // Only allow menu/delete if we are in 'mine' tab as per user request
                            showMenu={feedFilter === 'mine' && (item as Post).userId === user.id}
                            onMenuPress={() => {
                                triggerHaptic();
                                openMenu(item as Post);
                            }}
                            onImagePress={(url) => {
                                triggerHaptic();
                                setPreviewImageUrl(url);
                                setIsPreviewVisible(true);
                            }}
                            weightUnitLbs={user.weightUnitLbs}
                            onProfilePress={(uid) => {
                                triggerHaptic();
                                setSelectedMemberId(uid);
                            }}
                            showCommunityBadge={feedFilter !== 'community' && post.isPublic}
                            showAddFriend={feedFilter === 'community' && post.userId !== user.id}
                            friendStatus={friendStatus === 'self' ? undefined : friendStatus}
                            friendActionLoading={friendBusyId === post.userId}
                            onAddFriend={() => handleCommunityFriend(post.userId)}
                        />
                    </View>
                    );
                }}
            />

            {/* Image Preview Modal */}
            <Modal
                visible={isPreviewVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsPreviewVisible(false)}
            >
                <Pressable
                    style={styles.previewModalOverlay}
                    onPress={() => setIsPreviewVisible(false)}
                >
                    <Pressable
                        style={styles.closePreviewBtn}
                        onPress={() => setIsPreviewVisible(false)}
                    >
                        <FontAwesome name="times" size={24} color={VisualSystem.colors.textPrimary} />
                    </Pressable>
                    {previewImageUrl && (
                        <Image
                            source={{ uri: previewImageUrl }}
                            style={styles.fullPreviewImage}
                            resizeMode="contain"
                        />
                    )}
                </Pressable>
            </Modal>
            <MemberProfileModal
                visible={!!selectedMemberId}
                userId={selectedMemberId}
                onClose={() => setSelectedMemberId(null)}
            />
            <ChatsListScreen
                visible={chatVisible}
                currentUser={user}
                onClose={() => {
                    setChatVisible(false);
                    if (user) ChatStore.getTotalUnread(user.id).then(setUnreadCount);
                }}
            />
        </View>
    );
}

function PostCard({
    post,
    onLike,
    onComment,
    onMenuPress,
    currentUserId,
    weightUnitLbs,
    onImagePress,
    onProfilePress,
    showMenu,
    showCommunityBadge,
    showAddFriend,
    friendStatus,
    friendActionLoading,
    onAddFriend,
}: {
    post: Post;
    onLike: () => void;
    onComment: () => void;
    onMenuPress: () => void;
    currentUserId: string;
    weightUnitLbs?: boolean;
    onImagePress: (url: string) => void;
    onProfilePress: (userId: string) => void;
    showMenu?: boolean;
    showCommunityBadge?: boolean;
    showAddFriend?: boolean;
    friendStatus?: FriendUiStatus;
    friendActionLoading?: boolean;
    onAddFriend?: () => void;
}) {
    const isLiked = post.likes.includes(currentUserId);
    const displayImage = post.content.image;
    const [imageError, setImageError] = useState(false);

    // Filter out expired blob URLs on web to prevent consoles errors
    const [finalImage, setFinalImage] = useState<string | null>(null);

    useEffect(() => {
        if (displayImage && displayImage.startsWith('blob:')) {
            // Check if blob exists
            fetch(displayImage)
                .then(res => {
                    if (res.ok) setFinalImage(displayImage);
                    else setImageError(true);
                })
                .catch(() => setImageError(true));
        } else {
            setFinalImage(displayImage || null);
        }
    }, [displayImage]);


    const showFriendBtn = showAddFriend && friendStatus && friendStatus !== 'friends';

    return (
        <View style={[styles.postCard, Platform.OS === 'web' && styles.postCardWeb]}>
            <View style={styles.postHeader}>
                <Pressable
                    style={styles.postHeaderProfile}
                    onPress={() => onProfilePress(post.userId)}
                >
                    <View style={styles.avatarContainer}>
                        {post.userImage ? (
                            <Image source={{ uri: post.userImage }} style={styles.avatarImage} />
                        ) : (
                            <RNText style={styles.avatarText}>{post.userName.charAt(0)}</RNText>
                        )}
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <RNText style={styles.userName}>{post.userName}</RNText>
                            {showCommunityBadge && (
                                <View style={styles.communityBadge}>
                                    <RNText style={styles.communityBadgeText}>Community</RNText>
                                </View>
                            )}
                        </View>
                        {post.userDorm && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <DormLogo dorm={post.userDorm as Dorm} size={14} style={{ marginRight: 4 }} />
                                <RNText style={{ fontSize: 12, color: FitVerseTheme.colors.accentGold }}>
                                    {post.userDorm.charAt(0).toUpperCase() + post.userDorm.slice(1).toLowerCase().replace('_', ' ')} Hall
                                </RNText>
                            </View>
                        )}
                        <RNText style={styles.timestamp}>
                            {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </RNText>
                    </View>
                </Pressable>
                <View style={styles.postHeaderActions}>
                    {showFriendBtn && (
                        <Pressable
                            onPress={onAddFriend}
                            disabled={friendActionLoading || friendStatus === 'pending_sent'}
                            style={({ pressed }) => [
                                styles.addFriendBtn,
                                friendStatus === 'pending_received' && styles.addFriendBtnAccept,
                                friendStatus === 'pending_sent' && styles.addFriendBtnSent,
                                (pressed || friendActionLoading) && { opacity: 0.75 },
                            ]}
                        >
                            {friendActionLoading ? (
                                <RNText style={styles.addFriendBtnText}>…</RNText>
                            ) : (
                                <>
                                    <FontAwesome
                                        name={friendStatus === 'pending_received' ? 'check' : friendStatus === 'pending_sent' ? 'clock-o' : 'user-plus'}
                                        size={12}
                                        color={friendStatus === 'pending_received' ? '#7dcea0' : FitVerseTheme.colors.accentGold}
                                        style={{ marginRight: 5 }}
                                    />
                                    <RNText
                                        style={[
                                            styles.addFriendBtnText,
                                            friendStatus === 'pending_received' && { color: VisualSystem.colors.success },
                                            friendStatus === 'pending_sent' && styles.addFriendBtnTextMuted,
                                        ]}
                                    >
                                        {friendStatus === 'pending_received'
                                            ? 'Accept'
                                            : friendStatus === 'pending_sent'
                                              ? 'Requested'
                                              : 'Add'}
                                    </RNText>
                                </>
                            )}
                        </Pressable>
                    )}
                    {showAddFriend && friendStatus === 'friends' && (
                        <View style={styles.friendsPill}>
                            <FontAwesome name="check" size={11} color={FitVerseTheme.colors.accentGold} />
                            <RNText style={styles.friendsPillText}>Friends</RNText>
                        </View>
                    )}
                    {showMenu && (
                        <Pressable onPress={onMenuPress} style={({ pressed }) => [{ padding: 10, opacity: pressed ? 0.6 : 1 }]}>
                            <FontAwesome name="bars" size={18} color={FitVerseTheme.colors.accentGold} />
                        </Pressable>
                    )}
                </View>
            </View>

            {post.type === 'workout' && post.content.workoutData && (
                <View style={styles.workoutCard}>
                    <View style={styles.workoutCardBadge}>
                        <FontAwesome name="heartbeat" size={11} color={FitVerseTheme.colors.accentGold} />
                        <RNText style={styles.workoutCardBadgeText}>Workout</RNText>
                    </View>
                    <RNText style={styles.workoutCardTitle} numberOfLines={2}>
                        {post.content.workoutData.title}
                    </RNText>
                    <View style={styles.workoutStatsRow}>
                        <View style={styles.workoutStatCol}>
                            <RNText style={styles.workoutStatNum}>
                                {Math.max(1, Math.round(post.content.workoutData.duration / 60))}
                            </RNText>
                            <RNText style={styles.workoutStatLbl}>MIN</RNText>
                        </View>
                        <View style={styles.workoutStatDivider} />
                        <View style={styles.workoutStatCol}>
                            <RNText style={styles.workoutStatNum}>
                                {post.content.workoutData.setsCompleted ?? post.content.workoutData.exercisesCount}
                            </RNText>
                            <RNText style={styles.workoutStatLbl}>
                                {(post.content.workoutData.setsCompleted ?? 0) > 0 ? 'SETS' : 'EXERCISES'}
                            </RNText>
                        </View>
                        <View style={styles.workoutStatDivider} />
                        <View style={styles.workoutStatCol}>
                            <RNText style={styles.workoutStatNum}>
                                {post.content.workoutData.totalVolume > 0
                                    ? post.content.workoutData.totalVolume.toLocaleString()
                                    : '—'}
                            </RNText>
                            <RNText style={styles.workoutStatLbl}>
                                {post.content.workoutData.totalVolume > 0
                                    ? (weightUnitLbs !== false ? 'LBS' : 'KG')
                                    : 'VOL'}
                            </RNText>
                        </View>
                    </View>
                </View>
            )}

            {(post.type !== 'workout' || shouldShowWorkoutPostCaption(post.content.description)) && (
                <RNText style={styles.postDescription}>{post.content.description}</RNText>
            )}

            {finalImage && !imageError && (
                <Pressable
                    onPress={() => displayImage && onImagePress(displayImage)}
                    style={styles.imageWrapper}
                >
                    <Image
                        source={{ uri: finalImage }}
                        style={styles.postImage}
                        resizeMode="cover"
                        onError={() => setImageError(true)}
                    />
                    {post.type === 'photo' && (
                        <View style={styles.fizzOverlay}>
                            <RNText style={styles.fizzDateText}>
                                {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </RNText>
                            <View style={styles.fizzTimeContainer}>
                                <RNText style={styles.fizzTimeText}>
                                    {new Date(post.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </RNText>
                            </View>
                        </View>
                    )}
                </Pressable>
            )}

            {/* Post Actions */}
            <View style={styles.postActions}>
                <Pressable
                    style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={onLike}
                >
                    <FontAwesome name={isLiked ? "heart" : "heart-o"} size={20} color={isLiked ? "#ff4d4d" : FitVerseTheme.colors.accentGold} />
                    <RNText style={[styles.actionText, isLiked && { color: VisualSystem.colors.danger }]}>{post.likes.length}</RNText>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={onComment}
                >
                    <FontAwesome name="comment-o" size={20} color={FitVerseTheme.colors.accentGold} />
                    <RNText style={styles.actionText}>{post.comments ? post.comments.length : 0}</RNText>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.6 : 1 }]}>
                    <FontAwesome name="share" size={20} color={FitVerseTheme.colors.accentGold} />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    flatListContentWeb: {
        alignItems: 'center',
    },
    scrollContent: {
        padding: Tokens.spacing.xl,
        backgroundColor: 'transparent',
    },
    scrollView: {
        flex: 1,
    },
    heroContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 240,
        zIndex: 10,
        overflow: 'hidden',
    },
    heroContainerWeb: {
        maxWidth: 560,
        alignSelf: 'center',
        left: undefined,
        right: undefined,
        width: '100%',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerTitleWeb: {
        fontSize: 26,
        letterSpacing: 1.5,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    headerContent: {
        paddingHorizontal: Tokens.spacing.xl,
        height: '100%',
        justifyContent: 'flex-end',
        paddingBottom: 15,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: VisualSystem.colors.goldText,
        letterSpacing: 2,
    },
    userSubline: {
        fontSize: Tokens.typography.md,
        // Sits on the dark photo scrim, not on the page.
        color: VisualSystem.colors.textOnNavy,
        opacity: 0.9,
        marginTop: 4,
        fontWeight: '500',
    },
    headerActionsSpace: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Tokens.spacing.xs,
        position: 'relative',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
    },
    chatBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: VisualSystem.colors.dangerSoft,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: FitVerseTheme.colors.background,
    },
    chatBadgeText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 10,
        fontWeight: 'bold',
    },
    filterContainer: {
        flexDirection: 'row',
        marginTop: 10,
        gap: 8,
    },
    filterBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    filterBtnFlex: {
        flex: 1,
        alignItems: 'center',
    },
    filterBtnActive: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderColor: FitVerseTheme.colors.accentGold,
    },
    filterText: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: 13,
        fontWeight: '600',
    },
    communityBadge: {
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.35)',
    },
    communityBadgeText: {
        color: VisualSystem.colors.goldText,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    filterTextActive: {
        color: VisualSystem.colors.goldText,
    },
    feedHint: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: 13,
        lineHeight: 18,
        marginTop: 12,
        textAlign: 'center',
    },
    profileBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: FitVerseTheme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: FitVerseTheme.colors.border,
    },
    iconBadge: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: FitVerseTheme.colors.surface,
        borderRadius: Tokens.radius.md,
        paddingHorizontal: 15,
        height: 48,
        borderWidth: 1,
        borderColor: FitVerseTheme.colors.border,
    },
    postCard: {
        marginBottom: Tokens.spacing.xl,
        padding: Tokens.spacing.xl,
        borderRadius: Tokens.radius.xl,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    postCardWeb: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderColor: 'rgba(212, 175, 55, 0.12)',
        ...(Platform.OS === 'web' ? { boxShadow: '0 8px 32px rgba(0,0,0,0.25)' as unknown as undefined } : {}),
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Tokens.spacing.md,
        gap: 8,
    },
    postHeaderProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        minWidth: 0,
    },
    postHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
    },
    addFriendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.45)',
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
    },
    addFriendBtnAccept: {
        borderColor: 'rgba(125, 206, 160, 0.5)',
        backgroundColor: 'rgba(125, 206, 160, 0.12)',
    },
    addFriendBtnSent: {
        borderColor: VisualSystem.colors.borderSubtle,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    addFriendBtnText: {
        color: VisualSystem.colors.goldText,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    addFriendBtnTextMuted: {
        color: FitVerseTheme.colors.textMuted,
    },
    friendsPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    friendsPillText: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '700',
    },
    avatarContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    avatarImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    avatarText: {
        color: VisualSystem.colors.goldText,
        fontSize: 18,
        fontWeight: 'bold',
    },
    userName: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    timestamp: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    postDescription: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 15,
        lineHeight: 24,
        marginBottom: Tokens.spacing.lg,
        fontWeight: '400',
    },
    imageWrapper: {
        width: '100%',
        height: Platform.OS === 'web' ? 280 : 320,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: Tokens.spacing.lg,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    postImage: {
        width: '100%',
        height: '100%',
    },
    fizzOverlay: {
        position: 'absolute',
        top: 15,
        right: 15,
        backgroundColor: VisualSystem.colors.overlay,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    fizzDateText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    fizzTimeContainer: {
        marginTop: 2,
    },
    fizzTimeText: {
        color: VisualSystem.colors.goldText,
        fontSize: 12,
        fontWeight: '900',
    },
    workoutCard: {
        backgroundColor: 'rgba(212, 175, 55, 0.06)',
        borderRadius: 16,
        padding: 16,
        marginBottom: Tokens.spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.22)',
    },
    workoutCardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        marginBottom: 10,
    },
    workoutCardBadgeText: {
        color: VisualSystem.colors.goldText,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    workoutCardTitle: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 14,
        lineHeight: 24,
    },
    workoutStatsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.18)',
        borderRadius: 12,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    workoutStatCol: {
        flex: 1,
        alignItems: 'center',
    },
    workoutStatDivider: {
        width: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        marginVertical: 2,
    },
    workoutStatNum: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 17,
        fontWeight: '800',
    },
    workoutStatLbl: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.6,
        marginTop: 3,
    },
    postActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: VisualSystem.colors.borderSubtle,
        paddingTop: Tokens.spacing.md,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 24,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 16,
    },
    actionText: {
        color: FitVerseTheme.colors.textPrimary,
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 30,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        marginTop: 20,
    },
    emptyText: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 22,
        fontWeight: '900',
        marginTop: 20,
        letterSpacing: 0.5,
    },
    emptySubText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 15,
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 30,
        lineHeight: 22,
    },
    ctaButton: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderGold,
    },
    ctaText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '800',
        fontSize: 16,
        letterSpacing: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: VisualSystem.colors.overlay,
        justifyContent: 'flex-end',
    },
    menuContainer: {
        backgroundColor: VisualSystem.colors.bgBase,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 20,
        paddingBottom: 40,
    },
    menuHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    menuTitle: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 18,
        fontWeight: 'bold',
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
    },
    menuText: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 16,
        marginLeft: 10,
    },
    menuDivider: {
        height: 1,
        backgroundColor: VisualSystem.colors.bgMid,
    },
    editModalContent: {
        backgroundColor: VisualSystem.colors.bgBase,
        borderRadius: 20,
        padding: 20,
        width: '90%',
        alignSelf: 'center',
        marginBottom: '50%',
    },
    editModalTitle: {
        color: FitVerseTheme.colors.textPrimary,
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    editInput: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 10,
        padding: 15,
        color: VisualSystem.colors.textPrimary,
        height: 120,
        textAlignVertical: 'top',
        fontSize: 16,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 20,
    },
    modalBtnCancel: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginRight: 10,
    },
    modalBtnSave: {
        backgroundColor: FitVerseTheme.colors.accentGold,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    modalBtnTextCancel: {
        color: FitVerseTheme.colors.textMuted,
        fontWeight: 'bold',
    },
    modalBtnTextSave: {
        color: '#000',
        fontWeight: 'bold',
    },
    previewModalOverlay: {
        flex: 1,
        backgroundColor: VisualSystem.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closePreviewBtn: {
        position: 'absolute',
        top: 50,
        right: 25,
        zIndex: 10,
        padding: 10,
    },
    fullPreviewImage: {
        width: '100%',
        height: '80%',
    },
    // Social Styles
    searchResultsWrapper: {
        marginTop: 15,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: Tokens.radius.md,
        padding: 12,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    searchSectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: VisualSystem.colors.goldText,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
    },
    userResultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: VisualSystem.colors.borderSubtle,
    },
    resultAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(124, 255, 107, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: FitVerseTheme.colors.accentGold,
    },
    resultName: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 14,
        fontWeight: 'bold',
    },
    resultSub: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: 11,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: FitVerseTheme.colors.accentGold,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    addBtnText: {
        color: '#000',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    acceptBtn: {
        backgroundColor: Tokens.colors.accentGold,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    acceptBtnText: {
        color: '#000',
        fontSize: 12,
        fontWeight: 'bold',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    statusText: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    pendingBadge: {
        backgroundColor: VisualSystem.colors.bgMid,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    pendingText: {
        color: FitVerseTheme.colors.textMuted,
        fontSize: 11,
        fontWeight: 'bold',
    },
    requestsGrid: {
        // Placeholder for future expanded requests view
    }
});

