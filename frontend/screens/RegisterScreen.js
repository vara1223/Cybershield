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
import { useAuth } from '../context/AuthContext';
import GlowButton from '../components/GlowButton';
import { Typography } from '../constants/theme';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [fullNameFocused, setFullNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signUp, authLoading } = useAuth();

  const handleRegister = async () => {
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

    try {
      const result = await signUp({ full_name: fullName.trim(), email: trimmedEmail, password });
      const isLoggedIn = Boolean(result?.session?.user?.id);
      if (isLoggedIn) {
        setSuccess('Registration successful. You are now logged in.');
        navigation.replace('Main');
      } else {
        setSuccess('Registration successful. Please check your email to confirm your account.');
        setTimeout(() => {
          navigation.replace('Login');
        }, 3000);
      }
    } catch (err) {
      setError(err.message || 'Unable to register. Please try again.');
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
          <Text style={styles.cardTitle}>CREATE SECURE ACCOUNT</Text>
          <Text style={styles.cardSubtitle}>
            Provide details to register a new user console profile.
          </Text>

          {/* Full Name Input */}
          <View
            style={[
              styles.inputContainer,
              fullNameFocused && styles.inputFocused,
            ]}
          >
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
          <View
            style={[
              styles.inputContainer,
              emailFocused && styles.inputFocused,
            ]}
          >
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
          <View
            style={[
              styles.inputContainer,
              passwordFocused && styles.inputFocused,
            ]}
          >
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
              <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#64748b" />
            </Pressable>
          </View>

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

          {/* Glowing Sign Up Button */}
          <GlowButton
            testID="register-button"
            style={styles.registerButton}
            textStyle={styles.registerButtonText}
            onPress={handleRegister}
            disabled={authLoading}
            glowColor="#2f6eff"
          >
            {authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>Sign Up</Text>
            )}
          </GlowButton>

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
