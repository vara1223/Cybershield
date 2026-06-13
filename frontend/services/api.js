import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Backend URL resolution
//
//  • Expo Go  → auto-detects the laptop's IP from the Metro dev-server host,
//               so the backend is reached at  http://<laptop-ip>:8000  with NO
//               hardcoding. Works on ANY network automatically.
//  • Standalone APK → falls back to FALLBACK_URL below. If you ever build an
//               APK, set FALLBACK_URL to the backend laptop's IP and rebuild.
// ---------------------------------------------------------------------------
const BACKEND_PORT = 8000;
const FALLBACK_URL = 'http://10.20.241.216:8000'; // only used by standalone APK builds

function resolveBaseUrl() {
  // On web, window.location gives us the correct host
  if (Platform.OS === 'web') {
    return `http://localhost:${BACKEND_PORT}`;
  }
  // Metro dev-server host, e.g. "192.168.1.50:8081" (present only in Expo Go / dev)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:${BACKEND_PORT}`;
  return FALLBACK_URL;
}

const BASE_URL = resolveBaseUrl();

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Convert a file URI to a base64 string.
 * On native: uses expo-file-system.
 * On web: uses fetch + FileReader (works with blob:// and data: URIs too).
 */
async function fileToBase64(uri) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // result is "data:<mime>;base64,<data>" — strip the prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  // Native path — lazy-import to avoid crashing on web bundle
  const FileSystem = await import('expo-file-system');
  const readFn = FileSystem.readAsStringAsync || FileSystem.default?.readAsStringAsync;
  const base64 = await readFn(uri, { encoding: FileSystem.EncodingType?.Base64 || 'base64' });
  return base64;
}

export const api = {
  async analyzeURL(url) {
    const res = await client.post('/analyze/url', { url });
    return res.data;
  },

  async analyzeScreenshot(imageUri) {
    const base64 = await fileToBase64(imageUri);
    const res = await client.post('/analyze/screenshot', { image: base64 });
    return res.data;
  },

  async analyzeQR(decodedContent, imageUri = null) {
    const payload = { decoded_content: decodedContent };
    if (imageUri && !decodedContent) {
      payload.image = await fileToBase64(imageUri);
      delete payload.decoded_content;
    }
    const res = await client.post('/analyze/qr', payload);
    return res.data;
  },

  async analyzeOTP(message) {
    const res = await client.post('/analyze/otp', { message });
    return res.data;
  },

  async analyzeUPI(upiId, message = '') {
    const res = await client.post('/analyze/upi', { upi_id: upiId, message });
    return res.data;
  },

  async analyzeVoice(audioUri, format = 'mp3') {
    const base64 = await fileToBase64(audioUri);
    const res = await client.post('/analyze/voice', { audio: base64, format }, { timeout: 120000 });
    return res.data;
  },

  async getAdminLogs(page = 1, feature = null, verdict = null) {
    const params = { page, per_page: 20 };
    if (feature) params.feature = feature;
    if (verdict) params.verdict = verdict;
    const res = await client.get('/admin/logs', { params });
    return res.data;
  },

  async getAdminStats() {
    const res = await client.get('/admin/stats');
    return res.data;
  },
};

export default api;
