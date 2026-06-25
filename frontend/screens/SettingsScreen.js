import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Shadow, Typography } from '../constants/theme';
import useScanStore from '../store/useScanStore';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestNotificationPermission } from '../utils/notifications';

// ─── Reusable menu row ────────────────────────────────────────────────────────
function MenuRow({ iconName, iconColor, iconBg, label, sub, right, onPress, showBorder, colors }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => onPress && Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  const inner = (
    <Animated.View
      style={[
        styles.menuRow,
        { transform: [{ scale }] },
        showBorder && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={17} color={iconColor} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
        {sub ? <Text style={[styles.menuSub, { color: colors.textSecondary }]}>{sub}</Text> : null}
      </View>
      {right || (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null)}
    </Animated.View>
  );

  if (!onPress) return inner;
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      {inner}
    </TouchableOpacity>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children, colors }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{title}</Text> : null}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets                  = useSafeAreaInsets();
  const isDark                  = useScanStore((s) => s.isDark);
  const toggleTheme             = useScanStore((s) => s.toggleTheme);
  const notificationsEnabled    = useScanStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useScanStore((s) => s.setNotificationsEnabled);

  const colors     = isDark ? Colors.dark : Colors.light;
  const navigation = useNavigation();
  const { user, profile, avatarUri, updateProfileName, updateAvatar, signOut, authLoading } = useAuth();

  // ── Local state ─────────────────────────────────────────────────────────────
  const [nameInput,    setNameInput]    = useState(profile?.full_name || '');
  const [updatingName, setUpdatingName] = useState(false);
  const [editing,      setEditing]      = useState(false);
  const [saveStatus,   setSaveStatus]   = useState('idle'); // idle | saving | saved
  const [uploadingPic, setUploadingPic] = useState(false);

  // Animated values
  const savedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!editing) setNameInput(profile?.full_name || '');
  }, [profile, editing]);

  // ── Pick image ───────────────────────────────────────────────────────────────
  const handlePickImage = async () => {
    const launchPicker = async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setUploadingPic(true);
        try {
          await updateAvatar(result.assets[0].uri);
        } catch (err) {
          Alert.alert('Upload Failed', 'Could not save profile picture. Please try again.');
        } finally {
          setUploadingPic(false);
        }
      }
    };

    try {
      // 1. On Web, launch directly
      if (Platform.OS === 'web') {
        await launchPicker();
        return;
      }

      // 2. On Native, check existing permissions
      const permissionCheck = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      if (permissionCheck.status === 'granted') {
        await launchPicker();
        return;
      }

      // 3. On Android, try direct launch (runs without runtime permission on Android 11+)
      if (Platform.OS === 'android') {
        try {
          await launchPicker();
          return;
        } catch (err) {
          // Fall through to permission request
        }
      }

      // 4. Request permission on native
      const permissionRequest = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionRequest.status === 'granted') {
        await launchPicker();
      } else {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library in settings to set a profile picture.'
        );
      }
    } catch (err) {
      Alert.alert('Upload Failed', 'Could not open image picker.');
    }
  };

  // ── Take photo ───────────────────────────────────────────────────────────────
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access to take a profile photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setUploadingPic(true);
      try {
        await updateAvatar(result.assets[0].uri);
      } catch (err) {
        Alert.alert('Upload Failed', 'Could not save profile picture. Please try again.');
      } finally {
        setUploadingPic(false);
      }
    }
  };

  // ── Show picker options ───────────────────────────────────────────────────────
  const showAvatarOptions = () => {
    if (Platform.OS === 'web') {
      // For web, direct to library picker since taking a photo is not typical/needed on desktop browsers
      handlePickImage();
    } else {
      Alert.alert('Profile Picture', 'Choose an option', [
        { text: '📷  Take Photo', onPress: handleTakePhoto },
        { text: '🖼️  Choose from Library', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  // ── Save name ────────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { Alert.alert('Empty Name', 'Please enter a valid name.'); return; }
    setUpdatingName(true);
    setSaveStatus('saving');
    try {
      await updateProfileName(trimmed);
      setSaveStatus('saved');
      Animated.sequence([
        Animated.timing(savedAnim, { toValue: 1, duration: 250, useNativeDriver: true, easing: Easing.out(Easing.back(1.2)) }),
        Animated.delay(1500),
        Animated.timing(savedAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setSaveStatus('idle');
        setEditing(false);
        savedAnim.setValue(0);
      });
    } catch (err) {
      setSaveStatus('idle');
      Alert.alert('Update Failed', err.message || 'Could not update name.');
    } finally {
      setUpdatingName(false);
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    const performLogout = async () => {
      try {
        await signOut();
      } catch (err) {
        if (Platform.OS === 'web') {
          window.alert(err.message || 'Could not log out.');
        } else {
          Alert.alert('Error', err.message || 'Could not log out.');
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Are you sure you want to log out?');
      if (confirmLogout) {
        performLogout();
      }
    } else {
      Alert.alert('Log Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out', style: 'destructive',
          onPress: performLogout,
        },
      ]);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Guest User';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  const isSaving = saveStatus === 'saving';
  const isSaved = saveStatus === 'saved';

  const badgeStyle = {
    opacity: savedAnim,
    transform: [
      {
        scale: savedAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        }),
      },
    ],
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* ── Header / Top Nav ────────────────────────────────────── */}
      <View style={[styles.topNav, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile card ──────────────────────────────────────────── */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#4361EE' }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{displayName}</Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email || 'guest@cybershield.local'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => { setEditing((v) => !v); setSaveStatus('idle'); }}
            style={[styles.editBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <Ionicons name={editing ? 'close' : 'pencil-outline'} size={15} color={colors.text} />
          </TouchableOpacity>
        </View>

      {/* ── Inline name editor ─────────────────────────────────────── */}
      {(editing || isSaved) && (
        <View style={[styles.editCard, { backgroundColor: colors.card, borderColor: isSaved ? '#10B981' : colors.border }]}>
          <View style={styles.editLabelRow}>
            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Full Name</Text>
            <Animated.View style={[styles.savedBadge, badgeStyle]}>
              <Ionicons name="checkmark-circle" size={13} color="#10B981" />
              <Text style={styles.savedBadgeText}>Saved!</Text>
            </Animated.View>
          </View>
          <View style={styles.editRow}>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Enter full name"
              placeholderTextColor={colors.textMuted}
              style={[styles.textInput, { color: colors.text, borderColor: isSaved ? '#10B981' : colors.border, backgroundColor: colors.surface }]}
              autoFocus={!isSaved}
              editable={!isSaved && !isSaving}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <TouchableOpacity
              onPress={handleSaveName}
              disabled={isSaving || isSaved}
              style={[styles.saveBtn, isSaved && styles.saveBtnDone]}
              activeOpacity={0.85}
            >
              {isSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : isSaved
                  ? <Ionicons name="checkmark" size={20} color="#fff" />
                  : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Preferences ──────────────────────────────────────────── */}
      <Section title="PREFERENCES" colors={colors}>
        <MenuRow
          iconName="moon-outline"
          iconColor="#8B5CF6"
          iconBg={isDark ? '#2E1065' : '#F5F3FF'}
          label="Dark Mode"
          sub={isDark ? 'Currently enabled' : 'Currently disabled'}
          showBorder
          colors={colors}
          right={
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D1D5DB', true: '#4361EE' }}
              thumbColor="#ffffff"
            />
          }
        />
        <MenuRow
          iconName="notifications-outline"
          iconColor="#10B981"
          iconBg={isDark ? '#052E16' : '#ECFDF5'}
          label="Scan Alerts"
          sub="Notify when scan results are ready"
          colors={colors}
          right={
            <Switch
              value={notificationsEnabled}
              onValueChange={async (val) => {
                if (val) {
                  const granted = await requestNotificationPermission();
                  if (!granted) {
                    Alert.alert(
                      'Permission Denied',
                      'Please enable notifications in your phone settings to receive scan alerts.'
                    );
                    return;
                  }
                }
                setNotificationsEnabled(val);
              }}
              trackColor={{ false: '#D1D5DB', true: '#10B981' }}
              thumbColor="#ffffff"
            />
          }
        />
      </Section>

      {/* ── Quick Access ─────────────────────────────────────────── */}
      <Section title="QUICK ACCESS" colors={colors}>
        {[
          { icon: 'link-outline',    color: '#4361EE', bg: isDark ? '#1E2A50' : '#EEF2FF', label: 'URL Scan',     sub: 'Check suspicious links',     screen: 'URLScan' },
          { icon: 'qr-code-outline', color: '#10B981', bg: isDark ? '#052E16' : '#ECFDF5', label: 'QR Scanner',   sub: 'Verify QR code destinations', screen: 'QRScan' },
          { icon: 'mic-outline',     color: '#EF4444', bg: isDark ? '#450A0A' : '#FEF2F2', label: 'Voice Scan',   sub: 'Detect voice-based scams',    screen: 'VoiceScan' },
          { icon: 'time-outline',    color: '#F59E0B', bg: isDark ? '#451A03' : '#FFFBEB', label: 'Scan History', sub: 'View past scan results',      screen: 'History' },
        ].map((item, i) => (
          <MenuRow
            key={item.label}
            iconName={item.icon}
            iconColor={item.color}
            iconBg={item.bg}
            label={item.label}
            sub={item.sub}
            showBorder={i < 3}
            onPress={() => navigation.navigate(item.screen)}
            colors={colors}
          />
        ))}
      </Section>

      {/* ── About ───────────────────────────────────────────────── */}
      <Section title="ABOUT" colors={colors}>
        <MenuRow
          iconName="shield-checkmark-outline"
          iconColor="#4361EE"
          iconBg={isDark ? '#1E2A50' : '#EEF2FF'}
          label="App Version"
          sub="CyberShield v2.0.0"
          showBorder
          colors={colors}
        />
        <MenuRow
          iconName="flash-outline"
          iconColor="#10B981"
          iconBg={isDark ? '#052E16' : '#ECFDF5'}
          label="Security Engine"
          sub="AI Shield v3 · Updated June 2026"
          colors={colors}
        />
      </Section>

      {/* ── Logout ──────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={handleLogout}
        disabled={authLoading}
        activeOpacity={0.8}
        style={[styles.logoutBtn, { borderColor: isDark ? '#450A0A' : '#FCA5A5', backgroundColor: isDark ? '#1A0808' : '#FFF5F5' }]}
      >
        {authLoading
          ? <ActivityIndicator color="#EF4444" />
          : (
            <View style={styles.logoutInner}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              <Text style={styles.logoutText}>Log Out</Text>
            </View>
          )
        }
      </TouchableOpacity>

    </ScrollView>
  </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, gap: 16 },

  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Typography.monoBold,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, borderRadius: 16, borderWidth: 1, padding: 16,
    ...Shadow.sm,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  profileInfo: { flex: 1, gap: 3 },
  profileName:  { fontSize: 16, fontWeight: '700' },
  profileEmail: { fontSize: 12 },
  editBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },

  // Edit name card
  editCard: {
    borderRadius: 14, borderWidth: 1.5,
    padding: 14, gap: 10, ...Shadow.sm,
  },
  editLabelRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editLabel:      { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  savedBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  savedBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  editRow:        { flexDirection: 'row', gap: 10, alignItems: 'center' },
  textInput: {
    flex: 1, height: 44, borderRadius: 10,
    borderWidth: 1.5, paddingHorizontal: 12, fontSize: 14,
  },
  saveBtn: {
    height: 44, width: 72, borderRadius: 10,
    backgroundColor: '#4361EE', alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDone:    { backgroundColor: '#10B981' },
  saveBtnText:    { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Section
  section:      { gap: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 4 },
  sectionCard:  { borderRadius: 14, borderWidth: 1, overflow: 'hidden', ...Shadow.sm },

  // Menu row
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  menuIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuText:     { flex: 1, gap: 2 },
  menuLabel:    { fontSize: 14, fontWeight: '600' },
  menuSub:      { fontSize: 12 },

  // Logout
  logoutBtn: {
    height: 48, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  logoutInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoutText:  { color: '#EF4444', fontSize: 15, fontWeight: '700' },

  container: { flex: 1 },
  avatarTouchable: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  avatarWrap: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
  },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: '#4361EE',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  changePhotoText: {
    fontSize: 11,
    color: '#4361EE',
    fontWeight: '600',
  },
});