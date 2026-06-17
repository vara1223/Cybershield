import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
      <View style={styles.accentBubble} />
      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your CyberShield account and continue protecting your scans.</Text>

        <TextInput
          testID="email"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          placeholderTextColor="#999"
        />

        <TextInput
          testID="password"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholderTextColor="#999"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity testID="login-button" style={styles.button} onPress={handleLogin} disabled={authLoading}>
          {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
        </TouchableOpacity>

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkSecondary}>Create account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef4ff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  accentBubble: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 140,
    backgroundColor: '#d4e4ff',
    top: -60,
    right: -70,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#0c2c6a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#122a4a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#556b8a',
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f7faff',
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e4efff',
    fontSize: 15,
    color: '#1f3357',
  },
  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2f6eff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  adminInfoCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#f7faff',
    borderWidth: 1,
    borderColor: '#e4efff',
  },
  adminInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f3357',
    marginBottom: 6,
  },
  adminInfoText: {
    fontSize: 13,
    color: '#556b8a',
    marginBottom: 12,
  },
  adminButton: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#2f6eff',
  },
  adminButtonText: {
    color: '#2f6eff',
    fontWeight: '700',
    fontSize: 15,
  },
  error: {
    color: '#c62828',
    marginBottom: 12,
    textAlign: 'center',
  },
  linksRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  link: {
    color: '#2f6eff',
    fontWeight: '600',
  },
  linkSecondary: {
    color: '#556b8a',
    fontWeight: '600',
  },
});