import React, { useState, useRef } from 'react';
import {
    StyleSheet, ScrollView, View, Text as RNText,
    Pressable, FlatList, Platform, useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Dorm } from '@/types/user';
import { resolveDormFromName } from '@/lib/dormLogo';
import { DormLogo } from '@/components/DormLogo';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Tokens } from '@/constants/Tokens';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import { VisualSystem } from '@/constants/VisualSystem';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/features/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { WEB_FEED_MAX_WIDTH } from '@/constants/webLayout';

type GenderFilter = 'Mixed' | 'Men' | 'Women';

type LeaderboardEntry = { rank: number; name: string; points: number; color?: string };
type LeaderboardData = Record<GenderFilter, LeaderboardEntry[]>;

/**
 * Fetch leaderboard from the `leaderboard_dorm_weekly` Supabase view.
 * Falls back gracefully to empty arrays if the view doesn't exist yet.
 */
const fetchLeaderboard = async (): Promise<LeaderboardData> => {
    try {
        const { data, error } = await supabase
            .from('leaderboard_dorm_daily')
            .select('dorm, gender, total_xp, rank')
            .order('total_xp', { ascending: false });

        if (error) {
            console.warn('Leaderboard view not ready:', error.message);
            return { Mixed: [], Men: [], Women: [] };
        }

        const buildRanked = (rows: any[]): LeaderboardEntry[] =>
            rows.map((row) => ({
                rank: row.rank,
                name: row.dorm,
                points: row.total_xp,
                color: row.rank === 1 ? VisualSystem.colors.goldBright : row.rank === 2 ? '#9AA3AD' : row.rank === 3 ? '#A9662A' : undefined,
            }));

        return {
            Mixed: buildRanked(data.filter(r => r.gender === 'Mixed') || []),
            Men: buildRanked(data.filter(r => r.gender === 'Male') || []),
            Women: buildRanked(data.filter(r => r.gender === 'Female') || []),
        };
    } catch (e) {
        console.error('fetchLeaderboard error:', e);
        return { Mixed: [], Men: [], Women: [] };
    }
};


// ─── Weekly MVP Card ──────────────────────────────────────────────────────────
function MVPCard({ userName }: { userName: string }) {
    return (
        <LinearGradient
            colors={['rgba(201, 151, 0, 0.16)', 'rgba(201, 151, 0, 0.04)']}
            style={styles.mvpCard}
        >
            <View style={styles.mvpBadgeRow}>
                <FontAwesome name="star" size={10} color={VisualSystem.colors.gold} />
                <RNText style={styles.mvpBadgeText}> YOUR WEEK</RNText>
            </View>
            <View style={styles.mvpContent}>
                <View style={styles.mvpAvatar}>
                    <RNText style={styles.mvpAvatarText}>{userName.charAt(0).toUpperCase()}</RNText>
                </View>
                <View>
                    <RNText style={styles.mvpName}>{userName}</RNText>
                    <RNText style={styles.mvpStats}>Every workout you log lifts your dorm — thanks for showing up.</RNText>
                </View>
            </View>
        </LinearGradient>
    );
}



