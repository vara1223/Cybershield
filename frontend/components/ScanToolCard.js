import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Shadow, Spacing } from '../constants/theme';

export default function ScanToolCard({ icon, label, accentColor, onPress, isDark = false }) {
  const colors = isDark ? Colors.dark : Colors.light;
  
  // Custom pastel-colored backgrounds and borders matching their tool categories
  const cardBg = accentColor + (isDark ? '20' : '0F'); // ~12% opacity in dark, ~6% in light
  const cardBorder = accentColor + (isDark ? '65' : '40'); // ~40% opacity in dark, ~25% in light

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
          shadowColor: accentColor,
          shadowOpacity: isDark ? 0.2 : 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: accentColor }]}>
        <Ionicons name={icon} size={20} color="#ffffff" />
      </View>
      <Text style={[styles.label, { color: colors.text, fontFamily: Typography.bodyMedium }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    gap: 12,
    padding: 10,
    height: 54,
    width: '100%',
    cursor: 'pointer',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    textAlign: 'left',
    flex: 1,
  },
});
