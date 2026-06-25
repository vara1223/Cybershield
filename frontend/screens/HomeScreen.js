import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { useAuth } from '../context/AuthContext';
import { Colors, Spacing, Radius, Shadow } from '../constants/theme';
import RecentScanRow from '../components/RecentScanRow';
import TextureBackground from '../components/TextureBackground';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Tool definitions ────────────────────────────────────────────────────────
const SCAN_TOOLS = [
  { key: 'URL',        icon: 'link-outline',         label: 'URL Scan',    desc: 'Detect malicious links',   screen: 'URLScan',        color: '#4361EE' },
  { key: 'Screenshot', icon: 'image-outline',        label: 'Screenshot',  desc: 'Scan image for threats',   screen: 'ScreenshotScan', color: '#0EA5E9' },
  { key: 'QR',         icon: 'qr-code-outline',      label: 'QR Code',     desc: 'Verify QR destinations',   screen: 'QRScan',         color: '#10B981' },
  { key: 'OTP',        icon: 'chatbubble-outline',   label: 'OTP Scam',    desc: 'Detect OTP phishing',      screen: 'OTPScan',        color: '#F59E0B' },
  { key: 'UPI',        icon: 'card-outline',         label: 'UPI Fraud',   desc: 'Validate UPI handles',     screen: 'UPIScan',        color: '#8B5CF6' },
  { key: 'Voice',      icon: 'mic-outline',          label: 'Voice Scan',  desc: 'Analyse audio for scam',   screen: 'VoiceScan',      color: '#EF4444' },
];

