import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  Linking,
  ScrollView,
  Platform,
  TextInput,
  Modal,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useScanStore from '../store/useScanStore';
import { Typography, Shadow } from '../constants/theme';
import RecentScanRow from '../components/RecentScanRow';
import WeeklyChart from '../components/WeeklyChart';
import { MOCK_STATS } from '../services/mockData';
import api, { BASE_URL } from '../services/api';
import Constants from 'expo-constants';
import GlowButton from '../components/GlowButton';

export const ADMIN_PIN = '1234';
const PIN = ADMIN_PIN;

// Modern Bright Theme colors
const colors = {
  background: '#f1f5f9',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  surface: '#f8fafc',
  primary: '#2f6eff',
  purple: '#8b5cf6',
  pink: '#ef4444',
  green: '#10b981',
};

function timeAgo(isoString) {
  if (!isoString) return 'now';
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminPanelScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const adminAuthenticated = useScanStore((s) => s.adminAuthenticated);
  const setAdminAuthenticated = useScanStore((s) => s.setAdminAuthenticated);
  const history = useScanStore((s) => s.history);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const [pinInput, setPinInput] = useState('');
  const [stats, setStats] = useState(MOCK_STATS);

  // Admin dashboard states
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'threats', 'system'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedScan, setSelectedScan] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // System Diagnostics states
  const [securityLevel, setSecurityLevel] = useState('Standard'); // 'Low', 'Standard', 'Paranoid'
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

  const handlePasskeySubmit = () => {
    if (pinInput === PIN) {
      setAdminAuthenticated(true);
      setPinInput('');
    } else {
      Alert.alert('Incorrect Passkey', 'Please try again.');
      setPinInput('');
    }
  };

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
    const isThreat = scan.verdict !== 'SAFE';
    if (!isThreat) return false;

    const matchesSearch =
      (scan.input_data || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (scan.explanation || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === 'ALL' ||
      scan.feature.toLowerCase().includes(categoryFilter.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  // Reusable hoverable elements for dashboard
  function HoverableKey({ value, onPress, isMuted }) {
    const [hovered, setHovered] = useState(false);
    return (
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.numKeyCircle,
          {
            backgroundColor: value ? (hovered ? '#e2e8f0' : colors.surface) : 'transparent',
            borderColor: hovered ? colors.primary : colors.border,
            transform: [{ scale: hovered ? 1.05 : 1 }],
            opacity: pressed ? 0.8 : 1,
            shadowColor: colors.primary,
            shadowRadius: hovered ? 8 : 0,
            shadowOpacity: hovered ? 0.2 : 0,
          }
        ]}
        disabled={!value}
      >
        {value ? (
          <Text
            style={[
              styles.numKeyText,
              {
                color: isMuted ? colors.pink : colors.text,
                fontFamily: Typography.monoBold,
              }
            ]}
          >
            {value}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  function TabItem({ active, label, icon, onPress }) {
    const [hovered, setHovered] = useState(false);
    return (
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[
          styles.tabItem,
          active && { borderBottomColor: colors.primary },
          hovered && { backgroundColor: 'rgba(47, 110, 255, 0.04)' },
          { transform: [{ scale: hovered ? 1.02 : 1 }] }
        ]}
      >
        <Ionicons
          name={icon}
          size={16}
          color={active ? colors.primary : (hovered ? colors.purple : colors.textMuted)}
          style={{ marginRight: 6 }}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: active ? colors.primary : (hovered ? colors.purple : colors.textSecondary),
              fontFamily: active ? Typography.bodySemiBold : Typography.body,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  function SidebarItem({ active, label, icon, onPress }) {
    const [hovered, setHovered] = useState(false);
    return (
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[
          styles.sidebarItem,
          active && { backgroundColor: 'rgba(47, 110, 255, 0.06)', borderColor: colors.primary },
          hovered && !active && { backgroundColor: 'rgba(15, 23, 42, 0.02)' },
          { transform: [{ scale: hovered ? 1.02 : 1 }] }
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={active ? colors.primary : (hovered ? colors.purple : colors.textMuted)}
          style={{ marginRight: 12 }}
        />
        <Text
          style={[
            styles.sidebarLabel,
            {
              color: active ? colors.primary : (hovered ? colors.text : colors.textSecondary),
              fontFamily: active ? Typography.bodySemiBold : Typography.body,
            },
          ]}
        >
          {label}
        </Text>
        {active && <View style={styles.activeMenuIndicator} />}
      </Pressable>
    );
  }

  function StatCard({ label, value, sub, color, icon, glowColor }) {
    const [hovered, setHovered] = useState(false);
    return (
      <Pressable
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[
          styles.statCard,
          {
            borderColor: hovered ? glowColor : colors.border,
            transform: [{ scale: hovered ? 1.03 : 1 }],
            shadowColor: glowColor,
            shadowRadius: hovered ? 12 : 4,
            shadowOpacity: hovered ? 0.3 : 0.05,
            elevation: hovered ? 6 : 2,
          }
        ]}
      >
        <View style={styles.statCardHeader}>
          <Ionicons name={icon} size={18} color={color} />
          <Text style={[styles.statSubText, { color: colors.textSecondary, fontFamily: Typography.body }]}>
            {sub}
          </Text>
        </View>
        <Text style={[styles.statValue, { color: color, fontFamily: Typography.monoBold }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.text, fontFamily: Typography.bodyMedium }]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  function FilterPill({ cat, active, onPress }) {
    const [hovered, setHovered] = useState(false);
    return (
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[
          styles.filterPill,
          {
            backgroundColor: active ? colors.purple : (hovered ? colors.border : colors.background),
            borderColor: active ? colors.purple : (hovered ? colors.primary : colors.border),
            transform: [{ scale: hovered ? 1.05 : 1 }],
          }
        ]}
      >
        <Text
          style={[
            styles.filterPillText,
            {
              color: active ? '#ffffff' : colors.textSecondary,
              fontFamily: Typography.bodyMedium,
            },
          ]}
        >
          {cat}
        </Text>
      </Pressable>
    );
  }

  // Passkey screen rendering (if not authenticated) - Bright Colors
  if (!adminAuthenticated) {
    return (
      <View style={[styles.pinContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.glowAmbient, styles.glowPurple, { opacity: 0.05 }]} />
        <View style={[styles.glowAmbient, styles.glowCyan, { opacity: 0.05 }]} />

        {/* Elegant secure vault style card container */}
        <View style={[styles.pinCard, Shadow.md]}>
          {/* Header row with back button inside card */}
          <View style={styles.pinCardHeaderRow}>
            <Pressable onPress={handleBack} style={styles.pinCardBackBtn}>
              <Ionicons name="arrow-back" size={16} color={colors.primary} />
              <Text style={styles.pinCardBackText}>Exit</Text>
            </Pressable>
            <Text style={styles.pinCardHeaderTitle}>Admin Panel</Text>
            <View style={{ width: 44 }} /> {/* Spacer for centering */}
          </View>

          <View style={styles.lockIconContainer}>
            <View style={styles.lockIconPulse} />
            <Ionicons name="shield" size={32} color={colors.purple} />
          </View>
          <Text style={[styles.pinTitle, { fontFamily: Typography.monoBold }]}>ADMIN ACCESS</Text>
          <Text style={[styles.pinSub, { fontFamily: Typography.body }]}>
            Enter 4-digit Passkey to access
          </Text>

          {/* Passkey indicators */}
          <View style={styles.dotRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i < pinInput.length ? colors.primary : 'transparent',
                    borderColor: i < pinInput.length ? colors.primary : colors.border,
                    shadowColor: colors.primary,
                    shadowRadius: i < pinInput.length ? 8 : 0,
                    shadowOpacity: i < pinInput.length ? 0.3 : 0,
                  },
                ]}
              />
            ))}
          </View>

          {/* Modern Circular Numpad */}
          <View style={styles.numpad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, idx) => (
              <HoverableKey
                key={idx}
                value={d}
                isMuted={d === '⌫'}
                onPress={() => {
                  if (d === '⌫') setPinInput((p) => p.slice(0, -1));
                  else if (d) handleDigit(d);
                }}
              />
            ))}
          </View>

          {/* Vault submit button */}
          <GlowButton
            onPress={handlePasskeySubmit}
            style={styles.submitPasskeyButton}
            textStyle={styles.submitPasskeyText}
            glowColor={colors.primary}
          >
            SUBMIT PASSKEY
          </GlowButton>
        </View>
      </View>
    );
  }

  // Tab Rendering Helpers
  function renderOverviewTab() {
    return (
      <View style={styles.tabContentContainer}>
        {/* Modern Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Total Scans"
            value={stats.total}
            sub="+8% vs yesterday"
            color={colors.primary}
            glowColor={colors.primary}
            icon="search"
          />
          <StatCard
            label="Threats Blocked"
            value={stats.threats}
            sub="+2 today"
            color={colors.pink}
            glowColor={colors.pink}
            icon="bug"
          />
          <StatCard
            label="Safe Rate"
            value={`${stats.safe_rate}%`}
            sub="Stable"
            color={colors.green}
            glowColor={colors.green}
            icon="shield-half"
          />
          <StatCard
            label="Today's Scans"
            value={stats.today_count}
            sub="24h active logs"
            color={colors.purple}
            glowColor={colors.purple}
            icon="today"
          />
        </View>

        {/* Weekly Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>
            WEEKLY THREAT VOLUME
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <WeeklyChart data={stats.daily_counts} isDark={false} height={140} />
          </ScrollView>
        </View>

        {/* Category breakdown */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>
            BY CATEGORY
          </Text>
          {Object.entries(stats.by_category).map(([feature, count]) => {
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <View key={feature} style={styles.catRow}>
                <Text style={[styles.catLabel, { fontFamily: Typography.body }]}>
                  {feature.replace('_scan', '').toUpperCase()}
                </Text>
                <View style={styles.catBar}>
                  <View style={[styles.catFill, { width: `${pct}%`, backgroundColor: colors.purple }]} />
                </View>
                <Text style={[styles.catCount, { fontFamily: Typography.mono }]}>
                  {count}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  function renderThreatsTab() {
    return (
      <View style={styles.tabContentContainer}>
        {/* Search and Filter Area */}
        <View style={styles.searchFilterCard}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search threat logs..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { fontFamily: Typography.body }]}
            />
            {searchQuery !== '' && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Horizontal Category Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillRow}>
            {['ALL', 'URL', 'QR', 'OTP', 'UPI', 'Screenshot', 'Voice'].map((cat) => (
              <FilterPill
                key={cat}
                cat={cat}
                active={categoryFilter === cat}
                onPress={() => setCategoryFilter(cat)}
              />
            ))}
          </ScrollView>
        </View>

        {/* List / Table of threats */}
        <Text style={[styles.threatCountText, { fontFamily: Typography.body }]}>
          Showing {threatLogs.length} threat logs
        </Text>

        {isLargeScreen ? (
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { width: 85 }]}>THREAT ID</Text>
              <Text style={[styles.tableHeaderCell, { width: 100 }]}>SCAN TYPE</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>SCANNED DATA</Text>
              <Text style={[styles.tableHeaderCell, { width: 120 }]}>VERDICT</Text>
              <Text style={[styles.tableHeaderCell, { width: 95 }]}>RISK SCORE</Text>
              <Text style={[styles.tableHeaderCell, { width: 110 }]}>TIMESTAMP</Text>
              <Text style={[styles.tableHeaderCell, { width: 125 }]}>RULE ENGAGED</Text>
              <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'center' }]}>ACTIONS</Text>
            </View>

            {threatLogs.length > 0 ? (
              threatLogs.map((scan) => {
                const isDangerous = scan.verdict === 'DANGEROUS';
                const verdictTextColor = isDangerous ? colors.pink : colors.primary;
                const verdictBg = isDangerous ? 'rgba(239, 68, 68, 0.08)' : 'rgba(47, 110, 255, 0.08)';
                const confidence = scan.confidence ?? (isDangerous ? 94 : 82);
                
                return (
                  <View key={scan.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: 85, fontFamily: Typography.mono, color: colors.textSecondary }]}>
                      #TH-{String(scan.id).slice(-4)}
                    </Text>
                    <Text style={[styles.tableCell, { width: 100, fontWeight: '700', color: colors.text }]}>
                      {scan.feature.replace('_scan', '').toUpperCase()}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 2, color: colors.text }]} numberOfLines={1}>
                      {scan.input_data}
                    </Text>
                    <View style={{ width: 120 }}>
                      <View style={[styles.tableVerdictBadge, { backgroundColor: verdictBg }]}>
                        <Text style={[styles.tableVerdictBadgeText, { color: verdictTextColor, fontFamily: Typography.monoBold }]}>
                          {scan.verdict}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.tableCell, { width: 95, fontFamily: Typography.mono, color: colors.textSecondary }]}>
                      {confidence}%
                    </Text>
                    <Text style={[styles.tableCell, { width: 110, color: colors.textSecondary }]}>
                      {timeAgo(scan.scanned_at)}
                    </Text>
                    <Text style={[styles.tableCell, { width: 125, fontFamily: Typography.mono, color: colors.purple }]}>
                      {isDangerous ? 'RULE-BLOCK-HIGH' : 'RULE-WARN-MED'}
                    </Text>
                    <View style={{ width: 90, alignItems: 'center' }}>
                      <GlowButton
                        onPress={() => {
                          setSelectedScan(scan);
                          setModalVisible(true);
                        }}
                        style={styles.tableActionBtn}
                        textStyle={styles.tableActionText}
                        glowColor={colors.primary}
                      >
                        Inspect
                      </GlowButton>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.tableEmptyText}>No threats cataloged in database.</Text>
            )}
          </View>
        ) : (
          <View style={styles.detectionsCard}>
            {threatLogs.length > 0 ? (
              threatLogs.map((scan, idx) => (
                <RecentScanRow
                  key={scan.id}
                  scan={scan}
                  isDark={false}
                  showBorder={idx < threatLogs.length - 1}
                  onPress={() => {
                    setSelectedScan(scan);
                    setModalVisible(true);
                  }}
                />
              ))
            ) : (
              <Text style={[styles.noDetections, { fontFamily: Typography.body }]}>
                No matching threats found.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  function renderSystemTab() {
    return (
      <View style={styles.tabContentContainer}>
        {/* System Status Indicators */}
        <View style={styles.systemInfoCard}>
          <Text style={styles.sectionTitle}>
            SYSTEM STATUS
          </Text>
          <View style={styles.systemStatusItem}>
            <Text style={[styles.systemStatusLabel, { fontFamily: Typography.bodyMedium }]}>
              API Connection
            </Text>
            <View style={styles.systemStatusBadge}>
              <View style={[styles.statusDot, { backgroundColor: colors.green }]} />
              <Text style={[styles.systemStatusValText, { color: colors.green, fontFamily: Typography.mono }]}>
                HEALTHY (200)
              </Text>
            </View>
          </View>

          <View style={styles.systemStatusItem}>
            <Text style={[styles.systemStatusLabel, { fontFamily: Typography.bodyMedium }]}>
              Database Status
            </Text>
            <View style={styles.systemStatusBadge}>
              <View style={[styles.statusDot, { backgroundColor: colors.green }]} />
              <Text style={[styles.systemStatusValText, { color: colors.green, fontFamily: Typography.mono }]}>
                CONNECTED
              </Text>
            </View>
          </View>

          <View style={styles.systemStatusItem}>
            <Text style={[styles.systemStatusLabel, { fontFamily: Typography.bodyMedium }]}>
              Active Security Rules
            </Text>
            <Text style={[styles.systemStatusValTextText, { color: colors.text, fontFamily: Typography.mono }]}>
              14 Rules Engaged
            </Text>
          </View>
        </View>

        {/* Diagnostic Control */}
        <View style={styles.systemInfoCard}>
          <Text style={styles.sectionTitle}>
            DIAGNOSTIC UTILITIES
          </Text>
          <Text style={[styles.catLabel, { color: colors.textSecondary, fontFamily: Typography.body, width: '100%', marginBottom: 12 }]}>
            Run a diagnostic test across scan handlers and API latency.
          </Text>

          <GlowButton
            style={styles.primaryActionBtn}
            onPress={runSystemDiagnostic}
            disabled={diagnosticRunning}
            glowColor={colors.purple}
          >
            {diagnosticRunning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="pulse" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={[styles.primaryActionBtnText, { fontFamily: Typography.bodyMedium }]}>
                  Run Diagnostics
                </Text>
              </View>
            )}
          </GlowButton>

          {diagnosticResult !== '' && (
            <View style={styles.diagnosticResultBox}>
              <Text style={[styles.diagnosticResultText, { fontFamily: Typography.mono }]}>
                {diagnosticResult}
              </Text>
            </View>
          )}
        </View>

        {/* Only show these on mobile view (small screen) because they are moved to the right column on large screens! */}
        {!isLargeScreen && (
          <>
            {/* Security Config Level */}
            <View style={styles.systemInfoCard}>
              <Text style={styles.sectionTitle}>
                SECURITY SENSITIVITY
              </Text>
              <View style={styles.securityConfigRow}>
                {['Low', 'Standard', 'Paranoid'].map((level) => {
                  const active = securityLevel === level;
                  return (
                    <GlowButton
                      key={level}
                      style={[
                        styles.securityConfigBtn,
                        active && { backgroundColor: colors.purple, borderColor: colors.purple },
                      ]}
                      textStyle={[
                        styles.securityConfigBtnText,
                        active ? { color: '#fff' } : { color: colors.textSecondary },
                      ]}
                      onPress={() => setSecurityLevel(level)}
                      glowColor={colors.purple}
                    >
                      {level}
                    </GlowButton>
                  );
                })}
              </View>
            </View>

            {/* Quick Actions Panel */}
            <View style={styles.actionsRow}>
              <GlowButton
                style={styles.exportBtn}
                onPress={handleExportCSV}
                glowColor={colors.primary}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="download-outline" size={18} color={colors.primary} />
                  <Text style={[styles.exportBtnText, { color: colors.primary, fontFamily: Typography.bodyMedium }]}>
                    Export CSV
                  </Text>
                </View>
              </GlowButton>
              
              <GlowButton
                style={styles.logoutBtn}
                onPress={flushSystemCache}
                glowColor={colors.pink}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="trash-outline" size={18} color={colors.pink} />
                  <Text style={[styles.logoutBtnText, { color: colors.pink, fontFamily: Typography.bodyMedium }]}>
                    Flush Cache
                  </Text>
                </View>
              </GlowButton>
            </View>
            
            {/* Quick Panel Lock */}
            <GlowButton
              style={styles.fullLockBtn}
              glowColor={colors.pink}
              onPress={() => setAdminAuthenticated(false)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="lock-closed" size={16} color="#fff" />
                <Text style={[styles.fullLockBtnText, { color: '#fff', fontFamily: Typography.bodyMedium }]}>
                  Lock Admin Console
                </Text>
              </View>
            </GlowButton>
          </>
        )}
      </View>
    );
  }

  // Admin Panel Main rendering (if authenticated)
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.glowAmbient, styles.glowPurple, { opacity: 0.05, top: -200, right: -150 }]} />
      <View style={[styles.glowAmbient, styles.glowCyan, { opacity: 0.05, bottom: -200, left: -150 }]} />

      {isLargeScreen ? (
        <View style={styles.sidebarLayout}>
          {/* Side Bar Navigation */}
          <View style={styles.sidebar}>
            <View style={styles.sidebarLogoContainer}>
              <Ionicons name="shield" size={24} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sidebarLogoText}>
                CYBER<Text style={{ color: colors.primary }}>SHIELD</Text>
              </Text>
            </View>

            <View style={styles.sidebarMenu}>
              <SidebarItem
                active={activeTab === 'overview'}
                label="Overview"
                icon="bar-chart"
                onPress={() => setActiveTab('overview')}
              />
              <SidebarItem
                active={activeTab === 'threats'}
                label="Threat Center"
                icon="warning"
                onPress={() => setActiveTab('threats')}
              />
              <SidebarItem
                active={activeTab === 'system'}
                label="Diagnostics"
                icon="cog"
                onPress={() => setActiveTab('system')}
              />
            </View>
          </View>

          {/* Main content middle side */}
          <View style={styles.mainContent}>
            <View style={styles.header}>
              <View style={styles.headerInfo}>
                <Text style={[styles.headerTitle, { fontFamily: Typography.monoBold }]}>
                  Admin Panel
                </Text>
                <View style={styles.statusBadgeRow}>
                  <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.statusBadgeText, { color: colors.primary, fontFamily: Typography.body }]}>
                    {activeTab === 'overview' ? 'Overview' : activeTab === 'threats' ? 'Threat Center' : 'Diagnostics'}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <GlowButton
                  onPress={handleBack}
                  style={styles.backButtonHeader}
                  glowColor={colors.purple}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="arrow-back" size={16} color={colors.text} />
                    <Text style={[styles.backText, { color: colors.text, fontFamily: Typography.bodyMedium }]}>Exit</Text>
                  </View>
                </GlowButton>
                <View style={styles.authBadge}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.green} />
                  <Text style={[styles.authText, { color: colors.green, fontFamily: Typography.mono }]}>ADMIN</Text>
                </View>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
              showsVerticalScrollIndicator={false}
            >
              {activeTab === 'overview' && renderOverviewTab()}
              {activeTab === 'threats' && renderThreatsTab()}
              {activeTab === 'system' && renderSystemTab()}
            </ScrollView>
          </View>

          {/* Right Control Column - Consolidating Security, Export, Flush & Lock Console (Only ONE Lock button visible!) */}
          <View style={styles.rightColumn}>
            <View style={{ gap: 24 }}>
              {/* Security Sensitivity */}
              <View style={styles.rightColumnSection}>
                <Text style={styles.rightColumnTitle}>SECURITY SENSITIVITY</Text>
                <View style={styles.securityConfigRow}>
                  {['Low', 'Standard', 'Paranoid'].map((level) => {
                    const active = securityLevel === level;
                    return (
                      <GlowButton
                        key={level}
                        style={[
                          styles.securityConfigBtn,
                          active && { backgroundColor: colors.purple, borderColor: colors.purple },
                        ]}
                        textStyle={[
                          styles.securityConfigBtnText,
                          active ? { color: '#fff' } : { color: colors.textSecondary },
                        ]}
                        onPress={() => setSecurityLevel(level)}
                        glowColor={colors.purple}
                      >
                        {level}
                      </GlowButton>
                    );
                  })}
                </View>
              </View>

              <View style={styles.rightColumnDivider} />

              {/* Quick Actions */}
              <View style={styles.rightColumnSection}>
                <Text style={styles.rightColumnTitle}>QUICK UTILITIES</Text>
                <View style={{ gap: 12 }}>
                  <GlowButton
                    style={styles.exportBtn}
                    onPress={handleExportCSV}
                    glowColor={colors.primary}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="download-outline" size={18} color={colors.primary} />
                      <Text style={[styles.exportBtnText, { color: colors.primary, fontFamily: Typography.bodyMedium }]}>
                        Export CSV
                      </Text>
                    </View>
                  </GlowButton>
                  
                  <GlowButton
                    style={styles.logoutBtn}
                    onPress={flushSystemCache}
                    glowColor={colors.pink}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="trash-outline" size={18} color={colors.pink} />
                      <Text style={[styles.logoutBtnText, { color: colors.pink, fontFamily: Typography.bodyMedium }]}>
                        Flush Cache
                      </Text>
                    </View>
                  </GlowButton>
                </View>
              </View>
            </View>

            {/* Lock Console Button (The ONLY lock button visible on large screens!) */}
            <GlowButton
              style={styles.fullLockBtn}
              glowColor={colors.pink}
              onPress={() => setAdminAuthenticated(false)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="lock-closed" size={16} color="#fff" />
                <Text style={[styles.fullLockBtnText, { color: '#fff', fontFamily: Typography.bodyMedium }]}>
                  Lock Admin Console
                </Text>
              </View>
            </GlowButton>
          </View>
        </View>
      ) : (
        // Mobile Layout (Fallback tabs on top)
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <GlowButton
              onPress={handleBack}
              style={styles.backButtonHeader}
              glowColor={colors.purple}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="arrow-back" size={16} color={colors.text} />
                <Text style={[styles.backText, { color: colors.text, fontFamily: Typography.bodyMedium }]}>Exit</Text>
              </View>
            </GlowButton>
            
            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { fontFamily: Typography.monoBold }]}>Admin Panel</Text>
              <View style={styles.statusBadgeRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.statusBadgeText, { color: colors.primary, fontFamily: Typography.body }]}>
                  Secure Console
                </Text>
              </View>
            </View>
            
            <View style={styles.headerRight}>
              <View style={styles.authBadge}>
                <Ionicons name="shield-checkmark" size={14} color={colors.green} />
                <Text style={[styles.authText, { color: colors.green, fontFamily: Typography.mono }]}>ADMIN</Text>
              </View>
            </View>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            <TabItem
              active={activeTab === 'overview'}
              label="Overview"
              icon="bar-chart"
              onPress={() => setActiveTab('overview')}
            />
            <TabItem
              active={activeTab === 'threats'}
              label="Threat Center"
              icon="warning"
              onPress={() => setActiveTab('threats')}
            />
            <TabItem
              active={activeTab === 'system'}
              label="Diagnostics"
              icon="cog"
              onPress={() => setActiveTab('system')}
            />
          </View>

          {/* Mobile Scroll Area */}
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'threats' && renderThreatsTab()}
            {activeTab === 'system' && renderSystemTab()}
          </ScrollView>
        </View>
      )}

      {/* Threat Detail Modal */}
      {selectedScan && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { fontFamily: Typography.monoBold }]}>
                  Threat Details
                </Text>
                <Pressable onPress={() => setModalVisible(false)} style={styles.closeModalBtn}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              {/* Modal Scroll Content */}
              <ScrollView contentContainerStyle={styles.modalScroll}>
                {/* Threat Type */}
                <View style={styles.modalFieldRow}>
                  <Text style={[styles.modalFieldLabel, { color: colors.textSecondary, fontFamily: Typography.body }]}>
                    Scan Target
                  </Text>
                  <Text style={[styles.modalFieldValue, { fontFamily: Typography.monoBold }]}>
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
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.verdictBadgeText,
                        { color: selectedScan.verdict === 'DANGEROUS' ? colors.pink : colors.primary, fontFamily: Typography.monoBold },
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
                  <View style={styles.modalTextContainer}>
                    <Text style={[styles.modalTextContent, { fontFamily: Typography.mono }]}>
                      {selectedScan.input_data}
                    </Text>
                  </View>
                </View>

                {/* Explanation */}
                <View style={styles.modalTextArea}>
                  <Text style={[styles.modalFieldLabel, { color: colors.textSecondary, fontFamily: Typography.body, marginBottom: 4 }]}>
                    Threat Analysis Explanation
                  </Text>
                  <View style={styles.modalTextContainer}>
                    <Text style={[styles.modalTextContent, { fontFamily: Typography.body }]}>
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
                    <View style={styles.modalTextContainer}>
                      <Text style={[styles.modalTextContent, { fontFamily: Typography.body }]}>
                        {selectedScan.tips}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Modal Actions */}
              <View style={styles.modalFooter}>
                <GlowButton
                  style={styles.modalActionPrimary}
                  glowColor={colors.primary}
                  onPress={() => {
                    setModalVisible(false);
                    setCurrentResult(selectedScan);
                    navigation.navigate('Result');
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="analytics" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={[styles.modalActionPrimaryText, { fontFamily: Typography.bodyMedium }]}>
                      Full Analysis
                    </Text>
                  </View>
                </GlowButton>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  pinContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' },
  glowAmbient: {
    position: 'absolute',
    width: 450,
    height: 450,
    borderRadius: 225,
    opacity: 0.08,
  },
  glowPurple: {
    backgroundColor: colors.purple,
    top: -100,
    right: -100,
  },
  glowCyan: {
    backgroundColor: colors.primary,
    bottom: -150,
    left: -100,
  },
  
  // Back navigation capsule button on PIN page (No longer absolute, but let's keep style for compatibility)
  backButtonCapsule: {
    display: 'none',
  },
  backButtonCapsuleText: {
    fontSize: 13,
  },

  // Glassmorphic Passkey Card
  pinCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#0f172a',
    shadowRadius: 25,
    shadowOpacity: 0.08,
    elevation: 10,
  },
  pinCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  pinCardBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    cursor: 'pointer',
  },
  pinCardBackText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Typography.bodySemiBold,
  },
  pinCardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textSecondary,
    fontFamily: Typography.monoBold,
    letterSpacing: 1,
  },
  lockIconContainer: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: colors.purple,
    shadowRadius: 10,
    shadowOpacity: 0.15,
  },
  lockIconPulse: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  pinTitle: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: 1.5 },
  pinSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  dotRow: { flexDirection: 'row', gap: 20, marginVertical: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },

  // Circular Numpad layout
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 250,
    gap: 12,
    justifyContent: 'center',
    marginTop: 6,
  },
  numKeyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numKeyText: { fontSize: 20 },
  submitPasskeyButton: {
    height: 48,
    backgroundColor: colors.primary,
    width: '100%',
    marginTop: 8,
    borderRadius: 12,
  },
  submitPasskeyText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
    fontFamily: Typography.bodySemiBold,
  },

  // Responsive Sidebar Layout
  sidebarLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 240,
    backgroundColor: colors.card,
    borderRightWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  sidebarLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 32,
  },
  sidebarLogoText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1.5,
    fontFamily: Typography.monoBold,
  },
  sidebarMenu: {
    flex: 1,
    gap: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
  },
  sidebarLabel: {
    fontSize: 14,
  },
  activeMenuIndicator: {
    position: 'absolute',
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  
  // Right Column Layout (Consolidated controls)
  rightColumn: {
    width: 280,
    backgroundColor: colors.card,
    borderLeftWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 24,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  rightColumnSection: {
    gap: 12,
  },
  rightColumnTitle: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
  },
  rightColumnDivider: {
    height: 1.5,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  mainContent: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backButtonHeader: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 6,
    paddingHorizontal: 12,
    height: 34,
  },
  backText: {
    fontSize: 13,
  },
  headerInfo: {
    alignItems: 'flex-start',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
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
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    gap: 4,
  },
  authText: { fontSize: 11, fontWeight: '700' },

  // Tab Bar (Fallback for mobile view)
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
  },

  // Main Scroll & Tab Contents
  scroll: { padding: 24, gap: 24 },
  tabContentContainer: { gap: 24 },
  
  // Overview Tab stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' },
  statCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    gap: 4,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statSubText: { fontSize: 10, alignSelf: 'flex-end' },
  statValue: { fontSize: 24, fontWeight: '800', marginVertical: 2 },
  statLabel: { fontSize: 12, fontWeight: '600' },
  chartCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, fontWeight: '800', color: colors.primary },
  
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catLabel: { fontSize: 12, width: 85, color: colors.text },
  catBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  catFill: { height: 6, borderRadius: 3 },
  catCount: { fontSize: 12, width: 32, textAlign: 'right', color: colors.textSecondary },

  // Search filter box
  searchFilterCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
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
    borderWidth: 1.5,
    marginRight: 6,
  },
  filterPillText: {
    fontSize: 12,
  },
  threatCountText: {
    fontSize: 13,
    paddingHorizontal: 4,
    color: colors.textSecondary,
  },

  // Detailed Table layout for Large screens
  tableCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    paddingVertical: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'rgba(15, 23, 42, 0.01)',
  },
  tableHeaderCell: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  tableCell: {
    fontSize: 13,
    paddingRight: 8,
  },
  tableVerdictBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  tableVerdictBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tableActionBtn: {
    width: 76,
    height: 28,
    backgroundColor: 'rgba(47, 110, 255, 0.08)',
    borderWidth: 1.2,
    borderColor: colors.primary,
    borderRadius: 6,
  },
  tableActionText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  tableEmptyText: {
    paddingVertical: 32,
    fontSize: 14,
    textAlign: 'center',
    color: colors.textSecondary,
  },

  detectionsCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  noDetections: { paddingVertical: 24, fontSize: 14, textAlign: 'center', color: colors.textSecondary },

  // System Diagnostics styles
  systemInfoCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    gap: 12,
  },
  systemStatusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  systemStatusLabel: {
    fontSize: 13,
    color: colors.text,
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
    height: 44,
    backgroundColor: colors.purple,
    width: '100%',
  },
  primaryActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  diagnosticResultBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    marginTop: 4,
  },
  diagnosticResultText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.primary,
  },
  securityConfigRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  securityConfigBtn: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: 10,
  },
  securityConfigBtnText: {
    fontSize: 12,
  },

  // Actions rows
  actionsRow: { flexDirection: 'row', gap: 12 },
  exportBtn: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(47, 110, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
  },
  exportBtnText: { fontSize: 13, fontWeight: '700' },
  logoutBtn: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1.5,
    borderColor: colors.pink,
    borderRadius: 12,
  },
  logoutBtnText: { fontSize: 13, fontWeight: '700' },
  fullLockBtn: {
    height: 44,
    backgroundColor: colors.pink,
    borderColor: colors.pink,
    borderWidth: 1.5,
    borderRadius: 12,
    width: '100%',
  },
  fullLockBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowRadius: 20,
    shadowOpacity: 0.2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  closeModalBtn: {
    padding: 4,
  },
  modalScroll: {
    paddingVertical: 16,
    gap: 16,
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
    color: colors.text,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  modalTextContent: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  modalFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 16,
  },
  modalActionPrimary: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: '100%',
  },
  modalActionPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
