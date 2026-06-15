import * as Notifications from 'expo-notifications';
import { WeightCheckDay } from '@/types/user';
import { getExpoWeekday, parseCheckTime } from '@/lib/weightCheck';

const WEIGHT_CHECK_NOTIFICATION_ID = 'fitverse-weekly-weight-check';

export async function scheduleWeeklyWeightCheckReminder(
    day: WeightCheckDay,
    time24: string
): Promise<boolean> {
    try {
        const { status } = await Notifications.getPermissionsAsync();
        let finalStatus = status;
        if (status !== 'granted') {
            const { status: requested } = await Notifications.requestPermissionsAsync();
            finalStatus = requested;
        }
        if (finalStatus !== 'granted') return false;

        await Notifications.cancelScheduledNotificationAsync(WEIGHT_CHECK_NOTIFICATION_ID);

        const { hour, minute } = parseCheckTime(time24);
        await Notifications.scheduleNotificationAsync({
            identifier: WEIGHT_CHECK_NOTIFICATION_ID,
            content: {
                title: 'Weekly weigh-in ☘️',
                body: 'Log your weight in FitVerse — see if your plan is working for you.',
                sound: true,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: getExpoWeekday(day),
                hour,
                minute,
            },
        });
        return true;
    } catch (e) {
        if (__DEV__) console.warn('[WeightCheck] schedule notification failed:', e);
        return false;
    }
}

export async function cancelWeeklyWeightCheckReminder(): Promise<void> {
    try {
        await Notifications.cancelScheduledNotificationAsync(WEIGHT_CHECK_NOTIFICATION_ID);
    } catch {
        /* ignore */
    }
}
