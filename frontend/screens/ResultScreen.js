import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import ConfidenceArc from '../components/ConfidenceArc';
import VerdictBadge from '../components/VerdictBadge';
import BackButton from '../components/BackButton';
import TextureBackground from '../components/TextureBackground';
import { FEATURE_LABELS } from '../services/mockData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FEATURE_ICONS = {
  url_scan: 'link-outline',
  otp_scan: 'chatbox-ellipses-outline',
  upi_scan: 'card-outline',
  qr_scan: 'qr-code-outline',
  screenshot_scan: 'image-outline',
  voice_scan: 'mic-outline',
};

export default function ResultScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const result = useScanStore((s) => s.currentResult);
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement) {
      try { document.activeElement.blur(); } catch (e) {}
    }
  }, []);

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
  const featureLabel = FEATURE_LABELS[result.feature] || result.feature || 'Security Scan';
  const iconName = FEATURE_ICONS[result.feature] || 'shield-checkmark-outline';
  const mlModelName = result.raw?.ml_model || result.ml_model || (result.raw?.stt_provider ? `Whisper STT (${result.raw.stt_provider})` : 'Trained Local ML Engine');
  const classification = result.classification || result.raw?.classification || (result.verdict === 'DANGEROUS' ? 'Scam' : result.verdict === 'SUSPICIOUS' ? 'Suspicious' : 'Likely Safe');
  const riskLevel = result.risk_level || result.raw?.risk_level || (result.confidence >= 60 ? 'High' : result.confidence >= 30 ? 'Medium' : 'Low');
  const detectedIndicators = result.detected_indicators || result.raw?.detected_indicators || [];
  const recommendedAction = result.recommended_action || result.raw?.recommended_action || (result.tips && result.tips[0]) || null;
  const reasonText = result.reason || result.explanation;
  const detectedCategory = result.category || result.raw?.Category || result.raw?.category || null;
  const detectedLanguage = result.language || result.raw?.Language || result.raw?.language || null;
  const isMultilingual = result.is_multilingual || result.raw?.is_multilingual || (detectedLanguage && detectedLanguage.includes('+'));

  async function handleShare() {
    try {
      await Share.share({
        message: `CyberShield Threat Analysis Report\nClassification: ${classification}\nRisk Level: ${riskLevel}\nConfidence: ${result.confidence}%\n\nReason: ${reasonText}\n\nScan threats locally with CyberShield`,
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
      {/* Custom Clean Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 4, borderBottomColor: colors.border }]}>
        <BackButton navigation={navigation} absolute={false} />
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: Typography.bodyBold }]}>
            Scan Result
          </Text>
          <View style={[styles.headerBadge, { backgroundColor: verdictColor + '15', borderColor: verdictColor + '30' }]}>
            <Ionicons name={iconName} size={12} color={verdictColor} />
            <Text style={[styles.headerBadgeText, { color: verdictColor }]}>
              {featureLabel.toUpperCase()} REPORT
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Classification & Risk Level Badges Row */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricPill, { backgroundColor: verdictColor + '18', borderColor: verdictColor + '35' }]}>
            <Text style={[styles.metricPillLabel, { color: colors.textSecondary }]}>Classification:</Text>
            <Text style={[styles.metricPillVal, { color: verdictColor }]}>{classification}</Text>
          </View>
          <View style={[styles.metricPill, { backgroundColor: verdictColor + '18', borderColor: verdictColor + '35' }]}>
            <Text style={[styles.metricPillLabel, { color: colors.textSecondary }]}>Risk Level:</Text>
            <Text style={[styles.metricPillVal, { color: verdictColor }]}>{riskLevel}</Text>
          </View>
          <View style={[styles.metricPill, { backgroundColor: verdictColor + '18', borderColor: verdictColor + '35' }]}>
            <Text style={[styles.metricPillLabel, { color: colors.textSecondary }]}>Confidence:</Text>
            <Text style={[styles.metricPillVal, { color: verdictColor }]}>{result.confidence}%</Text>
          </View>
        </View>

        {/* Score Arc with Glowing Card */}
        <View style={[styles.arcSection, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <ConfidenceArc
            score={result.confidence}
            verdict={result.verdict}
            size={180}
            isDark={isDark}
          />
          <Text style={[styles.scanLabel, { color: verdictColor }]}>
            THREAT RISK CONFIDENCE
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
              {`${classification.toUpperCase()} · ${riskLevel.toUpperCase()} RISK`}
            </Text>
          </View>
          <Text style={styles.verdictSub}>
            {reasonText}
          </Text>

          {(detectedCategory || detectedLanguage) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {detectedLanguage && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="language-outline" size={13} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: Typography.monoBold }}>
                    {isMultilingual ? `MULTI-LANG: ${detectedLanguage.toUpperCase()}` : `LANG: ${detectedLanguage.toUpperCase()}`}
                  </Text>
                </View>
              )}
              {detectedCategory && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="pricetag-outline" size={13} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: Typography.monoBold }}>
                    {`CATEGORY: ${detectedCategory.toUpperCase()}`}
                  </Text>
                </View>
              )}
            </View>
          )}
        </LinearGradient>

        {/* Voice Recording Preview Player */}
        {result.feature === 'voice_scan' && (result.audioUri || result.raw?.audioUri) && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
            <View style={styles.cardHeader}>
              <Ionicons name="volume-high-outline" size={18} color={verdictColor} />
              <Text style={[styles.cardTitle, { color: verdictColor }]}>
                VOICE RECORDING PREVIEW
              </Text>
            </View>
            <View style={{ marginTop: 8, width: '100%', alignItems: 'center' }}>
              {Platform.OS === 'web' ? (
                <audio src={result.audioUri || result.raw?.audioUri} controls style={{ width: '100%', height: 40 }} />
              ) : (
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: Typography.body }}>
                  Audio recording captured and analyzed.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Dedicated Scanned Target / Extracted Audio Transcript Card */}
        {result.feature === 'voice_scan' ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
            <View style={[styles.cardHeader, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="chatbox-ellipses-outline" size={18} color={verdictColor} />
                <Text style={[styles.cardTitle, { color: verdictColor }]}>
                  EXTRACTED AUDIO TRANSCRIPT
                </Text>
              </View>
              {detectedLanguage && (
                <View style={{ backgroundColor: isDark ? '#1E293B' : '#E2E8F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, fontFamily: Typography.monoBold }}>
                    {detectedLanguage}
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.payloadBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}>
              <Text style={[styles.payloadText, { color: colors.text }]}>
                {renderHighlighted(transcript || result.input_data, highlighted, verdictColor)}
              </Text>
            </View>

            {mlModelName ? (
              <View style={[styles.mlChip, { backgroundColor: isDark ? '#1E293B' : '#EDF2F7', borderColor: colors.border }]}>
                <Ionicons name="hardware-chip-outline" size={13} color={colors.primary} />
                <Text style={[styles.mlChipText, { color: colors.textSecondary }]}>
                  {`AI Transcriber & NLP Analyzer: `}<Text style={{ color: colors.text, fontWeight: '700' }}>{mlModelName}</Text>
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          result.input_data ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
              <View style={styles.cardHeader}>
                <Ionicons name="finger-print-outline" size={18} color={verdictColor} />
                <Text style={[styles.cardTitle, { color: verdictColor }]}>
                  EXTRACTED TEXT / PAYLOAD
                </Text>
              </View>

              <View style={[styles.payloadBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: colors.border }]}>
                <Text style={[styles.payloadText, { color: colors.text }]}>
                  {result.input_data}
                </Text>
              </View>

              {mlModelName ? (
                <View style={[styles.mlChip, { backgroundColor: isDark ? '#1E293B' : '#EDF2F7', borderColor: colors.border }]}>
                  <Ionicons name="hardware-chip-outline" size={13} color={colors.primary} />
                  <Text style={[styles.mlChipText, { color: colors.textSecondary }]}>
                    {`Local AI Engine: `}<Text style={{ color: colors.text, fontWeight: '700' }}>{mlModelName}</Text>
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null
        )}

        {/* Detected Scam Indicators Card */}
        {detectedIndicators && detectedIndicators.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
            <View style={styles.cardHeader}>
              <Ionicons name="alert-circle-outline" size={18} color={verdictColor} />
              <Text style={[styles.cardTitle, { color: verdictColor }]}>
                DETECTED SCAM INDICATORS
              </Text>
            </View>
            {detectedIndicators.map((ind, idx) => (
              <View key={idx} style={styles.indicatorRow}>
                <Ionicons name="warning-outline" size={15} color={verdictColor} style={{ marginTop: 2 }} />
                <Text style={[styles.indicatorText, { color: colors.text }]}>{ind}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Explanation / Reason Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <View style={styles.cardHeader}>
            <Ionicons name="bulb-outline" size={18} color={verdictColor} />
            <Text style={[styles.cardTitle, { color: verdictColor }]}>
              REASON & ANALYSIS
            </Text>
          </View>
          <Text style={[styles.explanation, { color: colors.text }]}>
            {reasonText}
          </Text>
        </View>

        {/* Recommended Action Card */}
        {recommendedAction && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-checkmark-outline" size={18} color={verdictColor} />
              <Text style={[styles.cardTitle, { color: verdictColor }]}>
                RECOMMENDED SAFE ACTION
              </Text>
            </View>
            <Text style={[styles.explanation, { color: colors.text }]}>
              {recommendedAction}
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
    flexDirection: 'column',
    gap: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  headerBadgeText: {
    fontSize: 10,
    fontFamily: Typography.monoBold,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  payloadBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 2,
  },
  payloadText: {
    fontSize: 13,
    fontFamily: Typography.mono,
    lineHeight: 18,
  },
  mlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  mlChipText: {
    fontSize: 11,
    fontFamily: Typography.bodyMedium,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricPill: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  metricPillLabel: {
    fontSize: 10,
    fontFamily: Typography.mono,
  },
  metricPillVal: {
    fontSize: 12,
    fontFamily: Typography.bodyBold,
    fontWeight: '800',
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
  },
  indicatorText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
    fontFamily: Typography.bodyMedium,
  },
});
