import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Radius, Shadow, Spacing } from '../constants/theme';

export default function StatCard({ value, label, colorKey = 'blue', isDark = false }) {
  const colors = Colors.stat[colorKey];
  const bg = isDark ? colors.darkBg : colors.bg;
  const textColor = isDark ? colors.darkText : colors.text;
  const cardBg = isDark ? Colors.dark.card : Colors.light.card;

  return (
    <View style={[styles.card, { backgroundColor: bg }, Shadow.sm]}>
      <Text style={[styles.value, { color: textColor, fontFamily: Typography.monoBold }]}>
        {value}
      </Text>
      <Text style={[styles.label, { color: isDark ? Colors.dark.textSecondary : Colors.light.textSecondary, fontFamily: Typography.body }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'flex-start',
    minHeight: 80,
    justifyContent: 'space-between',
  },
  value: {
    fontSize: 28,
    lineHeight: 32,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
  },
});
