/**
 * FitVerse visual system — modern, professional ND dark theme.
 */
export const VisualSystem = {
    colors: {
        bgBase: '#0A1F38',
        bgMid: '#0C2340',
        bgDeep: '#081A30',
        bgElevated: '#132D52',
        gold: '#D4AF37',
        goldSoft: 'rgba(212, 175, 55, 0.35)',
        goldMuted: 'rgba(212, 175, 55, 0.12)',
        textPrimary: '#F4F7FB',
        textSecondary: '#9EB0C8',
        textTertiary: '#6B8299',
        borderSubtle: 'rgba(255, 255, 255, 0.08)',
        borderGold: 'rgba(212, 175, 55, 0.22)',
        glassFill: 'rgba(255, 255, 255, 0.055)',
        glassFillElevated: 'rgba(255, 255, 255, 0.09)',
        overlay: 'rgba(8, 20, 38, 0.72)',
    },
    gradient: {
        app: ['#0A1F38', '#0C2340', '#0F2A4C'] as const,
        vignette: ['transparent', 'rgba(8, 20, 38, 0.5)'] as const,
    },
    radius: {
        card: 20,
        pill: 28,
        button: 14,
    },
    shadow: {
        card: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.22,
            shadowRadius: 24,
            elevation: 8,
        },
        goldGlow: {
            shadowColor: '#D4AF37',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.28,
            shadowRadius: 20,
            elevation: 10,
        },
    },
} as const;

export const glassSurface = {
    backgroundColor: VisualSystem.colors.glassFill,
    borderWidth: 1,
    borderColor: VisualSystem.colors.borderSubtle,
    borderRadius: VisualSystem.radius.card,
    overflow: 'hidden' as const,
    ...VisualSystem.shadow.card,
};

export const glassSurfaceGold = {
    ...glassSurface,
    borderColor: VisualSystem.colors.borderGold,
    backgroundColor: VisualSystem.colors.glassFillElevated,
};
