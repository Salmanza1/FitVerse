import { Stack } from 'expo-router';
import { webStackContent } from '@/constants/webLayout';

export default function ProfileLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: webStackContent,
            }}
        />
    );
}
