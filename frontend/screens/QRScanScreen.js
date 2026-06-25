import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import Header from '../components/Header';
import ScanLineLoader from '../components/ScanLineLoader';
import TextureBackground from '../components/TextureBackground';
import api from '../services/api';

const { width } = Dimensions.get('window');
const SCAN_BOX = width * 0.7;

const IS_WEB = Platform.OS === 'web';

export default function QRScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  // On web, mock camera permission to be granted so we don't get stuck on check/errors
  const permission = Platform.OS === 'web' ? { granted: true } : cameraPermission;
  const requestPermission = Platform.OS === 'web' ? async () => ({ granted: true }) : requestCameraPermission;

  const [mode, setMode] = useState('camera'); // Default to camera
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const cameraRef = useRef(null);

  async function handleBarcodeScanned({ data }) {
    if (scanned || loading) return;
    setScanned(true);
    await analyzeContent(data);
  }

  async function handleCapture() {
    if (cameraRef.current) {
      setLoading(true);
      try {
        const options = { quality: 0.85, skipProcessing: false };
        const photo = await cameraRef.current.takePictureAsync(options);
        if (photo?.uri) {
          await analyzeImage(photo.uri);
        } else {
          Alert.alert('Capture failed', 'Could not take a snapshot of the QR code.');
        }
      } catch (e) {
        Alert.alert('Camera error', e.message || 'Error capturing image from camera.');
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleUpload() {
    try {
      // 1. On Web, launch directly
      if (Platform.OS === 'web') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.9,
        });
        if (!result.canceled && result.assets?.[0]) {
          await analyzeImage(result.assets[0].uri);
        }
        return;
      }

      // 2. On Native, check existing permissions
      const permissionCheck = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      if (permissionCheck.status === 'granted') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          quality: 0.9,
        });
        if (!result.canceled && result.assets?.[0]) {
          await analyzeImage(result.assets[0].uri);
        }
        return;
      }

      // 3. On Android, try direct launch (runs without runtime permission on Android 11+)
      if (Platform.OS === 'android') {
        try {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.9,
          });
          if (!result.canceled && result.assets?.[0]) {
            await analyzeImage(result.assets[0].uri);
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
          quality: 0.9,
        });
        if (!result.canceled && result.assets?.[0]) {
          await analyzeImage(result.assets[0].uri);
        }
      } else {
        Alert.alert(
          'Permission needed',
          'Please allow photo access in settings to select and scan QR images.'
        );
      }
    } catch (err) {
      Alert.alert('Upload Error', err.message || 'Could not select image.');
    }
  }

  async function analyzeImage(uri) {
    setLoading(true);
    try {
      const res = await api.analyzeQR(null, uri);
      res.input_data = '[QR image]';
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

  // Render loading state while permission status is being checked asynchronously
  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12, fontFamily: Typography.mono }}>
          Checking camera permissions...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextureBackground isDark={isDark} />
      {loading && <ScanLineLoader isDark={isDark} label="Decoding QR code..." />}

      {/* Header and Custom Tab Bar */}
      <View style={[styles.headerContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Header
          title="QR Code Scanner"
          subtitle={mode === 'camera' ? 'Open camera to scan QR' : 'Analyze uploaded QR codes'}
          isDark={isDark}
          onBack={() => navigation.goBack()}
        />

        {/* Tab switchers */}
        <View style={[styles.tabContainer, { backgroundColor: isDark ? '#1E2230' : '#EEF0F8' }]}>
          {['camera', 'upload'].map((m) => {
            const active = mode === m;
            return (
              <TouchableOpacity
                key={m}
                style={[
                  styles.tabBtn,
                  active && { backgroundColor: colors.card }
                ]}
                onPress={() => {
                  setScanned(false);
                  setLoading(false);
                  setMode(m);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={m === 'camera' ? 'camera-outline' : 'cloud-upload-outline'}
                  size={16}
                  color={active ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.tabText, { color: active ? colors.text : colors.textSecondary }]}>
                  {m === 'camera' ? 'Scan Camera' : 'Upload QR Image'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.body}>
        {mode === 'camera' ? (
          !permission?.granted ? (
            <View style={styles.centerContainer}>
              <View style={[styles.iconFrame, { backgroundColor: isDark ? '#1E2A50' : '#EEF2FF' }]}>
                <Ionicons name="camera" size={48} color={colors.primary} />
              </View>

              <Text style={[styles.errorTitle, { color: colors.text }]}>
                Camera Access Required
              </Text>

              <Text style={[styles.errorSub, { color: colors.textSecondary }]}>
                Please allow camera access to scan QR codes.
              </Text>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  const res = await requestPermission();
                  if (res?.granted) {
                    setMode('camera');
                  }
                }}
              >
                <Text style={styles.actionBtnText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanned || loading ? undefined : handleBarcodeScanned}
              />

              <View style={styles.overlayContainer} pointerEvents="none">
                <View style={styles.scanTarget}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                  <LinearGradient
                    colors={['rgba(0, 229, 160, 0)', '#00E5A0', 'rgba(0, 229, 160, 0)']}
                    style={styles.laser}
                  />
                </View>

                <Text style={styles.scanInstruction}>
                  {IS_WEB
                    ? 'Align the QR code and click Capture'
                    : 'Align the QR code within the frame to scan'}
                </Text>
              </View>

              {/* On web (or mobile manual capture), show Capture button */}
              {IS_WEB && (
                <TouchableOpacity
                  style={styles.captureFloatBtn}
                  onPress={handleCapture}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#00E5A0', '#4361EE']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                  >
                    <Ionicons name="scan-outline" size={18} color="#fff" />
                    <Text style={styles.rescanText}>Capture & Scan</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {scanned && !IS_WEB && (
                <TouchableOpacity
                  style={styles.rescanFloatBtn}
                  onPress={() => setScanned(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#4361EE', '#00E5A0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                  >
                    <Ionicons name="refresh" size={16} color="#fff" />
                    <Text style={styles.rescanText}>Scan Again</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )
        ) : (
          <View style={styles.uploadContainer}>
            <LinearGradient
              colors={isDark ? ['#1E2230', '#161920'] : ['#FFFFFF', '#EEF0F8']}
              style={[styles.uploadCard, { borderColor: colors.border }]}
            >
              <View style={styles.uploadInner}>
                <LinearGradient
                  colors={['#00E5A0', '#4361EE']}
                  style={styles.uploadIconWrap}
                >
                  <Ionicons name="qr-code-outline" size={40} color="#fff" />
                </LinearGradient>
                <Text style={[styles.uploadTitle, { color: colors.text }]}>Scan QR from Gallery</Text>
                <Text style={[styles.uploadDesc, { color: colors.textSecondary }]}>
                  Upload an image containing a QR code. We will extract and analyze it for phishing or suspicious links.
                </Text>
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={handleUpload}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#4361EE', '#3F37C9']}
                    style={styles.selectBtnGradient}
                  >
                    <Ionicons name="image-outline" size={18} color="#fff" />
                    <Text style={styles.selectBtnText}>Select Image</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={[styles.formatText, { color: colors.textMuted }]}>
                  Supports JPEG, PNG up to 10MB
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  iconFrame: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  scanTarget: {
    width: SCAN_BOX,
    height: SCAN_BOX,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#00E5A0',
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  laser: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: '50%',
    height: 3,
  },
  scanInstruction: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 4,
  },
  rescanFloatBtn: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    borderRadius: 24,
    ...Shadow.md,
  },
  captureFloatBtn: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    borderRadius: 24,
    ...Shadow.md,
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  rescanText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  uploadContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  uploadCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    ...Shadow.sm,
  },
  uploadInner: {
    alignItems: 'center',
    gap: 14,
  },
  uploadIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  uploadDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  selectBtn: {
    width: '100%',
    borderRadius: 14,
    marginTop: 8,
    overflow: 'hidden',
  },
  selectBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  selectBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  formatText: {
    fontSize: 11,
    marginTop: 4,
  },
});
