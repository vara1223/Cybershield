import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Spacing } from '../constants/theme';
import VerdictBadge from './VerdictBadge';
import { FEATURE_LABELS } from '../services/mockData';

const FEATURE_ICONS = {
  url_scan: 'link',
  otp_scan: 'chatbubble-ellipses',
  upi_scan: 'card',
  qr_scan: 'qr-code',
  screenshot_scan: 'image',
  voice_scan: 'mic',
};

function timeAgo(isoString) {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function RecentScanRow({ scan, onPress, isDark = false, showBorder = true }) {
  const colors = isDark ? Colors.dark : Colors.light;
  const iconName = FEATURE_ICONS[scan.feature] || 'scan';
  const featureLabel = FEATURE_LABELS[scan.feature] || scan.feature;
  const verdictColor = Colors.verdict[scan.verdict] || Colors.verdict.SAFE;
  const iconBg = isDark ? Colors.verdictBgDark[scan.verdict] || colors.surface : Colors.verdictBg[scan.verdict] || colors.surface;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.row,
        { borderBottomColor: colors.border },
        showBorder && styles.border,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color={verdictColor} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.text, fontFamily: Typography.bodyMedium }]} numberOfLines={1}>
          {scan.input_data}
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary, fontFamily: Typography.body }]}>
          {featureLabel} · {timeAgo(scan.scanned_at)}
        </Text>
      </View>
      <VerdictBadge verdict={scan.verdict} size="sm" isDark={isDark} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm + 4,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
  },
  sub: {
    fontSize: 12,
  },
});
