import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import useScanStore from '../store/useScanStore';
import { useAuth } from '../context/AuthContext';
import { Colors, Shadow } from '../constants/theme';
import RecentScanRow from '../components/RecentScanRow';
import TextureBackground from '../components/TextureBackground';

const VERDICT_FILTERS = ['ALL', 'SAFE', 'SUSPICIOUS', 'DANGEROUS'];
const FEATURE_FILTERS = ['ALL', 'url_scan', 'otp_scan', 'upi_scan', 'qr_scan', 'screenshot_scan', 'voice_scan'];
const FEATURE_LABELS = {
  ALL: 'All', url_scan: 'URL', otp_scan: 'OTP', upi_scan: 'UPI',
  qr_scan: 'QR', screenshot_scan: 'Screen', voice_scan: 'Voice',
};

const VERDICT_COLOR = {
  ALL:        null,
  SAFE:       '#00C48C',
  SUSPICIOUS: '#FFB020',
  DANGEROUS:  '#FF4D4F',
};

export default function HistoryScreen({ navigation }) {
  const isDark          = useScanStore((s) => s.isDark);
  const history         = useScanStore((s) => s.history);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const { profile }     = useAuth();
  const insets          = useSafeAreaInsets();
  const colors          = isDark ? Colors.dark : Colors.light;

  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [featureFilter, setFeatureFilter] = useState('ALL');

  const filtered = history.filter((s) => {
    const vMatch = verdictFilter === 'ALL' || s.verdict === verdictFilter;
    const fMatch = featureFilter === 'ALL' || s.feature === featureFilter;
    return vMatch && fMatch;
  });

  const threatCount = history.filter((s) => s.verdict === 'DANGEROUS' || s.verdict === 'SUSPICIOUS').length;

  // ── Filter pill ─────────────────────────────────────────────
  function FilterPill({ value, current, onPress, label, verdictColor }) {
    const active      = value === current;
    const activeColor = verdictColor || (isDark ? '#00D4FF' : '#4361EE');
    return (
      <TouchableOpacity
        style={[
          styles.pill,
          {
            backgroundColor: active
              ? activeColor + (isDark ? '20' : '15')
              : (isDark ? '#111827' : '#F1F5F9'),
            borderColor: active ? activeColor + '55' : (isDark ? '#1E2D45' : '#D1D9F0'),
          },
        ]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {active && verdictColor && (
          <View style={[styles.pillDot, { backgroundColor: verdictColor }]} />
        )}
        <Text style={[
          styles.pillText,
          { color: active ? activeColor : colors.textMuted, fontWeight: active ? '700' : '500' },
        ]}>
          {label || value}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <TextureBackground isDark={isDark} />

      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + 14,
          backgroundColor: isDark ? '#0A0F1E' : '#FFFFFF',
          borderBottomColor: isDark ? '#1E2D45' : '#D1D9F0',
        },
      ]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerEyebrow, { color: isDark ? '#00D4FF' : '#4361EE' }]}>
              SECURITY LOGS
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Scan History
            </Text>
          </View>

          {/* Log count badge */}
          <View style={[styles.countBadge, {
            backgroundColor: isDark ? '#00D4FF0A' : '#EEF2FF',
            borderColor: isDark ? '#00D4FF22' : '#C7D2FE',
          }]}>
            <Text style={[styles.countNum, { color: isDark ? '#00D4FF' : '#4361EE' }]}>
              {history.length}
            </Text>
            <Text style={[styles.countLabel, { color: isDark ? '#4A5568' : '#6B7280' }]}>ENTRIES</Text>
          </View>
        </View>

        {/* Threat summary row */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: '#00C48C12', borderColor: '#00C48C30' }]}>
            <View style={[styles.summaryDot, { backgroundColor: '#00C48C' }]} />
            <Text style={[styles.summaryText, { color: '#00C48C' }]}>
              {history.filter(s => s.verdict === 'SAFE').length} SAFE
            </Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: '#FFB02012', borderColor: '#FFB02030' }]}>
            <View style={[styles.summaryDot, { backgroundColor: '#FFB020' }]} />
            <Text style={[styles.summaryText, { color: '#FFB020' }]}>
              {history.filter(s => s.verdict === 'SUSPICIOUS' || s.verdict === 'MODERATE').length} SUSPICIOUS
            </Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: '#FF4D4F12', borderColor: '#FF4D4F30' }]}>
            <View style={[styles.summaryDot, { backgroundColor: '#FF4D4F' }]} />
            <Text style={[styles.summaryText, { color: '#FF4D4F' }]}>
              {history.filter(s => s.verdict === 'DANGEROUS' || s.verdict === 'DANGER').length} THREATS
            </Text>
          </View>
        </View>

        {/* Cyan accent line */}
        <View style={[styles.accentLine, { backgroundColor: isDark ? '#00D4FF' : '#4361EE' }]} />
      </View>

      {/* ── Filters ─────────────────────────────────────────── */}
      <View style={[styles.filtersWrap, { borderBottomColor: isDark ? '#1E2D45' : '#D1D9F0', backgroundColor: isDark ? '#070B14' : '#F8FAFF' }]}>
        {/* Verdict filters */}
        <FlatList
          data={VERDICT_FILTERS}
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          keyExtractor={(i) => i}
          renderItem={({ item }) => (
            <FilterPill
              value={item} current={verdictFilter}
              onPress={() => setVerdictFilter(item)}
              verdictColor={VERDICT_COLOR[item]}
            />
          )}
        />
        {/* Feature filters */}
        <FlatList
          data={FEATURE_FILTERS}
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          keyExtractor={(i) => i}
          renderItem={({ item }) => (
            <FilterPill
              value={item} current={featureFilter}
              onPress={() => setFeatureFilter(item)}
              label={FEATURE_LABELS[item]}
            />
          )}
        />
      </View>

      {/* ── Result count ─────────────────────────────────────── */}
      <View style={[styles.resultBar, { backgroundColor: isDark ? '#0A0F1E' : '#F0F4FF', borderBottomColor: isDark ? '#1E2D45' : '#D1D9F0' }]}>
        <Text style={[styles.resultText, { color: colors.textMuted }]}>
          {filtered.length} {filtered.length === 1 ? 'record' : 'records'} found
        </Text>
      </View>

      {/* ── Log entries ──────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#111827' : '#F1F5F9' }]}>
            <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Records Found</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No scan logs match the selected filters
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[
              styles.rowWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
              <RecentScanRow
                scan={item} isDark={isDark} showBorder={false}
                onPress={() => {
                  setCurrentResult(item);
                  navigation.navigate('Result');
                }}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft:   { gap: 2 },
  headerEyebrow:{ fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headerTitle:  { fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },

  countBadge: {
    alignItems: 'center', borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  countNum:   { fontSize: 20, fontWeight: '800' },
  countLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },

  summaryRow: { flexDirection: 'row', gap: 6 },
  summaryChip:{
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  summaryDot: { width: 5, height: 5, borderRadius: 3 },
  summaryText:{ fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  accentLine: { height: 1.5, width: 28, borderRadius: 2, opacity: 0.7, marginTop: 2 },

  // Filters
  filtersWrap:  { borderBottomWidth: 1, paddingBottom: 6 },
  filterRow:    { paddingHorizontal: 14, paddingTop: 8, gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 999, borderWidth: 1,
    paddingHorizontal: 11, paddingVertical: 5,
  },
  pillDot:  { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 11 },

  // Result bar
  resultBar: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderBottomWidth: 1,
  },
  resultText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  // List
  list:   { padding: 12, gap: 8 },
  rowWrap:{
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 10,
    ...Shadow.sm,
  },

  // Empty
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyText:  { fontSize: 14, textAlign: 'center' },
});