// ─── Pressable tool card ─────────────────────────────────────────────────────
function ToolCard({ tool, onPress, isDark, colors }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start();

  const iconBg   = tool.color + (isDark ? '28' : '18');
  const cardBg   = isDark ? colors.card : '#FFFFFF';
  const cardTint = tool.color + (isDark ? '10' : '08');  // very subtle color wash
  const borderC  = tool.color + (isDark ? '35' : '25');  // soft colored border

  return (
    <Animated.View style={[{ transform: [{ scale }] }, styles.toolCell]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        activeOpacity={1}
        style={[styles.toolCard, { backgroundColor: isDark ? cardBg : cardTint, borderColor: borderC }]}
      >
        <View style={[styles.toolIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={tool.icon} size={20} color={tool.color} />
        </View>
        <Text style={[styles.toolLabel, { color: colors.text }]} numberOfLines={1}>
          {tool.label}
        </Text>
        <Text style={[styles.toolDesc, { color: colors.textSecondary }]} numberOfLines={2}>
          {tool.desc}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const insets         = useSafeAreaInsets();
  const isDark         = useScanStore((s) => s.isDark);
  const history        = useScanStore((s) => s.history);
  const getTotalScans  = useScanStore((s) => s.getTotalScans);
  const getThreats     = useScanStore((s) => s.getThreats);
  const getSafeRate    = useScanStore((s) => s.getSafeRate);
  const { profile } = useAuth();

  const colors      = isDark ? Colors.dark : Colors.light;
  const recentScans = history.slice(0, 4);

  const now     = new Date();
  const hour    = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // ─── Stat rows ──────────────────────────────────────────────────────────────
  const STATS = [
    { label: 'Total Scans',  value: getTotalScans(), icon: 'shield-checkmark-outline', color: '#4361EE' },
    { label: 'Threats Found', value: getThreats(),    icon: 'warning-outline',          color: '#EF4444' },
    { label: 'Safe Rate',    value: `${getSafeRate()}%`, icon: 'checkmark-circle-outline', color: '#10B981' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <TextureBackground isDark={isDark} />

      {/* ── Header ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={isDark ? ['#1E1B4B', '#2E2A72'] : ['#4361EE', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
            borderBottomWidth: 0,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            shadowColor: '#4361EE',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDark ? 0.4 : 0.2,
            shadowRadius: 10,
            elevation: 8,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: 'rgba(255, 255, 255, 0.75)', fontWeight: '600' }]}>
            {greeting},
          </Text>
          <Text style={[styles.userName, { color: '#FFFFFF', fontWeight: '800' }]}>
            {profile?.full_name || 'User'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={styles.avatarHeaderBtn}
          activeOpacity={0.8}
        >
          <View style={[styles.avatarHeaderFallback, { backgroundColor: 'rgba(255, 255, 255, 0.25)', borderWidth: 1.5, borderColor: '#FFFFFF' }]}>
            <Text style={[styles.avatarHeaderInitial, { color: '#FFFFFF' }]}>
              {(profile?.full_name || 'U')[0].toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Scroll body ────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 96 }]}
      >

        {/* ── Protection status banner ──────────────────────────── */}
        <View style={[styles.banner, {
          backgroundColor: isDark ? '#0C1A3A' : '#EEF2FF',
          borderColor: isDark ? '#1E2E5C' : '#C7D2FE',
        }]}>
          <View style={styles.bannerLeft}>
            <View style={styles.shieldWrap}>
              <Ionicons name="shield-checkmark" size={26} color="#4361EE" />
              <View style={styles.activeDot} />
            </View>
            <View style={styles.bannerText}>
              <Text style={[styles.bannerTitle, { color: colors.text }]}>
                Protection Active
              </Text>
              <Text style={[styles.bannerSub, { color: colors.textSecondary }]}>
                AI scanning engine is running
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('URLScan')}
            style={styles.scanBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.scanBtnText}>Scan</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats ─────────────────────────────────────────────── */}
        <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {STATS.map((s, i) => (
            <React.Fragment key={s.label}>
              <View style={styles.statItem}>
                <View style={[styles.statIconBox, { backgroundColor: s.color + '18' }]}>
                  <Ionicons name={s.icon} size={16} color={s.color} />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
              </View>
              {i < STATS.length - 1 && (
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* ── Scan tools ────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Scan Tools</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('History')}
              activeOpacity={0.7}
            >
              <Text style={[styles.sectionLink, { color: colors.primary }]}>History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toolsGrid}>
            {SCAN_TOOLS.map((tool) => (
              <ToolCard
                key={tool.key}
                tool={tool}
                isDark={isDark}
                colors={colors}
                onPress={() => navigation.navigate(tool.screen)}
              />
            ))}
          </View>
        </View>

        {/* ── Recent scans ──────────────────────────────────────── */}
        {recentScans.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
              <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
                <Text style={[styles.sectionLink, { color: colors.primary }]}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.recentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {recentScans.map((scan, idx) => (
                <RecentScanRow
                  key={scan.id}
                  scan={scan}
                  isDark={isDark}
                  showBorder={idx < recentScans.length - 1}
                  onPress={() => {
                    useScanStore.getState().setCurrentResult(scan);
                    navigation.navigate('Result');
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Empty state ───────────────────────────────────────── */}
        {recentScans.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="scan-outline" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No scans yet</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Pick a tool above to run your first security check.
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flex: 1, gap: 2 },
  greeting:   { fontSize: 13, fontWeight: '400' },
  userName:   { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  // Avatar in header
  avatarHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarHeaderFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHeaderInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },


  // Body
  body: { padding: 16, gap: 16 },

  // Protection banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  bannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  shieldWrap:  { position: 'relative' },
  activeDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  bannerText:  { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 14, fontWeight: '700' },
  bannerSub:   { fontSize: 12 },
  scanBtn: {
    backgroundColor: '#4361EE',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  scanBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Stats card
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    ...Shadow.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 44, marginHorizontal: 2 },

  // Section
  section:     { gap: 10 },
  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionLink:  { fontSize: 13, fontWeight: '600' },

  // Tool grid — 2 columns
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toolCell: { width: '48.5%' },
  toolCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    ...Shadow.sm,
  },
  toolIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: { fontSize: 14, fontWeight: '700' },
  toolDesc:  { fontSize: 11, lineHeight: 16 },


  // Recent scans
  recentCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 4,
    ...Shadow.sm,
  },

  // Empty state
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
