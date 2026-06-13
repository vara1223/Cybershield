import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { useAuth } from '../context/AuthContext';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import StatCard from '../components/StatCard';
import ScanToolCard from '../components/ScanToolCard';
import RecentScanRow from '../components/RecentScanRow';
import TextureBackground from '../components/TextureBackground';

const SCAN_TOOLS = [
  { key: 'URL',        icon: 'link',                label: 'URL scan',   color: '#4361EE', screen: 'URLScan' },
  { key: 'Screenshot', icon: 'image-outline',       label: 'Screenshot', color: '#F59E0B', screen: 'ScreenshotScan' },
  { key: 'QR',         icon: 'qr-code-outline',     label: 'QR code',    color: '#22C55E', screen: 'QRScan' },
  { key: 'OTP',        icon: 'chatbubble-outline',  label: 'OTP scam',   color: '#EF4444', screen: 'OTPScan' },
  { key: 'UPI',        icon: 'card-outline',        label: 'UPI fraud',  color: '#8B5CF6', screen: 'UPIScan' },
  { key: 'Voice',      icon: 'mic-outline',         label: 'Voice scan', color: '#06B6D4', screen: 'VoiceScan' },
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const isDark = useScanStore((s) => s.isDark);
  const toggleTheme = useScanStore((s) => s.toggleTheme);
  const history = useScanStore((s) => s.history);
  const getTotalScans = useScanStore((s) => s.getTotalScans);
  const getThreats = useScanStore((s) => s.getThreats);
  const getSafeRate = useScanStore((s) => s.getSafeRate);
  const { user, profile, signOut, authLoading } = useAuth();

  const colors = isDark ? Colors.dark : Colors.light;
  const recentScans = history.slice(0, 5);
  const createdAt = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : null;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <TextureBackground isDark={isDark} />

<View style={[styles.header, { paddingTop: insets.top + 18, borderBottomColor: colors.border, backgroundColor: colors.card }]}> 
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: Typography.mono }]}>{greeting}</Text>
          <Text style={[styles.title, { color: colors.text, fontFamily: Typography.monoBold }]}>Welcome, {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: Typography.body }]}>Stay ahead of threats with fast, intelligent scans.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleTheme} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.75}>
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.75}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.75} disabled={authLoading}>
            <Ionicons name="log-out-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text, fontFamily: Typography.bodyMedium }]}>Hello, {profile?.full_name || user?.email || 'User'}</Text>
          <Text style={[styles.profileSubtitle, { color: colors.textSecondary, fontFamily: Typography.body }]}>Tap to view account settings.</Text>
        </View>
        <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => navigation.navigate('Settings')} activeOpacity={0.75}>
          <Ionicons name="chevron-forward-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 90 }]}> 
        <View style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.quickCardText}>
            <Text style={[styles.quickTitle, { color: colors.text, fontFamily: Typography.bodyMedium }]}>Quick scan</Text>
            <Text style={[styles.quickSubtitle, { color: colors.textSecondary, fontFamily: Typography.body }]}>Scan a URL, message, or screenshot in seconds.</Text>
          </View>
          <TouchableOpacity style={[styles.quickButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => navigation.navigate('URLScan')} activeOpacity={0.85}>
            <Text style={[styles.quickButtonText, { color: colors.primary }]}>{'Scan now'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.statsPanel, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <StatCard value={getTotalScans()} label="Total scans" colorKey="blue" isDark={isDark} />
          <StatCard value={getThreats()} label="Threats found" colorKey="red" isDark={isDark} />
          <StatCard value={`${getSafeRate()}%`} label="Safe rate" colorKey="green" isDark={isDark} />
        </View>

<View style={styles.sectionHeader}> 
          <View>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Typography.mono }]}>SCAN TOOLS</Text>
            <Text style={[styles.sectionLabel, { color: colors.text, fontFamily: Typography.bodyMedium }]}>Tap any tool to start scanning</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('History')}>
            <Text style={[styles.sectionAction, { color: colors.primary, fontFamily: Typography.body }]}>History</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.toolsGrid}> 
          {SCAN_TOOLS.map((tool) => (
            <View key={tool.key} style={styles.toolCell}>
              <ScanToolCard icon={tool.icon} label={tool.label} accentColor={tool.color} isDark={isDark} onPress={() => navigation.navigate(tool.screen)} />
            </View>
          ))}
        </View>

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
                RECENT SCANS
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('History')}>
                <Text style={[styles.sectionAction, { color: colors.primary, fontFamily: Typography.body }]}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.recentCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flex: 1, gap: 8 },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  greeting: { fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase' },
  title: { fontSize: 30, fontWeight: '800', marginTop: 2 },
  subtitle: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 16 },
  profileSubtitle: { fontSize: 13 },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  quickCardText: { flex: 1, gap: 6 },
  quickTitle: { fontSize: 18, fontWeight: '700' },
  quickSubtitle: { fontSize: 13, lineHeight: 20 },
  quickButton: {
    minWidth: 120,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statsPanel: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: 11, letterSpacing: 1.8, marginBottom: 4 },
  sectionLabel: { fontSize: 14, fontWeight: '600' },
  sectionAction: { fontSize: 13, fontWeight: '700' },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  toolCell: { width: '48%' },
  recentCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  emptyState: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 13, lineHeight: 20 },
});
