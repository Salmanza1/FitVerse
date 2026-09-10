/**
 * FitVerse visual system — light theme.
 *
 * Single source of truth for color, elevation, spacing and radius.
 * Colors.ts, Tokens.ts and FitVerseTheme.ts all re-export from here, so a
 * change in this file propagates to every screen that uses a token.
 *
 * Surfaces run light-to-white and text runs navy-on-light. Contrast ratios
 * against white are noted where a value is used for text; anything below 4.5:1
 * is intended for fills, icons or large type only.
 */

// ── Brand ────────────────────────────────────────────────────────────────────
const ND_NAVY = '#0C2340';
const ND_GOLD = '#C99700'; // deepened from #D4AF37, which is unreadable on white

export const VisualSystem = {
    colors: {
        // Surfaces, lightest content sits on white cards over a tinted page.
        bgBase: '#F7F9FC', // page background
        bgMid: '#FFFFFF', // cards / primary surface
        bgDeep: '#EEF2F7', // wells, inset rows, pressed states
        bgElevated: '#FFFFFF', // sheets and modals (pair with shadow.card)

        // Brand + accent
        navy: ND_NAVY,
        gold: ND_GOLD, // 2.6:1 — fills, icons, borders. Not small text.
        goldText: '#8A6D00', // 4.9:1 — gold-flavored text on light
        goldBright: '#D4AF37', // decorative fills, gradients, large shapes
        goldSoft: 'rgba(201, 151, 0, 0.28)',
        goldMuted: 'rgba(201, 151, 0, 0.10)',

        // Text
        textPrimary: ND_NAVY, // 14.9:1
        textSecondary: '#5A6B82', // 5.5:1
        textTertiary: '#63748C', // 4.8:1
        textOnGold: ND_NAVY,
        textOnNavy: '#FFFFFF',

        // Lines
        borderSubtle: '#E3E8EF',
        borderStrong: '#CBD5E1',
        borderGold: 'rgba(201, 151, 0, 0.32)',

        // Translucent fills, used over photos and gradients
        glassFill: 'rgba(255, 255, 255, 0.72)',
        glassFillElevated: 'rgba(255, 255, 255, 0.88)',

        // Scrim behind modals
        overlay: 'rgba(12, 35, 64, 0.42)',

        // Semantic — one value each, all >= 4.5:1 on white
        success: '#0F7A57',
        successSoft: 'rgba(15, 122, 87, 0.12)',
        danger: '#C62F2F',
        dangerSoft: 'rgba(198, 47, 47, 0.12)',
        warning: '#A96A00',
        warningSoft: 'rgba(169, 106, 0, 0.12)',
        info: '#2F6FB0',
        infoSoft: 'rgba(47, 111, 176, 0.12)',
    },
    gradient: {
        app: ['#FFFFFF', '#F7F9FC', '#EEF2F7'] as const,
        vignette: ['transparent', 'rgba(12, 35, 64, 0.06)'] as const,
        gold: ['#D4AF37', '#C99700'] as const,
        navy: ['#0C2340', '#173A63'] as const,
    },
    radius: {
        card: 20,
        pill: 28,
        button: 14,
        sm: 10,
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        xxl: 32,
    },
    /** Light-theme shadows are navy-tinted and soft; heavy black reads as dirt. */
    shadow: {
        card: {
            shadowColor: ND_NAVY,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 3,
        },
        raised: {
            shadowColor: ND_NAVY,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.12,
            shadowRadius: 28,
            elevation: 8,
        },
        goldGlow: {
            shadowColor: ND_GOLD,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.28,
            shadowRadius: 18,
            elevation: 6,
        },
    },
} as const;

export const glassSurface = {
    backgroundColor: VisualSystem.colors.bgMid,
    borderWidth: 1,
    borderColor: VisualSystem.colors.borderSubtle,
    borderRadius: VisualSystem.radius.card,
    overflow: 'hidden' as const,
    ...VisualSystem.shadow.card,
};

export const glassSurfaceGold = {
    ...glassSurface,
    borderColor: VisualSystem.colors.borderGold,
    backgroundColor: VisualSystem.colors.bgMid,
};
