import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { Colors, Typography } from '../constants/theme';

const { width, height } = Dimensions.get('window');

export default function ScanLineLoader({ isDark = false, label = 'Scanning...' }) {
  const scanY = useRef(new Animated.Value(-4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: height,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(scanY, {
          toValue: -4,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const bg = isDark ? 'rgba(13,15,20,0.95)' : 'rgba(245,246,250,0.96)';
  const lineColor = isDark ? Colors.dark.accent : Colors.light.primary;
  const textColor = isDark ? Colors.dark.text : Colors.light.text;
  const subColor = isDark ? Colors.dark.textSecondary : Colors.light.textSecondary;

  return (
    <Animated.View style={[styles.overlay, { backgroundColor: bg, opacity }]}>
      {/* Scan line */}
      <Animated.View
        style={[
          styles.scanLine,
          {
            backgroundColor: lineColor,
            transform: [{ translateY: scanY }],
          },
        ]}
      />
      {/* Glow below line */}
      <Animated.View
        style={[
          styles.scanGlow,
          {
            backgroundColor: lineColor,
            transform: [{ translateY: scanY }],
          },
        ]}
      />
      <View style={styles.content}>
        <Text style={[styles.label, { color: textColor, fontFamily: Typography.monoBold }]}>
          {label}
        </Text>
        <Text style={[styles.sub, { color: subColor, fontFamily: Typography.mono }]}>
          Analyzing for threats...
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.9,
  },
  scanGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 40,
    opacity: 0.05,
    marginTop: 2,
  },
  content: {
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 18,
    letterSpacing: 1,
  },
  sub: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
