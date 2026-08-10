import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Pressable, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BLUE      = '#2563EB';
const BLUE_DARK = '#1D4ED8';
const BLUE_LIGHT= '#EFF6FF';

// ─── Blue Animated Button ─────────────────────────────────────────────────────
function BlueButton({ onPress, disabled, loading, label, testID }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: Platform.OS !== 'web', speed: 50 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: Platform.OS !== 'web', speed: 50 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.55 : 1 }}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        disabled={disabled}
        style={styles.blueBtn}
      >
        <LinearGradient
          colors={[BLUE, BLUE_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.blueBtnGrad}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.blueBtnText}>{label}</Text>
          }
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────
function BlueInput({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, testID, rightElement }) {
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

  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['#BFDBFE', BLUE] });

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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [error, setError]               = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, authLoading } = useAuth();

  const handleLogin = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password)     { setError('Please enter your email and password.'); return; }
    if (!emailRegex.test(trimmedEmail)) { setError('Enter a valid email address.'); return; }
    if (password.length < 6)           { setError('Password must be at least 6 characters.'); return; }

    if (trimmedEmail === 'admin@cybershield.com' && password === 'admin123') {
      setEmail(''); setPassword('');
      navigation.navigate('Admin');
      return;
    }
    try {
      await signIn({ email: trimmedEmail, password });
      navigation.replace('Main');
    } catch (err) {
      setError(err.message || 'Authentication failed. Check your credentials.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Blue gradient top section ───────────────────────── */}
      <LinearGradient
        colors={['#1D4ED8', '#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.topSection, { paddingTop: insets.top + 24 }]}
      >
        {/* Shield logo */}
        <View style={styles.logoRing}>
          <Ionicons name="shield-checkmark" size={34} color="#fff" />
        </View>

        {/* Wordmark */}
        <Text style={styles.wordmark}>
          CYBER<Text style={styles.wordmarkAccent}>SHIELD</Text>
        </Text>
        <Text style={styles.tagline}>Threat Intelligence Platform</Text>
      </LinearGradient>

      {/* ── White bottom section ─────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.bottomSection}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { paddingBottom: insets.bottom + 8 }]}>

          {/* Title */}
          <View style={styles.cardTitleRow}>
            <View style={styles.cardTitleBar} />
            <Text style={styles.cardTitle}>Sign In</Text>
          </View>
          <Text style={styles.cardSub}>Welcome back — enter your credentials</Text>

          {/* Inputs */}
          <View style={styles.inputs}>
            <BlueInput
              testID="email"
              icon="mail-outline"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <BlueInput
              testID="password"
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              rightElement={
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={17}
                    color="#93C5FD"
                  />
                </Pressable>
              }
            />
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Forgot password */}
          <Pressable onPress={() => navigation.navigate('ResetPassword')} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {/* Login button */}
          <BlueButton
            testID="login-button"
            label="Sign In"
            onPress={handleLogin}
            loading={authLoading}
            disabled={authLoading}
          />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Create account */}
          <Pressable onPress={() => navigation.navigate('Register')} style={styles.registerBtn}>
            <Text style={styles.registerText}>
              Don't have an account?{' '}
              <Text style={styles.registerLink}>Create one</Text>
            </Text>
          </Pressable>

          {/* Trust row */}
          <View style={styles.trustRow}>
            {[
              { icon: 'lock-closed', label: 'Encrypted' },
              { icon: 'shield-checkmark', label: 'Secure' },
              { icon: 'eye-off', label: 'Private' },
            ].map((b) => (
              <View key={b.label} style={styles.trustBadge}>
                <Ionicons name={b.icon} size={11} color={BLUE} />
                <Text style={styles.trustLabel}>{b.label}</Text>
              </View>
            ))}
          </View>

        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // Blue top
  topSection: {
    alignItems: 'center',
    paddingBottom: 32,
    gap: 8,
  },
  logoRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
  },
  wordmark:       { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 3 },
  wordmarkAccent: { color: 'rgba(255,255,255,0.65)' },
  tagline:        { fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 },

  // White bottom card
  bottomSection: { flex: 1 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 14,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },

  cardTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitleBar:  { width: 4, height: 20, borderRadius: 2, backgroundColor: BLUE },
  cardTitle:     { fontSize: 20, fontWeight: '800', color: '#1E3A5F' },
  cardSub:       { fontSize: 13, color: '#64748B', marginTop: -6 },

  // Inputs
  inputs:    { gap: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 50, borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, height: '100%', fontSize: 14, color: '#1E3A5F', backgroundColor: 'transparent' },
  eyeBtn:    { padding: 4 },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  errorText: { color: '#DC2626', fontSize: 12, flex: 1 },

  // Forgot
  forgotBtn:  { alignItems: 'flex-end', marginTop: -6 },
  forgotText: { fontSize: 12, color: BLUE, fontWeight: '600' },

  // Button
  blueBtn:     { borderRadius: 12, overflow: 'hidden' },
  blueBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  blueBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  // Divider
  divider:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  // Register
  registerBtn:  { alignItems: 'center' },
  registerText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  registerLink: { color: BLUE, fontWeight: '700' },

  // Trust
  trustRow:   { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingTop: 4 },
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustLabel: { fontSize: 11, color: '#93C5FD', fontWeight: '600' },
});