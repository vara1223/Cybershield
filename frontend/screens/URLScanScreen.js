import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Clipboard, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import Header from '../components/Header';
import ScanLineLoader from '../components/ScanLineLoader';
import ScreenContainer from '../components/ScreenContainer';
import api from '../services/api';

export default function URLScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  async function handleAnalyze() {
    const trimmed = url.trim();
    if (!trimmed) { Alert.alert('Enter a URL', 'Please paste or type a URL to analyze.'); return; }
    setLoading(true);
    try {
      const result = await api.analyzeURL(trimmed);
      result.input_data = trimmed;
      addScan(result);
      setCurrentResult(result);
      navigation.navigate('Result');
    } catch (e) {
      Alert.alert('Analysis failed', e?.response?.data?.detail || e?.message || 'Cannot reach the backend. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePaste() {
    try {
      const text = await Clipboard.getString();
      if (text) setUrl(text);
    } catch {}
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && <ScanLineLoader isDark={isDark} label="Analyzing URL..." />}
      <Header title="URL scanner" subtitle="Paste any link to analyze" isDark={isDark} onBack={() => navigation.goBack()} />

      <ScreenContainer isDark={isDark} keyboardAvoiding scrollable={false}>
        <View style={styles.inputSection}>
          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Typography.mono }]}>ENTER URL</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                color: colors.text,
                borderColor: focused ? colors.borderActive : colors.border,
                fontFamily: Typography.mono,
                shadowColor: focused ? colors.accent : 'transparent',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: focused ? 1 : 0,
                shadowRadius: focused ? 6 : 0,
              },
            ]}
            placeholder="https://example.com"
            placeholderTextColor={colors.textMuted}
            value={url}
            onChangeText={setUrl}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <View style={styles.pasteRow}>
            <TouchableOpacity
              style={[styles.pasteBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handlePaste}
              activeOpacity={0.7}
            >
              <Ionicons name="clipboard-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.pasteBtnText, { color: colors.textSecondary, fontFamily: Typography.body }]}>
                Paste from clipboard
              </Text>
            </TouchableOpacity>
            {url.length > 0 && (
              <TouchableOpacity
                style={[styles.clearBtn, { backgroundColor: colors.surface }]}
                onPress={() => setUrl('')}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.analyzeBtn, { backgroundColor: colors.primary, opacity: url.trim() ? 1 : 0.5 }]}
            onPress={handleAnalyze}
            activeOpacity={0.85}
            disabled={!url.trim()}
          >
            <Text style={[styles.analyzeBtnText, { fontFamily: Typography.bodySemiBold }]}>Analyze URL</Text>
          </TouchableOpacity>
        </View>

        {/* Info cards */}
        <View style={styles.infoList}>
          {[
            'We analyze domain age, SSL certificate, redirect chains, and known phishing patterns to score the URL.',
            'Works with shortened links like bit.ly — we expand and scan the final destination.',
          ].map((text, idx) => (
            <View key={idx} style={styles.infoRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
              <Text style={[styles.infoText, { color: colors.textSecondary, fontFamily: Typography.body }]}>
                {text}
              </Text>
            </View>
          ))}
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inputSection: { gap: Spacing.sm, marginBottom: Spacing.lg },
  label: { fontSize: 11, letterSpacing: 1.5 },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
  },
  pasteRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  pasteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  pasteBtnText: { fontSize: 13 },
  clearBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  analyzeBtn: {
    borderRadius: Radius.md, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16 },
  infoList: { gap: Spacing.md },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { fontSize: 14, flex: 1, lineHeight: 20 },
});
