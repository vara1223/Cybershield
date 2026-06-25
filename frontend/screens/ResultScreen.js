import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import ConfidenceArc from '../components/ConfidenceArc';
import VerdictBadge from '../components/VerdictBadge';
import Header from '../components/Header';
import TextureBackground from '../components/TextureBackground';
import { FEATURE_LABELS } from '../services/mockData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ResultScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const result = useScanStore((s) => s.currentResult);
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  if (!result) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text, fontFamily: Typography.mono }}>No result to display.</Text>
      </View>
    );
  }

  const verdictColor = Colors.verdict[result.verdict] || Colors.verdict.SAFE;
  
  // Vibrant gradients for the verdict banner
  const verdictGradient =
    result.verdict === 'SAFE'
      ? ['#10B981', '#059669']
      : result.verdict === 'SUSPICIOUS' || result.verdict === 'MODERATE'
      ? ['#F59E0B', '#D97706']
      : ['#EF4444', '#DC2626'];

  const transcript = result.raw?.transcript;
  const highlighted = result.raw?.highlighted_phrases || [];
  const featureLabel = FEATURE_LABELS[result.feature] || result.feature;

  async function handleShare() {
    try {
      await Share.share({
        message: `CyberShield Report\nFeature: ${featureLabel}\nVerdict: ${result.verdict}\nConfidence: ${result.confidence}%\n\n${result.explanation}\n\nScan your own threats at cybershield.app`,
      });
    } catch {}
  }

  function renderHighlighted(text, phrases, color) {
    if (!text) return '';
    if (!phrases || phrases.length === 0) return text;
    
    const sortedPhrases = [...phrases].sort((a, b) => b.length - a.length);
    const escaped = sortedPhrases.map(p => p.replace(/[.*+?^${}()|[\\\\]]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
      const isMatch = phrases.some(p => p.toLowerCase() === part.toLowerCase());
      return (
        <Text key={i} style={isMatch ? { color: color, fontWeight: '800', textDecorationLine: 'underline' } : null}>
          {part}
        </Text>
      );
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextureBackground isDark={isDark} />
      {/* Custom Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 4, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: verdictColor, fontFamily: Typography.bodyBold }]}>
            Scan Result
          </Text>
          {result.input_data && (
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary, fontFamily: Typography.mono }]} numberOfLines={1}>
              {result.input_data.slice(0, 50)}
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Score Arc with Glowing Card */}
        <View style={[styles.arcSection, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <ConfidenceArc
            score={result.confidence}
            verdict={result.verdict}
            size={180}
            isDark={isDark}
          />
          <Text style={[styles.scanLabel, { color: verdictColor }]}>
            CONFIDENCE RATING
          </Text>
        </View>

        {/* Verdict Banner with vibrant Gradient */}
        <LinearGradient
          colors={verdictGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.verdictBanner}
        >
          <View style={styles.verdictRow}>
            <Ionicons
              name={result.verdict === 'SAFE' ? 'checkmark-circle' : 'warning'}
              size={24}
              color="#fff"
            />
            <Text style={styles.verdictText}>
              {result.verdict === 'SAFE'
                ? 'SECURE · No threat detected'
                : result.verdict === 'SUSPICIOUS' || result.verdict === 'MODERATE'
                ? 'CAUTION · Moderate threat risk'
                : 'DANGER · High security risk'}
            </Text>
          </View>
          <Text style={styles.verdictSub}>
            {result.verdict === 'SAFE'
              ? 'Our analysis engine scanned the payload and found no malicious patterns.'
              : result.verdict === 'SUSPICIOUS' || result.verdict === 'MODERATE'
              ? 'Suspicious elements were detected. Do not click links or share details.'
              : 'Critical security risk. Highly recommended to delete and block contact.'}
          </Text>
        </LinearGradient>

        {/* Explanation Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <View style={styles.cardHeader}>
            <Ionicons name="bulb-outline" size={18} color={verdictColor} />
            <Text style={[styles.cardTitle, { color: verdictColor }]}>
              ANALYSIS EXPLANATION
            </Text>
          </View>
          <Text style={[styles.explanation, { color: colors.text }]}>
            {result.explanation}
          </Text>
        </View>

        {/* Transcript (voice scan only) */}
        {transcript && !transcript.startsWith('[') && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
            <View style={styles.cardHeader}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={verdictColor} />
              <Text style={[styles.cardTitle, { color: verdictColor }]}>
                HIGHLIGHTED CALL DIALOGUE
              </Text>
            </View>
            <Text style={[styles.transcript, { color: colors.text }]}>
              {renderHighlighted(transcript, highlighted, verdictColor)}
            </Text>
          </View>
        )}

        {/* Prevention Tips */}
        {result.tips && result.tips.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-outline" size={18} color={verdictColor} />
              <Text style={[styles.cardTitle, { color: verdictColor }]}>
                RECOMMENDED SAFETY ACTIONS
              </Text>
            </View>
            {result.tips.map((tip, idx) => (
              <View key={idx} style={styles.tipRow}>
                <Ionicons name="checkbox-outline" size={16} color={verdictColor} style={{ marginTop: 2 }} />
                <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Detection flags */}
        {result.raw?.flags && result.raw.flags.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
            <View style={styles.cardHeader}>
              <Ionicons name="flag-outline" size={18} color={verdictColor} />
              <Text style={[styles.cardTitle, { color: verdictColor }]}>
                DETECTION SIGNATURE FLAGS
              </Text>
            </View>
            <View style={styles.flagsWrap}>
              {result.raw.flags.map((flag, idx) => (
                <View key={idx} style={[styles.flagChip, { backgroundColor: verdictColor + '15', borderColor: verdictColor + '30' }]}>
                  <Text style={[styles.flagText, { color: verdictColor }]}>
                    {flag}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions Row */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.shareBtnWrap}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#4361EE', '#3F37C9']}
              style={styles.btnGradient}
            >
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={styles.btnTextWhite}>Share Report</Text>
            </LinearGradient>
          </TouchableOpacity>

          {result.verdict !== 'SAFE' && (
            <TouchableOpacity
              style={styles.reportBtnWrap}
              onPress={() => Linking.openURL('https://cybercrime.gov.in')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#EF4444', '#B91C1C']}
                style={styles.btnGradient}
              >
                <Ionicons name="megaphone-outline" size={18} color="#fff" />
                <Text style={styles.btnTextWhite}>Report Incident</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  arcSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  scanLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontFamily: Typography.monoBold,
  },
  verdictBanner: {
    borderRadius: 18,
    padding: 20,
    gap: 8,
    ...Shadow.sm,
  },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verdictText: { fontSize: 16, fontWeight: '800', color: '#fff', fontFamily: Typography.bodySemiBold },
  verdictSub: { fontSize: 13, color: '#fff', opacity: 0.9, lineHeight: 19, fontFamily: Typography.body },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, fontFamily: Typography.monoBold },
  explanation: { fontSize: 14, lineHeight: 22, fontFamily: Typography.body },
  transcript: { fontSize: 14, lineHeight: 22, fontStyle: 'italic', fontFamily: Typography.bodyMedium },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  tipText: { fontSize: 14, flex: 1, lineHeight: 20, fontFamily: Typography.body },
  flagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  flagChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  flagText: { fontSize: 11, fontFamily: Typography.monoBold, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  shareBtnWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  reportBtnWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  btnTextWhite: { fontSize: 14, color: '#fff', fontWeight: '700' },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
  },
});
