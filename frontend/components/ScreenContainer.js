import React from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import TextureBackground from './TextureBackground';

export default function ScreenContainer({
  children,
  isDark = false,
  scrollable = true,
  style,
  contentStyle,
  keyboardAvoiding = false,
}) {
  const bg = isDark ? Colors.dark.background : Colors.light.background;
  const Wrapper = keyboardAvoiding ? KeyboardAvoidingView : View;

  const inner = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  return (
    <Wrapper
      style={[styles.container, { backgroundColor: bg }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TextureBackground isDark={isDark} />
      {inner}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
});
