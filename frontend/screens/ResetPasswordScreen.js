import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BLUE = '#2563EB';
const BLUE_DARK = '#1D4ED8';
const BLUE_LIGHT = '#EFF6FF';

// ─── Blue Animated Button Component ─────────────────────────────────────────
function ActionButton({ onPress, disabled, loading, label, testID, variant = 'primary' }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: Platform.OS !== 'web', speed: 50 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 50 }).start();

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.6 : 1 }}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        disabled={disabled || loading}
        style={[styles.btnWrap, !isPrimary && styles.btnSecondary]}
      >
        {isPrimary ? (
          <LinearGradient
            colors={[BLUE, BLUE_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGrad}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnText}>{label}</Text>
            )}
          </LinearGradient>
        ) : (
          <View style={styles.btnSecondaryInner}>
            {loading ? (
              <ActivityIndicator color={BLUE} size="small" />
            ) : (
              <Text style={styles.btnSecondaryText}>{label}</Text>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Input Component ────────────────────────────────────────────────────────
function CustomInput({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  testID,
  rightElement,
}) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#BFDBFE', BLUE],
  });

  return (
    <Animated.View style={[styles.inputWrap, { borderColor }]}>
      <Ionicons name={icon} size={17} color={focused ? BLUE : '#93C5FD'} style={styles.inputIcon} />
      <TextInput
        testID={testID}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        placeholderTextColor="#93C5FD"
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {rightElement}
    </Animated.View>
  );
}

