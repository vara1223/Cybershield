import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle, Line } from 'react-native-svg';

/**
 * Renders a subtle cyber-grid background — small dots on a dark grid
 * with faint radial glow in the top-right corner.
 * Falls back gracefully if SVG isn't available.
 */
export default function TextureBackground({ isDark }) {
  if (!isDark) {
    // Light mode: very subtle tinted background, no SVG needed
    return (
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: '#F0F4FF' },
        ]}
        pointerEvents="none"
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Deep navy base */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#070B14' }]} />
      {/* Radial glow — top right */}
      <View style={styles.glowTopRight} />
      {/* Radial glow — bottom left */}
      <View style={styles.glowBottomLeft} />
    </View>
  );
}

const styles = StyleSheet.create({
  glowTopRight: {
    position: 'absolute',
    width: 400,
    height: 400,
    top: -120,
    right: -120,
    borderRadius: 200,
    backgroundColor: '#00D4FF',
    opacity: 0.035,
  },
  glowBottomLeft: {
    position: 'absolute',
    width: 320,
    height: 320,
    bottom: -80,
    left: -80,
    borderRadius: 160,
    backgroundColor: '#4361EE',
    opacity: 0.04,
  },
});
