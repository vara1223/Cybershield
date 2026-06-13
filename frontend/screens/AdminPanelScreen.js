import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import TextureBackground from '../components/TextureBackground';
import RecentScanRow from '../components/RecentScanRow';
import WeeklyChart from '../components/WeeklyChart';
import { MOCK_STATS } from '../services/mockData';
import api from '../services/api';

export const ADMIN_PIN = '1234';

const PIN = ADMIN_PIN;

export default function AdminPanelScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const adminAuthenticated = useScanStore((s) => s.adminAuthenticated);
  const setAdminAuthenticated = useScanStore((s) => s.setAdminAuthenticated);
  const history = useScanStore((s) => s.history);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [pinInput, setPinInput] = useState('');
  const [stats, setStats] = useState(MOCK_STATS);

  useEffect(() => {
    if (adminAuthenticated) {
      api.getAdminStats().then(setStats).catch(() => {});
    }
  }, [adminAuthenticated]);

  function handleDigit(d) {
    if (pinInput.length >= 4) return;
    const next = pinInput + d;
    setPinInput(next);
    if (next.length === 4) {
      if (next === PIN) {
        setAdminAuthenticated(true);
        setPinInput('');
      } else {
        Alert.alert('Incorrect PIN', 'Please try again.');
        setTimeout(() => setPinInput(''), 500);
      }
    }
  }

  function handleExportCSV() {
    Linking.openURL('http://192.168.0.182:8000/admin/export/csv').catch(() =>
      Alert.alert('Export unavailable', 'Backend not connected. Connect to the FastAPI server to export logs.')
    );
  }

  function handleBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Login');
    }
  }

  if (!adminAuthenticated) {
    return (
      <View style={[styles.pinContainer, { backgroundColor: colors.background }]}>
        <TextureBackground isDark={isDark} />        <View style={styles.authHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.authHeaderTitle, { color: colors.text, fontFamily: Typography.monoBold }]}>Admin Panel</Text>
        </View>        <View style={[styles.pinCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.md]}>
          <View style={[styles.lockIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="lock-closed" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.pinTitle, { color: colors.text, fontFamily: Typography.monoBold }]}>Admin Panel</Text>
          <Text style={[styles.pinSub, { color: colors.textSecondary, fontFamily: Typography.body }]}>Enter 4-digit PIN to access</Text>

          {/* PIN dots */}
          <View style={styles.dotRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i < pinInput.length ? colors.primary : colors.surface,
                    borderColor: i < pinInput.length ? colors.primary : colors.border,
                  },
                ]}
              />
            ))}
          </View>

          {/* Numpad */}
          <View style={styles.numpad}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.numKey, { backgroundColor: d ? colors.surface : 'transparent', borderColor: colors.border }]}
                onPress={() => {
                  if (d === '⌫') setPinInput((p) => p.slice(0, -1));
                  else if (d) handleDigit(d);
                }}
                activeOpacity={d ? 0.7 : 1}
                disabled={!d && d !== '0'}
              >
                {d ? (
                  <Text style={[styles.numKeyText, { color: colors.text, fontFamily: d === '⌫' ? Typography.body : Typography.monoBold }]}>
                    {d}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const recentDetections = history.filter((s) => s.verdict !== 'SAFE').slice(0, 6);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextureBackground isDark={isDark} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}> 
        <TouchableOpacity onPress={handleBack} style={styles.backButtonHeader}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: Typography.monoBold }]}>Admin panel</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary, fontFamily: Typography.body }]}>Threat intelligence overview</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.authDots}>
            {[...Array(4)].map((_, i) => (
              <View key={i} style={[styles.authDot, { backgroundColor: Colors.light.primary }]} />
            ))}
          </View>
          <View style={styles.authBadge}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.verdict.SAFE} />
            <Text style={[styles.authText, { color: Colors.verdict.SAFE, fontFamily: Typography.mono }]}>Authenticated</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { value: stats.total, label: 'Total scans', color: colors.primary },
            { value: stats.threats, label: 'Threats detected', color: Colors.verdict.DANGEROUS },
            { value: `${stats.safe_rate}%`, label: 'Safe rate', color: Colors.verdict.SAFE },
            { value: stats.today_count, label: "Today's scans", color: '#8B5CF6' },
          ].map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
              <Text style={[styles.statValue, { color: s.color, fontFamily: Typography.monoBold }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: Typography.body }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Weekly chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Typography.mono }]}>SCANS THIS WEEK</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <WeeklyChart data={stats.daily_counts} isDark={isDark} height={130} />
          </ScrollView>
        </View>

        {/* Category breakdown */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Typography.mono }]}>BY CATEGORY</Text>
          {Object.entries(stats.by_category).map(([feature, count]) => {
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <View key={feature} style={styles.catRow}>
                <Text style={[styles.catLabel, { color: colors.text, fontFamily: Typography.body }]}>
                  {feature.replace('_scan', '').toUpperCase()}
                </Text>
                <View style={[styles.catBar, { backgroundColor: colors.surface }]}>
                  <View style={[styles.catFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={[styles.catCount, { color: colors.textSecondary, fontFamily: Typography.mono }]}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* Recent detections */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Typography.mono }]}>RECENT DETECTIONS</Text>
        </View>
        <View style={[styles.detectionsCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          {recentDetections.length > 0 ? recentDetections.map((scan, idx) => (
            <RecentScanRow
              key={scan.id}
              scan={scan}
              isDark={isDark}
              showBorder={idx < recentDetections.length - 1}
              onPress={() => { setCurrentResult(scan); navigation.navigate('Result'); }}
            />
          )) : (
            <Text style={[styles.noDetections, { color: colors.textSecondary, fontFamily: Typography.body }]}>No threats detected yet.</Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleExportCSV}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={18} color={colors.text} />
            <Text style={[styles.exportBtnText, { color: colors.text, fontFamily: Typography.bodyMedium }]}>Export CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: Colors.verdictBg.DANGEROUS, borderColor: Colors.verdict.DANGEROUS }]}
            onPress={() => setAdminAuthenticated(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed-outline" size={18} color={Colors.verdict.DANGEROUS} />
            <Text style={[styles.logoutBtnText, { color: Colors.verdict.DANGEROUS, fontFamily: Typography.bodyMedium }]}>Lock panel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pinContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  pinCard: { width: '100%', maxWidth: 340, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, alignItems: 'center', gap: Spacing.md },
  lockIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  pinTitle: { fontSize: 22 },
  pinSub: { fontSize: 14 },
  dotRow: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', width: 240, gap: 12, justifyContent: 'center' },
  numKey: { width: 64, height: 64, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  numKeyText: { fontSize: 22 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm + 4, borderBottomWidth: StyleSheet.hairlineWidth },
  backButtonHeader: { padding: 8, marginRight: 12 },
  authHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
  backButton: { padding: 10, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  authHeaderTitle: { fontSize: 18 },
  headerTitle: { fontSize: 20 },
  headerSub: { fontSize: 12, marginTop: 1 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  authDots: { flexDirection: 'row', gap: 4 },
  authDot: { width: 8, height: 8, borderRadius: 4 },
  authBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authText: { fontSize: 11 },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: { width: '47%', borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 4 },
  statValue: { fontSize: 26 },
  statLabel: { fontSize: 12 },
  chartCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catLabel: { fontSize: 12, width: 80 },
  catBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  catFill: { height: 6, borderRadius: 3 },
  catCount: { fontSize: 12, width: 32, textAlign: 'right' },
  detectionsCard: { borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: Spacing.md },
  noDetections: { paddingVertical: Spacing.md, fontSize: 14 },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.md, borderWidth: 1, paddingVertical: 12 },
  exportBtnText: { fontSize: 14 },
  logoutBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.md, borderWidth: 1, paddingVertical: 12 },
  logoutBtnText: { fontSize: 14 },
});
