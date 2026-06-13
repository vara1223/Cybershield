import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, Typography } from '../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ARC_COLOR = { SAFE: '#22C55E', SUSPICIOUS: '#F59E0B', MODERATE: '#F59E0B', DANGEROUS: '#EF4444', DANGER: '#EF4444' };
const TRACK_COLOR = { light: '#E8EAF0', dark: '#252830' };

export default function ConfidenceArc({ score = 0, verdict = 'SAFE', size = 160, isDark = false }) {
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;

  const animatedScore = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedScore, {
      toValue: score,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeDashoffset = animatedScore.interpolate({
    inputRange: [0, 100],
    outputRange: [arcLength, 0],
    extrapolate: 'clamp',
  });

  const color = ARC_COLOR[verdict] || '#22C55E';
  const trackColor = isDark ? TRACK_COLOR.dark : TRACK_COLOR.light;
  const rotation = 135;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          rotation={rotation}
          origin={`${cx}, ${cy}`}
        />
        {/* Progress */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={rotation}
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.score, { color, fontFamily: Typography.monoBold, fontSize: size * 0.22 }]}>
          {Math.round(score)}
        </Text>
        <Text style={[styles.label, { color: isDark ? Colors.dark.textSecondary : Colors.light.textSecondary, fontFamily: Typography.body, fontSize: size * 0.09 }]}>
          risk score
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    lineHeight: undefined,
  },
  label: {
    marginTop: 2,
    textTransform: 'lowercase',
  },
});
