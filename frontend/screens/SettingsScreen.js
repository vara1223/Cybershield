import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import useScanStore from '../store/useScanStore';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const isDark = useScanStore((s) => s.isDark);
  const toggleTheme = useScanStore((s) => s.toggleTheme);
  const notificationsEnabled = useScanStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useScanStore((s) => s.setNotificationsEnabled);
  
  const colors = isDark ? Colors.dark : Colors.light;
  const navigation = useNavigation();
  const { user, profile, updateProfileName, signOut, authLoading } = useAuth();
  
  const [nameInput, setNameInput] = useState(profile?.full_name || '');
  const [updatingName, setUpdatingName] = useState(false);

  useEffect(() => {
    setNameInput(profile?.full_name || '');
  }, [profile]);

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      Alert.alert('Empty Name', 'Please enter a valid name.');
      return;
    }
    setUpdatingName(true);
    try {
      await updateProfileName(nameInput);
      Alert.alert('Success', 'Profile name updated successfully.');
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Failed to update profile name.');
    } finally {
      setUpdatingName(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err) {
      Alert.alert('Logout Error', err.message || 'Could not log out.');
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: Typography.monoBold }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Profile Name Edit Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
        <Text style={[styles.cardTitle, { color: colors.text, fontFamily: Typography.bodyMedium }]}>Profile settings</Text>
        
        <View style={styles.inputSection}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name</Text>
          <View style={styles.row}>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Enter name"
              placeholderTextColor="#94a3b8"
              style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
            <TouchableOpacity
              onPress={handleSaveName}
              disabled={updatingName}
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              {updatingName ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.readOnlySection}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email</Text>
          <Text style={[styles.emailValue, { color: colors.text }]}>{user?.email || 'guest@cybershield.local'}</Text>
        </View>
      </View>

      {/* App Preferences Card (Theme & Notifications) */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
        <Text style={[styles.cardTitle, { color: colors.text, fontFamily: Typography.bodyMedium }]}>Preferences</Text>
        
        {/* Toggle Theme Row */}
        <View style={[styles.rowItem, { borderBottomColor: colors.border }]}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
              <Ionicons name="moon" size={18} color="#8b5cf6" />
            </View>
            <View style={styles.rowTexts}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Dark Mode</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Switch between dark and light themes</Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#cbd5e1', true: '#8b5cf6' }}
            thumbColor={isDark ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        {/* Scan Notifications Row */}
        <View style={styles.rowItem}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Ionicons name="notifications" size={18} color="#10b981" />
            </View>
            <View style={styles.rowTexts}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Scan Alerts</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Notify when scan results are ready</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#cbd5e1', true: '#10b981' }}
            thumbColor={notificationsEnabled ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Logout Card */}
      <TouchableOpacity
        onPress={handleLogout}
        disabled={authLoading}
        style={[styles.logoutBtn, { borderColor: '#ef4444' }]}
        activeOpacity={0.8}
      >
        {authLoading ? (
          <ActivityIndicator color="#ef4444" />
        ) : (
          <View style={styles.logoutContent}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </View>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    cursor: 'pointer',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  inputSection: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  saveBtn: {
    width: 70,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  readOnlySection: {
    gap: 4,
    marginTop: 4,
  },
  emailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 11,
  },
  logoutBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginTop: Spacing.sm,
    cursor: 'pointer',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
