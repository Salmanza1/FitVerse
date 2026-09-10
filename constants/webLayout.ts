import { Platform, ViewStyle } from 'react-native';
import { VisualSystem } from '@/constants/VisualSystem';

/** Page background — use anywhere web would otherwise show transparent/black. */
export const WEB_BG = VisualSystem.colors.bgBase;

export const webRoot: ViewStyle =
    Platform.OS === 'web'
        ? { flex: 1, backgroundColor: WEB_BG, minHeight: '100vh' as unknown as number }
        : { flex: 1, backgroundColor: WEB_BG };

export const webScreen: ViewStyle =
    Platform.OS === 'web' ? { flex: 1, backgroundColor: WEB_BG } : { flex: 1 };

export const webStackContent = {
    backgroundColor: Platform.OS === 'web' ? WEB_BG : 'transparent',
};

/** Centered feed column on desktop browsers */
export const WEB_FEED_MAX_WIDTH = 560;

export const webFeedColumn: ViewStyle =
    Platform.OS === 'web'
        ? { width: '100%', maxWidth: WEB_FEED_MAX_WIDTH, alignSelf: 'center' as const }
        : { width: '100%' };
