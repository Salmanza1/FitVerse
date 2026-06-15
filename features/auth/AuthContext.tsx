import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, AuthState } from '@/types/user';
import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { mapProfile, mapProfileUpdate } from '@/lib/mapping';
import { SocialStore } from '@/features/social/SocialStore';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetAppHomeRoute, goToAppHome } from '@/lib/navigation';
import {
    buildPersonalizationSnapshot,
    PersonalizationSnapshot,
} from '@/features/auth/personalization';

export type { PersonalizationSnapshot };

interface AuthContextType extends AuthState {
    isAuthLoading: boolean;
    isInitialCheck: boolean; // For cold start splash
    isPersonalizing: boolean;
    personalizationSnapshot: PersonalizationSnapshot | null;
    completePersonalization: () => void;
    signUp: (user: UserProfile, password: string, remember?: boolean) => Promise<{ session: any; user: any }>;
    login: (identifier: string, password: string, remember?: boolean) => Promise<{ success: boolean; errorCode?: 'invalid_credentials' | 'user_not_found' | 'unknown' }>;
    signOut: () => Promise<void>;
    updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
    refreshProfile: () => Promise<void>;
    resetDatabase: () => Promise<void>;
    sendPasswordResetOtp: (email: string) => Promise<boolean>;
    verifyPasswordResetOtp: (email: string, token: string, newPassword: string) => Promise<string | null>;
    recoverSession: () => Promise<{ ok: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    isAuthLoading: false,
    isInitialCheck: true,
    isPersonalizing: false,
    personalizationSnapshot: null,
    completePersonalization: () => {},
    signUp: async () => ({ session: null, user: null }),
    login: async () => ({ success: false, errorCode: 'unknown' }),
    signOut: async () => { },
    updateProfile: async () => { },
    refreshProfile: async () => { },
    resetDatabase: async () => { },
    sendPasswordResetOtp: async () => false,
    verifyPasswordResetOtp: async () => null,
    recoverSession: async () => ({ ok: false }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [isInitialCheck, setIsInitialCheck] = useState(true);
    const [isPersonalizing, setIsPersonalizing] = useState(false);
    const [personalizationSnapshot, setPersonalizationSnapshot] =
        useState<PersonalizationSnapshot | null>(null);

    const completePersonalization = () => {
        setIsPersonalizing(false);
        setPersonalizationSnapshot(null);
    };

    // Initial session load & auth state listener
    useEffect(() => {
        // Tells Supabase to automatically refresh tokens when app comes to foreground
        const appStateListener = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                supabase.auth.startAutoRefresh();
            } else {
                supabase.auth.stopAutoRefresh();
            }
        });

        // Get initial session (fails with "Network request failed" if device can't reach Supabase)
        supabase.auth.getSession()
            .then(({ data: { session } }: any) => {
                if (session) {
                    fetchUserProfile(session.user.id);
                } else {
                    setIsInitialCheck(false);
                    setIsLoading(false);
                }
            })
            .catch((err: Error) => {
                console.error('[Auth] getSession failed — check Wi‑Fi and Supabase project status:', err.message);
                setIsInitialCheck(false);
                setIsLoading(false);
            });

        // Listen for auth events (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            if (session) {
                fetchUserProfile(session.user.id);
            } else {
                setUser(null);
                setIsInitialCheck(false);
                setIsLoading(false);
            }
        });

        return () => {
            appStateListener.remove();
            subscription.unsubscribe();
        };
    }, []);

    // Fetches the extended profile data from our custom `profiles` table
    const fetchUserProfile = async (userId: string, retryCount = 0) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                // If not found, and we haven't retried yet, wait a bit and try again (trigger might be slow)
                if (retryCount < 2) {
                    console.warn(`[Auth] Profile not found for ${userId}, retrying in 1.5s...`);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    return fetchUserProfile(userId, retryCount + 1);
                } else {
                    // SELF-HEALING
                    console.warn(`[Auth] Profile still missing for ${userId}. Attempting auto-recreation...`);
                    const { data: { user: authUser } } = await supabase.auth.getUser();
                    if (authUser) {
                        const newProfile = {
                            id: authUser.id,
                            email: authUser.email,
                            display_name: authUser.user_metadata?.display_name || 'Student',
                            name: authUser.user_metadata?.full_name || '',
                        };
                        
                        const { error: insertError } = await supabase
                            .from('profiles')
                            .upsert(newProfile, { onConflict: 'id' });
                            
                        if (!insertError) {
                            return fetchUserProfile(userId, 0); 
                        }
                    }
                    setUser(null);
                    return;
                }
            }

            const mappedUser = mapProfile(data);
            const social = await SocialStore.getSocialSummary(userId);
            setUser({
                ...mappedUser,
                friends: social.friendIds,
                friendRequestsReceived: social.friendRequestsReceived,
                friendRequestsSent: social.friendRequestsSent,
            });

        } catch (error: any) {
            console.error(`[Auth] Critical error in fetchUserProfile:`, error.message || error);
            setUser(null);
        } finally {
            setIsLoading(false);
            setIsInitialCheck(false);
        }
    };

    const signUp = async (newUserProfile: UserProfile, password: string, remember: boolean = true): Promise<{ session: any; user: any }> => {
        setIsAuthLoading(true);
        try {
            const signupEmail = newUserProfile.email.toLowerCase().trim();

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: signupEmail,
                password,
                options: {
                    data: {
                        display_name: newUserProfile.displayName,
                        full_name: newUserProfile.name,
                        gender: newUserProfile.gender,
                        age: newUserProfile.age,
                        height_cm: newUserProfile.heightCm,
                        weight_kg: newUserProfile.weightKg,
                        goal: newUserProfile.goal,
                        dorm: newUserProfile.dorm,
                        protein_target: newUserProfile.proteinTarget,
                        carb_target: newUserProfile.carbTarget,
                        fat_target: newUserProfile.fatTarget,
                        calorie_target: newUserProfile.calorieTarget,
                    },
                },
            });

            if (authError) {
                const msg = (authError.message || '').toLowerCase();
                if (msg.includes('already registered') || msg.includes('already exists')) {
                    throw new Error('This @nd.edu email is already registered. Try logging in, or use Forgot Password.');
                }
                throw authError;
            }
            if (!authData.user) throw new Error('Failed to create user account.');

            if (remember) {
                await storage.setRememberedEmail(signupEmail);
            }

            // Supabase sometimes creates the user but returns no session (email confirm, etc.)
            let session = authData.session;
            let authUser = authData.user;

            if (!session) {
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: signupEmail,
                    password,
                });

                if (signInError) {
                    const signInMsg = (signInError.message || '').toLowerCase();
                    if (signInMsg.includes('confirm') || signInMsg.includes('verified')) {
                        throw new Error(
                            'Account created! Check your @nd.edu inbox for a confirmation email, then log in.'
                        );
                    }
                    if (signInMsg.includes('invalid login') || signInMsg.includes('invalid credentials')) {
                        throw new Error(
                            'Account may already exist for this email. Try logging in with your password, or use Forgot Password.'
                        );
                    }
                    throw signInError;
                }

                session = signInData.session;
                authUser = signInData.user;
            }

            if (!session || !authUser) {
                throw new Error('Account created but we could not start your session. Try logging in.');
            }

            await new Promise((resolve) => setTimeout(resolve, 800));

            const profileUpdate = mapProfileUpdate(newUserProfile);
            const { error: profileError } = await supabase
                .from('profiles')
                .update(profileUpdate)
                .eq('id', authUser.id);

            if (profileError) {
                console.error('[Auth] Profile update after signup:', profileError.message);
            }

            if (newUserProfile.weightKg > 0) {
                const { logWeightCheck } = await import('@/features/weight/WeightCheckStore');
                await logWeightCheck(authUser.id, newUserProfile.weightKg, 'signup_baseline');
            }
            if (
                newUserProfile.weightCheckEnabled !== false &&
                newUserProfile.weeklyWeightCheckDay &&
                newUserProfile.weeklyWeightCheckTime
            ) {
                const { scheduleWeeklyWeightCheckReminder } = await import('@/lib/weightCheckNotifications');
                await scheduleWeeklyWeightCheckReminder(
                    newUserProfile.weeklyWeightCheckDay,
                    newUserProfile.weeklyWeightCheckTime
                );
            }

            await fetchUserProfile(authUser.id);
            await resetAppHomeRoute(AsyncStorage);

            setPersonalizationSnapshot(buildPersonalizationSnapshot(newUserProfile));
            setIsAuthLoading(false);
            setIsPersonalizing(true);
            return { session, user: authUser };
        } catch (e: any) {
            console.error('[Auth] Sign up failed:', e?.message || e);
            setIsAuthLoading(false);
            setUser(null);
            throw e;
        }
    };

    const login = async (identifier: string, password: string, remember: boolean = true): Promise<{ success: boolean; errorCode?: 'invalid_credentials' | 'user_not_found' | 'unknown' }> => {
        setIsAuthLoading(true);
        try {
            // SECURITY: Explicitly clear any existing session/user state BEFORE trying a new login.
            await supabase.auth.signOut();
            setUser(null);
            // Brief pause to allow storage and client state to settle
            await new Promise(resolve => setTimeout(resolve, 150));

            let emailToUse = identifier.trim().toLowerCase();

            // If the identifier doesn't look like an email, treat it as a username.
            if (!emailToUse.includes('@')) {
                const { data: resolvedEmail, error: rpcError } = await supabase
                    .rpc('get_email_for_username', { p_username: emailToUse });

                if (rpcError || !resolvedEmail) {
                    setIsAuthLoading(false);
                    return { success: false, errorCode: 'user_not_found' };
                }

                emailToUse = (resolvedEmail as string).trim().toLowerCase();
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password: password,
            });

            if (error) {
                console.warn(`[Auth] Login error for ${emailToUse}:`, error.message);
                setIsAuthLoading(false);
                setUser(null);
                return { success: false, errorCode: 'invalid_credentials' };
            }

            if (!data.session || !data.user) {
                console.error("[Auth] Success response but missing session data.");
                setIsAuthLoading(false);
                return { success: false, errorCode: 'unknown' };
            }

            if (remember) {
                await storage.setRememberedEmail(emailToUse);
            } else {
                await storage.setRememberedEmail(null);
            }

            await fetchUserProfile(data.user.id);
            await resetAppHomeRoute(AsyncStorage);

            setTimeout(() => setIsAuthLoading(false), 1500);
            return { success: true };

        } catch (e) {
            console.error('[Auth] Unexpected login error:', e);
            setIsAuthLoading(false);
            setUser(null);
            return { success: false, errorCode: 'unknown' };
        }
    };

    const signOut = async () => {
        setIsLoading(true);
        completePersonalization();
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Error signing out:", error);
        setUser(null);
        setIsLoading(false);
    };

    const updateProfile = async (updates: Partial<UserProfile>) => {
        if (!user) return;

        try {
            // Convert camelCase to snake_case for Supabase
            const updatePayload = mapProfileUpdate(updates);

            const { error } = await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('id', user.id);

            if (error) throw error;

            // Optimistically update local state
            setUser({ ...user, ...updates });
        } catch (e) {
            console.error('Profile update failed:', e);
            throw e;
        }
    };

    const refreshProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = user?.id ?? session?.user?.id;
        if (userId) {
            await fetchUserProfile(userId);
        }
    };

    /** Use when signup/login succeeded but navigation landed on a missing screen. */
    const recoverSession = async (): Promise<{ ok: boolean; message?: string }> => {
        setIsAuthLoading(true);
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session?.user) {
                return {
                    ok: false,
                    message: 'No active session. Log in with your @nd.edu email and password first.',
                };
            }

            await resetAppHomeRoute(AsyncStorage);
            await fetchUserProfile(session.user.id);
            setIsAuthLoading(false);
            goToAppHome();
            return { ok: true };
        } catch (e: any) {
            setIsAuthLoading(false);
            return { ok: false, message: e?.message || 'Could not restore your session.' };
        }
    };

    const resetDatabase = async () => {
        // Only clears local legacy storage now
        await storage.clearAll();
        // Force signout from Supabase
        await signOut();
    };

    const sendPasswordResetOtp = async (email: string): Promise<boolean> => {
        setIsAuthLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
            setIsAuthLoading(false);
            if (error) {
                console.error("[Auth] Reset password error:", error.message);
                return false;
            }
            return true;
        } catch (e) {
            console.error("[Auth] send reset error:", e);
            setIsAuthLoading(false);
            return false;
        }
    };

    const verifyPasswordResetOtp = async (email: string, token: string, newPassword: string): Promise<string | null> => {
        setIsAuthLoading(true);
        try {
            const { error: verifyError } = await supabase.auth.verifyOtp({
                email: email.trim().toLowerCase(),
                token: token.trim(),
                type: 'recovery',
            });

            if (verifyError) {
                console.error("[Auth] Verify OTP error:", verifyError.message);
                setIsAuthLoading(false);
                return verifyError.message || "Invalid or expired code.";
            }

            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            
            if (updateError) {
                console.error("[Auth] Update password error:", updateError.message);
                setIsAuthLoading(false);
                return updateError.message || "Failed to set new password.";
            }

            // SECURITY/ROBUSTNESS: After updating the password, we sign out.
            await supabase.auth.signOut();
            setUser(null);
            
            setIsAuthLoading(false);
            return null; // success
        } catch (e) {
            console.error("[Auth] Unexpected reset error:", e);
            setIsAuthLoading(false);
            return "An unexpected error occurred.";
        }
    };

    return (
        <AuthContext.Provider value={{
            user, isLoading, isAuthLoading, isInitialCheck, isPersonalizing, personalizationSnapshot,
            completePersonalization, signUp, login, signOut, updateProfile, refreshProfile, resetDatabase,
            sendPasswordResetOtp, verifyPasswordResetOtp, recoverSession
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
