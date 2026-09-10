import { Redirect } from 'expo-router';

/**
 * Legacy route — goals live in Personal Profile.
 *
 * Uses <Redirect> rather than router.replace() in an effect: on a cold deep
 * link the effect fires before the navigation tree has mounted, which throws
 * "Attempted to navigate before mounting the Root Layout component".
 */
export default function CalorieTarget() {
    return <Redirect href="/profile/personal-info" />;
}
