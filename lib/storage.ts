import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
    REMEMBERED_EMAIL: 'fitverse_remembered_email', // Stored email for login screen
};

/**
 * Service for lightweight, persistent local key-value storage.
 * This should ONLY be used for non-sensitive UI-only preferences.
 * Auth and primary data should use Supabase.
 */
export const storage = {
    // Remember Me Feature
    async setRememberedEmail(email: string | null): Promise<void> {
        try {
            if (email) {
                await AsyncStorage.setItem(KEYS.REMEMBERED_EMAIL, email);
            } else {
                await AsyncStorage.removeItem(KEYS.REMEMBERED_EMAIL);
            }
        } catch (e) {
            console.error('Failed to set remembered email:', e);
        }
    },

    async getRememberedEmail(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(KEYS.REMEMBERED_EMAIL);
        } catch (e) {
            return null;
        }
    },

    // Administrative / Debugging
    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.multiRemove(Object.values(KEYS));
            console.log('Local storage cleared successfully');
        } catch (e) {
            console.error('Failed to clear storage:', e);
            throw e;
        }
    }
};
