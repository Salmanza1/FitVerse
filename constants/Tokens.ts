import { VisualSystem } from './VisualSystem';

/**
 * Legacy token shape. Kept so existing imports keep working; values now come
 * from VisualSystem so there is one place to change the theme.
 */
export const Tokens = {
    colors: {
        background: VisualSystem.colors.bgBase,
        surface: VisualSystem.colors.bgMid,
        surface2: VisualSystem.colors.bgDeep,
        textPrimary: VisualSystem.colors.textPrimary,
        textMuted: VisualSystem.colors.textSecondary,
        accentGold: VisualSystem.colors.gold,
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        xxl: 32,
        xxxl: 40,
    },
    radius: {
        xs: 8,
        sm: 12,
        md: 16,
        lg: 20,
        xl: 24,
    },
    typography: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 24,
        xxl: 32,
        xxxl: 40,
    },
};
