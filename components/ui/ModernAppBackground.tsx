import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VisualSystem } from '@/constants/VisualSystem';

/**
 * App-wide background.
 *
 * The previous version painted an animated starfield over a navy gradient. On
 * the light theme white stars are invisible against a near-white page, so this
 * is now a clean light wash with a single gold hairline for brand. Content
 * carries the visual interest instead of the backdrop, which is what keeps the
 * app reading as "neat" rather than busy.
 *
 * The exports and props are unchanged so existing imports keep working.
 */

type ModernAppBackgroundProps = {
    /** Softer treatment for loading screens — drops the accent line. */
    minimal?: boolean;
};

export function ModernAppBackground({ minimal }: ModernAppBackgroundProps) {
    return (
        <View style={styles.fullContainer} pointerEvents="none">
            <LinearGradient
                colors={[...VisualSystem.gradient.app]}
                style={StyleSheet.absoluteFill}
                start={[0, 0]}
                end={[0, 1]}
            />
            {/* Very slight warm lift at the bottom so long pages don't read flat. */}
            <LinearGradient
                colors={[...VisualSystem.gradient.vignette]}
                style={StyleSheet.absoluteFill}
                start={[0, 0.55]}
                end={[0, 1]}
            />
            {!minimal && Platform.OS === 'web' && <View style={styles.webAccentBar} />}
        </View>
    );
}

/**
 * @deprecated Global ModernAppBackground is sufficient — kept as no-op for imports.
 */
export function WorkoutAmbientBackground() {
    return null;
}

/**
 * @deprecated The starfield overlay belonged to the dark theme. Kept as a no-op
 * so screens that still import it keep rendering.
 */
export function GymStarOverlay() {
    return null;
}

const styles = StyleSheet.create({
    fullContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    webAccentBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: VisualSystem.colors.gold,
    },
});
