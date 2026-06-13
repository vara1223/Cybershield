import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, ScrollView, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import useScanStore from '../store/useScanStore';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import Header from '../components/Header';
import ScanLineLoader from '../components/ScanLineLoader';
import TextureBackground from '../components/TextureBackground';
import api from '../services/api';

const IS_WEB = Platform.OS === 'web';


export default function VoiceScanScreen({ navigation }) {
  const isDark = useScanStore((s) => s.isDark);
  const addScan = useScanStore((s) => s.addScan);
  const setCurrentResult = useScanStore((s) => s.setCurrentResult);
  const colors = isDark ? Colors.dark : Colors.light;

  const [recording, setRecording] = useState(null);         // native: expo-av Recording obj
  const [mediaRecorder, setMediaRecorder] = useState(null); // web: MediaRecorder obj
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recordingUri, setRecordingUri] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [analysisVerdict, setAnalysisVerdict] = useState(null);
  const webChunksRef = useRef([]);
  // Hidden file input ref for web audio upload
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

  // ─── Web recording via MediaRecorder ─────────────────────────────────────
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
        // Stop all tracks to release microphone
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        resolve(url);
      };
      mediaRecorder.stop();
    });
  }

  // ─── Native recording via expo-av ────────────────────────────────────────
  async function startRecordingNative() {
    try {
      const { Audio } = await import('expo-av');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow microphone access to record voice.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
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
    if (!recording) return null;
    clearInterval(timerRef.current);
    stopPulse();
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);
      setIsRecording(false);
      return uri;
    } catch (e) {
      Alert.alert('Error', e.message);
      return null;
    }
  }

  // ─── Unified start/stop ───────────────────────────────────────────────────
  async function startRecording() {
    if (IS_WEB) return startRecordingWeb();
    return startRecordingNative();
  }

  async function stopRecording() {
    if (IS_WEB) return stopRecordingWeb();
    return stopRecordingNative();
  }

  // ─── Upload audio ─────────────────────────────────────────────────────────
  async function handleUpload() {
    if (IS_WEB) {
      // On web: trigger hidden <input type="file">
      fileInputRef.current && fileInputRef.current.click();
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'] });
    if (!result.canceled && result.assets[0]) {
      setRecordingUri(result.assets[0].uri);
      setDuration(0);
    }
  }

  function handleWebFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRecordingUri(url);
    setDuration(0);
    // Reset input so same file can be picked again
    e.target.value = '';
  }

  async function handleAnalyze() {
    if (!recordingUri && !isRecording) { Alert.alert('No audio', 'Record or upload audio first.'); return; }
    let uriToAnalyze = recordingUri;
    if (isRecording) {
      uriToAnalyze = await stopRecording();
    }
    if (!uriToAnalyze) { Alert.alert('No audio', 'Could not get recording URI.'); return; }
    setLoading(true);
    setTranscript(null);
    setAnalysisVerdict(null);
    try {
      // On web, webm recordings are sent as 'webm'; uploads keep their format
      const format = IS_WEB ? 'webm' : 'm4a';
      const res = await api.analyzeVoice(uriToAnalyze, format);
      res.input_data = '[voice recording]';
      const realTranscript = res.raw?.transcript || res.transcript || '';
      setTranscript(realTranscript);
      setAnalysisVerdict(res.verdict);
      addScan(res);
      setCurrentResult(res);
      navigation.navigate('Result');
    } catch (e) {
      Alert.alert(
        'Analysis failed',
        e?.response?.data?.detail || e?.message || 'Could not reach the server. Make sure the backend is running on port 8000.',
      );
    } finally { setLoading(false); }
  }

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextureBackground isDark={isDark} />
      {loading && <ScanLineLoader isDark={isDark} label="Transcribing audio..." />}
      <Header title="Voice scanner" subtitle="Record or upload a call" isDark={isDark} onBack={() => navigation.goBack()} />

      {/* Hidden file input for web audio upload */}
      {IS_WEB && (
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={handleWebFileChange}
        />
      )}

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 80 }]} showsVerticalScrollIndicator={false}>
        {/* Record button */}
        <View style={styles.recordSection}>
          <Animated.View style={[styles.pulseOuter, { transform: [{ scale: pulseAnim }], backgroundColor: isRecording ? '#EF444420' : colors.surface }]}>
            <TouchableOpacity
              style={[styles.recordBtn, { backgroundColor: isRecording ? '#EF4444' : colors.card, borderColor: isRecording ? '#EF4444' : colors.border }, Shadow.md]}
              onPress={isRecording ? stopRecording : startRecording}
              activeOpacity={0.85}
            >
              <Ionicons name={isRecording ? 'stop' : 'mic'} size={36} color={isRecording ? '#fff' : colors.text} />
            </TouchableOpacity>
          </Animated.View>

          {isRecording && (
            <Text style={[styles.timer, { color: Colors.verdict.DANGEROUS, fontFamily: Typography.monoBold }]}>
              Recording... {formatTime(duration)}
            </Text>
          )}
          {recordingUri && !isRecording && (
            <Text style={[styles.timer, { color: Colors.verdict.SAFE, fontFamily: Typography.mono }]}>
              Recorded {formatTime(duration)} — ready to analyze
            </Text>
          )}
          {!isRecording && !recordingUri && (
            <Text style={[styles.timer, { color: colors.textSecondary, fontFamily: Typography.mono }]}>
              Tap to start recording
            </Text>
          )}

          {/* Waveform */}
          {isRecording && (
            <View style={styles.waveform}>
              {waveAnims.map((anim, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      backgroundColor: Colors.light.primary,
                      height: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 40] }),
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleUpload}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={colors.text} />
            <Text style={[styles.actionBtnText, { color: colors.text, fontFamily: Typography.bodyMedium }]}>Upload audio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isRecording ? '#EF444415' : colors.surface, borderColor: isRecording ? Colors.verdict.DANGEROUS : colors.border }]}
            onPress={handleAnalyze}
            activeOpacity={0.8}
            disabled={!isRecording && !recordingUri}
          >
            <Ionicons name="stop-circle-outline" size={18} color={isRecording ? Colors.verdict.DANGEROUS : colors.textMuted} />
            <Text style={[styles.actionBtnText, { color: isRecording ? Colors.verdict.DANGEROUS : colors.textMuted, fontFamily: Typography.bodyMedium }]}>
              {isRecording ? 'Stop & analyze' : 'Analyze'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Transcript card — shows real Whisper output after analysis */}
        <View style={[styles.transcriptCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
          <Text style={[styles.transcriptTitle, { color: colors.textSecondary, fontFamily: Typography.monoBold }]}>
            WHISPER TRANSCRIPT
          </Text>
          <Text style={[styles.transcriptText, { color: transcript ? colors.text : colors.textMuted, fontFamily: Typography.body }]}>
            {loading
              ? 'Whisper ML model is transcribing your audio...'
              : transcript
              ? `"${transcript}"`
              : isRecording
              ? 'Recording in progress — transcript will appear after analysis.'
              : recordingUri
              ? 'Audio ready. Tap Analyze to run Whisper transcription.'
              : 'Record or upload audio, then tap Analyze to see the transcript here.'}
          </Text>
          {analysisVerdict && transcript ? (
            <View style={[styles.scamAlert, { backgroundColor: Colors.verdictBg[analysisVerdict] || Colors.verdictBg.SAFE }]}>
              <Ionicons
                name={analysisVerdict === 'SAFE' ? 'checkmark-circle' : 'warning'}
                size={14}
                color={Colors.verdict[analysisVerdict] || Colors.verdict.SAFE}
              />
              <Text style={[styles.scamAlertText, { color: Colors.verdict[analysisVerdict] || Colors.verdict.SAFE, fontFamily: Typography.monoBold }]}>
                {analysisVerdict === 'SAFE' ? 'No scam detected' : `${analysisVerdict.toLowerCase()} — see full results`}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.textSecondary, fontFamily: Typography.monoBold }]}>HOW IT WORKS</Text>
          {[
            'Audio transcribed via Whisper ML model (open-source, runs locally)',
            'Text analyzed for fake authority, money demands, threats',
            'Suspicious phrases highlighted in the full results screen',
          ].map((t, i) => (
            <View key={i} style={styles.infoRow}>
              <Text style={[styles.infoNum, { color: Colors.light.primary, fontFamily: Typography.monoBold }]}>{i + 1}.</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary, fontFamily: Typography.body }]}>{t}</Text>
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
  recordSection: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.md },
  pulseOuter: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  recordBtn: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  timer: { fontSize: 16, letterSpacing: 0.5 },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 48 },
  waveBar: { width: 4, borderRadius: 2, backgroundColor: Colors.light.primary },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: Radius.md, borderWidth: 1, paddingVertical: 12,
  },
  actionBtnText: { fontSize: 13 },
  transcriptCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  transcriptTitle: { fontSize: 11, letterSpacing: 1.2 },
  transcriptText: { fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  scamAlert: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: Radius.sm },
  scamAlertText: { fontSize: 12 },
  infoCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  infoTitle: { fontSize: 11, letterSpacing: 1.2, marginBottom: 4 },
  infoRow: { flexDirection: 'row', gap: 8 },
  infoNum: { fontSize: 13, width: 16 },
  infoText: { fontSize: 13, flex: 1, lineHeight: 18 },
});
