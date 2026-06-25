import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

let Notifications = null;
if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (err) {
    console.warn('Error initializing expo-notifications:', err);
  }
}

/**
 * Requests push notification permission from the operating system.
 * Returns true if permission is granted, otherwise false.
 */
export async function requestNotificationPermission() {
  if (Platform.OS === 'web' || isExpoGo) return true;
  if (!Notifications) return false;
  
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * Schedules and fires a local notification immediately.
 */
export async function sendLocalNotification(title, body) {
  if (Platform.OS === 'web' || isExpoGo) return;
  if (!Notifications) return;
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // trigger immediately
    });
  } catch (err) {
    console.warn('Error sending local notification:', err);
  }
}