// ─── Main Screen Component ───────────────────────────────────────────────────
export default function ResetPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    resetPassword,
    checkEmailExists,
    completePasswordReset,
    authLoading,
  } = useAuth();

  // State Machine: 'email' -> 'sent' -> 'verifying' -> 'verified' -> 'reset' -> 'completed'
  const [stage, setStage] = useState('email');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isVerifyingLink, setIsVerifyingLink] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [pastedUrl, setPastedUrl] = useState('');

  // 1. Step 1: Send Verification Link (Forgot Password)
  const handleSendVerificationLink = async () => {
    setError('');
    setSuccess('');
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Validate email format
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsCheckingEmail(true);

    try {
      // 2. Check the user database/profiles to verify if email exists
      const registered = await checkEmailExists(trimmedEmail);
      if (!registered) {
        // Step 3: If email does not exist, show exact required error message and DO NOT send link
        setError('Email not registered. Please create an account first.');
        setIsCheckingEmail(false);
        return;
      }

      // 4. If email exists, send secure reset link configured with deep link
      // Primary deep link: grammapp://reset-password
      const redirectUrl = Linking.createURL('reset-password', { scheme: 'grammapp' });
      await resetPassword(trimmedEmail, redirectUrl);

      setIsCheckingEmail(false);
      // Step 5: Show exact success message
      setSuccess('Verification link sent. Please check your email.');
      setStage('sent');
    } catch (err) {
      setIsCheckingEmail(false);
      setError(err.message || 'Unable to send verification link. Please try again.');
    }
  };

  // 2. Email Link Verification Logic (Deep Linking)
  const applySessionFromUrl = async (url) => {
    if (!url) return false;
    setError('');
    setIsVerifyingLink(true);

    try {
      // Supabase appends tokens in URL fragment: #access_token=...&refresh_token=...&type=recovery
      let fragment = '';
      if (url.includes('#')) {
        fragment = url.split('#')[1] || '';
      } else if (url.includes('?')) {
        fragment = url.split('?')[1] || '';
      }

      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const type = params.get('type');
      const token = params.get('token');

      // Check if recovery link or valid access token
      if (type === 'recovery' && access_token) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token || access_token,
        });

        if (sessionErr) throw sessionErr;

        setIsVerified(true);
        setIsVerifyingLink(false);
        setStage('reset');
        setSuccess('✓ Email Verified Successfully');
        return true;
      } else if (token || access_token) {
        // Fallback session attempt
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: access_token || token,
          refresh_token: refresh_token || token,
        });
        if (!sessionErr) {
          setIsVerified(true);
          setIsVerifyingLink(false);
          setStage('reset');
          setSuccess('✓ Email Verified Successfully');
          return true;
        }
      }

      // Check if active recovery session already exists
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        setIsVerified(true);
        setIsVerifyingLink(false);
        setStage('reset');
        setSuccess('✓ Email Verified Successfully');
        return true;
      }

      throw new Error('This password reset link has expired. Please request a new one.');
    } catch (err) {
      setIsVerifyingLink(false);
      setIsVerified(false);
      setError('This password reset link has expired. Please request a new one.');
      return false;
    }
  };

  // Handle deep link listener on mount
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && (initialUrl.includes('reset') || initialUrl.includes('access_token') || initialUrl.includes('grammapp'))) {
          if (isMounted) {
            await applySessionFromUrl(initialUrl);
          }
        }
      } catch (e) {
        console.log('Error checking initial URL:', e?.message);
      }
    })();

    const subscription = Linking.addEventListener('url', async ({ url }) => {
      if (url && (url.includes('reset') || url.includes('access_token') || url.includes('grammapp'))) {
        if (isMounted) {
          await applySessionFromUrl(url);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  // 3. Step 3: Handle Reset Password Submission
  const handleResetPasswordSubmit = async () => {
    setError('');
    setSuccess('');

    // Security check: Must have completed verification process
    if (!isVerified) {
      const { data: currentSession } = await supabase.auth.getSession();
      if (!currentSession?.session) {
        setError('This password reset link has expired. Please request a new one.');
        setStage('email');
        return;
      }
    }

    // Validate fields filled
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Validate security rules
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      // Update password in Supabase Auth & record database fields
      await completePasswordReset(newPassword);

      setSuccess('✓ Password Reset Successfully');
      setStage('completed');

      // Automatically redirect user to Login Page
      setTimeout(() => {
        navigation.replace('Login');
      }, 2500);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('expired') || msg.includes('jwt') || msg.includes('session')) {
        setError('This password reset link has expired. Please request a new one.');
        setIsVerified(false);
      } else {
        setError(msg || 'Failed to update password. Please try again.');
      }
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Top Blue Gradient ────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1D4ED8', '#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.topSection, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.logoRing}>
          <Ionicons name="key-outline" size={32} color="#fff" />
        </View>

        <Text style={styles.wordmark}>
          CYBER<Text style={styles.wordmarkAccent}>SHIELD</Text>
        </Text>
        <Text style={styles.tagline}>Secure Account Recovery</Text>
      </LinearGradient>

      {/* ── Main Content Card ────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.bottomSection}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.cardScroll, { paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.cardTitleRow}>
              <View style={styles.cardTitleBar} />
              <Text style={styles.cardTitle}>
                {stage === 'email' && 'Forgot Password'}
                {stage === 'sent' && 'Check Email'}
                {stage === 'verifying' && 'Verifying Link'}
                {stage === 'verified' && 'Email Verified'}
                {stage === 'reset' && 'Reset Password'}
                {stage === 'completed' && 'Reset Complete'}
              </Text>
            </View>

            <Text style={styles.cardSub}>
              {stage === 'email' && 'Enter your registered email to receive a password reset link.'}
              {stage === 'sent' && 'We sent a verification link to your email address.'}
              {stage === 'verifying' && 'Validating your verification token...'}
              {stage === 'verified' && 'Redirecting to password reset form...'}
              {stage === 'reset' && 'Enter and confirm your new account password.'}
              {stage === 'completed' && 'Your password has been changed successfully.'}
            </Text>

            {/* Error Message Alert */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Success Message Alert */}
            {success ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text style={styles.successText}>{success}</Text>
              </View>
            ) : null}

            {/* ── STAGE 1: Forgot Password (Email Input) ── */}
            {stage === 'email' && (
              <View style={styles.formGap}>
                <CustomInput
                  testID="forgot-email-input"
                  icon="mail-outline"
                  placeholder="Registered Email Address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />

                <ActionButton
                  testID="send-link-button"
                  label="Send Verification Link"
                  onPress={handleSendVerificationLink}
                  loading={isCheckingEmail || authLoading}
                  disabled={isCheckingEmail || authLoading}
                />
              </View>
            )}

            {/* ── STAGE 2: Verification Sent / Link Handling ── */}
            {stage === 'sent' && (
              <View style={styles.formGap}>
                <View style={styles.infoBox}>
                  <Ionicons name="mail-unread-outline" size={24} color={BLUE} />
                  <Text style={styles.infoText}>
                    Click the link in your email to open the app and verify your reset request.
                  </Text>
                </View>

                {/* Paste Link Fallback */}
                <View style={styles.pasteBox}>
                  <Text style={styles.pasteLabel}>Or paste recovery link here:</Text>
                  <CustomInput
                    icon="link-outline"
                    placeholder="grammapp://reset-password#access_token=..."
                    value={pastedUrl}
                    onChangeText={setPastedUrl}
                  />
                  <ActionButton
                    label="Verify Pasted Link"
                    variant="secondary"
                    onPress={() => applySessionFromUrl(pastedUrl.trim())}
                    loading={isVerifyingLink}
                  />
                </View>
              </View>
            )}

            {/* ── STAGE 2.5: Verifying / Verified Loader ── */}
            {(stage === 'verifying' || stage === 'verified') && (
              <View style={styles.centeredStage}>
                <ActivityIndicator size="large" color={BLUE} style={{ marginVertical: 16 }} />
                <Text style={styles.stageStatusText}>
                  {stage === 'verifying' ? 'Verifying link tokens...' : '✓ Email Verified Successfully'}
                </Text>
              </View>
            )}

            {/* ── STAGE 3: Reset Password Form ── */}
            {stage === 'reset' && (
              <View style={styles.formGap}>
                <CustomInput
                  testID="new-password-input"
                  icon="lock-closed-outline"
                  placeholder="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  rightElement={
                    <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={17}
                        color="#93C5FD"
                      />
                    </Pressable>
                  }
                />

                <CustomInput
                  testID="confirm-password-input"
                  icon="shield-checkmark-outline"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  rightElement={
                    <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={17}
                        color="#93C5FD"
                      />
                    </Pressable>
                  }
                />

                <ActionButton
                  testID="reset-password-button"
                  label="Reset Password"
                  onPress={handleResetPasswordSubmit}
                  loading={authLoading}
                  disabled={authLoading}
                />
              </View>
            )}

            {/* ── STAGE 4: Password Reset Successfully ── */}
            {stage === 'completed' && (
              <View style={styles.completedGap}>
                <View style={styles.successIconBadge}>
                  <Ionicons name="checkmark-sharp" size={36} color="#fff" />
                </View>

                <Text style={styles.completedHeadline}>✓ Password Reset Successfully</Text>
                <Text style={styles.completedSub}>
                  Your password has been changed. Please login using your new password.
                </Text>

                <ActionButton
                  testID="go-to-login-button"
                  label="Back to Login"
                  onPress={() => navigation.replace('Login')}
                />
              </View>
            )}

            {/* Navigation back to Login */}
            {stage !== 'completed' && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                style={styles.backLinkWrap}
              >
                <Ionicons name="arrow-back" size={14} color={BLUE} />
                <Text style={styles.backLinkText}>Back to Login</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  topSection: {
    alignItems: 'center',
    paddingBottom: 28,
    gap: 6,
  },
  logoRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  wordmark: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: 3 },
  wordmarkAccent: { color: 'rgba(255,255,255,0.65)' },
  tagline: { fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 },

  bottomSection: { flex: 1 },
  cardScroll: { flexGrow: 1 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -16,
    paddingHorizontal: 24,
    paddingTop: 26,
    gap: 14,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },

  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitleBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: BLUE },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#1E3A5F' },
  cardSub: { fontSize: 13, color: '#64748B', marginTop: -4, lineHeight: 18 },

  formGap: { gap: 12, marginTop: 4 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    backgroundColor: BLUE_LIGHT,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#1E3A5F',
    backgroundColor: 'transparent',
  },
  eyeBtn: { padding: 6 },

  btnWrap: { borderRadius: 12, overflow: 'hidden' },
  btnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  btnSecondary: {
    borderWidth: 1.5,
    borderColor: BLUE,
    backgroundColor: BLUE_LIGHT,
  },
  btnSecondaryInner: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnSecondaryText: { color: BLUE, fontSize: 14, fontWeight: '700' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { color: '#DC2626', fontSize: 13, flex: 1, fontWeight: '500' },

  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successText: { color: '#047857', fontSize: 13, flex: 1, fontWeight: '600' },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BLUE_LIGHT,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: { flex: 1, fontSize: 13, color: '#1E3A5F', lineHeight: 18 },

  pasteBox: { marginTop: 8, gap: 8 },
  pasteLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },

  centeredStage: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  stageStatusText: { fontSize: 14, fontWeight: '700', color: BLUE },

  completedGap: { alignItems: 'center', paddingVertical: 16, gap: 14 },
  successIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  completedHeadline: { fontSize: 18, fontWeight: '800', color: '#047857', textAlign: 'center' },
  completedSub: { fontSize: 13, color: '#475569', textAlign: 'center', paddingHorizontal: 16, lineHeight: 18 },

  backLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  backLinkText: { fontSize: 13, color: BLUE, fontWeight: '700' },
});
