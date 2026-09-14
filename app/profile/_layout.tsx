import { Stack } from 'expo-router';
import { webStackContent } from '@/constants/webLayout';

export default function ProfileLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: webStackContent,
                // Each of these screens has its own back chevron.
                gestureEnabled: false,
            }}
        />
    );
}
