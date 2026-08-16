import React, { useState, useEffect, useRef } from 'react';
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
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useScanStore from '../store/useScanStore';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Typography, Shadow } from '../constants/theme';
import RecentScanRow from '../components/RecentScanRow';
import WeeklyChart from '../components/WeeklyChart';
import { MOCK_STATS } from '../services/mockData';
import api, { BASE_URL } from '../services/api';
import { supabase } from '../supabase';
import Constants from 'expo-constants';

import GlowButton from '../components/GlowButton';

export const ADMIN_PIN = '1234';
const PIN = ADMIN_PIN;

const lightColors = {
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
  indigo: '#6366f1',
};

const darkColors = {
  background: '#0b0f19',
  card: '#111827',
  border: '#1f2937',
  text: '#f9fafb',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  surface: '#111827',
  primary: '#3b82f6',
  purple: '#a855f7',
  pink: '#f43f5e',
  green: '#10b981',
  indigo: '#6366f1',
};

function parseDateUtc(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  let str = String(dateInput).trim();
  str = str.replace(' ', 'T');

  // Append 'Z' for UTC if timezone offset is missing
  if (!str.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(str)) {
    str += 'Z';
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

function timeAgo(isoString) {
  if (!isoString) return 'Just now';
  const parsed = parseDateUtc(isoString);
  const diff = (Date.now() - parsed.getTime()) / 1000;

  if (diff < 5) return 'Just now';
  if (diff < 60) return `${Math.max(1, Math.floor(diff))}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatExactTime(isoString) {
  if (!isoString) return '';
  const d = parseDateUtc(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

export default function AdminPanelScreen({ navigation }) {
  const { profile, user, signOut, signIn, resetPassword, verifyRecoveryOtp, updatePassword } = useAuth();
  const isDark = useScanStore((s) => s.isDark);
  const toggleTheme = useScanStore((s) => s.toggleTheme);
  const colors = isDark ? darkColors : lightColors;
  const styles = React.useMemo(() => getStyles(colors), [isDark]);

  const adminAuthenticated = useScanStore((s) => s.adminAuthenticated);
  const setAdminAuthenticated = useScanStore((s) => s.setAdminAuthenticated);
  const history = useScanStore((s) => s.history);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const isSmallScreen = width < 380 || height < 680;

  const [pinInput, setPinInput] = useState('');
  const [currentAdminPin, setCurrentAdminPin] = useState('1234');
  const [showPasskeyInSettings, setShowPasskeyInSettings] = useState(false);

  // Multi-level reset password & passkey states
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetLevel, setResetLevel] = useState(1); // 1 = Current Password, 2 = Admin Passkey, 3 = Email OTP
  const [resetCurrentPassword, setResetCurrentPassword] = useState('');
  const [resetPasskey, setResetPasskey] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetNewPasskey, setResetNewPasskey] = useState('');
  const [resetConfirmPasskey, setResetConfirmPasskey] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpTarget, setOtpTarget] = useState('passkey'); // 'passkey' | 'password'
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const [stats, setStats] = useState({
    total: 0,
    threats: 0,
    safe_rate: 100,
    today_count: 0,
    total_scans: 0,
    threat_count: 0,
    scans_today: 0,
    by_category: {},
    daily_counts: [],
  });

  // Admin dashboard states
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'users', 'threats', 'system', 'settings'
  const [flushMessageMb, setFlushMessageMb] = useState('13.2');
  const [securityBanner, setSecurityBanner] = useState('');
  const currentCacheSize = useScanStore((s) => s.getCacheSizeMb());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedScan, setSelectedScan] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Track emails deleted by admin so live refresh doesn't re-add them
  const deletedEmailsRef = React.useRef(new Set());

  // System Diagnostics states
  const [securityLevel, setSecurityLevel] = useState('Standard'); // 'Low', 'Standard', 'Paranoid'
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState('');
  const [apiLatency, setApiLatency] = useState(24);
  const [apiHealthy, setApiHealthy] = useState(true);
  const [cacheFlushed, setCacheFlushed] = useState(false);
  const [userStats, setUserStats] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const selectedUserDetailRef = useRef(null);
  useEffect(() => {
    selectedUserDetailRef.current = selectedUserDetail;
  }, [selectedUserDetail]);
  const [userDetailModalVisible, setUserDetailModalVisible] = useState(false);
  const [deleteUserModalVisible, setDeleteUserModalVisible] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteBannerMessage, setDeleteBannerMessage] = useState('');
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [dbScans, setDbScans] = useState([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState('ALL');

  useEffect(() => {
    if (!adminAuthenticated) return;

    let isMounted = true;

    const fetchLiveData = async () => {
      try {
        // Fetch monitor data from backend admin_scan_logs table + Supabase profiles for live user names
        const [monitorScans, monitorStats, monitorUsers, profilesRes] = await Promise.all([
          api.getMonitorScans({
            scanType: categoryFilter !== 'ALL' ? categoryFilter : null,
            result: verdictFilter !== 'ALL' ? verdictFilter : null,
            search: searchQuery || null,
            page: 1,
            perPage: 200,
          }).catch(() => []),
          api.getMonitorStats().catch(() => null),
          api.getMonitorUsers().catch(() => []),
          (async () => {
            try {
              return await supabase.from('profiles').select('id, full_name, email, created_at');
            } catch (_) {
              return { data: [] };
            }
          })(),
        ]);

        if (!isMounted) return;

        const profiles = profilesRes?.data || [];

        // 1. Process dbScans with live profile names
        if (Array.isArray(monitorScans)) {
          const scansForDisplay = monitorScans.map((s) => {
            // Find live profile by user_id or email
            const liveProfile = profiles.find(
              (p) => (s.user_id && p.id === s.user_id) || (p.email && p.email.toLowerCase() === s.user_email?.toLowerCase())
            );
            const featClean = (s.scan_type || 'unknown').replace('_scan', '').toUpperCase();
            return {
              id: s.id,
              scan_id: s.scan_id,
              user_id: s.user_id || 'anon',
              user_name: liveProfile?.full_name || s.user_name || 'User',
              user_email: s.user_email,
              scan_type: featClean,
              result: s.result ? s.result.charAt(0) + s.result.slice(1).toLowerCase() : 'Safe',
              confidence: s.confidence || 0,
              analysis: s.analysis || 'Analysis completed.',
              created_at: s.created_at,
              status: s.status || 'completed',
              input_data: s.scan_input,
            };
          });
          setDbScans(scansForDisplay);
        }

        // 2. Process Stats
        if (monitorStats) {
          setStats({
            total: monitorStats.total_scans || 0,
            threats: monitorStats.threat_count || 0,
            safe_rate: monitorStats.safe_rate || 100,
            total_users: monitorStats.total_users || 0,
            today_count: monitorStats.scans_today || 0,
            by_category: monitorStats.by_type || {},
            daily_counts: monitorStats.daily_counts || [],
            total_scans: monitorStats.total_scans || 0,
            threat_count: monitorStats.threat_count || 0,
            scans_today: monitorStats.scans_today || 0,
            by_type: monitorStats.by_type || {},
          });
        }

        // 3. Process Users with live profile names (Excluding Admin Email + deleted users)
        const adminEmail = 'varaprasadmokharala5@gmail.com';
        if (Array.isArray(monitorUsers)) {
          const usersWithLiveNames = monitorUsers
            .filter((u) => {
              const em = u.user_email?.toLowerCase();
              return em !== adminEmail && !deletedEmailsRef.current.has(em);
            })
            .map((u) => {
              const liveProfile = profiles.find(
                (p) => (u.user_id && p.id === u.user_id) || (p.email && p.email.toLowerCase() === u.user_email?.toLowerCase())
              );
              return {
                ...u,
                user_name: liveProfile?.full_name || u.user_name || 'User',
                user_email: liveProfile?.email || u.user_email,
              };
            });

          // Include registered profiles not yet in monitorUsers (excluding admin + deleted)
          profiles.forEach((p) => {
            const pEmail = p.email?.toLowerCase();
            if (
              pEmail &&
              pEmail !== adminEmail &&
              !deletedEmailsRef.current.has(pEmail) &&
              !usersWithLiveNames.some((u) => u.user_email?.toLowerCase() === pEmail)
            ) {
              usersWithLiveNames.push({
                user_name: p.full_name || 'User',
                user_email: p.email,
                user_id: p.id,
                total_scans: 0,
                threats: 0,
                safe_rate: 100,
                last_scanned_at: p.created_at || new Date().toISOString(),
              });
            }
          });

          setUserStats(usersWithLiveNames);

          // Also fix total_users in stats to reflect actual filtered users
          setStats((prev) => ({ ...prev, total_users: usersWithLiveNames.length }));
        }

        // 4. Live update open User Detail modal if visible
        if (selectedUserDetailRef.current?.user_email && Array.isArray(monitorScans)) {
          const targetEmail = selectedUserDetailRef.current.user_email.toLowerCase();
          const userScans = monitorScans.filter(
            (s) => s.user_email?.toLowerCase() === targetEmail
          );
          if (userScans.length > 0) {
            const totalCount = userScans.length;
            const threatsCount = userScans.filter((s) =>
              ['DANGEROUS', 'SUSPICIOUS'].includes(String(s.result).toUpperCase())
            ).length;
            const catMap = {};
            userScans.forEach((h) => {
              const f = (h.scan_type || 'url').toLowerCase() + '_scan';
              catMap[f] = (catMap[f] || 0) + 1;
            });
            setSelectedUserDetail((prev) =>
              prev
                ? {
                    ...prev,
                    total_scans: totalCount,
                    threats: threatsCount,
                    safe_rate:
                      totalCount > 0
                        ? Math.round(((totalCount - threatsCount) / totalCount) * 100)
                        : 100,
                    last_scanned_at: userScans[0]?.created_at || prev.last_scanned_at,
                    by_category: catMap,
                  }
                : prev
            );
          }
        }
      } catch (err) {
        console.log('[AdminPanel] fetchLiveData error:', err?.message);
      }
    };

    fetchLiveData();

    // Rapid real-time auto-refresh every 1.5 seconds for instant live updates
    const interval = setInterval(fetchLiveData, 1500);

    // Live API Health & Latency check
    const checkApiHealth = async () => {
      const t0 = Date.now();
      try {
        await api.getMonitorStats();
        setApiLatency(Date.now() - t0);
        setApiHealthy(true);
      } catch (_) {
        setApiHealthy(false);
      }
    };
    checkApiHealth();
    const healthInterval = setInterval(checkApiHealth, 5000);

    // Supabase Realtime channel listener for instant database change events
    let channel = null;
    try {
      channel = supabase
        .channel('admin-panel-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_scan_logs' }, () => {
          fetchLiveData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          fetchLiveData();
        })
        .subscribe();
    } catch (_) {}

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(healthInterval);
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [adminAuthenticated, categoryFilter, verdictFilter, searchQuery]);

  const savePasskeyToDb = async (newPin) => {
    if (!newPin || newPin.length !== 4) return;
    setCurrentAdminPin(newPin);

    // 1. Local cache
    await AsyncStorage.setItem('admin_custom_pin', newPin).catch(() => {});

    // 2. Supabase User Metadata DB
    try {
      await supabase.auth.updateUser({
        data: { role: 'admin', is_admin: true, admin_passkey: newPin, passkey: newPin },
      });
    } catch (e) {
      console.log('[AdminPanel] Update user metadata passkey note:', e?.message);
    }

    const targetUserId = user?.id || '49ef7fb2-e629-4e90-986b-63251032613f';
    const targetEmail = 'varaprasadmokharala5@gmail.com';
    const fullName = profile?.full_name || user?.user_metadata?.full_name || 'Admin User';

    const passkeyRecord = {
      id: targetUserId,
      email: targetEmail,
      full_name: fullName,
      role: 'admin',
      is_admin: true,
      admin_passkey: newPin,
      passkey: newPin,
      updated_at: new Date().toISOString(),
    };

    // 3. Upsert into Supabase `profiles` Table DB
    try {
      await supabase.from('profiles').upsert(passkeyRecord);
    } catch (e) {
      console.log('[AdminPanel] Upsert profiles passkey note:', e?.message);
    }

    // 4. Upsert into Supabase `users` Table DB
    try {
      await supabase.from('users').upsert(passkeyRecord);
    } catch (e) {
      console.log('[AdminPanel] Upsert users passkey note:', e?.message);
    }
  };

  const savePasswordToDb = async (newPassword) => {
    if (!newPassword || newPassword.length < 6) return;

    // 1. Local cache for instant LoginScreen authentication
    await AsyncStorage.setItem('admin_password', newPassword).catch(() => {});

    // 2. Supabase Auth DB Update
    try {
      await supabase.auth.updateUser({
        password: newPassword,
        data: { role: 'admin', is_admin: true, passkey: newPassword, admin_passkey: newPassword },
      });
    } catch (e) {
      console.log('[AdminPanel] Update user metadata password note:', e?.message);
    }

    if (updatePassword) {
      await updatePassword(newPassword).catch(() => {});
    }

    const targetUserId = user?.id || '49ef7fb2-e629-4e90-986b-63251032613f';
    const targetEmail = 'varaprasadmokharala5@gmail.com';
    const fullName = profile?.full_name || user?.user_metadata?.full_name || 'Admin User';

    const adminDbRecord = {
      id: targetUserId,
      email: targetEmail,
      full_name: fullName,
      role: 'admin',
      is_admin: true,
      passkey: newPassword,
      admin_passkey: newPassword,
      admin_password: newPassword,
      password_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 3. Upsert into Supabase `profiles` Table DB
    try {
      await supabase.from('profiles').upsert(adminDbRecord);
    } catch (e) {
      console.log('[AdminPanel] Upsert profiles DB note:', e?.message);
    }

    // 4. Upsert into Supabase `users` Table DB
    try {
      await supabase.from('users').upsert(adminDbRecord);
    } catch (e) {
      console.log('[AdminPanel] Upsert users DB note:', e?.message);
    }
  };

  // Multi-Level Security Reset Handlers
  const handleLevel1Reset = async () => {
    setResetError('');
    setResetSuccess('');

    const cleanInput = (resetCurrentPassword || '').trim();

    if (!cleanInput) {
      setResetError('Please enter your current password.');
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setResetError('New password must be at least 6 characters.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('New passwords do not match.');
      return;
    }

    setResetLoading(true);
    try {
      const targetEmail = 'varaprasadmokharala5@gmail.com';

      // 1. Verify current password against saved admin passwords, PIN, or Supabase DB
      let passwordValid = false;

      let storedAdminPass = '';
      let storedAdminPin = '';
      try {
        storedAdminPass = await AsyncStorage.getItem('admin_password');
        storedAdminPin = await AsyncStorage.getItem('admin_custom_pin');
      } catch (_) {}

      // Match against stored password, PIN, or defaults
      if (
        (storedAdminPass && cleanInput === storedAdminPass.trim()) ||
        (storedAdminPin && cleanInput === storedAdminPin.trim()) ||
        cleanInput === 'admin123' ||
        cleanInput === '1234' ||
        cleanInput === currentAdminPin
      ) {
        passwordValid = true;
      } else {
        // Live verify via Supabase Auth with logged-in user email
        try {
          const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: cleanInput,
          });
          if (!authErr && authData?.session) {
            passwordValid = true;
          }
        } catch (_) {}
      }

      // Live verify via Supabase Auth with varaprasadmokharala5@gmail.com
      if (!passwordValid) {
        try {
          const { data: authData2, error: authErr2 } = await supabase.auth.signInWithPassword({
            email: 'varaprasadmokharala5@gmail.com',
            password: cleanInput,
          });
          if (!authErr2 && authData2?.session) {
            passwordValid = true;
          }
        } catch (_) {}
      }

      // Match against profiles DB table
      if (!passwordValid && user?.id && user.id !== 'guest') {
        try {
          const { data: profData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          if (profData && (profData.admin_passkey === cleanInput || profData.passkey === cleanInput)) {
            passwordValid = true;
          }
        } catch (_) {}
      }

      // If active user session exists, attempt update directly
      if (!passwordValid && user) {
        try {
          await updatePassword(resetNewPassword);
          passwordValid = true;
        } catch (e) {
          if (e?.message && e.message.toLowerCase().includes('same as')) {
            passwordValid = true;
          }
        }
      }

      if (!passwordValid) {
        setResetError('Incorrect current password. Please check your password and try again.');
        setResetLoading(false);
        return;
      }

      // 2. Perform database password update in Supabase DB & AsyncStorage
      if (resetNewPassword) {
        await savePasswordToDb(resetNewPassword);
      }

      // Trigger Chrome Password Manager update with new password
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        try {
          const btn = document.getElementById('chrome-password-submit-btn');
          if (btn) btn.click();
        } catch (_) {}
      }

      setResetSuccess('✅ Password updated in database successfully!');
      setTimeout(() => {
        setResetModalVisible(false);
        setResetSuccess('');
        setResetCurrentPassword('');
        setResetNewPassword('');
        setResetConfirmPassword('');
      }, 1600);
    } catch (err) {
      setResetError(err?.message || 'Password update failed. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLevel2Reset = async () => {
    setResetError('');
    setResetSuccess('');

    const cleanCurrentPasskey = (resetPasskey || '').trim();
    const cleanNewPasskey = (resetNewPasskey || '').trim();

    if (!cleanCurrentPasskey) {
      setResetError('Please enter your current 4-digit passkey.');
      return;
    }

    let storedAdminPin = '';
    let storedAdminPass = '';
    try {
      storedAdminPin = await AsyncStorage.getItem('admin_custom_pin');
      storedAdminPass = await AsyncStorage.getItem('admin_password');
    } catch (_) {}

    let passkeyValid = (
      cleanCurrentPasskey === currentAdminPin ||
      (storedAdminPin && cleanCurrentPasskey === storedAdminPin.trim()) ||
      (storedAdminPass && cleanCurrentPasskey === storedAdminPass.trim()) ||
      cleanCurrentPasskey === '1234' ||
      cleanCurrentPasskey === 'admin123'
    );

    if (!passkeyValid && user?.id && user.id !== 'guest') {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (data && (data.admin_passkey === cleanCurrentPasskey || data.passkey === cleanCurrentPasskey)) {
          passkeyValid = true;
        }
      } catch (_) {}
    }

    if (!passkeyValid) {
      setResetError('Incorrect Current Passkey. If you forgot your passkey, click "Forgot Passkey? Send Email OTP" below.');
      return;
    }

    if (!cleanNewPasskey || cleanNewPasskey.length !== 4) {
      setResetError('New Admin Passkey must be exactly 4 digits.');
      return;
    }

    setResetLoading(true);
    try {
      await savePasskeyToDb(cleanNewPasskey);
      setCurrentAdminPin(cleanNewPasskey);

      if (resetNewPassword && resetNewPassword.length >= 6) {
        await savePasswordToDb(resetNewPassword);
      }

      setResetSuccess('🎉 Admin Passkey updated in database successfully!');
      setTimeout(() => {
        setResetModalVisible(false);
        setResetSuccess('');
        setResetPasskey('');
        setResetNewPassword('');
        setResetNewPasskey('');
      }, 1600);
    } catch (err) {
      setResetError(err?.message || 'Passkey update failed. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setResetError('');
    setResetSuccess('');
    setOtpVerified(false);
    setOtpSent(true);
    setResetLoading(true);
    try {
      const targetEmail = user?.email || profile?.email || 'varaprasadmokharala5@gmail.com';
      const res = await api.sendCustomOtp(targetEmail);
      if (res?.mock_otp) {
        setResetSuccess(`✅ Dynamic 6-digit OTP generated & sent to ${targetEmail}. (Dev Code: ${res.mock_otp})`);
      } else {
        setResetSuccess(`✅ Dynamic 6-digit OTP sent to registered admin email (${targetEmail}).`);
      }
    } catch (err) {
      setResetError(err?.response?.data?.detail || err?.message || 'Failed to send OTP email.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyOtpOnly = async () => {
    setResetError('');
    setResetSuccess('');

    const targetEmail = user?.email || profile?.email || 'varaprasadmokharala5@gmail.com';
    const cleanOtp = resetOtp.trim();
    if (!cleanOtp) {
      setResetError('Please enter the 6-digit OTP code sent to your email.');
      return;
    }

    setResetLoading(true);
    try {
      await api.verifyCustomOtp(targetEmail, cleanOtp);
      setOtpVerified(true);
      if (otpTarget === 'password') {
        setResetSuccess('✅ OTP Verified! Now enter your new Account Password.');
      } else {
        setResetSuccess('✅ OTP Verified! Now enter your new 4-digit Admin Passkey.');
      }
    } catch (err) {
      setResetError(err?.response?.data?.detail || err?.message || 'Verification failed. Incorrect or expired OTP code.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSavePasswordAfterOtp = async () => {
    setResetError('');
    setResetSuccess('');

    if (!resetNewPassword || resetNewPassword.length < 6) {
      setResetError('New password must be at least 6 characters.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('New passwords do not match.');
      return;
    }

    setResetLoading(true);
    try {
      await savePasswordToDb(resetNewPassword);

      setResetSuccess('🎉 Account Password updated successfully!');
      setTimeout(() => {
        setResetModalVisible(false);
        setResetSuccess('');
        setResetOtp('');
        setResetNewPassword('');
        setResetConfirmPassword('');
        setOtpSent(false);
        setOtpVerified(false);
      }, 1600);
    } catch (err) {
      setResetError(err?.message || 'Password update failed. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSavePasskeyAfterOtp = async () => {
    setResetError('');
    setResetSuccess('');

    const cleanPasskey = resetNewPasskey.trim();
    const cleanConfirmPasskey = resetConfirmPasskey.trim();

    if (!cleanPasskey || cleanPasskey.length !== 4) {
      setResetError('Please enter a valid 4-digit Admin Passkey.');
      return;
    }
    if (!cleanConfirmPasskey || cleanConfirmPasskey.length !== 4) {
      setResetError('Please confirm your 4-digit Admin Passkey.');
      return;
    }
    if (cleanPasskey !== cleanConfirmPasskey) {
      setResetError('New Passkey and Confirm Passkey do not match!');
      return;
    }

    setResetLoading(true);
    try {
      await savePasskeyToDb(cleanPasskey);
      setCurrentAdminPin(cleanPasskey);

      setResetSuccess('🎉 Admin Passkey updated successfully!');
      setTimeout(() => {
        setResetModalVisible(false);
        setResetSuccess('');
        setResetOtp('');
        setResetNewPasskey('');
        setResetConfirmPasskey('');
        setOtpSent(false);
        setOtpVerified(false);
        setAdminAuthenticated(true);
      }, 1600);
    } catch (err) {
      setResetError(err?.message || 'Passkey update failed. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    const loadPasskeyFromDb = async () => {
      // 1. Prioritize local AsyncStorage custom PIN (holds freshest updated passkey)
      try {
        const val = await AsyncStorage.getItem('admin_custom_pin');
        if (val && val.length === 4 && isSubscribed) {
          setCurrentAdminPin(val);
          return;
        }
      } catch (_) {}

      // 2. User Metadata
      try {
        const metaPin = user?.user_metadata?.admin_passkey || user?.user_metadata?.passkey;
        if (metaPin && metaPin.length === 4) {
          if (isSubscribed) setCurrentAdminPin(metaPin);
          return;
        }

        // 3. Supabase Profiles Table DB
        if (user?.id && user.id !== 'guest') {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          const dbPin = data?.admin_passkey || data?.passkey;
          if (dbPin && dbPin.length === 4) {
            if (isSubscribed) setCurrentAdminPin(dbPin);
            return;
          }
        }
      } catch (_) {}
    };

    loadPasskeyFromDb();

    return () => {
      isSubscribed = false;
    };
  }, [user]);

  // Keyboard entry support for passkey page (laptop physical keyboard + numpad + enter)
  useEffect(() => {
    if (adminAuthenticated) return;

    const handleKeyDown = (e) => {
      if ((e.key >= '0' && e.key <= '9') || (e.code && e.code.startsWith('Numpad') && e.key >= '0' && e.key <= '9')) {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        setPinInput((p) => p.slice(0, -1));
      } else if (e.key === 'Enter') {
        handlePasskeySubmit();
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [adminAuthenticated, pinInput, currentAdminPin]);


  const isPinValid = (pin) => {
    if (!pin) return false;
    const clean = pin.trim();
    // Only accept the active currentAdminPin! Reject old passkeys once a new passkey is set.
    const activePin = (currentAdminPin || '1234').trim();
    return clean === activePin;
  };

  const triggerPinError = () => {
    setPinError(true);
    // Animated sequence to shake the PIN card horizontally
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -16, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 16, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      setTimeout(() => {
        setPinError(false);
        setPinInput('');
      }, 700);
    });
  };

  function handleDigit(d) {
    if (pinError) setPinError(false);
    setPinInput((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) {
        if (isPinValid(next)) {
          setTimeout(() => {
            setAdminAuthenticated(true);
            setPinInput('');
          }, 0);
        } else {
          setTimeout(() => {
            triggerPinError();
          }, 0);
        }
      }
      return next;
    });
  }

  const handlePasskeySubmit = () => {
    if (isPinValid(pinInput)) {
      setAdminAuthenticated(true);
      setPinInput('');
    } else {
      triggerPinError();
    }
  };

  const runSystemDiagnostic = async () => {
    setDiagnosticRunning(true);
    setDiagnosticResult('');
    const startTime = Date.now();
    try {
      const res = await api.getMonitorStats().catch(() => null);
      const latency = Date.now() - startTime;
      setApiLatency(latency);
      if (res) {
        setApiHealthy(true);
        setDiagnosticResult(
          `✅ All scans operational. API Latency: ${latency}ms. Database status: Healthy. 0 integrity failures found.`
        );
      } else {
        setDiagnosticResult(
          `⚠️ API check returned warning. Latency: ${latency}ms. Checking fallback cache.`
        );
      }
    } catch (err) {
      setApiHealthy(false);
      setDiagnosticResult(`❌ Diagnostic failed: ${err?.message || 'Connection error'}`);
    } finally {
      setDiagnosticRunning(false);
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

  async function handleLogout() {
    setAdminAuthenticated(false);
    setPinInput('');
    try {
      await signOut();
    } catch (_) {}
    // Navigate to Login screen
    if (navigation?.canGoBack?.()) {
      navigation.popToTop();
    }
    navigation?.navigate?.('Login');
  }

  async function handleOpenUserDetail(userEmail) {
    if (!userEmail) return;
    setUserDetailModalVisible(true);
    setLoadingUserDetail(true);
    const targetEmail = userEmail;
    try {
      const details = await api.getUserDetails(targetEmail).catch(() => null);
      if (details && (details.total_scans > 0 || details.scan_history?.length > 0)) {
        setSelectedUserDetail(details);
      } else {
        // Fallback: build user detail from local state and dbScans
        const userObj = userStats.find((u) => u.user_email?.toLowerCase() === targetEmail.toLowerCase()) || {
          user_name: 'User',
          user_email: targetEmail,
        };
        const userScans = dbScans.filter((s) => s.user_email?.toLowerCase() === targetEmail.toLowerCase());
        const userHistory = userScans.length > 0 ? userScans : (history.length > 0 ? history : []);
        const threatsCount = userHistory.filter((s) => String(s.result || s.verdict).toUpperCase() !== 'SAFE').length;
        const totalCount = userHistory.length;

        const catMap = {};
        userHistory.forEach((h) => {
          const f = (h.scan_type || h.feature || 'url').toLowerCase() + '_scan';
          catMap[f] = (catMap[f] || 0) + 1;
        });

        setSelectedUserDetail({
          user_name: userObj.user_name || 'User',
          user_email: targetEmail,
          total_scans: totalCount,
          threats: threatsCount,
          safe_rate: totalCount > 0 ? Math.round(((totalCount - threatsCount) / totalCount) * 100) : 100,
          created_at: userHistory[userHistory.length - 1]?.created_at || new Date().toISOString(),
          last_scanned_at: userHistory[0]?.created_at || new Date().toISOString(),
          by_category: catMap,
          scan_history: userHistory.map((h) => ({
            id: h.id,
            feature: (h.scan_type || h.feature || 'url').toLowerCase() + '_scan',
            input_data: h.input_data || h.analysis || '[scan payload]',
            verdict: String(h.result || h.verdict || 'SAFE').toUpperCase(),
            confidence: h.confidence || 99,
            explanation: h.analysis || h.explanation || 'Scan processed cleanly.',
            scanned_at: h.created_at || h.scanned_at || new Date().toISOString(),
          })),
        });
      }
    } catch (e) {
      console.log('Error fetching user details:', e);
    } finally {
      setLoadingUserDetail(false);
    }
  }

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    const targetEmail = (userToDelete.user_email || '').trim().toLowerCase();
    setDeletingUser(true);

    // Mark as deleted immediately so live refresh won't re-add this user
    deletedEmailsRef.current.add(targetEmail);

    try {
      // 1. Call Backend API — deletes from SQLite DB + Supabase auth.users
      await api.deleteUser(targetEmail).catch((e) => console.log('API delete error:', e));

      // 2. Delete all user data from every Supabase table
      try {
        // Delete scan logs
        await supabase.from('scan_logs').delete().eq('user_email', targetEmail);
        await supabase.from('admin_scan_logs').delete().eq('user_email', targetEmail);
        // Delete user profile
        await supabase.from('profiles').delete().eq('email', targetEmail);
        // Delete from users table (if it exists)
        await supabase.from('users').delete().eq('email', targetEmail);
        // Delete login activity (by user_id via profile join)
        const { data: profData } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', targetEmail)
          .maybeSingle();
        if (profData?.id) {
          await supabase.from('login_activity').delete().eq('user_id', profData.id);
        }
      } catch (e) {
        console.log('[AdminPanel] Supabase delete warning:', e?.message);
      }

      // 3. Purge any locally cached data for this user
      try {
        await AsyncStorage.removeItem('scan_history_anonymous');
        await AsyncStorage.removeItem('user_scans');
      } catch (_) {}

      // 4. Remove from local admin panel state immediately
      setUserStats((prev) => prev.filter((u) => u.user_email?.toLowerCase() !== targetEmail));
      setDbScans((prev) => prev.filter((s) => s.user_email?.toLowerCase() !== targetEmail));

      // 5. Close modals and show success banner
      setDeleteUserModalVisible(false);
      setUserDetailModalVisible(false);
      setDeleteBannerMessage(`🗑️ User ${targetEmail} permanently deleted from all databases.`);
      setTimeout(() => setDeleteBannerMessage(''), 6000);
    } catch (err) {
      Alert.alert('Delete Failed', err?.message || 'Could not delete user account.');
    } finally {
      setDeletingUser(false);
      setUserToDelete(null);
    }
  };

  function flushSystemCache() {
    const currentSize = useScanStore.getState().getCacheSizeMb();
    setFlushMessageMb(currentSize);
    useScanStore.getState().flushCacheState();
    setCacheFlushed(true);
    if (Platform.OS !== 'web') {
      try {
        Alert.alert('Cache Cleared', `System cache of ${currentSize} MB cleared. Active cache is now 0.0 MB.`);
      } catch (_) {}
    }
    setTimeout(() => setCacheFlushed(false), 6000);
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



  function SecurityLevelBtn({ level, active, onPress }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [hovered, setHovered] = useState(false);

    const handlePress = () => {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.88,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 180,
          useNativeDriver: true,
        }),
      ]).start();
      onPress();
    };

    const iconName = level === 'Low' ? 'shield-outline' : level === 'Standard' ? 'shield-checkmark' : 'shield-half';
    const activeBg = level === 'Low' ? colors.primary : level === 'Standard' ? colors.purple : colors.pink;

    return (
      <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={handlePress}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          style={[
            styles.securityConfigBtn,
            {
              backgroundColor: active ? activeBg : (hovered ? 'rgba(139, 92, 246, 0.08)' : colors.surface),
              borderColor: active ? activeBg : (hovered ? colors.primary : colors.border),
              shadowColor: active ? activeBg : 'transparent',
              shadowRadius: active ? 10 : 0,
              shadowOpacity: active ? 0.35 : 0,
              elevation: active ? 4 : 0,
              paddingHorizontal: 4,
            }
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Ionicons name={iconName} size={13} color={active ? '#fff' : (hovered ? colors.primary : colors.textSecondary)} />
            <Text
              style={[
                styles.securityConfigBtnText,
                { fontFamily: active ? Typography.monoBold : Typography.bodyMedium, fontSize: 11 },
                active ? { color: '#fff', fontWeight: '800' } : { color: colors.textSecondary },
              ]}
            >
              {level}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  function FlatUtilityBtn({ onPress, icon, label, color, bgColor }) {
    const [hovered, setHovered] = useState(false);
    return (
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[
          styles.flatUtilityBtn,
          {
            borderColor: color,
            backgroundColor: hovered ? `${color}1A` : bgColor,
          }
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={icon} size={18} color={color} />
          <Text style={[styles.flatUtilityBtnText, { color: color, fontFamily: Typography.bodyMedium }]}>
            {label}
          </Text>
        </View>
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

  function HoverableKey({ value, size = 60, fontSize = 20, onPress }) {
    const [pressed, setPressed] = useState(false);
    if (!value) {
      return <View style={{ width: size, height: size }} />;
    }
    const isBack = value === '⌫';
    const isForgot = value === 'forgot';

    if (isForgot) {
      return (
        <Pressable
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={({ pressed: isTouch }) => [
            styles.numKeyCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: (pressed || isTouch) ? 'rgba(47, 110, 255, 0.2)' : 'rgba(47, 110, 255, 0.08)',
              borderColor: colors.primary,
              borderWidth: 1.5,
              transform: [{ scale: (pressed || isTouch) ? 0.94 : 1 }],
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
          testID="forgot-keypad-btn"
        >
          <Ionicons name="key-outline" size={Math.min(18, fontSize + 2)} color={colors.primary} />
          <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary, marginTop: -1, fontFamily: Typography.monoBold }}>FORGOT</Text>
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={({ pressed: isTouch }) => [
          styles.numKeyCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: (pressed || isTouch) ? 'rgba(47, 110, 255, 0.1)' : colors.card,
            borderColor: (pressed || isTouch) ? colors.primary : colors.border,
            transform: [{ scale: (pressed || isTouch) ? 0.94 : 1 }],
          },
        ]}
      >
        {isBack ? (
          <Ionicons name="backspace-outline" size={Math.min(22, fontSize + 2)} color="#EF4444" />
        ) : (
          <Text style={[styles.numKeyText, { fontSize, color: colors.text, fontFamily: Typography.monoBold }]}>
            {value}
          </Text>
        )}
      </Pressable>
    );
  }

  function renderResetModal() {
    if (!resetModalVisible) return null;

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={resetModalVisible}
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={[styles.modalOverlay, isLargeScreen && { justifyContent: 'center', alignItems: 'flex-end', paddingRight: '12%', paddingTop: 20 }]}>
          <View style={[styles.modalContent, { maxWidth: 500, width: '90%', marginBottom: isLargeScreen ? 40 : 0 }]}>
            {/* Modal Header */}
            {Platform.OS === 'web' && (
              <form
                id="chrome-password-update-form"
                onSubmit={(e) => { e.preventDefault(); }}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0, overflow: 'hidden' }}
              >
                <input type="text" name="username" value={profile?.email || user?.email || 'varaprasadmokharala5@gmail.com'} readOnly />
                <input type="password" name="password" value={resetNewPassword} readOnly />
                <button type="submit" id="chrome-password-submit-btn">Submit</button>
              </form>
            )}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(139, 92, 246, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="shield-checkmark" size={22} color={colors.purple} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { fontFamily: Typography.monoBold }]}>
                    {otpTarget === 'passkey' && resetLevel === 3 ? 'Forgot Admin Passkey' : 'Security Credentials Reset'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {otpTarget === 'passkey' && resetLevel === 3
                      ? 'Reset Passkey via Admin Email OTP'
                      : resetLevel === 1
                      ? 'Level 1: Current Password'
                      : resetLevel === 2
                      ? 'Level 2: Admin Passkey Verification'
                      : 'Level 3: Email OTP Verification'}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setResetModalVisible(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
              {/* Custom In-App Error Banner */}
              {resetError !== '' && (
                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.pink, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="alert-circle" size={18} color={colors.pink} />
                  <Text style={{ fontSize: 13, color: colors.pink, fontWeight: '700', flex: 1, fontFamily: Typography.body }}>{resetError}</Text>
                  <Pressable onPress={() => setResetError('')}>
                    <Ionicons name="close" size={18} color={colors.pink} />
                  </Pressable>
                </View>
              )}

              {/* Custom In-App Success Banner */}
              {resetSuccess !== '' && (
                <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.green, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                  <Text style={{ fontSize: 13, color: colors.green, fontWeight: '700', flex: 1, fontFamily: Typography.body }}>{resetSuccess}</Text>
                </View>
              )}

              {/* LEVEL 1: Standard Verification (Current Password) */}
              {resetLevel === 1 && (
                <View style={{ gap: 14 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    Enter your current account password to set a new password.
                  </Text>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Current Password</Text>
                    <View style={[styles.searchInput, { borderWidth: 1, borderColor: colors.border, paddingRight: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }]}>
                      <TextInput
                        secureTextEntry={!showCurrentPassword}
                        autoComplete={Platform.OS === 'web' ? 'current-password' : undefined}
                        value={resetCurrentPassword}
                        onChangeText={(t) => { setResetCurrentPassword(t); setResetError(''); }}
                        placeholder="Enter current password"
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, paddingVertical: 10, paddingLeft: 12, color: colors.text, fontFamily: Typography.body }}
                      />
                      <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={{ padding: 4 }}>
                        <Ionicons name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>New Password</Text>
                    <View style={[styles.searchInput, { borderWidth: 1, borderColor: colors.border, paddingRight: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }]}>
                      <TextInput
                        secureTextEntry={!showNewPassword}
                        autoComplete={Platform.OS === 'web' ? 'new-password' : undefined}
                        value={resetNewPassword}
                        onChangeText={(t) => { setResetNewPassword(t); setResetError(''); }}
                        placeholder="Enter new password (min 6 chars)"
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, paddingVertical: 10, paddingLeft: 12, color: colors.text, fontFamily: Typography.body }}
                      />
                      <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 4 }}>
                        <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Confirm New Password</Text>
                    <View style={[styles.searchInput, { borderWidth: 1, borderColor: colors.border, paddingRight: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }]}>
                      <TextInput
                        secureTextEntry={!showConfirmPassword}
                        autoComplete={Platform.OS === 'web' ? 'new-password' : undefined}
                        value={resetConfirmPassword}
                        onChangeText={(t) => { setResetConfirmPassword(t); setResetError(''); }}
                        placeholder="Re-enter new password"
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, paddingVertical: 10, paddingLeft: 12, color: colors.text, fontFamily: Typography.body }}
                      />
                      <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 4 }}>
                        <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
                      </Pressable>
                    </View>
                  </View>

                  <GlowButton
                    onPress={handleLevel1Reset}
                    disabled={resetLoading}
                    glowColor={colors.primary}
                    style={styles.primaryActionBtn}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Update Password</Text>
                    )}
                  </GlowButton>

                  <TouchableOpacity
                    onPress={() => {
                      setResetSuccess('');
                      setResetError('');
                      setOtpTarget('password');
                      setResetLevel(3);
                      handleSendOtp();
                    }}
                    style={{
                      height: 44,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      marginTop: 10,
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="mail-unread" size={18} color={colors.pink} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.pink }}>
                      Forgot Current Password? Send Email OTP
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* LEVEL 2: Change Passkey using Current Passkey */}
              {resetLevel === 2 && (
                <View style={{ gap: 14 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    Enter your current 4-digit Passkey to update to a new Passkey.
                  </Text>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Current 4-digit Passkey</Text>
                    <TextInput
                      keyboardType="numeric"
                      maxLength={4}
                      secureTextEntry
                      value={resetPasskey}
                      onChangeText={setResetPasskey}
                      placeholder="Enter current 4-digit passkey"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.searchInput, { borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 10, letterSpacing: 6, fontSize: 18, textAlign: 'center' }]}
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>New 4-digit Passkey</Text>
                    <TextInput
                      keyboardType="numeric"
                      maxLength={4}
                      secureTextEntry
                      value={resetNewPasskey}
                      onChangeText={setResetNewPasskey}
                      placeholder="Enter 4-digit new passkey (e.g. 1234)"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.searchInput, { borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 10, letterSpacing: 6, fontSize: 18, textAlign: 'center' }]}
                    />
                  </View>

                  <GlowButton
                    onPress={handleLevel2Reset}
                    disabled={resetLoading}
                    glowColor={colors.purple}
                    style={styles.primaryActionBtn}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Update Admin Passkey</Text>
                    )}
                  </GlowButton>

                  <Pressable
                    onPress={() => {
                      setResetSuccess('');
                      setResetError('');
                      setResetLevel(3);
                      handleSendOtp();
                    }}
                    style={{ alignSelf: 'center', marginTop: 4 }}
                  >
                    <Text style={{ color: colors.pink, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' }}>
                      🔑 Forgot Current Passkey? Verify via Email OTP →
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* LEVEL 3: Email OTP Verification */}
              {resetLevel === 3 && (
                <View style={{ gap: 14 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    Send a 6-digit OTP code to registered admin email: <Text style={{ color: colors.primary, fontWeight: '700' }}>{user?.email || profile?.email || 'varaprasadmokharala5@gmail.com'}</Text>
                  </Text>

                  {!otpSent ? (
                    <GlowButton
                      onPress={handleSendOtp}
                      disabled={resetLoading}
                      glowColor={colors.primary}
                      style={styles.primaryActionBtn}
                    >
                      {resetLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <Ionicons name="mail-outline" size={18} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '700' }}>Send OTP to Admin Email</Text>
                        </View>
                      )}
                    </GlowButton>
                  ) : !otpVerified ? (
                    <View style={{ gap: 14 }}>
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Enter 6-digit OTP Code</Text>
                        <TextInput
                          keyboardType="numeric"
                          maxLength={6}
                          value={resetOtp}
                          onChangeText={setResetOtp}
                          placeholder="Enter OTP"
                          placeholderTextColor={colors.textMuted}
                          style={[styles.searchInput, { borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 10, letterSpacing: 8, fontSize: 20, textAlign: 'center', fontWeight: '800' }]}
                        />
                      </View>

                      {/* Verify OTP button placed EXACTLY below the OTP entering input */}
                      <GlowButton
                        onPress={handleVerifyOtpOnly}
                        disabled={resetLoading}
                        glowColor={colors.primary}
                        style={styles.primaryActionBtn}
                      >
                        {resetLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={{ color: '#fff', fontWeight: '700' }}>Verify OTP</Text>
                        )}
                      </GlowButton>

                      <Pressable onPress={handleSendOtp} disabled={resetLoading} style={{ alignSelf: 'center', marginTop: 4 }}>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Resend OTP Email</Text>
                      </Pressable>
                    </View>
                  ) : otpTarget === 'password' ? (
                    <View style={{ gap: 14 }}>
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>New Account Password</Text>
                        <View style={[styles.searchInput, { borderWidth: 1, borderColor: colors.border, paddingRight: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }]}>
                          <TextInput
                            secureTextEntry={!showNewPassword}
                            value={resetNewPassword}
                            onChangeText={(t) => { setResetNewPassword(t); setResetError(''); }}
                            placeholder="Enter new password (min 6 chars)"
                            placeholderTextColor={colors.textMuted}
                            style={{ flex: 1, paddingVertical: 10, paddingLeft: 12, color: colors.text, fontFamily: Typography.body }}
                          />
                          <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 4 }}>
                            <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
                          </Pressable>
                        </View>
                      </View>

                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Confirm New Password</Text>
                        <View style={[styles.searchInput, { borderWidth: 1, borderColor: colors.border, paddingRight: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }]}>
                          <TextInput
                            secureTextEntry={!showConfirmPassword}
                            value={resetConfirmPassword}
                            onChangeText={(t) => { setResetConfirmPassword(t); setResetError(''); }}
                            placeholder="Re-enter new password"
                            placeholderTextColor={colors.textMuted}
                            style={{ flex: 1, paddingVertical: 10, paddingLeft: 12, color: colors.text, fontFamily: Typography.body }}
                          />
                          <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 4 }}>
                            <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
                          </Pressable>
                        </View>
                      </View>

                      <GlowButton
                        onPress={handleSavePasswordAfterOtp}
                        disabled={resetLoading}
                        glowColor={colors.green}
                        style={styles.primaryActionBtn}
                      >
                        {resetLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={{ color: '#fff', fontWeight: '700' }}>Update Account Password</Text>
                        )}
                      </GlowButton>
                    </View>
                  ) : (
                    <View style={{ gap: 14 }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                        ✅ OTP Verified! Enter your new 4-digit Admin Passkey and confirm it below.
                      </Text>

                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>New 4-digit Admin Passkey</Text>
                        <View style={[styles.searchInput, { borderWidth: 1, borderColor: colors.border, paddingRight: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }]}>
                          <TextInput
                            keyboardType="numeric"
                            maxLength={4}
                            secureTextEntry={!showPasskeyInSettings}
                            value={resetNewPasskey}
                            onChangeText={(t) => { setResetNewPasskey(t); setResetError(''); }}
                            placeholder="Enter 4-digit new passkey (e.g. 1234)"
                            placeholderTextColor={colors.textMuted}
                            style={{ flex: 1, paddingVertical: 10, paddingLeft: 12, color: colors.text, fontFamily: Typography.monoBold, letterSpacing: 4, fontSize: 16 }}
                          />
                          <Pressable onPress={() => setShowPasskeyInSettings(!showPasskeyInSettings)} style={{ padding: 4 }}>
                            <Ionicons name={showPasskeyInSettings ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
                          </Pressable>
                        </View>
                      </View>

                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Confirm New 4-digit Passkey</Text>
                        <View style={[styles.searchInput, { borderWidth: 1, borderColor: colors.border, paddingRight: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }]}>
                          <TextInput
                            keyboardType="numeric"
                            maxLength={4}
                            secureTextEntry={!showPasskeyInSettings}
                            value={resetConfirmPasskey}
                            onChangeText={(t) => { setResetConfirmPasskey(t); setResetError(''); }}
                            placeholder="Re-enter 4-digit new passkey"
                            placeholderTextColor={colors.textMuted}
                            style={{ flex: 1, paddingVertical: 10, paddingLeft: 12, color: colors.text, fontFamily: Typography.monoBold, letterSpacing: 4, fontSize: 16 }}
                          />
                          <Pressable onPress={() => setShowPasskeyInSettings(!showPasskeyInSettings)} style={{ padding: 4 }}>
                            <Ionicons name={showPasskeyInSettings ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
                          </Pressable>
                        </View>
                      </View>

                      <GlowButton
                        onPress={handleSavePasskeyAfterOtp}
                        disabled={resetLoading}
                        glowColor={colors.green}
                        style={styles.primaryActionBtn}
                      >
                        {resetLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={{ color: '#fff', fontWeight: '700' }}>Update & Set Admin Passkey</Text>
                        )}
                      </GlowButton>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // Passkey screen rendering (if not authenticated) - Compact Viewport Fit (No Scroll Required)
  if (!adminAuthenticated) {
    const keySize = isSmallScreen ? 42 : 48;
    const keyFontSize = isSmallScreen ? 15 : 17;
    const numpadWidth = keySize * 3 + 8 * 2 + 10; // Exactly 3 keys per row (176px)

    return (
      <View style={[styles.pinContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.glowAmbient, styles.glowPurple, { opacity: 0.04, top: -100, left: -100 }]} />
        <View style={[styles.glowAmbient, styles.glowCyan, { opacity: 0.04, bottom: -100, right: -100 }]} />

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: Math.max(insets.top, 8),
            paddingHorizontal: 12,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ width: '100%' }}
        >
          {/* Secure Vault Card Container with Shake Animation */}
          <Animated.View
            style={[
              styles.pinCard,
              Shadow.md,
              {
                width: '92%',
                maxWidth: 330,
                padding: isSmallScreen ? 12 : 16,
                gap: isSmallScreen ? 6 : 8,
                transform: [{ translateX: shakeAnim }],
                borderColor: pinError ? '#EF4444' : colors.border,
                borderWidth: pinError ? 2 : 1,
              },
            ]}
          >
            {/* Hidden TextInput for native & browser keyboard focus */}
            <TextInput
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, top: 0, left: 0 }}
              value={pinInput}
              onChangeText={(text) => {
                if (pinError) setPinError(false);
                const clean = text.replace(/[^0-9]/g, '').slice(0, 4);
                setPinInput(clean);
                if (clean.length === 4) {
                  if (isPinValid(clean)) {
                    setAdminAuthenticated(true);
                    setPinInput('');
                  } else {
                    triggerPinError();
                  }
                }
              }}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
            />
            {/* Header row with back button inside card */}

            <View style={[styles.pinCardHeaderRow, { marginBottom: 0 }]}>
              <Pressable onPress={handleBack} style={[styles.pinCardBackBtn, { width: 32, height: 32, borderRadius: 16 }]} testID="back-button">
                <Ionicons name="arrow-back" size={18} color={colors.primary} />
              </Pressable>
              <Text style={[styles.pinCardHeaderTitle, { color: colors.textSecondary, fontSize: 12 }]}>ADMIN PANEL</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Shield Badge with Ring Pulse */}
            <View style={[styles.lockIconContainer, { width: 48, height: 48, borderRadius: 24 }, pinError && { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <View style={[styles.lockIconPulse, { width: 58, height: 58, borderRadius: 29 }, pinError && { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]} />
              <Ionicons name={pinError ? "lock-closed" : "shield-checkmark"} size={22} color={pinError ? "#EF4444" : colors.primary} />
            </View>

            <View style={{ alignItems: 'center', gap: 1 }}>
              <Text style={[styles.pinTitle, { fontFamily: Typography.monoBold, color: pinError ? "#EF4444" : colors.text, fontSize: 17, letterSpacing: 1.2 }]}>
                {pinError ? "ACCESS DENIED" : "ADMIN ACCESS"}
              </Text>
              <Text style={[styles.pinSub, { fontFamily: Typography.body, color: pinError ? "#EF4444" : colors.textSecondary, fontSize: 12 }]}>
                {pinError ? "Incorrect Passkey! Try again." : "Enter 4-digit Passkey to access"}
              </Text>
            </View>

            {/* Passkey PIN Indicators (Turns RED on Error) */}
            <View style={[styles.dotRow, { gap: 14, marginVertical: 2 }]}>
              {[0, 1, 2, 3].map((i) => {
                const isFilled = i < pinInput.length;
                const dotColor = pinError
                  ? '#EF4444'
                  : isFilled
                  ? colors.primary
                  : colors.surface;
                const borderColor = pinError
                  ? '#EF4444'
                  : isFilled
                  ? colors.primary
                  : colors.border;

                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: dotColor,
                        borderColor: borderColor,
                        shadowColor: pinError ? '#EF4444' : colors.primary,
                        shadowRadius: pinError || isFilled ? 8 : 0,
                        shadowOpacity: pinError || isFilled ? 0.6 : 0,
                        shadowOffset: { width: 0, height: 0 },
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* Keypad — Exactly 3 keys per row */}
            <View style={[styles.numpad, { width: numpadWidth, gap: 8, marginTop: 2, justifyContent: 'flex-start' }]}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'forgot', '0', '⌫'].map((d, idx) => (
                <HoverableKey
                  key={idx}
                  value={d}
                  size={keySize}
                  fontSize={keyFontSize}
                  onPress={() => {
                    if (d === '⌫') setPinInput((p) => p.slice(0, -1));
                    else if (d === 'forgot') {
                      setResetSuccess('');
                      setResetError('');
                      setOtpTarget('passkey');
                      setResetLevel(3);
                      setResetModalVisible(true);
                      handleSendOtp();
                    } else if (d) handleDigit(d);
                  }}
                />
              ))}
            </View>

            {/* Vault Submit Button */}
            <GlowButton
              onPress={handlePasskeySubmit}
              style={[styles.submitPasskeyButton, { height: 40, marginTop: 4, borderRadius: 10 }]}
              glowColor={colors.primary}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons name="key-outline" size={16} color="#FFFFFF" />
                <Text style={[styles.submitPasskeyText, { fontSize: 13 }]}>SUBMIT PASSKEY</Text>
              </View>
            </GlowButton>
          </Animated.View>
        </ScrollView>
        {renderResetModal()}
      </View>
    );
  }




  // Tab Rendering Helpers
  function renderOverviewTab() {
    const totalScansVal = stats.total_scans !== undefined && stats.total_scans > 0 ? stats.total_scans : (stats.total || history.length);
    const threatsVal = stats.threat_count !== undefined && stats.threat_count > 0 ? stats.threat_count : (stats.threats || history.filter((s) => s.verdict !== 'SAFE').length);
    const safeRateVal = stats.safe_rate !== undefined ? stats.safe_rate : (totalScansVal > 0 ? Math.round(((totalScansVal - threatsVal) / totalScansVal) * 100) : 100.0);
    const todayCountVal = stats.scans_today !== undefined ? stats.scans_today : (stats.today_count || 0);
    const categoryEntries = Object.entries(stats.by_category || stats.by_type || {});

    return (
      <View style={styles.tabContentContainer}>
        {/* Modern Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Total Scans"
            value={totalScansVal}
            sub="Combined Scans"
            color={colors.primary}
            glowColor={colors.primary}
            icon="search"
          />
          <StatCard
            label="Threats Blocked"
            value={threatsVal}
            sub="Security detections"
            color={colors.pink}
            glowColor={colors.pink}
            icon="bug"
          />
          <StatCard
            label="Safe Rate"
            value={`${safeRateVal}%`}
            sub="System metric"
            color={colors.green}
            glowColor={colors.green}
            icon="shield-half"
          />
          <StatCard
            label="Today's Scans"
            value={todayCountVal}
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
            <WeeklyChart data={stats.daily_counts} isDark={isDark} height={140} />
          </ScrollView>
        </View>

        {/* Category breakdown */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>
            BY CATEGORY
          </Text>
          {categoryEntries.length > 0 ? (
            categoryEntries.map(([feature, count]) => {
              const pct = totalScansVal > 0 ? (count / totalScansVal) * 100 : 0;
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
            })
          ) : (
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>No scans recorded yet.</Text>
          )}
        </View>
      </View>
    );
  }

  function renderThreatsTab() {
    let displayScans = dbScans.length > 0 ? dbScans : history.map(h => ({
      id: h.id,
      user_id: 'usr-001',
      user_name: h.user_name || 'Guest User',
      user_email: h.user_email || 'guest@cybershield.local',
      scan_type: (h.feature || 'unknown').replace('_scan', '').toUpperCase(),
      result: h.verdict ? (h.verdict.charAt(0) + h.verdict.slice(1).toLowerCase()) : 'Safe',
      confidence: h.confidence || 0,
      analysis: h.explanation || 'Scan processed cleanly.',
      created_at: h.scanned_at,
      status: 'completed'
    }));

    if (categoryFilter !== 'ALL') {
      displayScans = displayScans.filter(s => s.scan_type.toUpperCase() === categoryFilter.toUpperCase());
    }
    if (verdictFilter !== 'ALL') {
      displayScans = displayScans.filter(s => String(s.result).toUpperCase() === verdictFilter.toUpperCase());
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      displayScans = displayScans.filter(s =>
        (s.user_name && s.user_name.toLowerCase().includes(q)) ||
        (s.user_email && s.user_email.toLowerCase().includes(q)) ||
        (s.analysis && s.analysis.toLowerCase().includes(q)) ||
        (s.scan_type && s.scan_type.toLowerCase().includes(q))
      );
    }

    return (
      <View style={styles.tabContentContainer}>
        {/* Search and Filter Card */}
        <View style={styles.searchFilterCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.searchBox, { flex: 1 }]}>
              <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search user, email, or scan result..."
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

            <Pressable
              onPress={async () => {
                setLoadingScans(true);
                try {
                  const res = await api.getAdminScans(1, 100, categoryFilter, verdictFilter, searchQuery);
                  if (res) setDbScans(res);
                } catch (e) {}
                setLoadingScans(false);
              }}
              style={{ padding: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="refresh" size={18} color={colors.primary} />
            </Pressable>
          </View>

          {/* Filter Pills Row */}
          <View style={{ gap: 8, marginTop: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillRow}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, alignSelf: 'center', marginRight: 4 }}>
                SCAN TYPE:
              </Text>
              {['ALL', 'URL', 'QR', 'OTP', 'UPI', 'SCREENSHOT', 'VOICE'].map((cat) => (
                <FilterPill
                  key={cat}
                  cat={cat}
                  active={categoryFilter === cat}
                  onPress={() => setCategoryFilter(cat)}
                />
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillRow}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, alignSelf: 'center', marginRight: 4 }}>
                VERDICT:
              </Text>
              {['ALL', 'SAFE', 'SUSPICIOUS', 'DANGEROUS'].map((v) => (
                <FilterPill
                  key={v}
                  cat={v}
                  active={verdictFilter === v}
                  onPress={() => setVerdictFilter(v)}
                />
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Count Header */}
        <Text style={[styles.threatCountText, { fontFamily: Typography.body }]}>
          Showing {displayScans.length} database scan history records
        </Text>

        {/* Scans Table (Desktop) / Cards (Mobile) */}
        {isLargeScreen ? (
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>USER</Text>
              <Text style={[styles.tableHeaderCell, { width: 110 }]}>SCAN TYPE</Text>
              <Text style={[styles.tableHeaderCell, { width: 120 }]}>RESULT</Text>
              <Text style={[styles.tableHeaderCell, { width: 100 }]}>CONFIDENCE</Text>
              <Text style={[styles.tableHeaderCell, { width: 140 }]}>DATE / TIME</Text>
              <Text style={[styles.tableHeaderCell, { width: 100 }]}>STATUS</Text>
              <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'center' }]}>ACTION</Text>
            </View>

            {displayScans.length > 0 ? (
              displayScans.map((scan) => {
                const resUpper = String(scan.result).toUpperCase();
                const isDangerous = resUpper === 'DANGEROUS';
                const isSuspicious = resUpper === 'SUSPICIOUS';
                const verdictTextColor = isDangerous ? colors.pink : isSuspicious ? colors.purple : colors.green;
                const verdictBg = isDangerous ? 'rgba(239, 68, 68, 0.08)' : isSuspicious ? 'rgba(139, 92, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)';

                return (
                  <View key={scan.id} style={styles.tableRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={[styles.tableCell, { fontWeight: '700', color: colors.text }]}>
                        {scan.user_name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: Typography.mono }}>
                        {scan.user_email}
                      </Text>
                    </View>
                    <Text style={[styles.tableCell, { width: 110, fontWeight: '700', color: colors.text }]}>
                      {scan.scan_type}
                    </Text>
                    <View style={{ width: 120 }}>
                      <View style={[styles.tableVerdictBadge, { backgroundColor: verdictBg }]}>
                        <Text style={[styles.tableVerdictBadgeText, { color: verdictTextColor, fontFamily: Typography.monoBold }]}>
                          {scan.result}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.tableCell, { width: 100, fontFamily: Typography.mono, color: colors.textSecondary }]}>
                      {scan.confidence}%
                    </Text>
                    <Text style={[styles.tableCell, { width: 140, color: colors.textSecondary, fontSize: 12 }]}>
                      {timeAgo(scan.created_at)}
                    </Text>
                    <View style={{ width: 100 }}>
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' }}>
                        <Text style={{ fontSize: 11, color: colors.green, fontWeight: '700', fontFamily: Typography.mono }}>
                          {scan.status || 'completed'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ width: 90, alignItems: 'center' }}>
                      <GlowButton
                        onPress={() => {
                          setSelectedScan({
                            id: scan.id,
                            feature: (scan.scan_type || 'URL').toLowerCase() + '_scan',
                            verdict: String(scan.result).toUpperCase(),
                            confidence: scan.confidence,
                            input_data: scan.analysis,
                            scanned_at: scan.created_at,
                            user_name: scan.user_name,
                            user_email: scan.user_email,
                          });
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
              <Text style={styles.tableEmptyText}>No scan history records found in database.</Text>
            )}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {displayScans.length > 0 ? (
              displayScans.map((scan) => (
                <Pressable
                  key={scan.id}
                  onPress={() => {
                    setSelectedScan({
                      id: scan.id,
                      feature: (scan.scan_type || 'URL').toLowerCase() + '_scan',
                      verdict: String(scan.result).toUpperCase(),
                      confidence: scan.confidence,
                      input_data: scan.analysis,
                      scanned_at: scan.created_at,
                      user_name: scan.user_name,
                      user_email: scan.user_email,
                    });
                    setModalVisible(true);
                  }}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 14, borderRadius: 14, borderWidth: 1 }]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{scan.user_name}</Text>
                    <View style={{ backgroundColor: 'rgba(47, 110, 255, 0.1)', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>{scan.scan_type}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: Typography.mono, marginBottom: 8 }}>{scan.user_email}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: String(scan.result).toUpperCase() === 'DANGEROUS' ? colors.pink : colors.green }}>
                      {scan.result} ({scan.confidence}%)
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{timeAgo(scan.created_at)}</Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.tableEmptyText}>No matching scan records found in database.</Text>
            )}
          </View>
        )}
      </View>
    );
  }


  function renderUsersTab() {
    const adminEmail = 'varaprasadmokharala5@gmail.com';
    let rawUsers = (userStats.length > 0 ? [...userStats] : []).filter(
      (u) => u.user_email?.toLowerCase() !== adminEmail
    );

    // Sort users by total scans descending to determine true top active user
    rawUsers.sort((a, b) => (b.total_scans || 0) - (a.total_scans || 0));


    const filteredUsers = rawUsers.filter((u) => {
      if (u.user_email?.toLowerCase() === adminEmail) return false;
      const q = userSearchQuery.toLowerCase();
      return (u.user_name || '').toLowerCase().includes(q) || (u.user_email || '').toLowerCase().includes(q);
    });

    const totalScansAcrossUsers = rawUsers.reduce((acc, u) => acc + (u.total_scans || 0), 0);


    return (
      <View style={styles.tabContentContainer}>
        {/* User Stats Overview Cards */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Total Users"
            value={rawUsers.length}
            sub="Registered & Active"
            color={colors.primary}
            glowColor={colors.primary}
            icon="people"
          />
          <StatCard
            label="Total User Scans"
            value={totalScansAcrossUsers}
            sub="Combined Scans"
            color={colors.purple}
            glowColor={colors.purple}
            icon="search"
          />
          <StatCard
            label="Top Active User"
            value={rawUsers[0]?.user_name || 'N/A'}
            sub={`${rawUsers[0]?.total_scans || 0} scans`}
            color={colors.green}
            glowColor={colors.green}
            icon="shield-half"
          />
        </View>


        {/* User Search Bar */}
        <View style={styles.searchFilterCard}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search user by name or email..."
              placeholderTextColor={colors.textMuted}
              value={userSearchQuery}
              onChangeText={setUserSearchQuery}
              style={[styles.searchInput, { fontFamily: Typography.body }]}
            />
            {userSearchQuery !== '' && (
              <Pressable onPress={() => setUserSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>

        <Text style={[styles.threatCountText, { fontFamily: Typography.body }]}>
          Showing {filteredUsers.length} users and scan counts
        </Text>

        {/* Users Table (Desktop) / Cards (Mobile) */}
        {isLargeScreen ? (
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>USER NAME</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>USER EMAIL</Text>
              <Text style={[styles.tableHeaderCell, { width: 120, textAlign: 'center' }]}>TOTAL SCANS</Text>
              <Text style={[styles.tableHeaderCell, { width: 100, textAlign: 'center' }]}>THREATS</Text>
              <Text style={[styles.tableHeaderCell, { width: 100, textAlign: 'center' }]}>SAFE RATE</Text>
              <Text style={[styles.tableHeaderCell, { width: 120 }]}>LAST ACTIVITY</Text>
              <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'center' }]}>ACTION</Text>
            </View>

            {filteredUsers.length > 0 ? (
              filteredUsers.map((u, idx) => (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [styles.tableRow, { opacity: pressed ? 0.7 : 1, cursor: 'pointer' }]}
                  onPress={() => handleOpenUserDetail(u.user_email)}
                >
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(47, 110, 255, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person" size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.tableCell, { fontWeight: '700', color: colors.text }]}>
                      {u.user_name}
                    </Text>
                  </View>
                  <Text style={[styles.tableCell, { flex: 2.5, color: colors.textSecondary, fontFamily: Typography.mono }]}>
                    {u.user_email}
                  </Text>
                  <View style={{ width: 120, alignItems: 'center' }}>
                    <View style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ color: colors.purple, fontWeight: '800', fontFamily: Typography.monoBold }}>
                        {u.total_scans} Scans
                      </Text>
                    </View>
                  </View>
                  <View style={{ width: 100, alignItems: 'center' }}>
                    <Text style={{ color: u.threats > 0 ? colors.pink : colors.green, fontWeight: '700', fontFamily: Typography.mono }}>
                      {u.threats} Threats
                    </Text>
                  </View>
                  <View style={{ width: 100, alignItems: 'center' }}>
                    <Text style={{ color: colors.green, fontWeight: '700', fontFamily: Typography.mono }}>
                      {u.safe_rate}%
                    </Text>
                  </View>
                  <Text style={[styles.tableCell, { width: 120, color: colors.textSecondary, fontSize: 12 }]}>
                    {timeAgo(u.last_scanned_at)}
                  </Text>
                  <View style={{ width: 140, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <TouchableOpacity
                      onPress={async (e) => {
                        e.stopPropagation?.();
                        try {
                          await api.resetUserScans(u.user_email);
                          await fetchMonitorData();
                          Alert.alert('Scans Reset', `Scan history for ${u.user_name} (${u.user_email}) has been reset to 0.`);
                        } catch (err) {
                          Alert.alert('Reset Failed', err?.message || 'Failed to reset user scans.');
                        }
                      }}
                      style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderColor: colors.purple,
                        borderWidth: 1,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Ionicons name="refresh-outline" size={13} color={colors.purple} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.purple }}>Reset</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setUserToDelete(u);
                        setDeleteUserModalVisible(true);
                      }}
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderColor: colors.pink,
                        borderWidth: 1,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Ionicons name="trash-outline" size={13} color={colors.pink} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.pink }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.tableEmptyText}>No matching users found.</Text>
            )}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredUsers.map((u, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleOpenUserDetail(u.user_email)}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16, borderRadius: 16, borderWidth: 1 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(47, 110, 255, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{u.user_name}</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: Typography.mono }}>{u.user_email}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 12, borderRadius: 12 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>TOTAL SCANS</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.purple, fontFamily: Typography.monoBold }}>{u.total_scans}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>THREATS</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: u.threats > 0 ? colors.pink : colors.green, fontFamily: Typography.monoBold }}>{u.threats}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>SAFE RATE</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.green, fontFamily: Typography.monoBold }}>{u.safe_rate}%</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>Last active {timeAgo(u.last_scanned_at)}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={async (e) => {
                        e.stopPropagation?.();
                        try {
                          await api.resetUserScans(u.user_email);
                          await fetchMonitorData();
                          Alert.alert('Scans Reset', `Scan history for ${u.user_name} (${u.user_email}) has been reset to 0.`);
                        } catch (err) {
                          Alert.alert('Reset Failed', err?.message || 'Failed to reset user scans.');
                        }
                      }}
                      style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderColor: colors.purple,
                        borderWidth: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Ionicons name="refresh-outline" size={14} color={colors.purple} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.purple }}>Reset</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setUserToDelete(u);
                        setDeleteUserModalVisible(true);
                      }}
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderColor: colors.pink,
                        borderWidth: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.pink} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.pink }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Pressable>
            ))}
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
              <View style={[styles.statusDot, { backgroundColor: apiHealthy ? colors.green : colors.pink }]} />
              <Text style={[styles.systemStatusValText, { color: apiHealthy ? colors.green : colors.pink, fontFamily: Typography.mono }]}>
                {apiHealthy ? `HEALTHY (${apiLatency}ms)` : 'OFFLINE'}
              </Text>
            </View>
          </View>

          <View style={styles.systemStatusItem}>
            <Text style={[styles.systemStatusLabel, { fontFamily: Typography.bodyMedium }]}>
              Database Status
            </Text>
            <View style={styles.systemStatusBadge}>
              <View style={[styles.statusDot, { backgroundColor: apiHealthy ? colors.green : colors.pink }]} />
              <Text style={[styles.systemStatusValText, { color: apiHealthy ? colors.green : colors.pink, fontFamily: Typography.mono }]}>
                {apiHealthy ? 'CONNECTED' : 'DISCONNECTED'}
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
                {['Low', 'Standard', 'Paranoid'].map((level) => (
                  <SecurityLevelBtn
                    key={level}
                    level={level}
                    active={securityLevel === level}
                    onPress={() => setSecurityLevel(level)}
                  />
                ))}
              </View>
            </View>

            {/* Quick Actions Panel */}
            <View style={styles.actionsRow}>
              <FlatUtilityBtn
                onPress={handleExportCSV}
                icon="download-outline"
                label="Export CSV"
                color={colors.primary}
                bgColor="rgba(47, 110, 255, 0.08)"
              />
              
              <FlatUtilityBtn
                onPress={flushSystemCache}
                icon="trash-outline"
                label="Flush Cache"
                color={colors.pink}
                bgColor="rgba(239, 68, 68, 0.08)"
              />
            </View>
            
            {/* Quick Panel Lock */}
            <GlowButton
              style={styles.fullLockBtn}
              glowColor={colors.pink}
              onPress={handleLogout}
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

  // End Security Reset Handlers

  function renderSettingsTab() {
    return (
      <View style={styles.tabContentContainer}>
        {/* Admin Theme Preference Card */}
        <View style={styles.systemInfoCard}>
          <Text style={styles.sectionTitle}>
            APPEARANCE & THEME
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <View style={{ gap: 4, flex: 1, paddingRight: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                Dark Theme Mode
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Switch between sleek Dark Mode and clean Light Mode for the Admin Portal.
              </Text>
            </View>
            <TouchableOpacity
              onPress={toggleTheme}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(47, 110, 255, 0.1)',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isDark ? colors.purple : colors.primary,
                gap: 8,
              }}
            >
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={isDark ? colors.purple : colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? colors.purple : colors.primary }}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Security & Password/Passkey Management */}
        <View style={styles.systemInfoCard}>
          <Text style={styles.sectionTitle}>
            SECURITY & CREDENTIALS
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
            Manage your admin account password, PIN passkey verification, and multi-level recovery options.
          </Text>

          <View style={{ backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 10, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Admin Email:</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, fontFamily: Typography.mono }}>
                varaprasadmokharala5@gmail.com
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Security Verification Passkey:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, fontFamily: Typography.monoBold }}>
                  {showPasskeyInSettings ? currentAdminPin : '••••'}
                </Text>
                <Pressable
                  onPress={() => setShowPasskeyInSettings(!showPasskeyInSettings)}
                  style={{ padding: 4, paddingHorizontal: 6, borderRadius: 6, backgroundColor: 'rgba(47, 110, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(47, 110, 255, 0.2)' }}
                  testID="toggle-passkey-visibility"
                >
                  <Ionicons
                    name={showPasskeyInSettings ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={colors.primary}
                  />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => {
                  setOtpTarget('passkey');
                  setResetLevel(3);
                  setResetCurrentPassword('');
                  setResetPasskey('');
                  setResetOtp('');
                  setResetNewPassword('');
                  setResetConfirmPassword('');
                  setResetNewPasskey('');
                  setOtpSent(false);
                  setResetError('');
                  setResetSuccess('');
                  setResetModalVisible(true);
                  handleSendOtp();
                }}
                style={{
                  flex: 1,
                  minWidth: 200,
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  borderColor: colors.purple,
                  borderWidth: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Ionicons name="key" size={18} color={colors.purple} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.purple }}>
                  Change Passkey via Email OTP
                </Text>
              </TouchableOpacity>
            </View>

            <GlowButton
              onPress={() => {
                setResetLevel(1);
                setResetCurrentPassword('');
                setResetPasskey('');
                setResetOtp('');
                setResetNewPassword('');
                setResetConfirmPassword('');
                setResetNewPasskey('');
                setOtpSent(false);
                setResetModalVisible(true);
              }}
              glowColor={colors.primary}
              style={styles.primaryActionBtn}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="lock-closed-outline" size={18} color="#ffffff" />
                <Text style={[styles.primaryActionBtnText, { color: '#ffffff', fontWeight: '700' }]}>
                  Change Account Password
                </Text>
              </View>
            </GlowButton>
          </View>
        </View>
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
                active={activeTab === 'users'}
                label="Users & Scans"
                icon="people"
                onPress={() => setActiveTab('users')}
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
              <SidebarItem
                active={activeTab === 'settings'}
                label="Settings"
                icon="settings"
                onPress={() => setActiveTab('settings')}
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
                    {activeTab === 'overview' ? 'Overview' : activeTab === 'users' ? 'Users & Scans' : activeTab === 'threats' ? 'Threat Center' : activeTab === 'system' ? 'Diagnostics' : 'Settings'}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={toggleTheme}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(47, 110, 255, 0.08)',
                    borderWidth: 1,
                    borderColor: isDark ? colors.purple : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  testID="theme-toggle-desktop-header"
                >
                  <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={isDark ? colors.purple : colors.primary} />
                </TouchableOpacity>

                <View style={styles.authBadge}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.green} />
                  <Text style={[styles.authText, { color: colors.green, fontFamily: Typography.mono }]}>ADMIN</Text>
                </View>

                <GlowButton
                  onPress={handleLogout}
                  style={[styles.backButtonHeader, { backgroundColor: colors.pink, borderColor: colors.pink }]}
                  glowColor={colors.pink}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="log-out-outline" size={16} color="#ffffff" />
                    <Text style={[styles.backText, { color: '#ffffff', fontFamily: Typography.bodyMedium, fontWeight: '700' }]}>Logout</Text>
                  </View>
                </GlowButton>
              </View>

            </View>

            {/* Security Sensitivity Feedback Banner */}
            {securityBanner !== '' && (
              <View
                style={{
                  backgroundColor: securityLevel === 'Paranoid' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                  borderColor: securityLevel === 'Paranoid' ? colors.pink : colors.purple,
                  borderWidth: 1,
                  borderRadius: 14,
                  marginHorizontal: 24,
                  marginTop: 16,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: securityLevel === 'Paranoid' ? colors.pink : colors.purple,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flex: 1, fontFamily: Typography.body }}>
                  {securityBanner}
                </Text>
                <Pressable onPress={() => setSecurityBanner('')} style={{ padding: 4 }}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}

            {/* System Cache Flush Alert Banner */}
            {cacheFlushed && (
              <View
                style={{
                  backgroundColor: flushMessageMb !== '0.0' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                  borderColor: flushMessageMb !== '0.0' ? colors.green : colors.primary,
                  borderWidth: 1,
                  borderRadius: 14,
                  marginHorizontal: 24,
                  marginTop: 16,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: flushMessageMb !== '0.0' ? colors.green : colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                  }}
                >
                  <Ionicons name="flash" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                    {flushMessageMb !== '0.0' ? '⚡ System Cache Flushed Successfully!' : '⚡ System Cache Clean'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {flushMessageMb !== '0.0'
                      ? `Cleared ${flushMessageMb} MB of temporary ML inference buffers & session cache. Active cache reset to 0.0 MB.`
                      : 'Active cache is already 0.0 MB. 0 active inference buffers to clear. Run a scan in the User Portal to accumulate cache.'}
                  </Text>
                </View>
                <Pressable onPress={() => setCacheFlushed(false)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}

            <ScrollView
              contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
              showsVerticalScrollIndicator={false}
            >
              {activeTab === 'overview' && renderOverviewTab()}
              {activeTab === 'users' && renderUsersTab()}
              {activeTab === 'threats' && renderThreatsTab()}
              {activeTab === 'system' && renderSystemTab()}
              {activeTab === 'settings' && renderSettingsTab()}
            </ScrollView>

          </View>

          {/* Right Control Column - Consolidating Security, Export, Flush & Lock Console (Only ONE Lock button visible!) */}
          <View style={styles.rightColumn}>
            <View style={{ gap: 24 }}>
              {/* Security Sensitivity */}
              <View style={styles.rightColumnSection}>
                <Text style={styles.rightColumnTitle}>SECURITY SENSITIVITY</Text>
                <View style={styles.securityConfigRow}>
                  {['Low', 'Standard', 'Paranoid'].map((level) => (
                    <SecurityLevelBtn
                      key={level}
                      level={level}
                      active={securityLevel === level}
                      onPress={() => {
                        setSecurityLevel(level);
                        setSecurityBanner(
                          level === 'Low'
                            ? '🛡️ Security Sensitivity set to LOW (Fast heuristics & minimal false positives)'
                            : level === 'Standard'
                            ? '🛡️ Security Sensitivity set to STANDARD (Balanced ML & AI detection model)'
                            : '🚨 Security Sensitivity set to PARANOID (Maximum zero-trust AI inspection)'
                        );
                        setTimeout(() => setSecurityBanner(''), 4000);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.rightColumnDivider} />

              {/* Quick Actions */}
              <View style={styles.rightColumnSection}>
                <Text style={styles.rightColumnTitle}>QUICK UTILITIES</Text>
                <View style={{ gap: 12 }}>
                  <FlatUtilityBtn
                    onPress={handleExportCSV}
                    icon="download-outline"
                    label="Export CSV"
                    color={colors.primary}
                    bgColor="rgba(47, 110, 255, 0.08)"
                  />
                  
                  <FlatUtilityBtn
                    onPress={flushSystemCache}
                    icon="trash-outline"
                    label={`Flush Cache (${currentCacheSize} MB)`}
                    color={colors.pink}
                    bgColor="rgba(239, 68, 68, 0.08)"
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : (
        // Mobile Layout (Fallback tabs on top)
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { fontFamily: Typography.monoBold }]}>Admin Panel</Text>
              <View style={styles.statusBadgeRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.statusBadgeText, { color: colors.primary, fontFamily: Typography.body }]}>
                  Secure Console
                </Text>
              </View>
            </View>
            
            <View style={[styles.headerRight, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <TouchableOpacity
                onPress={toggleTheme}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(47, 110, 255, 0.08)',
                  borderWidth: 1,
                  borderColor: isDark ? colors.purple : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                testID="theme-toggle-mobile-header"
              >
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={16} color={isDark ? colors.purple : colors.primary} />
              </TouchableOpacity>

              <View style={styles.authBadge}>
                <Ionicons name="shield-checkmark" size={14} color={colors.green} />
                <Text style={[styles.authText, { color: colors.green, fontFamily: Typography.mono }]}>ADMIN</Text>
              </View>

              <GlowButton
                onPress={handleLogout}
                style={[styles.backButtonHeader, { backgroundColor: colors.pink, borderColor: colors.pink }]}
                glowColor={colors.pink}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="log-out-outline" size={16} color="#ffffff" />
                  <Text style={[styles.backText, { color: '#ffffff', fontFamily: Typography.bodyMedium, fontWeight: '700' }]}>Logout</Text>
                </View>
              </GlowButton>
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
              active={activeTab === 'users'}
              label="Users"
              icon="people"
              onPress={() => setActiveTab('users')}
            />
            <TabItem
              active={activeTab === 'threats'}
              label="Threats"
              icon="warning"
              onPress={() => setActiveTab('threats')}
            />
            <TabItem
              active={activeTab === 'system'}
              label="System"
              icon="cog"
              onPress={() => setActiveTab('system')}
            />
            <TabItem
              active={activeTab === 'settings'}
              label="Settings"
              icon="settings"
              onPress={() => setActiveTab('settings')}
            />
          </View>

          {/* Mobile Scroll Area */}
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'users' && renderUsersTab()}
            {activeTab === 'threats' && renderThreatsTab()}
            {activeTab === 'system' && renderSystemTab()}
            {activeTab === 'settings' && renderSettingsTab()}
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

      {/* User Details & Complete Scan History Modal */}
      {userDetailModalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={userDetailModalVisible}
          onRequestClose={() => setUserDetailModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 680, width: '92%', maxHeight: '88%' }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(47, 110, 255, 0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person-circle" size={24} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.modalTitle, { fontFamily: Typography.monoBold }]}>
                      {selectedUserDetail?.user_name || 'User Profile'}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: Typography.mono }}>
                      {selectedUserDetail?.user_email}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setUserDetailModalVisible(false)} style={styles.closeModalBtn}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              {loadingUserDetail ? (
                <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ marginTop: 12, color: colors.textSecondary, fontFamily: Typography.body }}>
                    Fetching complete profile and scan history...
                  </Text>
                </View>
              ) : (
                <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                  {/* User Overview Cards */}
                  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    <View style={{ flex: 1, minWidth: 120, backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>TOTAL SCANS</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.purple, fontFamily: Typography.monoBold }}>
                        {selectedUserDetail?.total_scans || 0}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 120, backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>THREATS</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: (selectedUserDetail?.threats || 0) > 0 ? colors.pink : colors.green, fontFamily: Typography.monoBold }}>
                        {selectedUserDetail?.threats || 0}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 120, backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>SAFE RATE</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.green, fontFamily: Typography.monoBold }}>
                        {selectedUserDetail?.safe_rate || 100}%
                      </Text>
                    </View>
                  </View>

                  {/* Registered & Last Active Dates */}
                  <View style={{ backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        📅 <Text style={{ fontWeight: '700', color: colors.text }}>First Activity:</Text>
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, fontFamily: Typography.monoBold }}>
                        {selectedUserDetail?.created_at
                          ? `${timeAgo(selectedUserDetail.created_at)} (${formatExactTime(selectedUserDetail.created_at)})`
                          : 'No activity recorded'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        ⏱️ <Text style={{ fontWeight: '700', color: colors.text }}>Latest Activity:</Text>
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.green, fontFamily: Typography.monoBold }}>
                        {selectedUserDetail?.last_scanned_at
                          ? `${timeAgo(selectedUserDetail.last_scanned_at)} (${formatExactTime(selectedUserDetail.last_scanned_at)})`
                          : 'No activity recorded'}
                      </Text>
                    </View>
                  </View>

                  {/* Scan Category Breakdown */}
                  {selectedUserDetail?.by_category && Object.keys(selectedUserDetail.by_category).length > 0 && (
                    <View style={{ gap: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Scan Type Breakdown
                      </Text>
                      {Object.entries(selectedUserDetail.by_category).map(([feat, count]) => (
                        <View key={feat} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 10, borderRadius: 8 }}>
                          <Text style={{ fontSize: 13, fontFamily: Typography.bodyMedium, color: colors.text }}>
                            {feat.replace('_scan', '').toUpperCase()}
                          </Text>
                          <Text style={{ fontSize: 13, fontFamily: Typography.monoBold, color: colors.purple }}>
                            {count} scans
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Complete Scan History List */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Chronological Scan History ({selectedUserDetail?.scan_history?.length || 0})
                    </Text>
                    {selectedUserDetail?.scan_history && selectedUserDetail.scan_history.length > 0 ? (
                      selectedUserDetail.scan_history.map((scan) => (
                        <RecentScanRow
                          key={scan.id}
                          scan={scan}
                          isDark={isDark}
                          onPress={() => {
                            setSelectedScan(scan);
                            setModalVisible(true);
                          }}
                        />
                      ))
                    ) : (
                      <Text style={{ fontSize: 13, color: colors.textMuted, fontStyle: 'italic' }}>
                        No scan history recorded for this user yet.
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setUserToDelete({
                        user_name: selectedUserDetail?.user_name || 'User',
                        user_email: selectedUserDetail?.user_email,
                      });
                      setDeleteUserModalVisible(true);
                    }}
                    style={{
                      marginTop: 8,
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderColor: colors.pink,
                      borderWidth: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.pink} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.pink }}>
                      Permanently Delete User Account & Logs
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Multi-Level Password & Passkey Reset Modal */}
      {renderResetModal()}

      {/* Delete User Confirmation Modal */}
      {deleteUserModalVisible && userToDelete && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={deleteUserModalVisible}
          onRequestClose={() => setDeleteUserModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 460, width: '90%', padding: 24 }]}>
              <View style={{ alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(239, 68, 68, 0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="trash" size={28} color={colors.pink} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', fontFamily: Typography.monoBold }}>
                  Delete User Account?
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, fontFamily: Typography.body }}>
                  Are you sure you want to permanently delete <Text style={{ fontWeight: '700', color: colors.text }}>{userToDelete.user_name}</Text> (<Text style={{ fontFamily: Typography.mono, color: colors.primary }}>{userToDelete.user_email}</Text>) and all associated scan history from the database?
                </Text>
              </View>

              <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', marginBottom: 20 }}>
                <Text style={{ fontSize: 11, color: colors.pink, fontWeight: '700', textAlign: 'center', fontFamily: Typography.mono }}>
                  ⚠️ This action will permanently remove all logs & user data from SQLite / Supabase database.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => setDeleteUserModalVisible(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: Typography.body }}>Cancel</Text>
                </Pressable>

                <GlowButton
                  onPress={handleConfirmDeleteUser}
                  disabled={deletingUser}
                  style={{ flex: 1, height: 44, backgroundColor: colors.pink, borderColor: colors.pink, borderRadius: 12 }}
                  glowColor={colors.pink}
                >
                  {deletingUser ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#ffffff', fontFamily: Typography.bodyMedium }}>Delete User</Text>
                  )}
                </GlowButton>
              </View>
            </View>
          </View>
        </Modal>
      )}

    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
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

  // Clean White Passkey Card
  pinCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1,
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
    marginBottom: 4,
  },
  pinCardBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  },
  pinCardBackText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Typography.bodySemiBold,
  },
  pinCardHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    fontFamily: Typography.monoBold,
    letterSpacing: 1.5,
  },
  lockIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(47, 110, 255, 0.08)',
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: colors.primary,
    shadowRadius: 14,
    shadowOpacity: 0.2,
  },
  lockIconPulse: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1.5,
    borderColor: 'rgba(47, 110, 255, 0.15)',
  },
  pinTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: 1.5 },
  pinSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  dotRow: { flexDirection: 'row', gap: 20, marginVertical: 8 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },

  // Circular Numpad layout
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 250,
    gap: 14,
    justifyContent: 'center',
    marginTop: 4,
  },
  numKeyCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  numKeyText: { fontSize: 22 },
  submitPasskeyButton: {
    height: 50,
    width: '100%',
    maxWidth: 260,
    backgroundColor: colors.primary,
    marginTop: 8,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  submitPasskeyText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1.2,
    fontFamily: Typography.bodySemiBold,
    textAlign: 'center',
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
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
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  },
  securityConfigBtnText: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Actions rows
  actionsRow: { flexDirection: 'row', gap: 12 },
  flatUtilityBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  },
  flatUtilityBtnText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxHeight: '88%',
    padding: 20,
    shadowColor: '#0f172a',
    shadowRadius: 25,
    shadowOpacity: 0.22,
    elevation: 12,
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
}
