import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import Header from '../components/Header';
import RecentScanRow from '../components/RecentScanRow';
import TextureBackground from '../components/TextureBackground';

const VERDICT_FILTERS = ['ALL', 'SAFE', 'SUSPICIOUS', 'DANGEROUS'];
const FEATURE_FILTERS = ['ALL', 'url_scan', 'otp_scan', 'upi_scan', 'qr_scan', 'screenshot_scan', 'voice_scan'];
const FEATURE_LABELS_SHORT = {
  ALL: 'All types', url_scan: 'URL', otp_scan: 'OTP', upi_scan: 'UPI',
  qr_scan: 'QR', screenshot_scan: 'Screenshot', voice_scan: 'Voice',
};

export default function HistoryScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const history = useScanStore((s) => s.history);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;

  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [featureFilter, setFeatureFilter] = useState('ALL');

  const filtered = history.filter((s) => {
    const vMatch = verdictFilter === 'ALL' || s.verdict === verdictFilter;
    const fMatch = featureFilter === 'ALL' || s.feature === featureFilter;
    return vMatch && fMatch;
  });

  function FilterPill({ value, current, onPress, label }) {
    const active = value === current;
    const activeColor = Colors.verdict[value] || colors.primary;
    return (
      <TouchableOpacity
        style={[
          styles.pill,
          {
            backgroundColor: active ? (isDark ? activeColor + '30' : activeColor + '18') : colors.surface,
            borderColor: active ? activeColor : colors.border,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <Text style={[styles.pillText, { color: active ? activeColor : colors.textSecondary, fontFamily: Typography.bodyMedium }]}>
          {label || value}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextureBackground isDark={isDark} />
      <Header title="Scan history" subtitle={`${filtered.length} results`} isDark={isDark} />

      {/* Filters */}
      <View style={[styles.filtersWrap, { borderBottomColor: colors.border }]}>
        <FlatList
          data={VERDICT_FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          keyExtractor={(i) => i}
          renderItem={({ item }) => (
            <FilterPill value={item} current={verdictFilter} onPress={() => setVerdictFilter(item)} />
          )}
        />
        <FlatList
          data={FEATURE_FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          keyExtractor={(i) => i}
          renderItem={({ item }) => (
            <FilterPill value={item} current={featureFilter} onPress={() => setFeatureFilter(item)} label={FEATURE_LABELS_SHORT[item]} />
          )}
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="scan-circle-outline" size={52} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: Typography.body }]}>
            No scans match the selected filters
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={[styles.rowWrap, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
              <RecentScanRow
                scan={item}
                isDark={isDark}
                showBorder={false}
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
  filtersWrap: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8 },
  filterRow: { paddingHorizontal: Spacing.md, paddingTop: 8, gap: 6 },
  pill: { borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { fontSize: 12 },
  list: { padding: Spacing.md, gap: 8, paddingBottom: 80 },
  rowWrap: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyText: { fontSize: 15 },
});
