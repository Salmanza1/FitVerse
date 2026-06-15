import { router } from 'expo-router';

/** Tab routes that are always safe after login/signup. */
const SAFE_TAB_ROUTES = new Set([
    '/(tabs)',
    '/(tabs)/index',
    '/(tabs)/dining',
    '/(tabs)/gym',
    '/(tabs)/leaderboard',
    '/(tabs)/profile',
]);

export const LAST_TAB_STORAGE_KEY = 'fitverse_last_tab';

/**
 * Prevents post-login navigation to auth screens, deleted routes, or invalid paths.
 */
export function sanitizeStoredRoute(route: string | null | undefined): string {
    if (!route) return '/(tabs)';

    const normalized = route.trim();

    if (SAFE_TAB_ROUTES.has(normalized)) {
        return normalized;
    }

    // Legacy / stale values from older builds
    if (normalized.startsWith('/(auth)') || normalized === '/' || normalized === '/index') {
        return '/(tabs)';
    }

    // Map old tab paths like "/gym" → "/(tabs)/gym"
    if (['/dining', '/gym', '/leaderboard', '/profile'].includes(normalized)) {
        return `/(tabs)${normalized}`;
    }

    if (normalized.startsWith('/(tabs)/')) {
        const tabName = normalized.replace('/(tabs)/', '').split('/')[0];
        const candidate = tabName ? `/(tabs)/${tabName}` : '/(tabs)';
        if (SAFE_TAB_ROUTES.has(candidate)) {
            return candidate;
        }
    }

    // Profile sub-screens — open profile tab first; user can navigate from there
    if (normalized.startsWith('/profile')) {
        return '/(tabs)/profile';
    }

    return '/(tabs)';
}

export function goToAppHome() {
    router.replace('/(tabs)');
}

export async function resetAppHomeRoute(AsyncStorage: {
    setItem: (key: string, value: string) => Promise<void>;
}) {
    await AsyncStorage.setItem(LAST_TAB_STORAGE_KEY, '/(tabs)');
}
