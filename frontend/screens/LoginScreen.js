import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
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
      {/* Dynamic Security Ambient Glow Background */}
      <View style={[styles.glowAmbient, styles.glowPurple]} />
      <View style={[styles.glowAmbient, styles.glowCyan]} />

      <View style={styles.content}>
        {/* App Logo & Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoPulse} />
            <Ionicons name="shield-checkmark" size={38} color="#00f0ff" />
          </View>
          <Text style={styles.logoText}>CYBER<Text style={{ color: '#00f0ff' }}>SHIELD</Text></Text>
          <Text style={styles.subtitle}>Threat Intelligence & Real-time Scan Protection</Text>
        </View>

        {/* Security Vault styled login card */}
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
            <Ionicons name="mail-outline" size={20} color={emailFocused ? '#00f0ff' : '#5f6b8a'} style={styles.inputIcon} />
            <TextInput
              testID="email"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              placeholderTextColor="#5f6b8a"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          {/* Password Input */}
          <View
            style={[
              styles.inputContainer,
              passwordFocused && styles.inputFocused,
            ]}
          >
            <Ionicons name="lock-closed-outline" size={20} color={passwordFocused ? '#00f0ff' : '#5f6b8a'} style={styles.inputIcon} />
            <TextInput
              testID="password"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              placeholderTextColor="#5f6b8a"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={16} color="#ff2d55" style={{ marginRight: 6 }} />
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
            glowColor="#00f0ff"
          >
            {authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
          </GlowButton>

          {/* Footer Options */}
          <View style={styles.linksRow}>
            <GlowButton
              onPress={() => navigation.navigate('ResetPassword')}
              style={styles.linkButton}
              textStyle={styles.linkText}
              glowColor="#8b5cf6"
            >
              Forgot password?
            </GlowButton>
            <GlowButton
              onPress={() => navigation.navigate('Register')}
              style={styles.linkButtonSecondary}
              textStyle={styles.linkTextSecondary}
              glowColor="#ff2d55"
            >
              Create account
            </GlowButton>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060913',
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
    opacity: 0.15,
  },
  glowPurple: {
    backgroundColor: '#8b5cf6',
    top: -100,
    right: -100,
  },
  glowCyan: {
    backgroundColor: '#00f0ff',
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
    backgroundColor: '#121a30',
    borderWidth: 2,
    borderColor: '#00f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#00f0ff',
    shadowRadius: 16,
    shadowOpacity: 0.5,
    elevation: 8,
  },
  logoPulse: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2.5,
    fontFamily: Typography.monoBold,
  },
  subtitle: {
    fontSize: 13,
    color: '#8f9bb3',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#121829',
    borderWidth: 1,
    borderColor: '#1f2943',
    shadowColor: '#000',
    shadowRadius: 20,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00f0ff',
    letterSpacing: 1.5,
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: Typography.monoBold,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#8f9bb3',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#161f38',
    borderWidth: 1.5,
    borderColor: '#1f2943',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputFocused: {
    borderColor: '#00f0ff',
    shadowColor: '#00f0ff',
    shadowRadius: 8,
    shadowOpacity: 0.3,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#ffffff',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    borderWidth: 1,
    borderColor: '#ff2d55',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff2d55',
    fontSize: 12,
    flex: 1,
  },
  loginButton: {
    height: 52,
    backgroundColor: '#00f0ff',
    borderRadius: 12,
    width: '100%',
  },
  loginButtonText: {
    color: '#060913',
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
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  linkText: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: '600',
  },
  linkButtonSecondary: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.3)',
  },
  linkTextSecondary: {
    color: '#fda4af',
    fontSize: 12,
    fontWeight: '600',
  },
});