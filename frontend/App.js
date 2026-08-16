import React from 'react';
import { Platform, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './context/AuthContext';

LogBox.ignoreLogs([
  '"shadow*" style props are deprecated',
  '"textShadow*" style props are deprecated',
  'props.pointerEvents is deprecated',
]);

if (Platform.OS === 'web') {
  if (typeof console !== 'undefined') {
    const origWarn = console.warn;
    console.warn = (...args) => {
      if (typeof args[0] === 'string' && (
        args[0].includes('style props are deprecated') ||
        args[0].includes('pointerEvents is deprecated') ||
        args[0].includes('aria-hidden')
      )) {
        return;
      }
      origWarn(...args);
    };
  }

  const style = document.createElement('style');
  style.type = 'text/css';
  style.appendChild(document.createTextNode(`
    body, input, select, textarea, button {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      font-size: 14px;
    }
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus,
    input:-webkit-autofill:active {
      transition: background-color 5000s ease-in-out 0s;
      -webkit-text-fill-color: currentColor !important;
    }
  `));
  document.head.appendChild(style);
}

function App() {
  if (Platform.OS === 'web') {
    return (
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
