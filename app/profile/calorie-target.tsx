import { useEffect } from 'react';
import { router } from 'expo-router';

/** Legacy route — goals live in Personal Profile. */
export default function CalorieTarget() {
    useEffect(() => {
        router.replace('/profile/personal-info');
    }, []);
    return null;
}
