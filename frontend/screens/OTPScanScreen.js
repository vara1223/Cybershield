import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import ScanLineLoader from '../components/ScanLineLoader';
import api from '../services/api';

const ACCENT = '#EF4444';
const EXAMPLES = [
  'Your SBI OTP is 847291. Share it with our representative to unlock your frozen account immediately.',
  'Dear customer, your HDFC account has been suspended. Call 09876543210 to reactivate within 2 hours.',
  'Congratulations! You have won ₹10 lakh in Paytm lucky draw. Click http://bit.ly/claim to receive.',
];

export default function OTPScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  async function handleAnalyze() {
    if (!message.trim()) {
      if (Platform.OS === 'web') { window.alert('Paste the suspicious SMS or message to analyze.'); }
      else { Alert.alert('Enter a message', 'Paste the suspicious SMS or message to analyze.'); }
      return;
    }
    setLoading(true);
    try {
      const result = await api.analyzeOTP(message);
      result.input_data = message.slice(0, 80);
      addScan(result);
      setCurrentResult(result);
      navigation.navigate('Result');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Cannot reach the backend.';
      if (Platform.OS === 'web') { window.alert(msg); }
      else { Alert.alert('Analysis failed', msg); }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && <ScanLineLoader isDark={isDark} label="Analyzing message..." />}

      {/* Hero Header */}
      <View style={[styles.hero, { paddingTop: insets.top + 8, backgroundColor: isDark ? '#2A0E0E' : '#FEF2F2' }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: isDark ? '#1E2230' : '#fff', borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.heroBadgeIcon, { backgroundColor: ACCENT + '20' }]}>
          <Ionicons name="shield-checkmark" size={28} color={ACCENT} />
        </View>
        <Text style={[styles.heroTitle, { color: isDark ? '#fff' : '#1A1D2E' }]}>OTP Scam Detector</Text>
        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>Paste suspicious SMS or WhatsApp message</Text>

        {/* Warning banner */}
        <View style={[styles.warningBanner, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40' }]}>
          <Ionicons name="warning-outline" size={14} color={ACCENT} />
          <Text style={[styles.warningText, { color: ACCENT }]}>Never share your OTP. Banks never ask for it.</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Input Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PASTE SUSPICIOUS MESSAGE</Text>
          <View style={[styles.textAreaWrap, {
            borderColor: focused ? ACCENT : colors.border,
            backgroundColor: colors.surface,
          }]}>
            <TextInput
              style={[styles.textArea, { color: colors.text }]}
              placeholder="Paste the suspicious SMS, WhatsApp message, or notification here..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            {message.length > 0 && (
              <TouchableOpacity onPress={() => setMessage('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {message.length > 0 && (
            <Text style={[styles.charCount, { color: colors.textMuted }]}>{message.length} characters</Text>
          )}

          <TouchableOpacity
            style={[styles.analyzeBtn, { backgroundColor: ACCENT, opacity: message.trim() ? 1 : 0.5 }]}
            onPress={handleAnalyze}
            activeOpacity={0.85}
            disabled={!message.trim()}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
            <Text style={styles.analyzeBtnText}>Analyze Message</Text>
          </TouchableOpacity>
        </View>

        {/* Example scam messages */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>EXAMPLE SCAM MESSAGES — TAP TO TRY</Text>
        {EXAMPLES.map((ex, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.exampleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setMessage(ex)}
            activeOpacity={0.75}
          >
            <View style={[styles.exampleNumBadge, { backgroundColor: ACCENT + '15' }]}>
              <Text style={[styles.exampleNum, { color: ACCENT }]}>#{idx + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[styles.exampleText, { color: colors.text }]} numberOfLines={2}>{ex}</Text>
              <View style={styles.tapRow}>
                <Ionicons name="finger-print-outline" size={12} color={ACCENT} />
                <Text style={[styles.tapHint, { color: ACCENT }]}>Tap to load this message</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 6,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 52,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroBadgeIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  heroSub: { fontSize: 13, textAlign: 'center' },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  warningText: { fontSize: 12, fontWeight: '600' },

  body: { padding: 16, gap: 14 },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    ...Shadow.sm,
  },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },

  textAreaWrap: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    position: 'relative',
  },
  textArea: { fontSize: 14, minHeight: 130, lineHeight: 22 },
  clearBtn: { position: 'absolute', top: 8, right: 8 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: -4 },

  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: 4, marginTop: 4 },

  exampleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    ...Shadow.sm,
  },
  exampleNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  exampleNum: { fontSize: 12, fontWeight: '800' },
  exampleText: { fontSize: 13, lineHeight: 19 },
  tapRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tapHint: { fontSize: 11, fontWeight: '600' },
});