function RankingPage({ currentFilter, bottomPad, data, userName, userDorm, pageWidth, isWeb }: {
    currentFilter: GenderFilter;
    bottomPad: number;
    data: any;
    userName: string;
    userDorm: Dorm;
    pageWidth: number;
    isWeb: boolean;
}) {
    const pageStyle = { width: pageWidth };

    if (!data || data.length === 0) {
        return (
            <ScrollView
                style={[styles.pageContainer, pageStyle]}
                contentContainerStyle={[
                    styles.scroll,
                    isWeb && styles.scrollEmpty,
                    { paddingBottom: bottomPad },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <RNText style={[styles.sectionHeader, isWeb && styles.sectionHeaderWeb]}>
                    DORMS SHOWING UP — {currentFilter.toUpperCase()}
                </RNText>
                <View style={isWeb ? styles.emptyStateWeb : styles.emptyStateNative}>
                    <FontAwesome name="bolt" size={40} color={VisualSystem.colors.gold} />
                    <RNText style={styles.emptyStateText}>
                        Be the first to log today — any session counts toward your dorm.
                    </RNText>
                </View>
            </ScrollView>
        );
    }

    return (
        <ScrollView
            style={[styles.pageContainer, pageStyle]}
            contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
        >
            <RNText style={[styles.sectionHeader, isWeb && styles.sectionHeaderWeb]}>
                DORMS SHOWING UP — {currentFilter.toUpperCase()}
            </RNText>

            {/* ── Top 3 Rankings ── */}
            <View style={[styles.rankList, { marginBottom: 16 }]}>
                {data.slice(0, 3).map((item: any) => {
                    const color = item.rank === 1 ? VisualSystem.colors.goldBright : item.rank === 2 ? '#9AA3AD' : '#A9662A';
                    return (
                        <View key={item.name} style={[styles.rankCard, { borderColor: color, backgroundColor: VisualSystem.colors.bgMid }, resolveDormFromName(item.name || '') === userDorm && styles.userRankCard]}>
                            <View style={styles.rankInfo}>
                                <RNText style={[styles.rankNumberSmall, { color, opacity: 1 }]}>#{item.rank}</RNText>
                                <View style={{ marginLeft: 12 }}>
                                    <RNText style={[styles.dormName, { color }]}>{item.name}</RNText>
                                    <RNText style={styles.xpText}>{item.points.toLocaleString()} XP</RNText>
                                </View>
                            </View>
                            <DormLogo dorm={item.name} size={44} />
                        </View>
                    );
                })}
            </View>

            {/* Weekly MVP */}
            <MVPCard userName={userName} />

        </ScrollView>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LeaderboardScreen() {
    const { user } = useAuth();
    const [filter, setFilter] = useState<GenderFilter>('Mixed');
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();
    const { width: windowWidth } = useWindowDimensions();
    const flatListRef = useRef<FlatList<GenderFilter>>(null);
    const filters: GenderFilter[] = ['Mixed', 'Men', 'Women'];
    const isWeb = Platform.OS === 'web';
    const pageWidth = isWeb ? Math.min(windowWidth, WEB_FEED_MAX_WIDTH) : windowWidth;

    const { data: cachedLeaderboard, isLoading } = useQuery({
        queryKey: ['leaderboard'],
        queryFn: fetchLeaderboard,
        staleTime: 1000 * 60 * 5,
        refetchInterval: 5000,
    });

    // Tab bar: bottom:25, height:65 → top of tab bar = insets.bottom + 25 + 65 = ~90 above bottom
    // Add a little breathing room (8px)
    // Sits just above the tab bar. This was insets.bottom + 25 + 65 + 8, sized
    // for the floating bar that used to live here; the native bar reports its
    // own height, safe area included.
    const footerBottom = tabBarHeight + 8;
    // ScrollView needs enough padding to not be hidden behind the footer
    const bottomPad = footerBottom + 80;

    const handleFilterPress = (f: GenderFilter, index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setFilter(f);
        flatListRef.current?.scrollToIndex({ index, animated: true });
    };

    const onMomentumScrollEnd = (e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
        if (filters[index] && filters[index] !== filter) {
            setFilter(filters[index]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const userDisplayName = user?.displayName || user?.name || 'You';
    const userDorm = user?.dorm || Dorm.SORIN;

    const currentData = cachedLeaderboard ? cachedLeaderboard[filter] : [];
    const userDormData = currentData?.find(d => resolveDormFromName(d?.name || '') === userDorm);

    const userRank = userDormData ? userDormData.rank : '-';
    const userXP = userDormData ? userDormData.points : 0;

    const rankFooter = (
        <View style={[styles.stickyFooter, isWeb ? styles.stickyFooterWeb : styles.stickyFooterNative, { bottom: footerBottom }]}>
            <BlurView intensity={Platform.OS === 'ios' ? 30 : 50} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.94)', 'rgba(255, 255, 255, 0.88)']}
                style={styles.footerGradient}
            >
                <View style={styles.footerInner}>
                    <View style={styles.userIconBadge}>
                        <DormLogo dorm={userDorm} size={26} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <RNText style={styles.footerName}>{userDisplayName}</RNText>
                        <RNText style={styles.footerSub}>{userXP.toLocaleString()} XP  •  {userDorm}</RNText>
                    </View>
                    <View style={styles.rankBadgeContainer}>
                        <RNText style={styles.rankLabel}>Your dorm today</RNText>
                        <RNText style={styles.rankValue}>#{userRank}</RNText>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );

    return (
        <View style={[styles.container, isWeb && styles.containerWeb]}>
            <View style={[styles.mainColumn, isWeb && styles.mainColumnWeb]}>
            <ScreenHeader title="Leaderboard" subtitle="Dorms showing up today" />

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                {filters.map((f, i) => (
                    <Pressable
                        key={f}
                        onPress={() => handleFilterPress(f, i)}
                        style={({ pressed }) => [
                            styles.filterBtn,
                            filter === f && styles.filterBtnActive,
                            { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
                        ]}
                    >
                        <RNText style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</RNText>
                    </Pressable>
                ))}
            </View>

            {/* Paged Rankings */}
            {isLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <RNText style={{ color: VisualSystem.colors.goldText, fontWeight: '700' }}>
                        Loading community stats...
                    </RNText>
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={filters}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item}
                    onMomentumScrollEnd={onMomentumScrollEnd}
                    style={[styles.flatList, isWeb && styles.flatListWeb, isWeb && { width: pageWidth }]}
                    getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
                    renderItem={({ item: currentFilter }) => (
                        <RankingPage
                            currentFilter={currentFilter}
                            bottomPad={bottomPad}
                            data={cachedLeaderboard?.[currentFilter]}
                            userName={userDisplayName}
                            userDorm={userDorm}
                            pageWidth={pageWidth}
                            isWeb={isWeb}
                        />
                    )}
                />
            )}
            {isWeb && rankFooter}
            </View>
            {!isWeb && rankFooter}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    containerWeb: {
        alignItems: 'center',
    },
    mainColumn: {
        flex: 1,
        width: '100%',
    },
    mainColumnWeb: {
        maxWidth: WEB_FEED_MAX_WIDTH,
        alignSelf: 'center',
    },
    headerContainer: {
        paddingHorizontal: Tokens.spacing.xl,
        paddingBottom: 12,
    },
    headerContainerWeb: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: VisualSystem.colors.goldText,
        letterSpacing: 0.2,
    },
    headerTitleWeb: {
        fontSize: 24,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: VisualSystem.colors.textTertiary,
        marginTop: 4,
        letterSpacing: 0.2,
    },
    headerSubtitleWeb: {
        textAlign: 'center',
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: Tokens.spacing.xl,
        gap: Tokens.spacing.md,
        paddingBottom: Tokens.spacing.lg,
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: VisualSystem.colors.bgMid,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    filterBtnActive: {
        backgroundColor: VisualSystem.colors.goldMuted,
        borderColor: FitVerseTheme.colors.accentGold,
    },
    filterText: {
        color: FitVerseTheme.colors.textMuted,
        fontWeight: '700',
        fontSize: Tokens.typography.sm,
    },
    filterTextActive: {
        color: VisualSystem.colors.goldText,
    },
    flatList: {
        flex: 1,
    },
    flatListWeb: {
        alignSelf: 'center',
    },
    pageContainer: {
        flex: 1,
    },
    scroll: {
        paddingHorizontal: Tokens.spacing.xl,
        paddingTop: Tokens.spacing.sm,
    },
    scrollEmpty: {
        flexGrow: 1,
    },
    emptyStateNative: {
        marginTop: 32,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    emptyStateWeb: {
        flex: 1,
        minHeight: 280,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        width: '100%',
    },
    emptyStateText: {
        color: FitVerseTheme.colors.textMuted,
        marginTop: 16,
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
        maxWidth: 320,
    },
    sectionHeader: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
        marginBottom: Tokens.spacing.md,
        color: VisualSystem.colors.goldText,
        opacity: 0.85,
    },
    sectionHeaderWeb: {
        textAlign: 'center',
    },



    // ── MVP Card ──
    mvpCard: {
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderGold,
        marginBottom: 16,
    },
    mvpBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(201, 151, 0, 0.16)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    mvpBadgeText: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    mvpContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    mvpAvatar: {
        width: 40,
        height: 40,
        borderRadius: 22,
        backgroundColor: VisualSystem.colors.bgDeep,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: VisualSystem.colors.borderGold,
    },
    mvpAvatarText: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '700',
        fontSize: 17,
    },
    mvpName: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '700',
        fontSize: 13,
    },
    mvpStats: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },

    // ── Rank list (4+) ──
    rankList: {
        gap: 8,
    },
    rankCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Tokens.spacing.lg,
        paddingVertical: 12,
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
    },
    userRankCard: {
        borderColor: VisualSystem.colors.success,
        backgroundColor: VisualSystem.colors.successSoft,
    },
    rankInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rankNumberSmall: {
        fontSize: 17,
        fontWeight: '800',
        color: VisualSystem.colors.textTertiary,
        width: 36,
        fontStyle: 'italic',
    },
    dormName: {
        fontSize: Tokens.typography.md,
        fontWeight: '700',
        color: FitVerseTheme.colors.textPrimary,
    },
    xpText: {
        fontSize: Tokens.typography.xs,
        color: FitVerseTheme.colors.textMuted,
        marginTop: 4,
    },

    // ── Sticky Footer ──
    stickyFooter: {
        position: 'absolute',
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(201, 151, 0, 0.55)',
        shadowColor: VisualSystem.colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 100,
    },
    stickyFooterNative: {
        left: 16,
        right: 16,
    },
    stickyFooterWeb: {
        left: 16,
        right: 16,
        maxWidth: WEB_FEED_MAX_WIDTH,
        alignSelf: 'center',
    },
    footerGradient: {
        borderRadius: 22,
    },
    footerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    userIconBadge: {
        width: 42,
        height: 42,
        borderRadius: 22,
        backgroundColor: VisualSystem.colors.goldMuted,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: FitVerseTheme.colors.accentGold,
    },
    userAvatarText: {
        color: VisualSystem.colors.goldText,
        fontWeight: '800',
        fontSize: 15,
    },
    footerName: {
        color: VisualSystem.colors.textPrimary,
        fontWeight: '700',
        fontSize: 13,
    },
    footerSub: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        marginTop: 4,
    },
    rankBadgeContainer: {
        alignItems: 'flex-end',
    },
    rankLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: VisualSystem.colors.goldText,
        letterSpacing: 0.2,
    },
    rankValue: {
        fontSize: 20,
        fontWeight: '800',
        color: VisualSystem.colors.goldText,
        fontStyle: 'italic',
    },
});
