import React, { useState, useRef, useEffect } from 'react';
import { Pressable, Text, Animated, Platform, StyleSheet } from 'react-native';

export default function GlowButton({
  onPress,
  children,
  style,
  textStyle,
  testID,
  disabled,
  glowColor = '#00f0ff',
}) {
  const [hovered, setHovered] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: hovered ? 1.03 : 1,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [hovered]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.button,
          style,
          {
            opacity: pressed ? 0.9 : 1,
            shadowColor: glowColor,
            shadowRadius: hovered ? 14 : 6,
            shadowOpacity: hovered ? 0.8 : 0.4,
            elevation: hovered ? 10 : 4,
            borderColor: hovered ? glowColor : (style?.borderColor || 'transparent'),
          },
        ]}
      >
        {typeof children === 'string' ? (
          <Text style={[styles.text, textStyle]}>{children}</Text>
        ) : (
          children
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
  },
  text: {
    fontWeight: '700',
    fontSize: 15,
  },
});
