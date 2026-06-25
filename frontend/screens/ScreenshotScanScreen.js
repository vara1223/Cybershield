import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Alert, ScrollView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import ScanLineLoader from '../components/ScanLineLoader';
import api from '../services/api';

const ACCENT = '#F59E0B';

const DETECTS = [
  { icon: 'chatbubble-outline', color: '#4361EE', bg: '#EEF2FF', label: 'Scam SMS & WhatsApp' },
  { icon: 'card-outline', color: '#10B981', bg: '#ECFDF5', label: 'Fake Bank Alerts' },
  { icon: 'key-outline', color: '#EF4444', bg: '#FEF2F2', label: 'OTP Phishing' },
  { icon: 'business-outline', color: '#8B5CF6', bg: '#F5F3FF', label: 'Brand Impersonation' },
  { icon: 'warning-outline', color: ACCENT, bg: '#FFFBEB', label: 'Urgency Manipulation' },
  { icon: 'globe-outline', color: '#06B6D4', bg: '#ECFEFF', label: 'Malicious Links' },
];

export default function ScreenshotScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    try {
      // 1. On Web, launch directly
      if (Platform.OS === 'web') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.85,
        });
        if (!result.canceled && result.assets?.[0]) {
          setImageUri(result.assets[0].uri);
        }
        return;
      }

      // 2. On Native, check existing permissions
      const permissionCheck = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      if (permissionCheck.status === 'granted') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.85,
        });
        if (!result.canceled && result.assets?.[0]) {
          setImageUri(result.assets[0].uri);
        }
        return;
      }

      // 3. On Android, try direct launch (runs without runtime permission on Android 11+)
      if (Platform.OS === 'android') {
        try {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.85,
          });
          if (!result.canceled && result.assets?.[0]) {
            setImageUri(result.assets[0].uri);
            return;
          }
        } catch (err) {
          // Fall through to permission request
        }
      }

      // 4. Request permission on native
      const permissionRequest = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionRequest.status === 'granted') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.85,
        });
        if (!result.canceled && result.assets?.[0]) {
          setImageUri(result.assets[0].uri);
        }
      } else {
        Alert.alert(
          'Permission needed',
          'Please allow photo access in settings to select and scan screenshots.'
        );
      }
    } catch (err) {
      Alert.alert('Upload Error', err.message || 'Could not select image.');
    }
  }

  async function handleAnalyze() {
    if (!imageUri) {
      if (Platform.OS === 'web') { window.alert('Please select a screenshot first.'); }
      else { Alert.alert('No image', 'Please select a screenshot first.'); }
      return;
    }
    setLoading(true);
    try {
      const result = await api.analyzeScreenshot(imageUri);
      result.input_data = '[screenshot]';
      addScan(result);
      setCurrentResult(result);
      navigation.navigate('Result');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Cannot reach the backend.';
      if (Platform.OS === 'web') { window.alert(msg); }
      else { Alert.alert('Analysis failed', msg); }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && <ScanLineLoader isDark={isDark} label="Running OCR scan..." />}

      {/* Hero Header */}
      <View style={[styles.hero, { paddingTop: insets.top + 8, backgroundColor: isDark ? '#251800' : '#FFFBEB' }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: isDark ? '#1E2230' : '#fff', borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.heroBadgeIcon, { backgroundColor: ACCENT + '20' }]}>
          <Ionicons name="image" size={28} color={ACCENT} />
        </View>
        <Text style={[styles.heroTitle, { color: isDark ? '#fff' : '#1A1D2E' }]}>Screenshot Scanner</Text>
        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>Upload a screenshot to detect scams via OCR</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Upload / Preview card */}
        <View style={[styles.uploadCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.uploadArea,
              {
                backgroundColor: colors.surface,
                borderColor: imageUri ? ACCENT : colors.border,
                borderStyle: imageUri ? 'solid' : 'dashed',
              },
            ]}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {imageUri ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
                <View style={styles.previewOverlay}>
                  <View style={[styles.changePhotoBadge, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
                    <Ionicons name="swap-horizontal" size={14} color="#fff" />
                    <Text style={styles.changePhotoText}>Tap to change</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <View style={[styles.uploadIconWrap, { backgroundColor: ACCENT + '20' }]}>
                  <Ionicons name="cloud-upload-outline" size={36} color={ACCENT} />
                </View>
                <Text style={[styles.uploadTitle, { color: colors.text }]}>Select Screenshot</Text>
                <Text style={[styles.uploadSub, { color: colors.textSecondary }]}>JPG, PNG, WEBP supported</Text>
                <View style={[styles.uploadChip, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40' }]}>
                  <Text style={[styles.uploadChipText, { color: ACCENT }]}>Browse files</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* Scan button */}
          <TouchableOpacity
            style={[styles.analyzeBtn, { backgroundColor: ACCENT, opacity: imageUri ? 1 : 0.45 }]}
            onPress={handleAnalyze}
            activeOpacity={0.85}
            disabled={!imageUri}
          >
            <Ionicons name="scan-outline" size={18} color="#fff" />
            <Text style={styles.analyzeBtnText}>Scan Screenshot</Text>
          </TouchableOpacity>

          {imageUri && (
            <TouchableOpacity onPress={pickImage} style={styles.changeLink}>
              <Ionicons name="refresh-outline" size={14} color={colors.primary} />
              <Text style={[styles.changeLinkText, { color: colors.primary }]}>Choose different image</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Detection capabilities grid */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>WHAT WE DETECT</Text>
        <View style={styles.detectGrid}>
          {DETECTS.map((d) => (
            <View
              key={d.label}
              style={[
                styles.detectCard,
                { backgroundColor: isDark ? colors.card : d.bg, borderColor: d.color + '30' },
              ]}
            >
              <View style={[styles.detectIcon, { backgroundColor: d.color + '20' }]}>
                <Ionicons name={d.icon} size={18} color={d.color} />
              </View>
              <Text style={[styles.detectLabel, { color: isDark ? colors.text : d.color }]}>{d.label}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <View style={[styles.howCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>HOW OCR SCAN WORKS</Text>
          {[
            { n: '1', t: 'Screenshot is processed by OCR to extract all visible text' },
            { n: '2', t: 'Extracted text is analyzed for scam patterns, URLs, and urgency tactics' },
            { n: '3', t: 'A safety score with highlighted suspicious elements is returned' },
          ].map((s) => (
            <View key={s.n} style={styles.howRow}>
              <View style={[styles.howNum, { backgroundColor: ACCENT + '20' }]}>
                <Text style={[styles.howNumText, { color: ACCENT }]}>{s.n}</Text>
              </View>
              <Text style={[styles.howText, { color: colors.textSecondary }]}>{s.t}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 6,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 52,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroBadgeIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  heroSub: { fontSize: 13, textAlign: 'center' },

  body: { padding: 16, gap: 16 },

  uploadCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    ...Shadow.sm,
  },
  uploadArea: {
    borderWidth: 2,
    borderRadius: 16,
    minHeight: 210,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlaceholder: { alignItems: 'center', gap: 12, padding: 24 },
  uploadIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontSize: 17, fontWeight: '700' },
  uploadSub: { fontSize: 13 },
  uploadChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginTop: 4,
  },
  uploadChipText: { fontSize: 12, fontWeight: '700' },

  previewWrap: { width: '100%', height: 210 },
  preview: { width: '100%', height: '100%' },
  previewOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  changePhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  changePhotoText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  changeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: -4,
  },
  changeLinkText: { fontSize: 13, fontWeight: '600' },

  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: 4 },

  detectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detectCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  detectIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectLabel: { fontSize: 12, fontWeight: '700' },

  howCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  howNum: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  howNumText: { fontSize: 13, fontWeight: '800' },
  howText: { fontSize: 13, flex: 1, lineHeight: 20 },
});
