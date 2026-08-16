import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Colors, Typography } from '../constants/theme';

export default function WeeklyChart({ data = [], isDark = false, height = 120 }) {
  const colors = isDark ? Colors.dark : Colors.light;
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: Typography.body }}>
          No weekly threat volume data available.
        </Text>
      </View>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count || 0), 1);
  const chartH = height - 28;
  const barWidth = 22;
  const gap = 12;
  const totalWidth = Math.max(140, data.length * (barWidth + gap) - gap);

  return (
    <View style={styles.container}>
      <Svg width={totalWidth} height={height} style={{ overflow: 'visible' }}>
        {data.map((d, i) => {
          const barH = Math.max(4, (d.count / maxCount) * chartH);
          const x = i * (barWidth + gap);
          const y = chartH - barH;
          const isToday = i === data.length - 1;
          const fill = isToday ? Colors.light.primary : (isDark ? '#2A3050' : '#D1D5E8');

          return (
            <React.Fragment key={d.date}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={4}
                fill={fill}
              />
              <SvgText
                x={x + barWidth / 2}
                y={height - 4}
                textAnchor="middle"
                fontSize={10}
                fill={colors.textSecondary}
                fontFamily={Typography.body}
              >
                {d.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
});
