import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Backend URL resolution
// ---------------------------------------------------------------------------
const BACKEND_PORT = 8000;
const FALLBACK_URL = 'http://10.190.47.216:8000'; // fallback for standalone builds

const LIVE_BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  '';

function resolveBaseUrl() {
  if (Platform.OS === 'web') {
    return LIVE_BACKEND_URL || `http://localhost:${BACKEND_PORT}`;
  }
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    if (process.env.EXPO_PUBLIC_FORCE_LIVE === 'true' && LIVE_BACKEND_URL) {
      return LIVE_BACKEND_URL;
    }
    return `http://${host}:${BACKEND_PORT}`;
  }
  if (__DEV__) {
    if (process.env.EXPO_PUBLIC_FORCE_LIVE === 'true' && LIVE_BACKEND_URL) {
      return LIVE_BACKEND_URL;
    }
    return `http://localhost:${BACKEND_PORT}`;
  }
  return LIVE_BACKEND_URL || FALLBACK_URL;
}

export const BASE_URL = resolveBaseUrl();

const ADMIN_API_KEY =
  Constants.expoConfig?.extra?.ADMIN_API_KEY ||
  Constants.manifest?.extra?.ADMIN_API_KEY ||
  process.env.EXPO_PUBLIC_ADMIN_API_KEY ||
  'cybershield-secure-admin-token-2026';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  if (config.url && config.url.startsWith('/admin')) {
    config.headers['X-Admin-Key'] = ADMIN_API_KEY;
  }
  try {
    const userId    = await AsyncStorage.getItem('current_user_id');
    const userEmail = await AsyncStorage.getItem('current_user_email');
    const userName  = await AsyncStorage.getItem('mock_user_full_name');
    if (userId)    config.headers['X-User-Id']    = userId;
    if (userEmail) config.headers['X-User-Email'] = userEmail;
    if (userName)  config.headers['X-User-Name']  = encodeURIComponent(userName);
  } catch (_) {}
  return config;
}, (error) => {
  return Promise.reject(error);
});

async function fileToBase64(uri) {
  if (typeof uri === 'string' && uri.startsWith('data:')) {
    const parts = uri.split(',');
    return parts[1] || parts[0];
  }
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const FileSystem = await import('expo-file-system/src/legacy');
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

  async analyzeVoice(audioSource, format = 'webm', clientTranscript = null) {
    const formData = new FormData();
    formData.append('format', format || 'webm');

    if (clientTranscript && typeof clientTranscript === 'string' && clientTranscript.trim()) {
      formData.append('transcript', clientTranscript.trim());
    }

    if (audioSource) {
      if (audioSource instanceof Blob || (typeof File !== 'undefined' && audioSource instanceof File)) {
        formData.append('audio', audioSource, `recording.${format || 'webm'}`);
      } else if (typeof audioSource === 'string' && audioSource.trim()) {
        try {
          const response = await fetch(audioSource);
          const blob = await response.blob();
          formData.append('audio', blob, `recording.${format || 'webm'}`);
        } catch (err) {
          console.log('[API] fetch audio blob error:', err?.message);
        }
      }
    }

    const res = await client.post('/analyze/voice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return res.data;
  },

  async getAdminLogs(page = 1, perPage = 20, feature = null, verdict = null, query = null) {
    const params = { page, per_page: perPage };
    if (feature) params.feature = feature;
    if (verdict) params.verdict = verdict;
    if (query) params.query = query;
    const res = await client.get('/admin/logs', { params });
    return res.data;
  },

  async getAdminScans(page = 1, perPage = 50, feature = null, verdict = null, query = null) {
    const params = { page, per_page: perPage };
    if (feature && feature !== 'ALL') params.feature = feature;
    if (verdict && verdict !== 'ALL') params.verdict = verdict;
    if (query) params.query = query;
    const res = await client.get('/admin/scans', { params });
    return res.data;
  },

  async getAdminStats() {
    const res = await client.get('/admin/stats');
    return res.data;
  },

  async getAdminUsers() {
    const res = await client.get('/admin/users');
    return res.data;
  },

  async getUserDetails(email) {
    const res = await client.get('/admin/user/details', { params: { email } });
    return res.data;
  },

  async updateUserName(email, newName) {
    try {
      const res = await client.post('/admin/user/update-name', { email, new_name: newName });
      return res.data;
    } catch (e) {
      return null;
    }
  },

  async deleteUser(email) {
    try {
      const res = await client.delete(`/admin/users/${encodeURIComponent(email)}`);
      return res.data;
    } catch (e) {
      console.log('[API] deleteUser error:', e);
      throw e;
    }
  },

  // ── Admin Monitor endpoints (admin_scan_logs table) ──────────────────────────
  async getMonitorScans({ page = 1, perPage = 50, scanType, result, search, dateFrom, dateTo, sort = 'newest' } = {}) {
    const params = { page, per_page: perPage };
    if (scanType && scanType !== 'ALL') params.scan_type = scanType;
    if (result && result !== 'ALL') params.result = result;
    if (search) params.search = search;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (sort) params.sort = sort;
    const res = await client.get('/admin/monitor/scans', { params });
    return res.data;
  },

  async getMonitorStats() {
    const res = await client.get('/admin/monitor/stats');
    return res.data;
  },

  async getMonitorUsers() {
    const res = await client.get('/admin/monitor/users');
    return res.data;
  },

  async resetAllScans() {
    const res = await client.post('/admin/scans/reset');
    return res.data;
  },

  async resetUserScans(email) {
    const res = await client.post('/admin/user/reset-scans', null, { params: { email } });
    return res.data;
  },
  
  // Custom OTP Reset & Registration Flow
  sendCustomOtp: async (email) => {
    const res = await axios.post(`${BASE_URL}/api/custom-auth/send-otp`, { email });
    return res.data;
  },
  verifyCustomOtp: async (email, otp) => {
    const res = await axios.post(`${BASE_URL}/api/custom-auth/verify-otp`, { email, otp });
    return res.data;
  },
  registerUser: async ({ email, password, full_name, otp }) => {
    const res = await axios.post(`${BASE_URL}/api/custom-auth/register-user`, {
      email,
      password,
      full_name,
      otp,
    });
    return res.data;
  },
};

export default api;
