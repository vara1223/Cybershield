import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const expoConfigExtras =
  Constants.expoConfig?.extra ||
  Constants.default?.expoConfig?.extra ||
  Constants.manifest?.extra ||
  Constants.default?.manifest?.extra ||
  Constants.manifest2?.extra ||
  Constants.default?.manifest2?.extra ||
  {};

const envSupabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL;
const envSupabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl =
  expoConfigExtras.SUPABASE_URL ||
  expoConfigExtras.NEXT_PUBLIC_SUPABASE_URL ||
  expoConfigExtras.EXPO_PUBLIC_SUPABASE_URL ||
  envSupabaseUrl;
const supabaseAnonKey =
  expoConfigExtras.SUPABASE_ANON_KEY ||
  expoConfigExtras.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  expoConfigExtras.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  envSupabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY in your environment or Expo config.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
