import { VisualSystem } from './VisualSystem';

/**
 * Legacy theme shape. Values resolve from VisualSystem so the app has one
 * source of truth. `accentLime` is kept as an alias because screens still
 * reference it; it was never lime.
 */
export const FitVerseTheme = {
    colors: {
        background: VisualSystem.colors.bgBase,
        surface: VisualSystem.colors.bgMid,
        surfaceElevated: VisualSystem.colors.bgElevated,
        border: VisualSystem.colors.borderSubtle,
        borderGold: VisualSystem.colors.borderGold,
        textPrimary: VisualSystem.colors.textPrimary,
        textMuted: VisualSystem.colors.textSecondary,
        accentLime: VisualSystem.colors.gold,
        accentGold: VisualSystem.colors.gold,
        ndNavy: VisualSystem.colors.navy,
        ndGold: VisualSystem.colors.gold,
    },
    visual: VisualSystem,
};
