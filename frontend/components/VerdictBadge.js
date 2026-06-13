import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Radius } from '../constants/theme';

const CONFIG = {
  SAFE:       { color: Colors.verdict.SAFE,       bgKey: 'SAFE',       label: 'SAFE' },
  SUSPICIOUS: { color: Colors.verdict.SUSPICIOUS, bgKey: 'SUSPICIOUS', label: 'RISK' },
  MODERATE:   { color: Colors.verdict.MODERATE,   bgKey: 'MODERATE',   label: 'MODERATE' },
  DANGEROUS:  { color: Colors.verdict.DANGEROUS,  bgKey: 'DANGEROUS',  label: 'DANGER' },
  DANGER:     { color: Colors.verdict.DANGER,     bgKey: 'DANGER',     label: 'DANGER' },
};

export default function VerdictBadge({ verdict = 'SAFE', size = 'md', isDark = false }) {
  const cfg = CONFIG[verdict] || CONFIG.SAFE;
  const bg = isDark ? Colors.verdictBgDark[cfg.bgKey] : Colors.verdictBg[cfg.bgKey];

  const fontSize = size === 'lg' ? 20 : size === 'sm' ? 11 : 13;
  const px = size === 'lg' ? 20 : size === 'sm' ? 8 : 12;
  const py = size === 'lg' ? 10 : size === 'sm' ? 3 : 5;

  return (
    <View style={[styles.badge, { backgroundColor: bg, paddingHorizontal: px, paddingVertical: py }]}>
      <Text style={[styles.text, { color: cfg.color, fontSize, fontFamily: Typography.monoBold }]}>
        [ {cfg.label} ]
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    letterSpacing: 1.5,
  },
});
