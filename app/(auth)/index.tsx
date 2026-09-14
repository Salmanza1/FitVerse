import React, { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity, Modal, ActivityIndicator, useColorScheme } from 'react-native';
import { WebShell } from '@/components/ui/WebShell';
import { webRoot } from '@/constants/webLayout';
import { FontAwesome } from '@expo/vector-icons';
import { Text } from '../../components/Themed';
import { useAuth } from '../../features/auth/AuthContext';
import Colors from '../../constants/Colors';
import { StyledInput } from '../../components/ui/StyledInput';
import { StyledButton } from '../../components/ui/StyledButton';
import { router } from 'expo-router';
// import { AnimatedAstronomyBackground } from '../../components/ui/AnimatedAstronomyBackground'; // Removed duplicate

import { storage } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { VisualSystem } from '@/constants/VisualSystem';

export default function LoginScreen() {
    const [identifier, setIdentifier] = useState(''); // email or username
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    // Forgot Password State
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotStep, setForgotStep] = useState<1 | 2>(1);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotCode, setForgotCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);

    const { login, sendPasswordResetOtp, verifyPasswordResetOtp, recoverSession, isAuthLoading } = useAuth();
    const colorScheme = useColorScheme();

    React.useEffect(() => {
        const fetchRememberedEmail = async () => {
            const rememberedEmail = await storage.getRememberedEmail();
            if (rememberedEmail) {
                setIdentifier(rememberedEmail);
                setRememberMe(true);
            }
        };
        fetchRememberedEmail();
    }, []);

    const handleLogin = async () => {
        if (!identifier.trim() || !password) {
            Alert.alert('Missing Fields', 'Please enter your email (or username) and password.');
            return;
        }

        const result = await login(identifier.trim(), password, rememberMe);
        if (!result.success) {
            if (result.errorCode === 'user_not_found') {
                Alert.alert(
                    'Account Not Found',
                    'No account was found with that username or email. Please check your entry and try again.'
                );
            } else if (result.errorCode === 'invalid_credentials') {
                Alert.alert(
                    'Login Failed',
                    'The email/username or password you entered is incorrect. Please try again.'
                );
            } else {
                Alert.alert('Login Failed', 'An unexpected error occurred. Please try again.');
            }
        }
    };

    const handleForgotPasswordSend = async () => {
        if (!forgotEmail.trim()) {
            Alert.alert("Error", "Please enter your email.");
            return;
        }
        setForgotLoading(true);

        // Let's directly call it here to get the explicit error message for the user
        const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim());

        setForgotLoading(false);

        if (error) {
            // Check if it's the specific Supabase rate limit error
            if (error.message.includes('rate limit') || error.message.includes('seconds')) {
                Alert.alert(
                    "Rate Limit Reached ⏳",
                    "Supabase limits test emails to 3 per hour. If you already received a code recently, please click 'Already have a code?' to enter it!"
                );
            } else {
                Alert.alert("Error", error.message);
            }
        } else {
            setForgotStep(2);
        }
    };

    const handleForgotPasswordVerify = async () => {
        if (!forgotCode.trim() || !newPassword.trim()) {
            Alert.alert("Error", "Please enter the code and a new password.");
            return;
        }

        // Password complexity check (matches signup requirements)
        const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
        if (newPassword.length < 8 || !specialCharRegex.test(newPassword)) {
            Alert.alert("Weak Password", "Use at least 8 characters and 1 special character for your new password.");
            return;
        }

        setForgotLoading(true);
        const errorMsg = await verifyPasswordResetOtp(forgotEmail, forgotCode, newPassword);
        setForgotLoading(false);
        if (errorMsg) {
            Alert.alert("Error", errorMsg);
        } else {
            Alert.alert("Success", `Password updated successfully for ${forgotEmail.toLowerCase().trim()}! You can now log in.`, [
                {
                    text: "OK", onPress: () => {
                        setShowForgotModal(false);
                        // Clear the password field to encourage fresh entry
                        setPassword('');
                    }
                }
            ]);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'web' ? undefined : 'height'}
            style={webRoot}
        >
            {/* <AnimatedAstronomyBackground /> // Removed duplicate */}
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <WebShell maxWidth={480}>
                <View style={styles.header}>
                    <Text style={styles.welcomePill}>Welcome to</Text>
                    <Text style={styles.logoText}>FitVerse</Text>
                    <Text style={styles.logoSubText}>Notre dame edition</Text>

                    <Text style={styles.heroDescription}>
                        Your all-in-one platform for campus fitness, dining, and wellness.
                    </Text>
                </View>

                <View style={styles.formCard}>
                    <Text style={[styles.title, { color: VisualSystem.colors.textPrimary }]}>Student Login</Text>

                    <StyledInput
                        label="Email or Username"
                        placeholder="student@nd.edu or your username"
                        value={identifier}
                        onChangeText={setIdentifier}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        textContentType="username"
                        autoComplete="username"
                    />

                    <StyledInput
                        label="Password"
                        placeholder="••••••••"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        textContentType="password"
                        autoComplete="password"
                    />

                    <View style={styles.optionsRow}>
                        <TouchableOpacity
                            style={styles.rememberRow}
                            onPress={() => setRememberMe(!rememberMe)}
                            activeOpacity={0.7}
                        >
                            <FontAwesome
                                name={rememberMe ? "check-square" : "square-o"}
                                size={20}
                                color={rememberMe ? "#C99700" : "#666"}
                            />
                            <Text style={styles.rememberText}>Remember Me</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                setForgotStep(1);
                                // Pre-fill email field if identifier looks like an email
                                setForgotEmail(identifier.includes('@') ? identifier : '');
                                setForgotCode('');
                                setNewPassword('');
                                setShowForgotModal(true);
                            }}
                        >
                            <Text style={styles.forgotText}>Forgot Password?</Text>
                        </TouchableOpacity>
                    </View>

                    <StyledButton title="Log In" onPress={handleLogin} />

                    <View style={styles.divider} />

                    <StyledButton
                        title="Create Account"
                        onPress={() => router.push('/(auth)/signup')}
                        variant="outline"
                    />

                    <TouchableOpacity
                        style={styles.recoverLink}
                        onPress={async () => {
                            const result = await recoverSession();
                            if (!result.ok) {
                                Alert.alert('Could not enter app', result.message || 'Try logging in again.');
                            }
                        }}
                    >
                        <Text style={styles.recoverLinkText}>
                            Signed up but stuck? Tap to enter FitVerse
                        </Text>
                    </TouchableOpacity>

                    {Platform.OS === 'web' && (
                        <View style={styles.webTipBox}>
                            <Text style={styles.webTipTitle}>Testing with two accounts?</Text>
                            <Text style={styles.webTipText}>
                                Create Account here, then open an Incognito/private window (or a different browser) for your second account. Sign out before switching in the same window.
                            </Text>
                        </View>
                    )}
                </View>
                </WebShell>
            </ScrollView>

            <Modal visible={showForgotModal} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCard}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Reset Password</Text>
                            <TouchableOpacity accessibilityLabel="Close" onPress={() => setShowForgotModal(false)} hitSlop={10}>
                                <FontAwesome name="times" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {forgotStep === 1 ? (
                            <View>
                                <Text style={styles.modalSubtitle}>Enter your student email, and we'll send you a 6-digit recovery code.</Text>
                                <StyledInput
                                    label="Email"
                                    placeholder="student@nd.edu"
                                    value={forgotEmail}
                                    onChangeText={setForgotEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                                <StyledButton
                                    title={forgotLoading ? "Sending..." : "Send Code"}
                                    onPress={handleForgotPasswordSend}
                                    disabled={forgotLoading}
                                />
                                <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setForgotStep(2)}>
                                    <Text style={{ color: VisualSystem.colors.goldText, textAlign: 'center', fontWeight: '700' }}>Already have a code?</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.modalSubtitle}>We just sent a code to your email. Please enter it below along with your new password.</Text>
                                <StyledInput
                                    label="Recovery Code"
                                    placeholder="123456"
                                    value={forgotCode}
                                    onChangeText={setForgotCode}
                                    keyboardType="number-pad"
                                    textContentType="oneTimeCode"
                                    autoComplete="one-time-code"
                                />
                                <StyledInput
                                    label="New Password"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry
                                    textContentType="password"
                                    autoComplete="password"
                                />
                                <StyledButton
                                    title={forgotLoading ? "Verifying..." : "Update Password"}
                                    onPress={handleForgotPasswordVerify}
                                    disabled={forgotLoading}
                                />
                                <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setForgotStep(1)}>
                                    <Text style={{ color: VisualSystem.colors.textPrimary, textAlign: 'center' }}>Didn't get the code? Try again.</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                </View>
            </Modal>

        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
        paddingTop: 32,
        backgroundColor: 'transparent',
        ...(Platform.OS === 'web' ? { minHeight: '100vh' as unknown as number } : {}),
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    welcomePill: {
        color: VisualSystem.colors.goldText,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
        marginBottom: 8,
        backgroundColor: 'rgba(201, 151, 0, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 22,
        overflow: 'hidden',
    },
    logoText: {
        fontSize: 40,
        fontWeight: '800',
        color: VisualSystem.colors.textPrimary,
        letterSpacing: -1,
        marginBottom: 4,
    },
    logoSubText: {
        fontSize: 13,
        color: VisualSystem.colors.goldText, // ND Gold
        fontWeight: '800',
        letterSpacing: 0.2,
        marginBottom: 16,
    },
    heroDescription: {
        fontSize: 15,
        color: VisualSystem.colors.textPrimary, // Softer secondary text
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: '85%',
    },
    formCard: {
        backgroundColor: VisualSystem.colors.bgMid, // Translucent card
        borderRadius: 22,
        padding: 24,
        borderWidth: 1,
        borderColor: VisualSystem.colors.borderSubtle,
        shadowColor: VisualSystem.colors.navy,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 24,
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: VisualSystem.colors.bgMid,
        marginVertical: 16,
        width: '100%',
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    rememberRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rememberText: {
        color: VisualSystem.colors.textPrimary, // Match secondary text
        marginLeft: 8,
        fontSize: 13,
        fontWeight: '600',
    },
    forgotText: {
        color: VisualSystem.colors.goldText,
        fontSize: 13,
        fontWeight: '600',
    },
    recoverLink: {
        marginTop: 16,
        paddingVertical: 8,
    },
    recoverLinkText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
    },
    webTipBox: {
        marginTop: 16,
        padding: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.22)',
    },
    webTipTitle: {
        color: VisualSystem.colors.goldText,
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 4,
    },
    webTipText: {
        color: VisualSystem.colors.textSecondary,
        fontSize: 11,
        lineHeight: 18,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: VisualSystem.colors.overlay,
        justifyContent: 'center',
        padding: 16,
    },
    modalCard: {
        backgroundColor: VisualSystem.colors.bgMid,
        borderRadius: 22,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
        shadowColor: VisualSystem.colors.navy,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: VisualSystem.colors.textPrimary,
    },
    modalSubtitle: {
        color: VisualSystem.colors.textPrimary,
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 16,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(12, 35, 64, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    loadingText: {
        color: VisualSystem.colors.goldText,
        marginTop: 16,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});
