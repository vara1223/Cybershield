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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn, authLoading } = useAuth();

  const handleLogin = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (!emailRegex.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (trimmedEmail === 'admin@cybershield.com' && password === 'admin123') {
      setEmail('');
      setPassword('');
      navigation.navigate('Admin');
      return;
    }

    try {
      await signIn({ email: trimmedEmail, password });
      navigation.replace('Main');
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Light Theme Soft Ambient Glow Background */}
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

        {/* Secure login card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SECURE AUTHORIZATION</Text>
          <Text style={styles.cardSubtitle}>
            Input credentials to verify identity and unlock console.
          </Text>

          {/* Email Input */}
          <View
            style={[
              styles.inputContainer,
              emailFocused && styles.inputFocused,
            ]}
          >
            <Ionicons name="mail-outline" size={20} color={emailFocused ? '#2f6eff' : '#64748b'} style={styles.inputIcon} />
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
            <Ionicons name="lock-closed-outline" size={20} color={passwordFocused ? '#2f6eff' : '#64748b'} style={styles.inputIcon} />
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

          {/* Glowing Log In Button */}
          <GlowButton
            testID="login-button"
            style={styles.loginButton}
            textStyle={styles.loginButtonText}
            onPress={handleLogin}
            disabled={authLoading}
            glowColor="#2f6eff"
          >
            {authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
          </GlowButton>

          {/* Flat text link buttons */}
          <View style={styles.linksRow}>
            <Pressable
              onPress={() => navigation.navigate('ResetPassword')}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>Forgot password?</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Register')}
              style={styles.linkButtonSecondary}
            >
              <Text style={styles.linkTextSecondary}>Create account</Text>
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
    shadowColor: '#2f6eff',
    shadowRadius: 8,
    shadowOpacity: 0.15,
    backgroundColor: '#ffffff',
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
  loginButton: {
    height: 52,
    backgroundColor: '#2f6eff',
    borderRadius: 12,
    width: '100%',
  },
  loginButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
    fontFamily: Typography.bodySemiBold,
  },
  linksRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  linkButton: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkButtonSecondary: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkTextSecondary: {
    color: '#db2777',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});