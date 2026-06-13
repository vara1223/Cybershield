import React, { useEffect, useState } from 'react';
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
import * as Linking from 'expo-linking';
import { supabase } from '../supabase';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResetPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState('request');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pastedUrl, setPastedUrl] = useState('');
  const { resetPassword, updatePassword, authLoading } = useAuth();

  const handleSendResetLink = async () => {
    setError('');
    setSuccess('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      // create a deep link that opens the Reset screen in the app
      const redirectUrl = Linking.createURL('reset');
      await resetPassword(trimmedEmail, redirectUrl);
      setSuccess('Password reset link sent. Open the link from your email to continue.');
      setStage('sent');
    } catch (err) {
      setError(err.message || 'Unable to send reset link. Please try again.');
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setSuccess('');

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      await updatePassword(password);
      setSuccess('Password reset successful. Signing you in...');
      setStage('complete');
      // navigate to main app once AuthContext updates user (AppNavigator reacts to auth)
      navigation.replace('Main');
    } catch (err) {
      setError(err.message || 'Unable to update password. Please try again.');
    }
  };

  // parse tokens from a Supabase redirect URL fragment and set the session
  const applySessionFromUrl = async (url) => {
    if (!url) return false;
    // Supabase appends tokens in the URL fragment: #access_token=...&refresh_token=...&type=recovery
    const parts = url.split('#');
    const fragment = parts[1] || '';
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const type = params.get('type');
    if (type !== 'recovery' || !access_token) return false;
    try {
      await supabase.auth.setSession({ access_token, refresh_token });
      // now the app has a valid session — allow user to set a new password
      setStage('reset');
      return true;
    } catch (err) {
      console.log('setSession error', err);
      return false;
    }
  };

  useEffect(() => {
    // handle initial URL when app launches from the email link
    (async () => {
      try {
        const initial = await Linking.getInitialURL();
        if (initial) {
          await applySessionFromUrl(initial);
        }
      } catch (err) {
        console.log('Linking.getInitialURL error', err);
      }
    })();

    // listen for in-app URL opens
    const sub = Linking.addEventListener('url', async ({ url }) => {
      await applySessionFromUrl(url);
    });
    return () => sub.remove();
  }, []);

  const redirectUrlDisplay = Linking.createURL('reset');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          {stage === 'request' && 'Enter your email to receive a password reset link.'}
          {stage === 'sent' && 'We sent a reset link — open it from your email.'}
          {stage === 'reset' && 'Set your new password.'}
          {stage === 'complete' && 'Your password has been reset successfully.'}
        </Text>

        {(stage === 'request' || stage === 'reset') && (
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            placeholderTextColor="#999"
          />
        )}

        {stage === 'request' && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: '#333' }}>App redirect URL (add to Supabase Redirect URLs):</Text>
            <Text style={{ fontSize: 12, color: '#007aff' }}>{redirectUrlDisplay}</Text>
          </View>
        )}
        {stage === 'sent' && (
          <View style={{ marginBottom: 12 }}>
            <TextInput
              placeholder="Paste full reset link here"
              value={pastedUrl}
              onChangeText={setPastedUrl}
              autoCapitalize="none"
              style={[styles.input, { marginBottom: 8 }]}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#444' }]}
              onPress={async () => {
                setError('');
                setSuccess('');
                if (!pastedUrl.trim()) {
                  setError('Please paste the full link you received.');
                  return;
                }
                const ok = await applySessionFromUrl(pastedUrl.trim());
                if (ok) setSuccess('Link applied — set your new password below.');
                else setError('Link invalid or expired.');
              }}
            >
              <Text style={styles.buttonText}>Apply link</Text>
            </TouchableOpacity>
          </View>
        )}
        {stage === 'reset' && (
          <TextInput
            placeholder="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            placeholderTextColor="#999"
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {stage === 'request' && (
          <TouchableOpacity style={styles.button} onPress={handleSendResetLink} disabled={authLoading}>
            {authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send reset link</Text>
            )}
          </TouchableOpacity>
        )}

        {stage === 'reset' && (
          <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={authLoading}>
            {authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Update password</Text>
            )}
          </TouchableOpacity>
        )}

        {stage === 'complete' && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.replace('Login')}
          >
            <Text style={styles.buttonText}>Go to login</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#f7f7f8',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 18,
  },
  input: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  button: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#007aff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  error: {
    color: '#b00020',
    marginBottom: 8,
  },
  success: {
    color: '#0a7d2b',
    marginBottom: 8,
  },
  link: {
    marginTop: 16,
    color: '#007aff',
    textAlign: 'center',
  },
});
