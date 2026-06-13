import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import ConfidenceArc from '../components/ConfidenceArc';
import VerdictBadge from '../components/VerdictBadge';
import Header from '../components/Header';
import TextureBackground from '../components/TextureBackground';
import { FEATURE_LABELS } from '../services/mockData';

export default function ResultScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const result = useScanStore((s) => s.currentResult);
  const colors = isDark ? Colors.dark : Colors.light;

  if (!result) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text, fontFamily: Typography.mono }}>No result to display.</Text>
      </View>
    );
  }

  const verdictColor = Colors.verdict[result.verdict] || Colors.verdict.SAFE;
  const verdictBgColor = isDark
    ? Colors.verdictBgDark[result.verdict] || colors.surface
    : Colors.verdictBg[result.verdict] || colors.surface;
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextureBackground isDark={isDark} />
      <Header
        title="Scan result"
        subtitle={result.input_data?.slice(0, 40)}
        isDark={isDark}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Score Arc */}
        <View style={styles.arcSection}>
          <ConfidenceArc
            score={result.confidence}
            verdict={result.verdict}
            size={180}
            isDark={isDark}
          />
        </View>

        {/* Verdict Banner */}
        <View style={[styles.verdictBanner, { backgroundColor: verdictBgColor, borderLeftColor: verdictColor }]}>
          <View style={styles.verdictRow}>
            <Ionicons
              name={result.verdict === 'SAFE' ? 'checkmark-circle' : 'warning'}
              size={22}
              color={verdictColor}
            />
            <Text style={[styles.verdictText, { color: verdictColor, fontFamily: Typography.monoBold }]}>
              {result.verdict === 'SAFE'
                ? 'SAFE — No threats detected'
                : result.verdict === 'SUSPICIOUS' || result.verdict === 'MODERATE'
                ? 'MODERATE RISK — Proceed with caution'
                : 'HIGH RISK — Likely phishing'}
            </Text>
          </View>
          <Text style={[styles.verdictSub, { color: verdictColor, fontFamily: Typography.body, opacity: 0.8 }]}>
            {result.verdict === 'SAFE' ? 'This appears to be legitimate' : 'Do not open this link'}
          </Text>
        </View>

        {/* Explanation */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.primary, fontFamily: Typography.monoBold }]}>
              WHY IS THIS{result.verdict !== 'SAFE' ? ' SUSPICIOUS?' : ' SAFE?'}
            </Text>
          </View>
          <Text style={[styles.explanation, { color: colors.text, fontFamily: Typography.body }]}>
            {result.explanation}
          </Text>
        </View>

        {/* Transcript (voice scan) */}
        {transcript && !transcript.startsWith('[') && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary, fontFamily: Typography.monoBold }]}>
              LIVE TRANSCRIPT
            </Text>
            <Text style={[styles.transcript, { color: colors.text, fontFamily: Typography.body }]}>
              {renderHighlighted(transcript, highlighted, verdictColor)}
            </Text>
          </View>
        )}

        {/* Prevention Tips */}
        {result.tips && result.tips.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary, fontFamily: Typography.monoBold }]}>
              PREVENTION TIPS
            </Text>
            {result.tips.map((tip, idx) => (
              <View key={idx} style={styles.tipRow}>
                <View style={[styles.tipDot, { backgroundColor: verdictColor }]} />
                <Text style={[styles.tipText, { color: colors.text, fontFamily: Typography.body }]}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Raw flags */}
        {result.raw?.flags && result.raw.flags.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary, fontFamily: Typography.monoBold }]}>
              DETECTION FLAGS
            </Text>
            <View style={styles.flagsWrap}>
              {result.raw.flags.map((flag, idx) => (
                <View key={idx} style={[styles.flagChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.flagText, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
                    {flag}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={18} color={colors.text} />
            <Text style={[styles.btnSecondaryText, { color: colors.text, fontFamily: Typography.bodyMedium }]}>
              Share report
            </Text>
          </TouchableOpacity>
          {result.verdict !== 'SAFE' && (
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: Colors.verdict.DANGEROUS }]}
              onPress={() => Linking.openURL('https://cybercrime.gov.in')}
              activeOpacity={0.8}
            >
              <Ionicons name="flag-outline" size={18} color="#fff" />
              <Text style={[styles.btnPrimaryText, { fontFamily: Typography.bodyMedium }]}>Report scam</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function renderHighlighted(text, phrases, color) {
  // Simple: return as plain text for now (RN doesn't inline JSX in Text easily)
  return text;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  arcSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  verdictBanner: {
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    padding: Spacing.md,
    gap: 4,
  },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdictText: { fontSize: 15, flex: 1 },
  verdictSub: { fontSize: 12, paddingLeft: 30 },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 11, letterSpacing: 1.2 },
  explanation: { fontSize: 14, lineHeight: 22 },
  transcript: { fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  tipText: { fontSize: 14, flex: 1, lineHeight: 20 },
  flagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  flagChip: { borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  flagText: { fontSize: 11 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  btnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: Radius.md, borderWidth: 1, paddingVertical: 13,
  },
  btnSecondaryText: { fontSize: 14 },
  btnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: Radius.md, paddingVertical: 13,
  },
  btnPrimaryText: { fontSize: 14, color: '#fff' },
});
