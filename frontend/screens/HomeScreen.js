import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, Dimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useScanStore from '../store/useScanStore';
import { useAuth } from '../context/AuthContext';
import { Colors, Shadow } from '../constants/theme';
import RecentScanRow from '../components/RecentScanRow';
import TextureBackground from '../components/TextureBackground';

const { width: SW } = Dimensions.get('window');

// ─── Scan tool definitions ────────────────────────────────────────────────────
const SCAN_TOOLS = [
  { key: 'URL',        icon: 'link',                  label: 'URL Scan',    desc: 'Phishing & malware links', screen: 'URLScan',        color: '#2563EB', grad: ['#3B82F6', '#1D4ED8'] },
  { key: 'Screenshot', icon: 'image',                 label: 'Screenshot',  desc: 'OCR threat detection',     screen: 'ScreenshotScan', color: '#FFB020', grad: ['#FFB020', '#CC8800'] },
  { key: 'QR',         icon: 'qr-code',               label: 'QR Code',     desc: 'Verify QR destinations',   screen: 'QRScan',         color: '#00C48C', grad: ['#00C48C', '#008866'] },
  { key: 'OTP',        icon: 'chatbubble-ellipses',   label: 'OTP Scam',    desc: 'SMS phishing detection',   screen: 'OTPScan',        color: '#FF4D4F', grad: ['#FF4D4F', '#CC2222'] },
  { key: 'UPI',        icon: 'card',                  label: 'UPI Fraud',   desc: 'Payment handle analysis',  screen: 'UPIScan',        color: '#8B5CF6', grad: ['#8B5CF6', '#6D28D9'] },
  { key: 'Voice',      icon: 'mic',                   label: 'Voice Scan',  desc: 'Audio scam analysis',      screen: 'VoiceScan',      color: '#60A5FA', grad: ['#60A5FA', '#2563EB'] },
];

