import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useScanStore from '../store/useScanStore';
import { Colors } from '../constants/theme';

/**
 * Cyber-themed back button — consistent on every screen.
 *
 * Modes:
 *  absolute={true}  (default) — floats over hero headers
 *  absolute={false}           — sits inline in a flex row
 */
export default function BackButton({ navigation, top, left = 16, absolute = true, onPress }) {
  const isDark  = useScanStore((s) => s.isDark);
  const insets  = useSafeAreaInsets();
  const colors  = isDark ? Colors.dark : Colors.light;
  const scale   = useRef(new Animated.Value(1)).current;

  const resolvedTop = top !== undefined ? top : insets.top + 12;

  function handlePress() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 80, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scale,  { toValue: 1,    useNativeDriver: Platform.OS !== 'web', speed: 40 }),
    ]).start();
    if (typeof onPress === 'function') {
      try {
        onPress();
        return;
      } catch (e) {}
    }
    if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (navigation?.navigate) {
      try {
        navigation.navigate('Main', { screen: 'Home' });
        return;
      } catch (e) {
        try {
          navigation.navigate('Main');
          return;
        } catch (err) {}
      }
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
      window.history.back();
    }
  }

  const posStyle = absolute
    ? { position: 'absolute', top: resolvedTop, left, zIndex: 100 }
    : {};

  const cyberBorder = isDark ? 'rgba(0,212,255,0.25)' : 'rgba(67,97,238,0.25)';
  const cyberBg     = isDark ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.9)';
  const iconColor   = isDark ? '#00D4FF' : '#4361EE';

  return (
    <Animated.View style={[posStyle, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.btn, { backgroundColor: cyberBg, borderColor: cyberBorder }]}
      >
        <Ionicons name="chevron-back" size={20} color={iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
