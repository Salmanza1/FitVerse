import React, { useState, useRef } from 'react';
import {
    StyleSheet, ScrollView, View, Text as RNText,
    Pressable, FlatList, Platform, useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Dorm } from '@/types/user';
import { resolveDormFromName } from '@/lib/dormLogo';
import { DormLogo } from '@/components/DormLogo';
import { Tokens } from '@/constants/Tokens';
import { FitVerseTheme } from '@/constants/FitVerseTheme';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/features/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { WEB_FEED_MAX_WIDTH } from '@/constants/webLayout';

type GenderFilter = 'Mixed' | 'Boys' | 'Girls';

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
            return { Mixed: [], Boys: [], Girls: [] };
        }

        const buildRanked = (rows: any[]): LeaderboardEntry[] =>
            rows.map((row) => ({
                rank: row.rank,
                name: row.dorm,
                points: row.total_xp,
                color: row.rank === 1 ? FitVerseTheme.colors.accentGold : row.rank === 2 ? '#C0C0C0' : row.rank === 3 ? '#CD7F32' : undefined,
            }));

        return {
            Mixed: buildRanked(data.filter(r => r.gender === 'Mixed') || []),
            Boys: buildRanked(data.filter(r => r.gender === 'Male') || []),
            Girls: buildRanked(data.filter(r => r.gender === 'Female') || []),
        };
    } catch (e) {
        console.error('fetchLeaderboard error:', e);
        return { Mixed: [], Boys: [], Girls: [] };
    }
};


// ─── Weekly MVP Card ──────────────────────────────────────────────────────────
function MVPCard({ userName }: { userName: string }) {
    return (
        <LinearGradient
            colors={['rgba(212,175,55,0.18)', 'rgba(212,175,55,0.06)']}
            style={styles.mvpCard}
        >
            <View style={styles.mvpBadgeRow}>
                <FontAwesome name="star" size={10} color="#D4AF37" />
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
                    <FontAwesome name="bolt" size={40} color="rgba(212,175,55,0.2)" />
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
            <View style={[styles.rankList, { marginBottom: 20 }]}>
                {data.slice(0, 3).map((item: any) => {
                    const color = item.rank === 1 ? FitVerseTheme.colors.accentGold : item.rank === 2 ? '#C0C0C0' : '#CD7F32';
                    return (
                        <View key={item.name} style={[styles.rankCard, { borderColor: color, backgroundColor: 'rgba(255,255,255,0.06)' }, resolveDormFromName(item.name || '') === userDorm && styles.userRankCard]}>
                            <View style={styles.rankInfo}>
                                <RNText style={[styles.rankNumberSmall, { color, opacity: 1 }]}>#{item.rank}</RNText>
                                <View style={{ marginLeft: 14 }}>
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
    const { width: windowWidth } = useWindowDimensions();
    const flatListRef = useRef<FlatList<GenderFilter>>(null);
    const filters: GenderFilter[] = ['Mixed', 'Boys', 'Girls'];
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
    const footerBottom = insets.bottom + 25 + 65 + 8;
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
            <BlurView intensity={Platform.OS === 'ios' ? 30 : 50} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
                colors={['rgba(12,35,64,0.4)', 'rgba(12,35,64,0.2)']}
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
                        <RNText style={styles.rankLabel}>YOUR DORM TODAY</RNText>
                        <RNText style={styles.rankValue}>#{userRank}</RNText>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );

    return (
        <View style={[styles.container, isWeb && styles.containerWeb]}>
            <View style={[styles.mainColumn, isWeb && styles.mainColumnWeb]}>
            <View style={[styles.headerContainer, isWeb && styles.headerContainerWeb, { paddingTop: insets.top + 10 }]}>
                <RNText style={[styles.headerTitle, isWeb && styles.headerTitleWeb]}>LEADERBOARD</RNText>
                <RNText style={[styles.headerSubtitle, isWeb && styles.headerSubtitleWeb]}>Dorms showing up today</RNText>
            </View>

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
                    <RNText style={{ color: FitVerseTheme.colors.accentGold, fontWeight: 'bold' }}>
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
        paddingBottom: 14,
    },
    headerContainerWeb: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: FitVerseTheme.colors.accentGold,
        letterSpacing: 1.5,
    },
    headerTitleWeb: {
        fontSize: 26,
        letterSpacing: 1.2,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 1,
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
        paddingVertical: 13,
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    filterBtnActive: {
        backgroundColor: 'rgba(212,175,55,0.12)',
        borderColor: FitVerseTheme.colors.accentGold,
    },
    filterText: {
        color: FitVerseTheme.colors.textMuted,
        fontWeight: 'bold',
        fontSize: Tokens.typography.sm,
    },
    filterTextActive: {
        color: FitVerseTheme.colors.accentGold,
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
        marginTop: 60,
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
        marginTop: 20,
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
        maxWidth: 320,
    },
    sectionHeader: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: Tokens.spacing.md,
        color: FitVerseTheme.colors.accentGold,
        opacity: 0.85,
    },
    sectionHeaderWeb: {
        textAlign: 'center',
    },



    // ── MVP Card ──
    mvpCard: {
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.28)',
        marginBottom: 20,
    },
    mvpBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212,175,55,0.18)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    mvpBadgeText: {
        color: '#D4AF37',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
    },
    mvpContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    mvpAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.35)',
    },
    mvpAvatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    mvpName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    mvpStats: {
        color: '#D4AF37',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },

    // ── Rank list (4+) ──
    rankList: {
        gap: 10,
    },
    rankCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Tokens.spacing.lg,
        paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    userRankCard: {
        borderColor: 'rgba(124,255,107,0.4)',
        backgroundColor: 'rgba(124,255,107,0.08)',
    },
    rankInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rankNumberSmall: {
        fontSize: 17,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.3)',
        width: 36,
        fontStyle: 'italic',
    },
    dormName: {
        fontSize: Tokens.typography.md,
        fontWeight: 'bold',
        color: FitVerseTheme.colors.textPrimary,
    },
    xpText: {
        fontSize: Tokens.typography.xs,
        color: FitVerseTheme.colors.textMuted,
        marginTop: 2,
    },

    // ── Sticky Footer ──
    stickyFooter: {
        position: 'absolute',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.45)',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 100,
    },
    stickyFooterNative: {
        left: 16,
        right: 16,
    },
    stickyFooterWeb: {
        left: 0,
        right: 0,
        width: '100%',
    },
    footerGradient: {
        borderRadius: 20,
    },
    footerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    userIconBadge: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(212,175,55,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: FitVerseTheme.colors.accentGold,
    },
    userAvatarText: {
        color: FitVerseTheme.colors.accentGold,
        fontWeight: '900',
        fontSize: 16,
    },
    footerName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    footerSub: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 11,
        marginTop: 2,
    },
    rankBadgeContainer: {
        alignItems: 'flex-end',
    },
    rankLabel: {
        fontSize: 8,
        fontWeight: '900',
        color: 'rgba(212,175,55,0.65)',
        letterSpacing: 0.8,
    },
    rankValue: {
        fontSize: 22,
        fontWeight: '900',
        color: FitVerseTheme.colors.accentGold,
        fontStyle: 'italic',
    },
});
