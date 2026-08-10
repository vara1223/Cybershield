import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Clipboard, Alert, Animated, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import ScanLineLoader from '../components/ScanLineLoader';
import BackButton from '../components/BackButton';
import api from '../services/api';

const ACCENT  = '#00D4FF';
const ACCENT2 = '#0099BB';

export default function URLScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const focusAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  function onFocus() {
    setFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  }
  function onBlur() {
    setFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }

  const borderColor = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, ACCENT] });
  const glowOpacity = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] });

  async function handleAnalyze() {
    const trimmed = url.trim();
    if (!trimmed) {
      if (Platform.OS === 'web') { window.alert('Please paste or type a URL to analyze.'); }
      else { Alert.alert('Enter a URL', 'Please paste or type a URL to analyze.'); }
      return;
    }
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 80, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    setLoading(true);
    try {
      const result = await api.analyzeURL(trimmed);
      result.input_data = trimmed;
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

  async function handlePaste() {
    try {
      const text = await Clipboard.getString();
      if (text) setUrl(text);
    } catch {}
  }

  const FEATURES = [
    { icon: 'shield-checkmark-outline', color: '#22C55E', bg: isDark ? '#052E16' : '#F0FFF4', label: 'Phishing Detection' },
    { icon: 'link-outline', color: '#4361EE', bg: isDark ? '#1E2A50' : '#EEF2FF', label: 'Link Expansion' },
    { icon: 'lock-closed-outline', color: '#8B5CF6', bg: isDark ? '#2E1065' : '#F5F3FF', label: 'SSL Analysis' },
    { icon: 'globe-outline', color: '#F59E0B', bg: isDark ? '#451A03' : '#FFFBEB', label: 'Domain Age' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && <ScanLineLoader isDark={isDark} label="Analyzing URL..." />}

      {/* Hero Header */}
      <View style={[styles.hero, { paddingTop: insets.top + 8, backgroundColor: isDark ? '#070B14' : '#EEF9FF' }]}>
        <BackButton navigation={navigation} top={insets.top + 12} left={16} />
        <View style={styles.heroBadge}>
          <View style={[styles.heroBadgeIcon, { backgroundColor: isDark ? '#00D4FF15' : '#00AACC15', borderWidth: 1, borderColor: isDark ? '#00D4FF25' : '#00AACC25' }]}>
            <Ionicons name="link" size={28} color={isDark ? '#00D4FF' : '#0099BB'} />
          </View>
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>URL SCANNER</Text>
        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>Analyze links for phishing & malware</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Input Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ENTER URL</Text>

          {/* Glow wrapper */}
          <View style={styles.inputWrap}>
            <Animated.View style={[styles.inputGlow, { backgroundColor: ACCENT, opacity: glowOpacity }]} />
            <Animated.View style={[styles.inputBorder, { borderColor }]}>
              <Ionicons name="link-outline" size={18} color={focused ? ACCENT : colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: 'transparent' }]}
                placeholder="https://example.com"
                placeholderTextColor={colors.textMuted}
                value={url}
                onChangeText={setUrl}
                onFocus={onFocus}
                onBlur={onBlur}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {url.length > 0 && (
                <TouchableOpacity onPress={() => setUrl('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>

          {/* Paste button */}
          <TouchableOpacity
            style={[styles.pasteBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handlePaste}
            activeOpacity={0.7}
          >
            <Ionicons name="clipboard-outline" size={16} color={ACCENT} />
            <Text style={[styles.pasteBtnText, { color: ACCENT }]}>Paste from clipboard</Text>
          </TouchableOpacity>

          {/* Analyze button */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={{ borderRadius: 12, overflow: 'hidden', opacity: url.trim() ? 1 : 0.5 }}
              onPress={handleAnalyze}
              activeOpacity={0.9}
              disabled={!url.trim() || loading}
            >
              <LinearGradient
                colors={isDark ? ['#00D4FF', '#0099BB'] : ['#4361EE', '#3A56D4']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.analyzeBtn}
              >
                <Ionicons name="search" size={18} color={isDark ? '#070B14' : '#fff'} />
                <Text style={[styles.analyzeBtnText, { color: isDark ? '#070B14' : '#fff' }]}>ANALYZE URL</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Feature Badges */}
        <View style={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <View key={f.label} style={[styles.featureBadge, { backgroundColor: f.bg, borderColor: f.color + '30' }]}>
              <View style={[styles.featureIcon, { backgroundColor: f.color + '20' }]}>
                <Ionicons name={f.icon} size={18} color={f.color} />
              </View>
              <Text style={[styles.featureLabel, { color: f.color }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Info cards */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoCardTitle, { color: colors.textSecondary }]}>HOW IT WORKS</Text>
          {[
            { icon: 'git-network-outline', text: 'We expand shortened links like bit.ly to their final destination before scanning.' },
            { icon: 'analytics-outline', text: 'Domain age, SSL certificate, redirect chains, and known phishing patterns are all scored.' },
          ].map((item, i) => (
            <View key={i} style={styles.infoRow}>
              <View style={[styles.infoIconWrap, { backgroundColor: ACCENT + '15' }]}>
                <Ionicons name={item.icon} size={15} color={ACCENT} />
              </View>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>{item.text}</Text>
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
  heroBadge: { marginBottom: 4, marginTop: 8 },
  heroBadgeIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  heroSub: { fontSize: 13, textAlign: 'center' },

  body: { padding: 16, gap: 16 },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    ...Shadow.sm,
  },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },

  inputWrap: { position: 'relative' },
  inputGlow: {
    position: 'absolute',
    inset: -4,
    borderRadius: 16,
  },
  inputBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 46, fontSize: 14 },
  clearBtn: { padding: 4 },

  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pasteBtnText: { fontSize: 13, fontWeight: '600' },

  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    backgroundColor: ACCENT,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureBadge: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: { fontSize: 12, fontWeight: '700' },

  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  infoCardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  infoText: { fontSize: 13, flex: 1, lineHeight: 20 },
});
