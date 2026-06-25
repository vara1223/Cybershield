import { create } from 'zustand';
import { supabase } from '../supabase';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendLocalNotification } from '../utils/notifications';

const createScanEntry = (scan, persisted) => ({
  ...scan,
  id: persisted?.id ?? scan.id ?? Date.now(),
  scanned_at: persisted?.scanned_at ?? scan.scanned_at ?? new Date().toISOString(),
  feature: scan.feature ?? 'unknown',
  verdict: scan.verdict ?? 'UNKNOWN',
  confidence: scan.confidence ?? null,
  input_data: scan.input_data ?? null,
  explanation: scan.explanation ?? null,
  tips: scan.tips ?? null,
  raw: scan.raw ?? null,
});

const useScanStore = create((set, get) => ({
  // Theme
  isDark: false,
  toggleTheme: () => set((s) => ({ isDark: !s.isDark })),

  // Scan history
  history: [],
  historyLoading: false,
  setHistory: (history) => set({ history }),
  clearHistory: () => set({ history: [] }),

  saveScanLog: async (scan) => {
    try {
      const userId = await AsyncStorage.getItem('current_user_id').catch(() => null);
      const isMockOrGuest = !userId || userId === 'guest' || userId === 'test-user-id';

      if (isMockOrGuest) {
        const mockEntry = {
          id: Date.now(),
          scanned_at: new Date().toISOString(),
          feature: scan.feature ?? 'unknown',
          verdict: scan.verdict ?? 'UNKNOWN',
          confidence: scan.confidence ?? null,
          input_data: scan.input_data ?? null,
          explanation: scan.explanation ?? null,
          tips: scan.tips ?? null,
          raw: scan.raw ?? null,
        };
        const storageKey = `scan_history_${userId || 'guest'}`;
        const localHistoryRaw = await AsyncStorage.getItem(storageKey).catch(() => null);
        const localHistory = localHistoryRaw ? JSON.parse(localHistoryRaw) : [];
        localHistory.unshift(mockEntry);
        await AsyncStorage.setItem(storageKey, JSON.stringify(localHistory.slice(0, 100))).catch(() => {});
        return mockEntry;
      }

      // Real Supabase user path
      const payload = {
        user_id: userId,
        feature: scan.feature ?? 'unknown',
        verdict: scan.verdict ?? 'UNKNOWN',
        confidence: scan.confidence ?? null,
        input_data: scan.input_data ?? null,
        explanation: scan.explanation ?? null,
        tips: scan.tips ?? null,
        raw: scan.raw ?? null,
      };

      const { data, error } = await supabase
        .from('scan_logs')
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        console.log('Supabase scan_logs insert error, falling back to local storage:', error.message);
        const mockEntry = {
          ...payload,
          id: Date.now(),
          scanned_at: new Date().toISOString(),
        };
        const storageKey = `scan_history_${userId}`;
        const localHistoryRaw = await AsyncStorage.getItem(storageKey).catch(() => null);
        const localHistory = localHistoryRaw ? JSON.parse(localHistoryRaw) : [];
        localHistory.unshift(mockEntry);
        await AsyncStorage.setItem(storageKey, JSON.stringify(localHistory.slice(0, 100))).catch(() => {});
        return mockEntry;
      }
      return data;
    } catch (err) {
      console.log('saveScanLog unexpected error:', err);
      return null;
    }
  },

  loadHistory: async () => {
    set({ historyLoading: true });
    try {
      const userId = await AsyncStorage.getItem('current_user_id').catch(() => null);
      const isMockOrGuest = !userId || userId === 'guest' || userId === 'test-user-id';

      if (isMockOrGuest) {
        const storageKey = `scan_history_${userId || 'guest'}`;
        const localHistoryRaw = await AsyncStorage.getItem(storageKey).catch(() => null);
        const localHistory = localHistoryRaw ? JSON.parse(localHistoryRaw) : [];
        set({ history: localHistory });
        return localHistory;
      }

      // Real Supabase user path
      const { data, error } = await supabase
        .from('scan_logs')
        .select('id, feature, verdict, confidence, input_data, explanation, tips, raw, scanned_at')
        .order('scanned_at', { ascending: false })
        .limit(100);

      if (error) {
        console.log('Supabase scan_logs fetch error, falling back to local history:', error.message);
        const storageKey = `scan_history_${userId}`;
        const localHistoryRaw = await AsyncStorage.getItem(storageKey).catch(() => null);
        const localHistory = localHistoryRaw ? JSON.parse(localHistoryRaw) : [];
        set({ history: localHistory });
        return localHistory;
      }

      // Sync local storage with fetched Supabase data
      const storageKey = `scan_history_${userId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(data ?? [])).catch(() => {});

      set({ history: data ?? [] });
      return data ?? [];
    } catch (err) {
      console.log('loadHistory unexpected error:', err);
      set({ history: [] });
      return [];
    } finally {
      set({ historyLoading: false });
    }
  },

  // Settings
  notificationsEnabled: true,
  setNotificationsEnabled: (val) => set({ notificationsEnabled: val }),

  addScan: async (scan) => {
    const persisted = await get().saveScanLog(scan);
    const entry = createScanEntry(scan, persisted);
    set((s) => ({ history: [entry, ...s.history] }));

    if (get().notificationsEnabled) {
      const isSafe = entry.verdict === 'SAFE';
      const title = isSafe ? "✅ Scan Complete" : "⚠️ Security Alert";
      const message = `A scan for ${entry.feature.replace('_scan', '').toUpperCase()} completed with verdict: ${entry.verdict}.`;
      
      if (Platform.OS === 'web') {
        Alert.alert(title, message);
      } else {
        await sendLocalNotification(title, message);
      }
    }

    return entry;
  },

  // Current result (shared result screen)
  currentResult: null,
  setCurrentResult: (result) => set({ currentResult: result }),
  clearCurrentResult: () => set({ currentResult: null }),

  // Authentication
  isAuthenticated: false,
  setAuthenticated: (val) => set({ isAuthenticated: val }),

  // Admin
  adminAuthenticated: false,
  setAdminAuthenticated: (val) => set({ adminAuthenticated: val }),

  // Loading
  isScanning: false,
  setScanning: (val) => set({ isScanning: val }),

  // Computed
  getTotalScans: () => get().history.length,
  getThreats: () =>
    get().history.filter(
      (s) => s.verdict === 'DANGEROUS' || s.verdict === 'SUSPICIOUS'
    ).length,
  getSafeRate: () => {
    const h = get().history;
    if (h.length === 0) return 100;
    const safe = h.filter((s) => s.verdict === 'SAFE').length;
    return Math.round((safe / h.length) * 100);
  },
}));

export default useScanStore;
