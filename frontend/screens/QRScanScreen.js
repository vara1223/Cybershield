import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import Header from '../components/Header';
import ScanLineLoader from '../components/ScanLineLoader';
import TextureBackground from '../components/TextureBackground';
import api from '../services/api';

const { width } = Dimensions.get('window');
const SCAN_BOX = width * 0.65;

// Camera-based barcode scanning is not available on web
const IS_WEB = Platform.OS === 'web';

export default function QRScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;

  const [permission, requestPermission] = useCameraPermissions();
  // On web, force upload mode since camera barcode scanning is unsupported
  const [mode, setMode] = useState(IS_WEB ? 'upload' : 'camera');
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  async function handleBarcodeScanned({ data }) {
    if (scanned || loading) return;
    setScanned(true);
    await analyzeContent(data);
  }

  async function handleUpload() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to scan QR images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled && result.assets[0]) {
      setLoading(true);
      try {
        const res = await api.analyzeQR(null, result.assets[0].uri);
        res.input_data = '[QR image]';
        addScan(res);
        setCurrentResult(res);
        navigation.navigate('Result');
      } catch (e) {
        Alert.alert('Analysis failed', e?.response?.data?.detail || e?.message || 'Cannot reach the backend.');
      } finally { setLoading(false); }
    }
  }

  async function analyzeContent(content) {
    setLoading(true);
    try {
      const res = await api.analyzeQR(content);
      res.input_data = content.slice(0, 60);
      addScan(res);
      setCurrentResult(res);
      navigation.navigate('Result');
    } catch (e) {
      Alert.alert('Analysis failed', e?.response?.data?.detail || e?.message || 'Cannot reach the backend.');
    } finally {
      setLoading(false);
      setTimeout(() => setScanned(false), 2000);
    }
  }

  const bg = isDark ? '#0D0F14' : '#0D0F14'; // camera screen is always dark-ish

  return (
    <View style={styles.container}>
      {loading && <ScanLineLoader isDark label="Decoding QR code..." />}

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: isDark ? Colors.dark.card : Colors.light.card, borderBottomColor: isDark ? Colors.dark.border : Colors.light.border }]}>
        <Header title="QR code scanner" subtitle={mode === 'camera' ? 'Point at a QR code' : 'Upload QR image'} isDark={isDark} onBack={() => navigation.goBack()} />
        {/* Only show camera/upload tabs on native; web is upload-only */}
        {!IS_WEB && (
          <View style={[styles.tabs, { borderColor: isDark ? Colors.dark.border : Colors.light.border }]}>
            {['camera', 'upload'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.tab, mode === m && { borderBottomColor: Colors.light.primary, borderBottomWidth: 2 }]}
                onPress={() => setMode(m)}
              >
                <Ionicons name={m === 'camera' ? 'camera-outline' : 'cloud-upload-outline'} size={16} color={mode === m ? Colors.light.primary : (isDark ? Colors.dark.textSecondary : Colors.light.textSecondary)} />
                <Text style={[styles.tabText, { color: mode === m ? Colors.light.primary : (isDark ? Colors.dark.textSecondary : Colors.light.textSecondary), fontFamily: Typography.bodyMedium }]}>
                  {m === 'camera' ? 'Scan camera' : 'Upload image'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {IS_WEB && (
          <View style={[styles.tabs, { borderColor: isDark ? Colors.dark.border : Colors.light.border }]}>
            <View style={[styles.tab, { borderBottomColor: Colors.light.primary, borderBottomWidth: 2 }]}>
              <Ionicons name="cloud-upload-outline" size={16} color={Colors.light.primary} />
              <Text style={[styles.tabText, { color: Colors.light.primary, fontFamily: Typography.bodyMedium }]}>Upload image</Text>
            </View>
          </View>
        )}
      </View>

      {mode === 'camera' ? (
        !permission?.granted ? (
          <View style={[styles.permBox, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
            <TextureBackground isDark={isDark} />
            <Ionicons name="camera-outline" size={48} color={isDark ? Colors.dark.textMuted : Colors.light.textMuted} />
            <Text style={[styles.permText, { color: isDark ? Colors.dark.text : Colors.light.text, fontFamily: Typography.bodyMedium }]}>
              Camera access required
            </Text>
            <TouchableOpacity
              style={[styles.permBtn, { backgroundColor: Colors.light.primary }]}
              onPress={requestPermission}
            >
              <Text style={[styles.permBtnText, { fontFamily: Typography.bodySemiBold }]}>Grant Access</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            {/* Overlay */}
            <View style={styles.overlay}>
              <View style={[styles.scanBox, { borderColor: Colors.light.accent }]}>
                <View style={[styles.corner, styles.tl, { borderColor: Colors.light.accent }]} />
                <View style={[styles.corner, styles.tr, { borderColor: Colors.light.accent }]} />
                <View style={[styles.corner, styles.bl, { borderColor: Colors.light.accent }]} />
                <View style={[styles.corner, styles.br, { borderColor: Colors.light.accent }]} />
              </View>
              <Text style={[styles.scanHint, { fontFamily: Typography.mono }]}>
                Align QR code within the frame
              </Text>
            </View>
            {scanned && (
              <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
                <Text style={[styles.rescanText, { fontFamily: Typography.monoBold }]}>Tap to scan again</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      ) : (
        <View style={[styles.uploadSection, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
          <TextureBackground isDark={isDark} />
          <TouchableOpacity
            style={[styles.uploadBtn, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface, borderColor: isDark ? Colors.dark.border : Colors.light.border }]}
            onPress={handleUpload}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={48} color={Colors.verdict.SAFE} />
            <Text style={[styles.uploadTitle, { color: isDark ? Colors.dark.text : Colors.light.text, fontFamily: Typography.bodyMedium }]}>
              Upload QR image
            </Text>
            <Text style={[styles.uploadSub, { color: isDark ? Colors.dark.textSecondary : Colors.light.textSecondary, fontFamily: Typography.body }]}>
              JPG, PNG supported
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const CORNER = 20;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  tabText: { fontSize: 13 },
  cameraWrap: { flex: 1, position: 'relative' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 20 },
  scanBox: {
    width: SCAN_BOX, height: SCAN_BOX,
    borderWidth: 0, position: 'relative',
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#00E5A0' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scanHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: 0.5 },
  rescanBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md },
  rescanText: { color: '#fff', fontSize: 14 },
  permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  permText: { fontSize: 16, marginTop: 8 },
  permBtn: { borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  permBtnText: { color: '#fff', fontSize: 15 },
  uploadSection: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  uploadBtn: {
    width: '100%', borderRadius: Radius.lg, borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm,
  },
  uploadTitle: { fontSize: 18 },
  uploadSub: { fontSize: 13 },
});
