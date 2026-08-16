import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import GlowButton from '../components/GlowButton';
import { Typography } from '../constants/theme';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }) {
  const [stage, setStage] = useState('details'); // 'details' | 'otp'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [fullNameFocused, setFullNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const { signUp, signIn, authLoading } = useAuth();

  const handleInitiateSignUp = async () => {
    setError('');
    setSuccess('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSendingOtp(true);
    try {
      await api.sendCustomOtp(trimmedEmail);
      setSuccess(`Verification OTP sent to ${trimmedEmail}`);
      setStage('otp');
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to send verification OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    setError('');
    setSuccess('');
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOtp = otp.trim();

    if (!trimmedOtp || trimmedOtp.length !== 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      // 1. Verify OTP & create auto-confirmed user in Supabase via backend admin API
      await api.registerUser({
        email: trimmedEmail,
        password,
        full_name: fullName.trim(),
        otp: trimmedOtp,
      });

      // Save full name locally so profile displays immediately
      await AsyncStorage.setItem('mock_user_full_name', fullName.trim()).catch(() => {});

      // 2. Log in immediately
      try {
        await signIn({ email: trimmedEmail, password });
        setSuccess('Registration successful!');
        navigation.replace('Main');
      } catch (loginErr) {
        setSuccess('Registration successful! Please log in.');
        navigation.replace('Login');
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'OTP verification or registration failed.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Soft Ambient Glow Background */}
      <View style={[styles.glowAmbient, styles.glowBlue]} />
      <View style={[styles.glowAmbient, styles.glowPurple]} />

      <View style={styles.content}>
        {/* App Logo & Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoPulse} />
            <Ionicons name="shield-checkmark" size={38} color="#2f6eff" />
          </View>
          <Text style={styles.logoText}>CYBER<Text style={{ color: '#2f6eff' }}>SHIELD</Text></Text>
          <Text style={styles.subtitle}>Threat Intelligence & Real-time Scan Protection</Text>
        </View>

        {/* Secure registration card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {stage === 'details' ? 'CREATE SECURE ACCOUNT' : 'VERIFY EMAIL OTP'}
          </Text>
          <Text style={styles.cardSubtitle}>
            {stage === 'details'
              ? 'Provide details to register a new user console profile.'
              : `Enter the 6-digit OTP sent to ${email.trim().toLowerCase()}`}
          </Text>

          {stage === 'details' ? (
            <>
              {/* Full Name Input */}
              <View style={[styles.inputContainer, fullNameFocused && styles.inputFocused]}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={fullNameFocused ? '#2f6eff' : '#64748b'}
                  style={styles.inputIcon}
                />
                <TextInput
                  testID="full-name"
                  placeholder="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                  onFocus={() => setFullNameFocused(true)}
                  onBlur={() => setFullNameFocused(false)}
                />
              </View>

              {/* Email Input */}
              <View style={[styles.inputContainer, emailFocused && styles.inputFocused]}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={emailFocused ? '#2f6eff' : '#64748b'}
                  style={styles.inputIcon}
                />
                <TextInput
                  testID="email"
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>

              {/* Password Input with Eye Icon Toggle */}
              <View style={[styles.inputContainer, passwordFocused && styles.inputFocused]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={passwordFocused ? '#2f6eff' : '#64748b'}
                  style={styles.inputIcon}
                />
                <TextInput
                  testID="password"
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748b" />
                </Pressable>
              </View>
            </>
          ) : (
            <>
              {/* OTP Input */}
              <View style={[styles.inputContainer, otpFocused && styles.inputFocused]}>
                <Ionicons
                  name="key-outline"
                  size={20}
                  color={otpFocused ? '#2f6eff' : '#64748b'}
                  style={styles.inputIcon}
                />
                <TextInput
                  testID="otp-input"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="numeric"
                  maxLength={6}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                  onFocus={() => setOtpFocused(true)}
                  onBlur={() => setOtpFocused(false)}
                />
              </View>
            </>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" style={{ marginRight: 6 }} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          {stage === 'details' ? (
            <GlowButton
              testID="register-button"
              style={styles.registerButton}
              textStyle={styles.registerButtonText}
              onPress={handleInitiateSignUp}
              disabled={isSendingOtp}
              glowColor="#2f6eff"
            >
              {isSendingOtp ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerButtonText}>Continue with Email OTP</Text>
              )}
            </GlowButton>
          ) : (
            <>
              <GlowButton
                testID="verify-otp-button"
                style={styles.registerButton}
                textStyle={styles.registerButtonText}
                onPress={handleVerifyAndRegister}
                disabled={isVerifyingOtp || authLoading}
                glowColor="#2f6eff"
              >
                {isVerifyingOtp || authLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>Verify & Complete Registration</Text>
                )}
              </GlowButton>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <Pressable onPress={() => setStage('details')} disabled={isVerifyingOtp}>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>← Edit Details</Text>
                </Pressable>
                <Pressable onPress={handleInitiateSignUp} disabled={isSendingOtp}>
                  <Text style={{ color: '#2f6eff', fontSize: 13, fontWeight: '600' }}>
                    {isSendingOtp ? 'Sending...' : 'Resend OTP'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Flat text link buttons */}
          <View style={styles.linksRow}>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={styles.linkButtonSingle}
            >
              <Text style={styles.linkText}>Already have an account? Log In</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f6fc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    overflow: 'hidden',
  },
  glowAmbient: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.08,
  },
  glowBlue: {
    backgroundColor: '#2f6eff',
    top: -100,
    right: -100,
  },
  glowPurple: {
    backgroundColor: '#8b5cf6',
    bottom: -150,
    left: -100,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#2f6eff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#2f6eff',
    shadowRadius: 16,
    shadowOpacity: 0.2,
    elevation: 8,
  },
  logoPulse: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: 'rgba(47, 110, 255, 0.15)',
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 2.5,
    fontFamily: Typography.monoBold,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowRadius: 24,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2f6eff',
    letterSpacing: 1.5,
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: Typography.monoBold,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputFocused: {
    borderColor: '#2f6eff',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: 'transparent',
  },
  eyeIcon: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  successText: {
    color: '#10b981',
    fontSize: 12,
    flex: 1,
  },
  registerButton: {
    height: 52,
    backgroundColor: '#2f6eff',
    borderRadius: 12,
    width: '100%',
  },
  registerButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
    fontFamily: Typography.bodySemiBold,
  },
  linksRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  linkButtonSingle: {
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
