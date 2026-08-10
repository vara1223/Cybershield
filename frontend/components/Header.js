import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, Spacing } from '../constants/theme';
import BackButton from './BackButton';

/**
 * Shared top header — dark navy with a 1px cyan accent line at bottom.
 * Used by QRScan, VoiceScan, History, etc.
 */
export default function Header({ title, subtitle, isDark = false, onBack, rightAction, navigation }) {
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;

  const accentLine = isDark ? '#00D4FF' : '#4361EE';
  const headerBg   = isDark ? '#0A0F1E' : '#FFFFFF';

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 6,
          backgroundColor: headerBg,
          borderBottomColor: isDark ? '#1E2D45' : '#D1D9F0',
        },
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.row}>
        {(onBack || navigation) && (
          <BackButton absolute={false} onPress={onBack} navigation={navigation} />
        )}
        <View style={styles.titleWrap}>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: isDark ? '#00D4FF' : '#4361EE' }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {rightAction && <View>{rightAction}</View>}
      </View>

      {/* Cyan accent line */}
      <View style={[styles.accentLine, { backgroundColor: accentLine }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  titleWrap: { flex: 1, gap: 1 },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  accentLine: {
    height: 1.5,
    width: 32,
    borderRadius: 2,
    marginTop: 10,
    opacity: 0.7,
  },
});
