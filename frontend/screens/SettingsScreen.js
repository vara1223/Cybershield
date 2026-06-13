import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import useScanStore from '../store/useScanStore';
import { useAuth } from '../context/AuthContext';

const SettingsScreen = () => {
  const isDark = useScanStore((s) => s.isDark);
  const colors = isDark ? Colors.dark : Colors.light;
  const navigation = useNavigation();
  const { user, profile } = useAuth();
  const createdAt = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : null;

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: Spacing.lg, backgroundColor: colors.background }}>
      <View style={{ marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.sm }}>
          <Ionicons name="arrow-back-outline" size={20} color={colors.primary} />
          <Text style={{ marginLeft: Spacing.xs, color: colors.primary, fontFamily: Typography.body }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontFamily: Typography.bodyBold, color: colors.text }}>Settings</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={{ backgroundColor: colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginBottom: Spacing.md }}>
        <Text style={{ fontSize: 16, fontFamily: Typography.bodyMedium, color: colors.text, marginBottom: Spacing.sm }}>Profile & account</Text>
        <Text style={{ fontSize: 14, fontFamily: Typography.body, color: colors.textSecondary, marginBottom: Spacing.xs }}>Manage your account info and access details below.</Text>
      </View>

      <View style={{ backgroundColor: colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, marginBottom: Spacing.lg }}>
        <Text style={{ fontSize: 15, fontFamily: Typography.bodyMedium, color: colors.text, marginBottom: Spacing.sm }}>Name</Text>
        <Text style={{ fontSize: 14, fontFamily: Typography.body, color: colors.textSecondary, marginBottom: Spacing.md }}>{profile?.full_name || user?.email || 'User'}</Text>

        <Text style={{ fontSize: 15, fontFamily: Typography.bodyMedium, color: colors.text, marginBottom: Spacing.sm }}>Email</Text>
        <Text style={{ fontSize: 14, fontFamily: Typography.body, color: colors.textSecondary, marginBottom: Spacing.md }}>{profile?.email || user?.email}</Text>

        {createdAt ? (
          <>
            <Text style={{ fontSize: 15, fontFamily: Typography.bodyMedium, color: colors.text, marginBottom: Spacing.sm }}>Member since</Text>
            <Text style={{ fontSize: 14, fontFamily: Typography.body, color: colors.textSecondary }}>{createdAt}</Text>
          </>
        ) : null}
      </View>

      <View style={{ marginTop: Spacing.lg, backgroundColor: colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, padding: Spacing.md }}>
        <Text style={{ fontSize: 16, fontFamily: Typography.bodyMedium, color: colors.text, marginBottom: Spacing.sm }}>App preferences</Text>
        <Text style={{ fontSize: 14, fontFamily: Typography.body, color: colors.textSecondary }}>Theme, notifications, and scan preferences will be shown here once configured.</Text>
      </View>
    </ScrollView>
  );
};

export default SettingsScreen;
