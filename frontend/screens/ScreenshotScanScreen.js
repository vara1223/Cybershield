import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import Header from '../components/Header';
import ScanLineLoader from '../components/ScanLineLoader';
import ScreenContainer from '../components/ScreenContainer';
import api from '../services/api';


export default function ScreenshotScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;

  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to scan screenshots.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handleAnalyze() {
    if (!imageUri) { Alert.alert('No image', 'Please select a screenshot first.'); return; }
    setLoading(true);
    try {
      const result = await api.analyzeScreenshot(imageUri);
      result.input_data = '[screenshot]';
      addScan(result);
      setCurrentResult(result);
      navigation.navigate('Result');
    } catch (e) {
      Alert.alert('Analysis failed', e?.response?.data?.detail || e?.message || 'Cannot reach the backend. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && <ScanLineLoader isDark={isDark} label="Running OCR scan..." />}
      <Header title="Screenshot scanner" subtitle="Upload image to detect scams" isDark={isDark} onBack={() => navigation.goBack()} />

      <ScreenContainer isDark={isDark} scrollable>
        {/* Upload area */}
        <TouchableOpacity
          style={[
            styles.uploadArea,
            {
              backgroundColor: colors.surface,
              borderColor: imageUri ? colors.borderActive : colors.border,
              borderStyle: imageUri ? 'solid' : 'dashed',
            },
          ]}
          onPress={pickImage}
          activeOpacity={0.8}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <View style={[styles.uploadIcon, { backgroundColor: '#F59E0B18' }]}>
                <Ionicons name="image-outline" size={32} color="#F59E0B" />
              </View>
              <Text style={[styles.uploadTitle, { color: colors.text, fontFamily: Typography.bodyMedium }]}>
                Select screenshot
              </Text>
              <Text style={[styles.uploadSub, { color: colors.textSecondary, fontFamily: Typography.body }]}>
                JPG, PNG, WEBP supported
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {imageUri && (
          <TouchableOpacity style={styles.changeLink} onPress={pickImage}>
            <Text style={[styles.changeLinkText, { color: colors.primary, fontFamily: Typography.body }]}>
              Choose different image
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.analyzeBtn, { backgroundColor: '#F59E0B', opacity: imageUri ? 1 : 0.4 }]}
          onPress={handleAnalyze}
          activeOpacity={0.85}
          disabled={!imageUri}
        >
          <Ionicons name="scan-outline" size={18} color="#fff" />
          <Text style={[styles.analyzeBtnText, { fontFamily: Typography.bodySemiBold }]}>Scan Screenshot</Text>
        </TouchableOpacity>

        {/* Capabilities */}
        <View style={[styles.capCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <Text style={[styles.capTitle, { color: colors.textSecondary, fontFamily: Typography.monoBold }]}>
            WHAT WE DETECT
          </Text>
          {[
            ['chatbubble-outline', 'Scam SMS and WhatsApp messages'],
            ['card-outline', 'Fake bank and payment alerts'],
            ['key-outline', 'OTP phishing attempts'],
            ['business-outline', 'Brand impersonation (SBI, HDFC, Paytm)'],
            ['warning-outline', 'Urgency manipulation tactics'],
          ].map(([icon, text], i) => (
            <View key={i} style={styles.capRow}>
              <Ionicons name={icon} size={14} color={colors.accent} />
              <Text style={[styles.capText, { color: colors.textSecondary, fontFamily: Typography.body }]}>{text}</Text>
            </View>
          ))}
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  uploadArea: {
    borderWidth: 1.5, borderRadius: Radius.lg,
    minHeight: 220, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  preview: { width: '100%', height: 220 },
  uploadPlaceholder: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg },
  uploadIcon: { width: 64, height: 64, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { fontSize: 16 },
  uploadSub: { fontSize: 13 },
  changeLink: { alignItems: 'center', marginTop: 8 },
  changeLinkText: { fontSize: 13 },
  analyzeBtn: {
    borderRadius: Radius.md, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: Spacing.md,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16 },
  capCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  capTitle: { fontSize: 11, letterSpacing: 1.2, marginBottom: 4 },
  capRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  capText: { fontSize: 13, flex: 1 },
});
