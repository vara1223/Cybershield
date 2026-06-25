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

const ACCENT = '#8B5CF6';
const ACCENT2 = '#6D28D9';

export default function UPIScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [upiId, setUpiId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [upiF, setUpiF] = useState(false);
  const [msgF, setMsgF] = useState(false);

  async function handleAnalyze() {
    if (!upiId.trim()) {
      if (Platform.OS === 'web') { window.alert('Please enter a UPI ID to analyze.'); }
      else { Alert.alert('Enter UPI ID', 'Please enter a UPI ID to analyze.'); }
      return;
    }
    setLoading(true);
    try {
      const result = await api.analyzeUPI(upiId, message);
      result.input_data = upiId;
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

  const DETECTION_POINTS = [
    { icon: 'checkmark-circle-outline', color: '#22C55E', text: 'Validates UPI ID format against official patterns' },
    { icon: 'warning-outline', color: '#F59E0B', text: 'Flags handles with "support", "refund", "lottery"' },
    { icon: 'cash-outline', color: '#EF4444', text: 'Detects advance-fee scam patterns in messages' },
    { icon: 'person-remove-outline', color: ACCENT, text: 'Identifies non-standard VPAs used by scammers' },
  ];

  const QUICK_IDS = [
    'support@icici', 'refund@paytm', 'lottery@upi',
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && <ScanLineLoader isDark={isDark} label="Analyzing UPI ID..." />}

      {/* Hero Header */}
      <View style={[styles.hero, { paddingTop: insets.top + 8, backgroundColor: isDark ? '#17102B' : '#F5F3FF' }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: isDark ? '#1E2230' : '#fff', borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.heroBadgeIcon, { backgroundColor: ACCENT + '20' }]}>
          <Ionicons name="card" size={28} color={ACCENT} />
        </View>
        <Text style={[styles.heroTitle, { color: isDark ? '#fff' : '#1A1D2E' }]}>UPI Fraud Detector</Text>
        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>Enter UPI ID or payment message to verify</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Input Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* UPI ID field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>UPI ID</Text>
            <View style={[styles.inputRow, { borderColor: upiF ? ACCENT : colors.border, backgroundColor: colors.surface }]}>
              <Ionicons name="at-outline" size={18} color={upiF ? ACCENT : colors.textMuted} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="name@bank"
                placeholderTextColor={colors.textMuted}
                value={upiId}
                onChangeText={setUpiId}
                onFocus={() => setUpiF(true)}
                onBlur={() => setUpiF(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              {upiId.length > 0 && (
                <TouchableOpacity onPress={() => setUpiId('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            {/* Quick-fill suspicious examples */}
            <View style={styles.quickRow}>
              <Text style={[styles.quickLabel, { color: colors.textMuted }]}>Try suspicious:</Text>
              {QUICK_IDS.map((id) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => setUpiId(id)}
                  style={[styles.quickChip, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}
                >
                  <Text style={[styles.quickChipText, { color: '#EF4444' }]}>{id}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Message field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              PAYMENT MESSAGE <Text style={{ color: colors.textMuted, fontWeight: '400' }}>(OPTIONAL)</Text>
            </Text>
            <View style={[styles.textAreaRow, { borderColor: msgF ? ACCENT : colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.textArea, { color: colors.text }]}
                placeholder="Paste the payment request or transaction message..."
                placeholderTextColor={colors.textMuted}
                value={message}
                onChangeText={setMessage}
                onFocus={() => setMsgF(true)}
                onBlur={() => setMsgF(false)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Analyze button */}
          <TouchableOpacity
            style={[styles.analyzeBtn, { backgroundColor: ACCENT, opacity: upiId.trim() ? 1 : 0.5 }]}
            onPress={handleAnalyze}
            activeOpacity={0.85}
            disabled={!upiId.trim()}
          >
            <Ionicons name="card-outline" size={18} color="#fff" />
            <Text style={styles.analyzeBtnText}>Check UPI ID</Text>
          </TouchableOpacity>
        </View>

        {/* Detection method cards */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>HOW WE DETECT UPI FRAUD</Text>
        <View style={styles.detectionGrid}>
          {DETECTION_POINTS.map((item, i) => (
            <View
              key={i}
              style={[styles.detectionCard, { backgroundColor: colors.card, borderColor: item.color + '30', borderLeftColor: item.color, borderLeftWidth: 3 }]}
            >
              <Ionicons name={item.icon} size={20} color={item.color} />
              <Text style={[styles.detectionText, { color: colors.textSecondary }]}>{item.text}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: {
    paddingHorizontal: 20,
    paddingBottom: 28,
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

  body: { padding: 16, gap: 16 },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 18,
    ...Shadow.sm,
  },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  input: { flex: 1, fontSize: 14 },

  quickRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  quickLabel: { fontSize: 11 },
  quickChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  quickChipText: { fontSize: 11, fontWeight: '600' },

  textAreaRow: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textArea: { fontSize: 14, minHeight: 90 },

  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: 4 },

  detectionGrid: { gap: 10 },
  detectionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    ...Shadow.sm,
  },
  detectionText: { fontSize: 13, flex: 1, lineHeight: 18 },
});
