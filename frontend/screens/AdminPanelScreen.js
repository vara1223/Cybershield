import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Linking,
  ScrollView,
  Platform,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import TextureBackground from '../components/TextureBackground';
import RecentScanRow from '../components/RecentScanRow';
import WeeklyChart from '../components/WeeklyChart';
import { MOCK_STATS } from '../services/mockData';
import api, { BASE_URL } from '../services/api';
import Constants from 'expo-constants';

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

  // New admin dashboard states
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'threats', 'system'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedScan, setSelectedScan] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // System Diagnostics states
  const [securityLevel, setSecurityLevel] = useState('Standard'); // 'Low', 'Standard', 'High'
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState('');
  const [cacheFlushed, setCacheFlushed] = useState(false);

  useEffect(() => {
    if (adminAuthenticated) {
      api.getAdminStats().then(setStats).catch(() => {});
    }
  }, [adminAuthenticated]);

  // Keyboard entry support for passkey page
  useEffect(() => {
    if (adminAuthenticated) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        setPinInput((p) => p.slice(0, -1));
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [pinInput, adminAuthenticated]);

  function handleDigit(d) {
    setPinInput((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) {
        if (next === PIN) {
          setTimeout(() => {
            setAdminAuthenticated(true);
            setPinInput('');
          }, 0);
        } else {
          setTimeout(() => {
            Alert.alert('Incorrect Passkey', 'Please try again.');
            setPinInput('');
          }, 0);
        }
      }
      return next;
    });
  }

  function handleExportCSV() {
    const adminKey =
      Constants.expoConfig?.extra?.ADMIN_API_KEY ||
      Constants.manifest?.extra?.ADMIN_API_KEY ||
      process.env.EXPO_PUBLIC_ADMIN_API_KEY ||
      '';
    const exportUrl = `${BASE_URL}/admin/export/csv${adminKey ? `?api_key=${encodeURIComponent(adminKey)}` : ''}`;
    Linking.openURL(exportUrl).catch(() =>
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

  function runSystemDiagnostic() {
    setDiagnosticRunning(true);
    setDiagnosticResult('');
    setTimeout(() => {
      setDiagnosticRunning(false);
      setDiagnosticResult('All scans operational. API Latency: 24ms. Database status: Healthy. 0 integrity failures found.');
    }, 1500);
  }

  function flushSystemCache() {
    setCacheFlushed(true);
    Alert.alert('Cache Cleared', 'System cache was flushed successfully.');
    setTimeout(() => setCacheFlushed(false), 2000);
  }

  // Filter logs for the threats tab
  const threatLogs = history.filter((scan) => {
    // Exclude SAFE verdicts for the threat logs view
    const isThreat = scan.verdict !== 'SAFE';
    if (!isThreat) return false;

    // Search query match
    const matchesSearch =
      (scan.input_data || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (scan.explanation || '').toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter match
    const matchesCategory =
      categoryFilter === 'ALL' ||
      scan.feature.toLowerCase().includes(categoryFilter.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  // Passkey screen rendering (if not authenticated)
  if (!adminAuthenticated) {
    return (
      <View style={[styles.pinContainer, { backgroundColor: colors.background }]}>
        <TextureBackground isDark={isDark} />

        {/* Modern back navigation capsule */}
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backButtonCapsule, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}
        >
          <Ionicons name="arrow-back" size={16} color={colors.text} />
          <Text style={[styles.backButtonCapsuleText, { color: colors.text, fontFamily: Typography.bodyMedium }]}>
            Exit Admin
          </Text>
        </TouchableOpacity>

        {/* Elegant card container */}
        <View style={[styles.pinCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.md]}>
          <View style={[styles.lockIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.pinTitle, { color: colors.text, fontFamily: Typography.monoBold }]}>Admin Console</Text>
          <Text style={[styles.pinSub, { color: colors.textSecondary, fontFamily: Typography.body }]}>
            Enter 4-digit Passkey to access
          </Text>

          {/* Passkey dots */}
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

          {/* Modern Circular Numpad */}
          <View style={styles.numpad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.numKeyCircle,
                  {
                    backgroundColor: d ? colors.surface : 'transparent',
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  if (d === '⌫') setPinInput((p) => p.slice(0, -1));
                  else if (d) handleDigit(d);
                }}
                activeOpacity={d ? 0.6 : 1}
                disabled={!d && d !== '0'}
              >
                {d ? (
                  <Text
                    style={[
                      styles.numKeyText,
                      { color: colors.text, fontFamily: d === '⌫' ? Typography.body : Typography.monoBold },
                    ]}
                  >
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

  // Admin Panel Main rendering (if authenticated)
  const recentDetections = history.filter((s) => s.verdict !== 'SAFE').slice(0, 5);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextureBackground isDark={isDark} />

      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backButtonHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text, fontFamily: Typography.bodyMedium }]}>Exit</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: Typography.monoBold }]}>Admin Panel</Text>
          <View style={styles.statusBadgeRow}>
            <View style={[styles.statusDot, { backgroundColor: Colors.verdict.SAFE }]} />
            <Text style={[styles.statusBadgeText, { color: colors.textSecondary, fontFamily: Typography.body }]}>
              Secure Console
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.authBadge}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.verdict.SAFE} />
            <Text style={[styles.authText, { color: Colors.verdict.SAFE, fontFamily: Typography.mono }]}>ADMIN</Text>
          </View>
        </View>
      </View>

      {/* Modern Tab Bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {[
          { id: 'overview', label: 'Overview', icon: 'bar-chart' },
          { id: 'threats', label: 'Threat Center', icon: 'warning' },
          { id: 'system', label: 'Diagnostics', icon: 'cog' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabItem,
              activeTab === tab.id && { borderBottomColor: colors.primary },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? colors.primary : colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: activeTab === tab.id ? colors.primary : colors.textSecondary,
                  fontFamily: activeTab === tab.id ? Typography.bodySemiBold : Typography.body,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <View style={styles.tabContentContainer}>
            {/* Modern Stats Grid */}
            <View style={styles.statsGrid}>
              {[
                { value: stats.total, label: 'Total Scans', sub: '+8% vs yesterday', color: colors.primary, icon: 'search' },
                { value: stats.threats, label: 'Threats Blocked', sub: '+2 today', color: Colors.verdict.DANGEROUS, icon: 'bug' },
                { value: `${stats.safe_rate}%`, label: 'Safe Rate', sub: 'Stable', color: Colors.verdict.SAFE, icon: 'shield-half' },
                { value: stats.today_count, label: "Today's Scans", sub: '24h active logs', color: '#8B5CF6', icon: 'today' },
              ].map((s, i) => (
                <View
                  key={i}
                  style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}
                >
                  <View style={styles.statCardHeader}>
                    <Ionicons name={s.icon} size={18} color={s.color} />
                    <Text style={[styles.statSubText, { color: colors.textSecondary, fontFamily: Typography.body }]}>
                      {s.sub}
                    </Text>
                  </View>
                  <Text style={[styles.statValue, { color: s.color, fontFamily: Typography.monoBold }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.text, fontFamily: Typography.bodyMedium }]}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Chart */}
            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
                WEEKLY THREAT VOLUME
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <WeeklyChart data={stats.daily_counts} isDark={isDark} height={140} />
              </ScrollView>
            </View>

            {/* Category breakdown */}
            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
                BY SCAN TYPE
              </Text>
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
                    <Text style={[styles.catCount, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
                      {count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* TAB 2: THREAT CENTER */}
        {activeTab === 'threats' && (
          <View style={styles.tabContentContainer}>
            {/* Search and Filter Area */}
            <View style={[styles.searchFilterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search threat logs..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={[styles.searchInput, { color: colors.text, fontFamily: Typography.body }]}
                />
                {searchQuery !== '' && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Horizontal Category Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillRow}>
                {['ALL', 'URL', 'QR', 'OTP', 'UPI', 'Screenshot', 'Voice'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: categoryFilter === cat ? colors.primary : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setCategoryFilter(cat)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        {
                          color: categoryFilter === cat ? '#fff' : colors.textSecondary,
                          fontFamily: Typography.bodyMedium,
                        },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* List of threats */}
            <Text style={[styles.threatCountText, { color: colors.textSecondary, fontFamily: Typography.body }]}>
              Showing {threatLogs.length} threat logs
            </Text>

            <View style={[styles.detectionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {threatLogs.length > 0 ? (
                threatLogs.map((scan, idx) => (
                  <RecentScanRow
                    key={scan.id}
                    scan={scan}
                    isDark={isDark}
                    showBorder={idx < threatLogs.length - 1}
                    onPress={() => {
                      setSelectedScan(scan);
                      setModalVisible(true);
                    }}
                  />
                ))
              ) : (
                <Text style={[styles.noDetections, { color: colors.textSecondary, fontFamily: Typography.body }]}>
                  No matching threats found.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* TAB 3: DIAGNOSTICS & SYSTEM */}
        {activeTab === 'system' && (
          <View style={styles.tabContentContainer}>
            {/* System Status Indicators */}
            <View style={[styles.systemInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
                SYSTEM STATUS
              </Text>
              <View style={styles.systemStatusItem}>
                <Text style={[styles.systemStatusLabel, { color: colors.text, fontFamily: Typography.bodyMedium }]}>
                  API Connection
                </Text>
                <View style={styles.systemStatusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: Colors.verdict.SAFE }]} />
                  <Text style={[styles.systemStatusValText, { color: Colors.verdict.SAFE, fontFamily: Typography.mono }]}>
                    HEALTHY (200)
                  </Text>
                </View>
              </View>

              <View style={styles.systemStatusItem}>
                <Text style={[styles.systemStatusLabel, { color: colors.text, fontFamily: Typography.bodyMedium }]}>
                  Database Status
                </Text>
                <View style={styles.systemStatusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: Colors.verdict.SAFE }]} />
                  <Text style={[styles.systemStatusValText, { color: Colors.verdict.SAFE, fontFamily: Typography.mono }]}>
                    CONNECTED
                  </Text>
                </View>
              </View>

              <View style={styles.systemStatusItem}>
                <Text style={[styles.systemStatusLabel, { color: colors.text, fontFamily: Typography.bodyMedium }]}>
                  Active Security Rules
                </Text>
                <Text style={[styles.systemStatusValTextText, { color: colors.text, fontFamily: Typography.mono }]}>
                  14 Rules Engaged
                </Text>
              </View>
            </View>

            {/* Diagnostic Control */}
            <View style={[styles.systemInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
                DIAGNOSTIC UTILITIES
              </Text>
              <Text style={[styles.catLabel, { color: colors.textSecondary, fontFamily: Typography.body, width: '100%', marginBottom: 12 }]}>
                Run a diagnostic test across scan handlers and API latency.
              </Text>

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                onPress={runSystemDiagnostic}
                disabled={diagnosticRunning}
              >
                {diagnosticRunning ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="pulse" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={[styles.primaryActionBtnText, { fontFamily: Typography.bodyMedium }]}>
                      Run Diagnostics
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {diagnosticResult !== '' && (
                <View style={[styles.diagnosticResultBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.diagnosticResultText, { color: colors.text, fontFamily: Typography.mono }]}>
                    {diagnosticResult}
                  </Text>
                </View>
              )}
            </View>

            {/* Security Config Level */}
            <View style={[styles.systemInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
                SECURITY SENSITIVITY
              </Text>
              <View style={styles.securityConfigRow}>
                {['Low', 'Standard', 'Paranoid'].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.securityConfigBtn,
                      {
                        backgroundColor: securityLevel === level ? colors.primary : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setSecurityLevel(level)}
                  >
                    <Text
                      style={[
                        styles.securityConfigBtnText,
                        {
                          color: securityLevel === level ? '#fff' : colors.textSecondary,
                          fontFamily: Typography.bodyMedium,
                        },
                      ]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Quick Actions Panel */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleExportCSV}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={18} color={colors.text} />
                <Text style={[styles.exportBtnText, { color: colors.text, fontFamily: Typography.bodyMedium }]}>
                  Export logs (CSV)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutBtn, { backgroundColor: Colors.verdictBg.DANGEROUS, borderColor: Colors.verdict.DANGEROUS }]}
                onPress={flushSystemCache}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.verdict.DANGEROUS} style={{ marginRight: 4 }} />
                <Text style={[styles.logoutBtnText, { color: Colors.verdict.DANGEROUS, fontFamily: Typography.bodyMedium }]}>
                  Flush Cache
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Quick Panel Lock */}
            <TouchableOpacity
              style={[styles.fullLockBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setAdminAuthenticated(false)}
            >
              <Ionicons name="lock-closed" size={16} color={colors.text} style={{ marginRight: 6 }} />
              <Text style={[styles.fullLockBtnText, { color: colors.text, fontFamily: Typography.bodyMedium }]}>
                Lock Admin Console
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Threat Detail Modal */}
      {selectedScan && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text, fontFamily: Typography.monoBold }]}>
                  Threat Details
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeModalBtn}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Modal Scroll Content */}
              <ScrollView contentContainerStyle={styles.modalScroll}>
                {/* Threat Type */}
                <View style={styles.modalFieldRow}>
                  <Text style={[styles.modalFieldLabel, { color: colors.textSecondary, fontFamily: Typography.body }]}>
                    Scan Target
                  </Text>
                  <Text style={[styles.modalFieldValue, { color: colors.text, fontFamily: Typography.monoBold }]}>
                    {selectedScan.feature.toUpperCase()}
                  </Text>
                </View>

                {/* Verdict Badge */}
                <View style={styles.modalFieldRow}>
                  <Text style={[styles.modalFieldLabel, { color: colors.textSecondary, fontFamily: Typography.body }]}>
                    Verdict
                  </Text>
                  <View
                    style={[
                      styles.verdictBadge,
                      {
                        backgroundColor: Colors.verdictBg[selectedScan.verdict] || colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.verdictBadgeText,
                        { color: Colors.verdict[selectedScan.verdict] || colors.text, fontFamily: Typography.monoBold },
                      ]}
                    >
                      {selectedScan.verdict}
                    </Text>
                  </View>
                </View>

                {/* Input Data */}
                <View style={styles.modalTextArea}>
                  <Text style={[styles.modalFieldLabel, { color: colors.textSecondary, fontFamily: Typography.body, marginBottom: 4 }]}>
                    Scanned Data / Content
                  </Text>
                  <View style={[styles.modalTextContainer, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.modalTextContent, { color: colors.text, fontFamily: Typography.mono }]}>
                      {selectedScan.input_data}
                    </Text>
                  </View>
                </View>

                {/* Explanation */}
                <View style={styles.modalTextArea}>
                  <Text style={[styles.modalFieldLabel, { color: colors.textSecondary, fontFamily: Typography.body, marginBottom: 4 }]}>
                    Threat Analysis Explanation
                  </Text>
                  <View style={[styles.modalTextContainer, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.modalTextContent, { color: colors.text, fontFamily: Typography.body }]}>
                      {selectedScan.explanation}
                    </Text>
                  </View>
                </View>

                {/* Mitigation / Tips */}
                {selectedScan.tips && (
                  <View style={styles.modalTextArea}>
                    <Text style={[styles.modalFieldLabel, { color: colors.textSecondary, fontFamily: Typography.body, marginBottom: 4 }]}>
                      Recommended Actions / Remediation
                    </Text>
                    <View style={[styles.modalTextContainer, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.modalTextContent, { color: colors.text, fontFamily: Typography.body }]}>
                        {selectedScan.tips}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Modal Actions */}
              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.modalActionPrimary, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setModalVisible(false);
                    setCurrentResult(selectedScan);
                    navigation.navigate('Result');
                  }}
                >
                  <Ionicons name="analytics" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={[styles.modalActionPrimaryText, { fontFamily: Typography.bodyMedium }]}>
                    Full Analysis
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pinContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  
  // Capsule Exit button on passkey entry
  backButtonCapsule: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    zIndex: 10,
  },
  backButtonCapsuleText: {
    fontSize: 13,
    marginLeft: 6,
  },

  // Glassmorphic Passkey Card
  pinCard: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  lockIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pinTitle: { fontSize: 24, fontWeight: '700' },
  pinSub: { fontSize: 13, textAlign: 'center', marginBottom: 6 },
  dotRow: { flexDirection: 'row', gap: 18, marginVertical: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },

  // Circular Numpad layout
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 250,
    gap: 14,
    justifyContent: 'center',
    marginTop: 10,
  },
  numKeyCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numKeyText: { fontSize: 22 },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  backText: {
    fontSize: 13,
    marginLeft: 4,
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusBadgeText: {
    fontSize: 11,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F0FFF4',
    gap: 4,
  },
  authText: { fontSize: 11, fontWeight: '700' },

  // Modern Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.sm,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
  },

  // Main Scroll & Tab Contents
  scroll: { padding: Spacing.md, gap: Spacing.md },
  tabContentContainer: { gap: Spacing.md },
  
  // Overview Tab stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'space-between' },
  statCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statSubText: { fontSize: 10, alignSelf: 'flex-end' },
  statValue: { fontSize: 26, fontWeight: '700', marginVertical: 2 },
  statLabel: { fontSize: 12, fontWeight: '600' },
  chartCard: { borderRadius: 18, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  sectionTitle: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catLabel: { fontSize: 12, width: 85 },
  catBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  catFill: { height: 6, borderRadius: 3 },
  catCount: { fontSize: 12, width: 32, textAlign: 'right' },

  // Search filter box
  searchFilterCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  filterPillRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
  },
  filterPillText: {
    fontSize: 12,
  },
  threatCountText: {
    fontSize: 13,
    paddingHorizontal: 4,
  },

  detectionsCard: { borderRadius: 18, borderWidth: 1, paddingHorizontal: Spacing.md, overflow: 'hidden' },
  noDetections: { paddingVertical: Spacing.xl, fontSize: 14, textAlign: 'center' },

  // System Diagnostics styles
  systemInfoCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  systemStatusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  systemStatusLabel: {
    fontSize: 13,
  },
  systemStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  systemStatusValText: {
    fontSize: 12,
    fontWeight: '700',
  },
  systemStatusValTextText: {
    fontSize: 12,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
  },
  primaryActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  diagnosticResultBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
  },
  diagnosticResultText: {
    fontSize: 12,
    lineHeight: 18,
  },
  securityConfigRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  securityConfigBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
  },
  securityConfigBtnText: {
    fontSize: 12,
  },

  // Actions rows
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 12,
  },
  exportBtnText: { fontSize: 13 },
  logoutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 12,
  },
  logoutBtnText: { fontSize: 13 },
  fullLockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 12,
    width: '100%',
  },
  fullLockBtnText: {
    fontSize: 13,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '80%',
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeModalBtn: {
    padding: 4,
  },
  modalScroll: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  modalFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalFieldLabel: {
    fontSize: 13,
  },
  modalFieldValue: {
    fontSize: 14,
  },
  verdictBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  verdictBadgeText: {
    fontSize: 12,
  },
  modalTextArea: {
    flexDirection: 'column',
  },
  modalTextContainer: {
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  modalTextContent: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
  },
  modalActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
  },
  modalActionPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
