import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Haptics that no-op on web so onPress handlers never fail silently. */
export function safeImpact(
    style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light
): void {
    if (Platform.OS === 'web') return;
    try {
        Haptics.impactAsync(style);
    } catch {
        // ignore
    }
}

export function safeNotification(
    type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success
): void {
    if (Platform.OS === 'web') return;
    try {
        Haptics.notificationAsync(type);
    } catch {
        // ignore
    }
}
