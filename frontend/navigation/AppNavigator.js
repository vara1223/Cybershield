import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { Colors, Typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from './navigationRef';
import * as Linking from 'expo-linking';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import URLScanScreen from '../screens/URLScanScreen';
import ScreenshotScanScreen from '../screens/ScreenshotScanScreen';
import QRScanScreen from '../screens/QRScanScreen';
import OTPScanScreen from '../screens/OTPScanScreen';
import UPIScanScreen from '../screens/UPIScanScreen';
import VoiceScanScreen from '../screens/VoiceScanScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ResultScreen from '../screens/ResultScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AdminPanelScreen from '../screens/AdminPanelScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const linking = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      Main: {
        path: '',
        screens: {
          Home: 'home',
          Scan: 'scan',
          History: 'history',
        },
      },
      Result: 'result',
      Settings: 'settings',
      URLScan: 'url-scan',
      ScreenshotScan: 'screenshot-scan',
      QRScan: 'qr-scan',
      OTPScan: 'otp-scan',
      UPIScan: 'upi-scan',
      VoiceScan: 'voice-scan',
      Login: 'login',
      Register: 'register',
      ResetPassword: 'reset-password',
      Admin: 'admin',
    },
  },
};

function TabBarIcon({ name, focused, color }) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
      <Ionicons name={focused ? name : `${name}-outline`} size={22} color={color} />
      {focused && <View style={[styles.tabDot, { backgroundColor: color }]} />}
    </View>
  );
}

function MainTabs({ isDark }) {
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 62,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Typography.bodyMedium,
          fontSize: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused, color }) => <TabBarIcon name="home" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Scan"
        component={URLScanScreen}
        options={{
          tabBarIcon: ({ focused, color }) => <TabBarIcon name="scan" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused, color }) => <TabBarIcon name="time" focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const isDark = useScanStore((s) => s.isDark);
  const { user, loading } = useAuth();
  const colors = isDark ? Colors.dark : Colors.light;
  const loadHistory = useScanStore((s) => s.loadHistory);
  const clearHistory = useScanStore((s) => s.clearHistory);

  useEffect(() => {
    if (user) {
      loadHistory();
    } else {
      clearHistory();
    }
  }, [user, loadHistory, clearHistory]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.card,
      border: colors.border,
      text: colors.text,
    },
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main">
              {(props) => <MainTabs {...props} isDark={isDark} />}
            </Stack.Screen>
            <Stack.Screen name="Result" component={ResultScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="URLScan" component={URLScanScreen} />
            <Stack.Screen name="ScreenshotScan" component={ScreenshotScanScreen} />
            <Stack.Screen name="QRScan" component={QRScanScreen} />
            <Stack.Screen name="OTPScan" component={OTPScanScreen} />
            <Stack.Screen name="UPIScan" component={UPIScanScreen} />
            <Stack.Screen name="VoiceScan" component={VoiceScanScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name="Admin" component={AdminPanelScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    gap: 3,
  },
  tabIconActive: {},
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
