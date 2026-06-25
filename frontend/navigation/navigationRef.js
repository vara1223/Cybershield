import { createNavigationContainerRef } from '@react-navigation/native';

// A ref to the NavigationContainer, usable from anywhere (including AuthContext)
export const navigationRef = createNavigationContainerRef();

/**
 * Navigate to a screen from outside of a component.
 * Safe to call even if the navigator hasn't mounted yet.
 */
export function navigateTo(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

/**
 * Reset the stack to a single screen (e.g. after logout).
 */
export function resetTo(name) {
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name }] });
  }
}
