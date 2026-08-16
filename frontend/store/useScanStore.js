import { create } from 'zustand';
import { supabase } from '../supabase';
import { Platform } from 'react-native';
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
  toggleTheme: async () => {
    const nextState = !get().isDark;
    set({ isDark: nextState });
    try {
      await AsyncStorage.setItem('app_theme_is_dark', JSON.stringify(nextState));
    } catch (_) {}
  },
  loadTheme: async () => {
    try {
      const val = await AsyncStorage.getItem('app_theme_is_dark');
      if (val !== null) {
        set({ isDark: JSON.parse(val) });
      }
    } catch (_) {}
  },

  // Dynamic Cache Tracking
  scansSinceFlush: 5,
  incrementScansSinceFlush: () => set((s) => ({ scansSinceFlush: s.scansSinceFlush + 1 })),
  flushCacheState: () => set({ scansSinceFlush: 0 }),
  getCacheSizeMb: () => {
    const count = get().scansSinceFlush;
    return count > 0 ? (count * 2.4 + 1.2).toFixed(1) : '0.0';
  },

  // Scan history
  history: [],
  historyLoading: false,
  setHistory: (history) => set({ history }),

  clearHistory: async () => {
    set({ history: [] });
    try {
      const userId = await AsyncStorage.getItem('current_user_id').catch(() => null);
      const storageKey = `scan_history_${userId || 'anonymous'}`;
      await AsyncStorage.removeItem(storageKey).catch(() => {});

      // Try to clear Supabase scan_logs for the authenticated user
      const supabaseUser = (await supabase.auth.getUser().catch(() => null))?.data?.user;
      if (supabaseUser?.id) {
        await supabase.from('scan_logs').delete().eq('user_id', supabaseUser.id).catch(() => {});
      }
    } catch (e) {}
  },

  saveScanLog: async (scan) => {
    try {
      const userId = await AsyncStorage.getItem('current_user_id').catch(() => null);
      const savedUserEmail = (await AsyncStorage.getItem('user_email').catch(() => null)) || (await AsyncStorage.getItem('mock_user_email').catch(() => null));
      const savedMockName = await AsyncStorage.getItem('mock_user_full_name').catch(() => null);

      // Resolve real authenticated user info
      const supabaseUser = (await supabase.auth.getUser().catch(() => null))?.data?.user;
      const actualEmail = (supabaseUser?.email || savedUserEmail || scan.raw?.user_email || '').toLowerCase() || 'user@cybershield.local';
      const actualName = savedMockName || supabaseUser?.user_metadata?.full_name || (actualEmail ? actualEmail.split('@')[0] : 'User');

      // Build the scan payload
      const payload = {
        feature: scan.feature ?? 'unknown',
        verdict: scan.verdict ?? 'UNKNOWN',
        confidence: scan.confidence ?? null,
        input_data: scan.input_data ?? null,
        explanation: scan.explanation ?? null,
        tips: scan.tips ?? null,
        raw: {
          ...(scan.raw || {}),
          user_name: actualName,
          user_email: actualEmail,
        },
      };

      let sbResult = null;

      // ── Attempt Supabase insertion (matches public.scan_logs table schema) ──
      try {
        const validUUID =
          supabaseUser?.id ||
          (userId && userId.length > 20 && userId.includes('-') ? userId : null);

        const insertPayload = {
          ...payload,
          ...(validUUID ? { user_id: validUUID } : {}),
        };

        const { data, error } = await supabase
          .from('scan_logs')
          .insert([insertPayload])
          .select('*')
          .single();

        if (!error && data) {
          sbResult = data;
          console.log('[Supabase] scan_log saved:', data.id);
        } else if (error) {
          console.log('[Supabase] scan_log insert note:', error.message);
        }
      } catch (sbErr) {
        console.log('[Supabase] scan_log catch:', sbErr?.message);
      }

      // ── Always persist to AsyncStorage (offline + fallback) ──
      const entry = {
        ...payload,
        id: sbResult?.id || Date.now(),
        scanned_at: sbResult?.scanned_at || new Date().toISOString(),
        user_name: actualName,
        user_email: actualEmail,
      };

      const storageKey = `scan_history_${userId || 'anonymous'}`;
      const localHistoryRaw = await AsyncStorage.getItem(storageKey).catch(() => null);
      const localHistory = localHistoryRaw ? JSON.parse(localHistoryRaw) : [];

      // Prepend and deduplicate
      const merged = [entry];
      localHistory.forEach((item) => {
        if (
          !merged.some(
            (m) =>
              m.id === item.id ||
              (m.input_data === item.input_data && m.feature === item.feature)
          )
        ) {
          merged.push(item);
        }
      });

      await AsyncStorage.setItem(storageKey, JSON.stringify(merged.slice(0, 100))).catch(() => {});
      set((state) => ({
        history: [entry, ...state.history.filter((h) => h.id !== entry.id)].slice(0, 100),
        scansSinceFlush: state.scansSinceFlush + 1,
      }));

      return entry;
    } catch (err) {
      console.log('[saveScanLog] unexpected error:', err);
      return null;
    }
  },

  loadHistory: async () => {
    set({ historyLoading: true });
    try {
      const userId = await AsyncStorage.getItem('current_user_id').catch(() => null);
      const storageKey = `scan_history_${userId || 'anonymous'}`;
      const localHistoryRaw = await AsyncStorage.getItem(storageKey).catch(() => null);
      const localHistory = localHistoryRaw ? JSON.parse(localHistoryRaw) : [];

      // ── Fetch from Supabase (matches public.scan_logs table schema) ──
      const supabaseUser = (await supabase.auth.getUser().catch(() => null))?.data?.user;
      let supabaseLogs = [];

      if (supabaseUser?.id) {
        const { data, error } = await supabase
          .from('scan_logs')
          .select('id, feature, verdict, confidence, input_data, explanation, tips, raw, scanned_at, user_id')
          .eq('user_id', supabaseUser.id)
          .order('scanned_at', { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data)) {
          supabaseLogs = data;
          console.log('[Supabase] loaded', supabaseLogs.length, 'scan logs');
        } else if (error) {
          console.log('[Supabase] loadHistory note:', error.message);
        }
      }

      // ── Merge Supabase + local, deduplicate, sort ──
      const merged = [...supabaseLogs];
      localHistory.forEach((item) => {
        if (
          !merged.some(
            (m) =>
              m.id === item.id ||
              (m.input_data === item.input_data && m.feature === item.feature)
          )
        ) {
          merged.push(item);
        }
      });

      merged.sort(
        (a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
      );

      const finalHistory = merged.slice(0, 100);
      await AsyncStorage.setItem(storageKey, JSON.stringify(finalHistory)).catch(() => {});
      set({ history: finalHistory });
      return finalHistory;
    } catch (err) {
      console.log('[loadHistory] unexpected error:', err);
      const userId = await AsyncStorage.getItem('current_user_id').catch(() => null);
      const storageKey = `scan_history_${userId || 'anonymous'}`;
      const localHistoryRaw = await AsyncStorage.getItem(storageKey).catch(() => null);
      const localHistory = localHistoryRaw ? JSON.parse(localHistoryRaw) : [];
      set({ history: localHistory });
      return localHistory;
    } finally {
      set({ historyLoading: false });
    }
  },

  // Settings
  notificationsEnabled: true,
  setNotificationsEnabled: (val) => set({ notificationsEnabled: val }),

  addScan: async (scan) => {
    const entry = await get().saveScanLog(scan);
    const finalEntry = entry || createScanEntry(scan, null);

    if (get().notificationsEnabled) {
      const isSafe = finalEntry.verdict === 'SAFE';
      const title = isSafe ? '✅ Scan Complete' : '⚠️ Security Alert';
      const message = `A scan for ${(finalEntry.feature || '')
        .replace('_scan', '')
        .toUpperCase()} completed with verdict: ${finalEntry.verdict}.`;

      if (Platform.OS === 'web') {
        console.log(`[SCAN] ${title}: ${message}`);
      } else {
        await sendLocalNotification(title, message);
      }
    }

    return finalEntry;
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
