import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import Header from '../components/Header';
import ScanLineLoader from '../components/ScanLineLoader';
import ScreenContainer from '../components/ScreenContainer';
import api from '../services/api';


export default function UPIScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;

  const [upiId, setUpiId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [upiF, setUpiF] = useState(false);
  const [msgF, setMsgF] = useState(false);

  async function handleAnalyze() {
    if (!upiId.trim()) { Alert.alert('Enter UPI ID', 'Please enter a UPI ID to analyze.'); return; }
    setLoading(true);
    try {
      const result = await api.analyzeUPI(upiId, message);
      result.input_data = upiId;
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
      {loading && <ScanLineLoader isDark={isDark} label="Analyzing UPI ID..." />}
      <Header title="UPI fraud detector" subtitle="Enter UPI ID or payment message" isDark={isDark} onBack={() => navigation.goBack()} />

      <ScreenContainer isDark={isDark} keyboardAvoiding scrollable>
        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Typography.mono }]}>UPI ID</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: upiF ? colors.borderActive : colors.border, fontFamily: Typography.mono }]}
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

        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Typography.mono, marginTop: Spacing.sm }]}>
          PAYMENT MESSAGE (OPTIONAL)
        </Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: msgF ? colors.borderActive : colors.border, fontFamily: Typography.body }]}
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

        <TouchableOpacity
          style={[styles.analyzeBtn, { backgroundColor: '#8B5CF6', opacity: upiId.trim() ? 1 : 0.5 }]}
          onPress={handleAnalyze}
          activeOpacity={0.85}
          disabled={!upiId.trim()}
        >
          <Ionicons name="card-outline" size={18} color="#fff" />
          <Text style={[styles.analyzeBtnText, { fontFamily: Typography.bodySemiBold }]}>Check UPI ID</Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.textSecondary, fontFamily: Typography.monoBold }]}>
            HOW WE DETECT UPI FRAUD
          </Text>
          {[
            'Check UPI ID format against official patterns',
            'Flag handles containing "support", "refund", "lottery"',
            'Detect advance-fee scam patterns in payment messages',
            'Identify non-standard VPAs used by scammers',
          ].map((item, i) => (
            <View key={i} style={styles.infoRow}>
              <Ionicons name="shield-outline" size={14} color={colors.accent} />
              <Text style={[styles.infoText, { color: colors.textSecondary, fontFamily: Typography.body }]}>{item}</Text>
            </View>
          ))}
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 11, letterSpacing: 1.5, marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, marginBottom: Spacing.sm },
  textArea: { borderWidth: 1.5, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 100, marginBottom: Spacing.md },
  analyzeBtn: { borderRadius: Radius.md, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: Spacing.lg },
  analyzeBtnText: { color: '#fff', fontSize: 16 },
  infoBox: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  infoTitle: { fontSize: 11, letterSpacing: 1.2, marginBottom: 4 },
  infoRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  infoText: { fontSize: 13, flex: 1, lineHeight: 18 },
});
