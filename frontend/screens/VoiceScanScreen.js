import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, ScrollView, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import Header from '../components/Header';
import ScanLineLoader from '../components/ScanLineLoader';
import TextureBackground from '../components/TextureBackground';
import api from '../services/api';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

const IS_WEB = Platform.OS === 'web';

const WAVEFORM_COLORS = [
  '#4361EE',
  '#3F37C9',
  '#7209B7',
  '#F72585',
  '#7209B7',
  '#3F37C9',
  '#4361EE',
];

export default function VoiceScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [mediaRecorder, setMediaRecorder] = useState(null); // web: MediaRecorder obj
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recordingUri, setRecordingUri] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [analysisVerdict, setAnalysisVerdict] = useState(null);
  const webChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef([...Array(7)].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
    };
  }, []);

  function startPulse() {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ])).start();
    waveAnims.forEach((anim, i) => {
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: 0.9, duration: 300 + i * 80, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0.2 + Math.random() * 0.3, duration: 300 + i * 80, useNativeDriver: false }),
      ])).start();
    });
  }

  function stopPulse() {
    pulseAnim.stopAnimation();
    waveAnims.forEach((a) => a.stopAnimation());
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }

  // Web recording via MediaRecorder
  async function startRecordingWeb() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      webChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) webChunksRef.current.push(e.data); };
      mr.start();
      setMediaRecorder(mr);
      setIsRecording(true);
      setDuration(0);
      setRecordingUri(null);
      setTranscript(null);
      setAnalysisVerdict(null);
      startPulse();
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (e) {
      Alert.alert('Recording error', e.message);
    }
  }

  async function stopRecordingWeb() {
    return new Promise((resolve) => {
      if (!mediaRecorder) return resolve(null);
      mediaRecorder.onstop = () => {
        const blob = new Blob(webChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingUri(url);
        setIsRecording(false);
        clearInterval(timerRef.current);
        stopPulse();
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        resolve(url);
      };
      mediaRecorder.stop();
    });
  }

  // Native recording via expo-audio
  async function startRecordingNative() {
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow microphone access to record voice.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setDuration(0);
      setRecordingUri(null);
      setTranscript(null);
      setAnalysisVerdict(null);
      startPulse();
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (e) {
      Alert.alert('Recording error', e.message);
    }
  }

  async function stopRecordingNative() {
    if (!audioRecorder) return null;
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setRecordingUri(uri);
      setIsRecording(false);
      clearInterval(timerRef.current);
      stopPulse();
      return uri;
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  const startRecording = IS_WEB ? startRecordingWeb : startRecordingNative;
  const stopRecording = IS_WEB ? stopRecordingWeb : stopRecordingNative;

  async function handleUpload() {
    if (IS_WEB) {
      fileInputRef.current?.click();
      return;
    }
    // Native document picker
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (!result.canceled && result.assets?.[0]) {
        setRecordingUri(result.assets[0].uri);
        setTranscript(null);
        setAnalysisVerdict(null);
        setDuration(0);
        Alert.alert('Audio loaded', 'Audio file selected successfully. Tap Analyze to begin transcription.');
      }
    } catch (e) {
      Alert.alert('Error picking document', e.message);
    }
  }

  const handleWebFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setRecordingUri(url);
      setTranscript(null);
      setAnalysisVerdict(null);
      setDuration(0);
      Alert.alert('Audio loaded', 'Audio file selected successfully. Tap Analyze to begin transcription.');
    }
  };

  async function handleAnalyze() {
    let uri = recordingUri;
    if (isRecording) {
      uri = await stopRecording();
    }
    if (!uri) {
      Alert.alert('No audio source', 'Please record a call or upload an audio file first.');
      return;
    }

    setLoading(true);
    try {
      const format = IS_WEB ? 'webm' : 'm4a';
      const res = await api.analyzeVoice(uri, format);
      res.input_data = '[Voice audio file]';
      addScan(res);
      setCurrentResult(res);
      setTranscript(res.raw?.transcript || '');
      setAnalysisVerdict(res.verdict);
      setTimeout(() => {
        navigation.navigate('Result');
      }, 1500);
    } catch (e) {
      Alert.alert('Analysis failed', e?.response?.data?.detail || e?.message || 'Cannot reach the backend.');
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextureBackground isDark={isDark} />
      {loading && <ScanLineLoader isDark={isDark} label="Transcribing call with Whisper..." />}
      <Header title="Voice Scanner" subtitle="Record or upload audio to spot scams" isDark={isDark} onBack={() => navigation.goBack()} />

      {IS_WEB && (
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={handleWebFileChange}
        />
      )}

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 60 }]} showsVerticalScrollIndicator={false}>
        {/* Record circular area */}
        <View style={[styles.recordSection, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <Animated.View
            style={[
              styles.pulseOuter,
              {
                transform: [{ scale: pulseAnim }],
                backgroundColor: isRecording
                  ? 'rgba(239, 68, 68, 0.15)'
                  : (isDark ? 'rgba(67, 97, 238, 0.08)' : 'rgba(67, 97, 238, 0.04)'),
              }
            ]}
          >
            <TouchableOpacity
              onPress={isRecording ? stopRecording : startRecording}
              activeOpacity={0.85}
              style={styles.recordBtnWrap}
            >
              <LinearGradient
                colors={isRecording ? ['#FF007F', '#EF4444'] : ['#4361EE', '#3A0CA3']}
                style={styles.recordBtn}
              >
                <Ionicons name={isRecording ? 'stop' : 'mic'} size={40} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {isRecording && (
            <Text style={[styles.timer, { color: '#FF007F', fontWeight: '800' }]}>
              Recording: {formatTime(duration)}
            </Text>
          )}
          {recordingUri && !isRecording && (
            <Text style={[styles.timer, { color: Colors.verdict.SAFE, fontWeight: '700' }]}>
              Audio Ready · {formatTime(duration)}
            </Text>
          )}
          {!isRecording && !recordingUri && (
            <Text style={[styles.timer, { color: colors.textSecondary, fontWeight: '600' }]}>
              Tap microphone to record
            </Text>
          )}

          {/* Color Waveform */}
          {isRecording ? (
            <View style={styles.waveform}>
              {waveAnims.map((anim, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      backgroundColor: WAVEFORM_COLORS[i],
                      height: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 44] }),
                    },
                  ]}
                />
              ))}
            </View>
          ) : (
            <View style={styles.waveformPlaceholder}>
              <View style={[styles.placeholderBar, { backgroundColor: colors.border }]} />
              <View style={[styles.placeholderBar, { backgroundColor: colors.border }]} />
              <View style={[styles.placeholderBar, { backgroundColor: colors.border }]} />
              <View style={[styles.placeholderBar, { backgroundColor: colors.border }]} />
              <View style={[styles.placeholderBar, { backgroundColor: colors.border }]} />
            </View>
          )}
        </View>

        {/* Action Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleUpload}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Upload Audio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.analyzeBtnWrap}
            onPress={handleAnalyze}
            activeOpacity={0.8}
            disabled={!isRecording && !recordingUri}
          >
            <LinearGradient
              colors={isRecording ? ['#FF007F', '#EF4444'] : ['#4361EE', '#00E5A0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.actionBtnGradient, (!isRecording && !recordingUri) && { opacity: 0.5 }]}
            >
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
              <Text style={styles.actionBtnTextWhite}>
                {isRecording ? 'Stop & Analyze' : 'Analyze Now'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Console-style Transcript Box */}
        <View style={[styles.transcriptCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <View style={styles.transcriptHeader}>
            <View style={[styles.liveDot, { backgroundColor: isRecording ? '#FF007F' : '#10B981' }]} />
            <Text style={[styles.transcriptTitle, { color: colors.textSecondary }]}>
              TRANSCRIPTION TERMINAL
            </Text>
          </View>
          <Text style={[styles.transcriptText, { color: transcript ? colors.text : colors.textMuted }]}>
            {loading
              ? 'Whisper AI is transcribing and running scam diagnostics...'
              : transcript
              ? `"${transcript}"`
              : isRecording
              ? 'Microphone active. Waiting for transcription analysis...'
              : recordingUri
              ? 'Audio payload loaded. Press "Analyze Now" to begin.'
              : 'Waiting for recording or file upload...'}
          </Text>
          {analysisVerdict && transcript ? (
            <View style={[styles.scamAlert, {
              backgroundColor: isDark
                ? Colors.verdictBgDark[analysisVerdict] || '#1E2230'
                : Colors.verdictBg[analysisVerdict] || '#F0F2F8',
              borderColor: Colors.verdict[analysisVerdict] || colors.border
            }]}>
              <Ionicons
                name={analysisVerdict === 'SAFE' ? 'checkmark-circle' : 'warning'}
                size={16}
                color={Colors.verdict[analysisVerdict] || Colors.verdict.SAFE}
              />
              <Text style={[styles.scamAlertText, { color: Colors.verdict[analysisVerdict] || Colors.verdict.SAFE }]}>
                {analysisVerdict === 'SAFE' ? 'Analysis Complete: Legitimate Call' : `Scam Diagnostic Alert: ${analysisVerdict}`}
              </Text>
            </View>
          ) : null}
        </View>

        {/* How It Works Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>SECURE VOICE ENGINE DICTIONARY</Text>
          {[
            'Audio is securely transcribed via Whisper AI model.',
            'Decoded dialogue is scanned for phishing, emergency pressure, or banking requests.',
            'Flagged scam phrases are highlighted in real-time on your dashboard.',
          ].map((t, i) => (
            <View key={i} style={styles.infoRow}>
              <LinearGradient
                colors={['#4361EE', '#00E5A0']}
                style={styles.infoBadge}
              >
                <Text style={styles.infoBadgeText}>{i + 1}</Text>
              </LinearGradient>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  recordSection: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 16,
  },
  pulseOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  recordBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    fontSize: 15,
    letterSpacing: 0.5,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 50,
    marginTop: 8,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  waveformPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 50,
    marginTop: 8,
    opacity: 0.3,
  },
  placeholderBar: {
    width: 4,
    height: 8,
    borderRadius: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  analyzeBtnWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  actionBtnTextWhite: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  transcriptCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  transcriptTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  scamAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  scamAlertText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 12,
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  infoBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  infoText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});
