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

import LoginScreen         from '../screens/LoginScreen';
import RegisterScreen      from '../screens/RegisterScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import HomeScreen          from '../screens/HomeScreen';
import URLScanScreen       from '../screens/URLScanScreen';
import ScreenshotScanScreen from '../screens/ScreenshotScanScreen';
import QRScanScreen        from '../screens/QRScanScreen';
import OTPScanScreen       from '../screens/OTPScanScreen';
import UPIScanScreen       from '../screens/UPIScanScreen';
import VoiceScanScreen     from '../screens/VoiceScanScreen';
import HistoryScreen       from '../screens/HistoryScreen';
import ResultScreen        from '../screens/ResultScreen';
import SettingsScreen      from '../screens/SettingsScreen';
import AdminPanelScreen    from '../screens/AdminPanelScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const linking = {
  prefixes: [
    Linking.createURL('/'),
    'grammapp://',
    'cybershield://',
  ],
  config: {
    screens: {
      Main: {
        path: '',
        screens: { Home: 'home', Scan: 'scan', History: 'history' },
      },
      Result: 'result', Settings: 'settings',
      URLScan: 'url-scan', ScreenshotScan: 'screenshot-scan',
      QRScan: 'qr-scan', OTPScan: 'otp-scan',
      UPIScan: 'upi-scan', VoiceScan: 'voice-scan',
      Login: 'login', Register: 'register',
      ResetPassword: 'reset-password', Admin: 'admin',
    },
  },
};

// ─── Tab icon ─────────────────────────────────────────────────────────────────
function TabIcon({ name, focused, color }) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
      <Ionicons
        name={focused ? name : `${name}-outline`}
        size={21}
        color={color}
      />
      {focused && <View style={[styles.tabActiveLine, { backgroundColor: color }]} />}
    </View>
  );
}

// ─── Main tab navigator ───────────────────────────────────────────────────────
function MainTabs({ isDark }) {
  const colors = isDark ? Colors.dark : Colors.light;

  const TAB_BG     = isDark ? '#0A0F1E'   : '#FFFFFF';
  const TAB_BORDER = isDark ? '#1E2D45'   : '#BFDBFE';
  const ACTIVE     = isDark ? '#60A5FA'   : '#2563EB';
  const INACTIVE   = isDark ? '#2D3D55'   : '#93C5FD';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: TAB_BORDER,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.8,
          marginTop: 2,
        },
        tabBarActiveTintColor:   ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'DASHBOARD',
          tabBarIcon: ({ focused, color }) =>
            <TabIcon name="shield-checkmark" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Scan"
        component={URLScanScreen}
        options={{
          tabBarLabel: 'SCAN',
          tabBarIcon: ({ focused, color }) =>
            <TabIcon name="scan" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'LOGS',
          tabBarIcon: ({ focused, color }) =>
            <TabIcon name="list" focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const isDark      = useScanStore((s) => s.isDark);
  const { user, loading } = useAuth();
  const colors      = isDark ? Colors.dark : Colors.light;
  const loadHistory  = useScanStore((s) => s.loadHistory);
  const clearHistory = useScanStore((s) => s.clearHistory);
  const loadTheme    = useScanStore((s) => s.loadTheme);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  useEffect(() => {
    if (user) { loadHistory(); } else { clearHistory(); }
  }, [user, loadHistory, clearHistory]);

  // Cyber-branded nav theme
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card:       colors.card,
      border:     colors.border,
      text:       colors.text,
      primary:    isDark ? '#00D4FF' : '#4361EE',
    },
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={isDark ? '#00D4FF' : '#4361EE'} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={user ? "Main" : "Login"}>

        <Stack.Screen name="Main">
          {(props) => <MainTabs {...props} isDark={isDark} />}
        </Stack.Screen>
        <Stack.Screen name="Result"         component={ResultScreen} />
        <Stack.Screen name="Settings"       component={SettingsScreen} />
        <Stack.Screen name="URLScan"        component={URLScanScreen} />
        <Stack.Screen name="ScreenshotScan" component={ScreenshotScanScreen} />
        <Stack.Screen name="QRScan"         component={QRScanScreen} />
        <Stack.Screen name="OTPScan"        component={OTPScanScreen} />
        <Stack.Screen name="UPIScan"        component={UPIScanScreen} />
        <Stack.Screen name="VoiceScan"      component={VoiceScanScreen} />
        <Stack.Screen name="Login"         component={LoginScreen} />
        <Stack.Screen name="Register"      component={RegisterScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="Admin"         component={AdminPanelScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  // Tab icon
  tabIconWrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 2, gap: 4,
  },
  tabIconActive: {},
  tabActiveLine: {
    width: 16, height: 2, borderRadius: 1, opacity: 0.8,
  },

  // Loading
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
});