// ─── Pulsing status indicator ─────────────────────────────────────────────────
function PulsingDot({ color = '#00C48C' }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.7, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 10, height: 10, borderRadius: 5,
        backgroundColor: color, opacity: 0.3, transform: [{ scale: pulse }],
      }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color, isDark }) {
  const colors = isDark ? Colors.dark : Colors.light;
  return (
    <View style={[
      styles.statCard,
      {
        backgroundColor: isDark ? colors.card : '#fff',
        borderColor: color + '30',
        flex: 1,
      },
    ]}>
      <View style={[styles.statIconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Tool card ────────────────────────────────────────────────────────────────
function ToolCard({ tool, onPress, isDark, colors }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: Platform.OS !== 'web', speed: 50 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: Platform.OS !== 'web', speed: 50 }).start();

  return (
    <Animated.View style={[styles.toolCell, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={onPress} onPressIn={onIn} onPressOut={onOut}
        activeOpacity={1}
        style={[
          styles.toolCard,
          {
            backgroundColor: isDark ? colors.card : '#fff',
            borderColor: tool.color + '25',
          },
        ]}
      >
        {/* Glow accent top-left */}
        <View style={[styles.toolGlow, { backgroundColor: tool.color }]} />

        <LinearGradient
          colors={tool.grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.toolIcon}
        >
          <Ionicons name={tool.icon} size={20} color="#fff" />
        </LinearGradient>

        <Text style={[styles.toolLabel, { color: colors.text }]}>{tool.label}</Text>
        <Text style={[styles.toolDesc,  { color: colors.textMuted }]} numberOfLines={2}>
          {tool.desc}
        </Text>

        <View style={[styles.toolAction, { backgroundColor: tool.color + '15' }]}>
          <Ionicons name="arrow-forward" size={12} color={tool.color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const insets        = useSafeAreaInsets();
  const isDark        = useScanStore((s) => s.isDark);
  const history       = useScanStore((s) => s.history);
  const getTotalScans = useScanStore((s) => s.getTotalScans);
  const getThreats    = useScanStore((s) => s.getThreats);
  const getSafeRate   = useScanStore((s) => s.getSafeRate);
  const { profile }   = useAuth();

  const colors      = isDark ? Colors.dark : Colors.light;
  const recentScans = history.slice(0, 4);
  const threats     = getThreats();
  const firstName   = (profile?.full_name || 'Operator').split(' ')[0];

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : 'EVENING';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <TextureBackground isDark={isDark} />

      {/* ── Dashboard Header ──────────────────────────────────── */}
      <LinearGradient
        colors={['#1D4ED8', '#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        {/* Top row */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerGreeting}>
              GOOD {greeting}, OPERATOR
            </Text>
            <Text style={styles.headerName}>{firstName}</Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.avatarBtn} activeOpacity={0.8}>
            <View style={styles.avatarGrad}>
              <Text style={styles.avatarInitial}>
                {(profile?.full_name || 'O')[0].toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Status bar */}
        <View style={styles.statusBar}>
          <PulsingDot color="#4ADE80" />
          <Text style={styles.statusLabel}>
            PROTECTION ACTIVE — AI ENGINE ONLINE
          </Text>
          {threats > 0 && (
            <View style={styles.threatBadge}>
              <Ionicons name="warning" size={10} color="#FF4D4F" />
              <Text style={styles.threatBadgeText}>{threats} THREATS</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* ── Scroll body ───────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 100 }]}
      >

        {/* ── Stats row ───────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard icon="shield-checkmark-outline" value={getTotalScans()} label="TOTAL SCANS"  color={isDark ? '#00D4FF' : '#4361EE'} isDark={isDark} />
          <StatCard icon="warning-outline"          value={threats}         label="THREATS"       color="#FF4D4F" isDark={isDark} />
          <StatCard icon="checkmark-circle-outline" value={`${getSafeRate()}%`} label="SAFE RATE" color="#00C48C" isDark={isDark} />
        </View>

        {/* ── Quick scan CTA ──────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => navigation.navigate('URLScan')}
          activeOpacity={0.85}
          style={[styles.ctaBanner, {
            backgroundColor: isDark ? '#2563EB10' : '#EFF6FF',
            borderColor: isDark ? '#3B82F630' : '#BFDBFE',
          }]}
        >
          <View style={[styles.ctaIconWrap, { backgroundColor: isDark ? '#3B82F618' : '#DBEAFE' }]}>
            <Ionicons name="flash" size={20} color={isDark ? '#60A5FA' : '#2563EB'} />
          </View>
          <View style={styles.ctaText}>
            <Text style={[styles.ctaTitle, { color: colors.text }]}>Quick URL Scan</Text>
            <Text style={[styles.ctaSub, { color: colors.textSecondary }]}>Paste a link and analyze instantly</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={isDark ? '#60A5FA' : '#2563EB'} />
        </TouchableOpacity>

        {/* ── Security Tools ──────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionAccent, { backgroundColor: isDark ? '#00D4FF' : '#4361EE' }]} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>SECURITY TOOLS</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
              <Text style={[styles.sectionLink, { color: isDark ? '#00D4FF' : '#4361EE' }]}>LOGS →</Text>
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

        {/* ── Threat log (Recent scans) ────────────────────────── */}
        {recentScans.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionAccent, { backgroundColor: '#FF4D4F' }]} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>RECENT THREAT LOG</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
                <Text style={[styles.sectionLink, { color: isDark ? '#00D4FF' : '#4361EE' }]}>ALL →</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {recentScans.map((scan, idx) => (
                <RecentScanRow
                  key={scan.id} scan={scan} isDark={isDark}
                  showBorder={idx < recentScans.length - 1}
                  onPress={() => { useScanStore.getState().setCurrentResult(scan); navigation.navigate('Result'); }}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Empty state ──────────────────────────────────────── */}
        {recentScans.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#00D4FF0A' : '#EEF9FF' }]}>
              <Ionicons name="scan" size={30} color={isDark ? '#00D4FF' : '#4361EE'} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Scan Records</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Select a tool above to run your first threat analysis
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('URLScan')} activeOpacity={0.85} style={styles.emptyBtn}>
              <LinearGradient colors={['#00D4FF', '#0099BB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyBtnGrad}>
                <Ionicons name="flash" size={16} color="#070B14" />
                <Text style={styles.emptyBtnText}>INITIATE SCAN</Text>
              </LinearGradient>
            </TouchableOpacity>
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
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft:   { gap: 2 },
  headerGreeting: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: 'rgba(255,255,255,0.7)' },
  headerName:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.3, color: '#FFFFFF' },
  avatarBtn:    { borderRadius: 24 },
  avatarGrad:   {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },

  // Status bar (inside blue header — white text)
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  statusLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: '#FFFFFF', flex: 1 },
  threatBadge:   {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF4D4F15', borderWidth: 1, borderColor: '#FF4D4F35',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  threatBadgeText: { color: '#FF4D4F', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  // Body
  body: { paddingTop: 14, paddingHorizontal: 14, gap: 16 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard:  {
    borderRadius: 12, borderWidth: 1,
    padding: 12, alignItems: 'center', gap: 6,
  },
  statIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue:   { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  statLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },

  // CTA banner
  ctaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  ctaIconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ctaText:     { flex: 1, gap: 2 },
  ctaTitle:    { fontSize: 15, fontWeight: '700' },
  ctaSub:      { fontSize: 12 },

  // Section
  section:       { gap: 10 },
  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionAccent: { width: 3, height: 14, borderRadius: 2 },
  sectionTitle:  { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  sectionLink:   { fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  // Tool grid
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toolCell:  { width: '48.5%' },
  toolCard:  {
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 8,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  toolGlow:  {
    position: 'absolute', top: 0, left: 0,
    width: 60, height: 60, borderRadius: 30,
    opacity: 0.06, transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  toolIcon:  { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 14, fontWeight: '700' },
  toolDesc:  { fontSize: 11, lineHeight: 15 },
  toolAction:{ width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },

  // Log card
  logCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 4, ...Shadow.sm },

  // Empty
  emptyCard:     { borderRadius: 16, borderWidth: 1, padding: 36, alignItems: 'center', gap: 10 },
  emptyIcon:     { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:    { fontSize: 17, fontWeight: '700' },
  emptySub:      { fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 220 },
  emptyBtn:      { borderRadius: 10, overflow: 'hidden', marginTop: 6 },
  emptyBtnGrad:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13 },
  emptyBtnText:  { color: '#070B14', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
});
