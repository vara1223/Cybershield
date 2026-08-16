import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Typography } from '../constants/theme';

const ARC_COLOR = {
  SAFE: '#22C55E',
  SUSPICIOUS: '#F59E0B',
  MODERATE: '#F59E0B',
  DANGEROUS: '#EF4444',
  DANGER: '#EF4444'
};
const TRACK_COLOR = { light: '#E8EAF0', dark: '#252830' };

export default function ConfidenceArc({ score = 0, verdict = 'SAFE', size = 160, isDark = false }) {
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;

  const targetScore = Math.min(100, Math.max(0, Number(score) || 0));
  const [displayScore, setDisplayScore] = useState(targetScore);

  useEffect(() => {
    let animationFrame;
    const startTime = Date.now();
    const duration = 800;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(targetScore * easedProgress);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [score]);

  const currentOffset = arcLength * (1 - displayScore / 100);
  const color = ARC_COLOR[verdict] || '#22C55E';
  const trackColor = isDark ? TRACK_COLOR.dark : TRACK_COLOR.light;
  const rotation = 135;
  const cx = size / 2;
  const cy = size / 2;

  if (Platform.OS === 'web') {
    const strokeDasharray = `${arcLength} ${circumference}`;
    const transform = `rotate(${rotation}deg)`;
    const transformOrigin = `${cx}px ${cy}px`;

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
          {/* Track Circle */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{ transform, transformOrigin }}
          />
          {/* Active Animated Score Arc */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={currentOffset}
            strokeLinecap="round"
            style={{ transform, transformOrigin, transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <View style={styles.center}>
          <Text style={[styles.score, { color, fontFamily: Typography.monoBold, fontSize: size * 0.22 }]}>
            {Math.round(displayScore)}
          </Text>
          <Text style={[styles.label, { color: isDark ? Colors.dark.textSecondary : Colors.light.textSecondary, fontFamily: Typography.body, fontSize: size * 0.09 }]}>
            risk score
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Track Circle */}
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
        {/* Active Animated Score Arc */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={currentOffset}
          strokeLinecap="round"
          rotation={rotation}
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.score, { color, fontFamily: Typography.monoBold, fontSize: size * 0.22 }]}>
          {Math.round(displayScore)}
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
    position: 'relative',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  score: {
    fontWeight: '800',
  },
  label: {
    marginTop: 2,
    textTransform: 'lowercase',
  },
});
