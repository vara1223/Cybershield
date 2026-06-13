import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import Header from '../components/Header';
import ScanLineLoader from '../components/ScanLineLoader';
import ScreenContainer from '../components/ScreenContainer';
import api from '../services/api';

const EXAMPLE_MESSAGES = [
  'Your SBI OTP is 847291. Share it with our representative to unlock your frozen account immediately.',
  'Dear customer, your HDFC account has been suspended. Call 09876543210 to reactivate within 2 hours.',
  'Congratulations! You have won ₹10 lakh in Paytm lucky draw. Click http://bit.ly/claim to receive.',
];


export default function OTPScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  async function handleAnalyze() {
    if (!message.trim()) { Alert.alert('Enter a message', 'Paste the suspicious SMS or message to analyze.'); return; }
    setLoading(true);
    try {
      const result = await api.analyzeOTP(message);
      result.input_data = message.slice(0, 80);
      addScan(result);
      setCurrentResult(result);
      navigation.navigate('Result');
    } catch (e) {
      Alert.alert('Analysis failed', e?.response?.data?.detail || e?.message || 'Cannot reach the backend. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && <ScanLineLoader isDark={isDark} label="Analyzing message..." />}
      <Header title="OTP scam detector" subtitle="Paste suspicious SMS or message" isDark={isDark} onBack={() => navigation.goBack()} />

      <ScreenContainer isDark={isDark} keyboardAvoiding scrollable>
        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
          PASTE MESSAGE
        </Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: colors.inputBg,
              color: colors.text,
              borderColor: focused ? colors.borderActive : colors.border,
              fontFamily: Typography.body,
            },
          ]}
          placeholder="Paste the suspicious SMS, WhatsApp message, or notification here..."
          placeholderTextColor={colors.textMuted}
          value={message}
          onChangeText={setMessage}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.analyzeBtn, { backgroundColor: Colors.verdict.DANGEROUS, opacity: message.trim() ? 1 : 0.5 }]}
          onPress={handleAnalyze}
          activeOpacity={0.85}
          disabled={!message.trim()}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
          <Text style={[styles.analyzeBtnText, { fontFamily: Typography.bodySemiBold }]}>Analyze Message</Text>
        </TouchableOpacity>

        <Text style={[styles.examplesLabel, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
          EXAMPLE SCAM MESSAGES
        </Text>
        {EXAMPLE_MESSAGES.map((ex, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.exampleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setMessage(ex)}
            activeOpacity={0.75}
          >
            <Text style={[styles.exampleText, { color: colors.textSecondary, fontFamily: Typography.body }]} numberOfLines={2}>
              {ex}
            </Text>
            <Text style={[styles.tapHint, { color: colors.accent, fontFamily: Typography.mono }]}>Tap to use</Text>
          </TouchableOpacity>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 11, letterSpacing: 1.5, marginBottom: 6 },
  textArea: {
    borderWidth: 1.5, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, minHeight: 120,
    marginBottom: Spacing.md,
  },
  analyzeBtn: {
    borderRadius: Radius.md, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: Spacing.lg,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16 },
  examplesLabel: { fontSize: 11, letterSpacing: 1.5, marginBottom: Spacing.sm },
  exampleCard: {
    borderRadius: Radius.md, borderWidth: 1,
    padding: Spacing.md, marginBottom: Spacing.sm, gap: 6,
  },
  exampleText: { fontSize: 13, lineHeight: 18 },
  tapHint: { fontSize: 11, letterSpacing: 0.5 },
});
