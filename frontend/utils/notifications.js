import { Platform } from 'react-native';

let Notifications = null;
if (Platform.OS !== 'web') {
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
 * Requests push/local notification permission from the operating system.
 * Configures high-priority Android notification channel for threat alerts.
 * Returns true if permission is granted, otherwise false.
 */
export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return true;
  if (!Notifications) return false;
  
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus === 'granted' && Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('security-alerts', {
        name: 'CyberShield Threat Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4361EE',
        sound: 'default',
      }).catch((e) => console.log('Notification channel setup note:', e));
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
  if (Platform.OS === 'web') return;
  if (!Notifications) return;
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        channelId: Platform.OS === 'android' ? 'security-alerts' : undefined,
      },
      trigger: null, // trigger immediately
    });
  } catch (err) {
    console.warn('Error sending local notification:', err);
  }
}
