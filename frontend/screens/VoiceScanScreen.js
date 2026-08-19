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
import ConfidenceArc from '../components/ConfidenceArc';
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
  const [analysisConfidence, setAnalysisConfidence] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const webChunksRef = useRef([]);
  const webAudioBlobRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingStartTimeRef = useRef(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef('');

  const [micVolume, setMicVolume] = useState(0);
  const [isMicQuiet, setIsMicQuiet] = useState(false);
  const [isProcessingState, setIsProcessingState] = useState(false);

  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef([...Array(7)].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) {}
      }
    };
  }, []);

  function startPulse() {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
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
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start();
  }

  // Web recording via MediaRecorder + Web Speech API
  async function startRecordingWeb() {
    if (isProcessingState) return;
    setIsProcessingState(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error("No microphone audio track found.");
      }

      console.log('Recording started');
      console.log('Microphone:', audioTrack.label || 'Default Microphone');
      console.log('Track enabled:', audioTrack.enabled);
      console.log('Track muted:', audioTrack.muted);
      console.log('Track readyState:', audioTrack.readyState);
      console.log('Audio track settings:', audioTrack.getSettings ? audioTrack.getSettings() : {});

      webChunksRef.current = [];
      webAudioBlobRef.current = null;
      liveTranscriptRef.current = '';
      recordingStartTimeRef.current = Date.now();
      setRecordingUri(null);
      setTranscript(null);
      setAnalysisVerdict(null);
      setDuration(0);
      setMicVolume(0);
      setIsMicQuiet(false);

      // Web Audio API volume monitoring
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const actx = new AudioContext();
          audioContextRef.current = actx;
          const source = actx.createMediaStreamSource(stream);
          const analyser = actx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let quietTicks = 0;

          const checkVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            const vol = Math.min(100, Math.round((avg / 128) * 100));
            setMicVolume(vol);

            if (vol < 2) {
              quietTicks++;
              if (quietTicks > 10) setIsMicQuiet(true);
            } else {
              quietTicks = 0;
              setIsMicQuiet(false);
            }

            if (mediaStreamRef.current && mediaStreamRef.current.active) {
              requestAnimationFrame(checkVolume);
            }
          };
          requestAnimationFrame(checkVolume);
        }
      } catch (e) {
        console.log('Web Audio API monitoring note:', e?.message);
      }

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }
      console.log('Chosen mimeType:', mimeType);

      const mr = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          console.log(`Audio chunk received: ${e.data.size} bytes`);
          webChunksRef.current.push(e.data);
        }
      };

      mr.onerror = (evt) => {
        console.error('MediaRecorder error:', evt);
      };

      mr.onstart = () => {
        console.log('MediaRecorder state:', mr.state);
      };

      mr.start(500);
      setMediaRecorder(mr);
      setIsRecording(true);
      setIsProcessingState(false);

      // Web Speech API initialization
      if (typeof window !== 'undefined') {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          try {
            const rec = new SpeechRecognition();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = selectedLanguage === 'hi' ? 'hi-IN' : selectedLanguage === 'te' ? 'te-IN' : selectedLanguage === 'ta' ? 'ta-IN' : 'en-IN';
            rec.onresult = (evt) => {
              let fullText = '';
              for (let i = 0; i < evt.results.length; i++) {
                fullText += evt.results[i][0].transcript + ' ';
              }
              const trimmed = fullText.trim();
              if (trimmed) {
                liveTranscriptRef.current = trimmed;
                setTranscript(trimmed);
              }
            };
            rec.start();
            recognitionRef.current = rec;
          } catch (e) {
            console.log('Web Speech API note:', e?.message);
          }
        }
      }

      startPulse();
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (e) {
      setIsProcessingState(false);
      console.error('Unable to start microphone:', e);
      Alert.alert('Microphone error', e?.message || 'Unable to access microphone.');
    }
  }

  async function stopRecordingWeb() {
    if (isProcessingState) return null;
    setIsProcessingState(true);
    return new Promise((resolve) => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        setIsProcessingState(false);
        return resolve(webAudioBlobRef.current || null);
      }

      const durationMs = Date.now() - (recordingStartTimeRef.current || 0);

      mediaRecorder.onstop = () => {
        try {
          const mime = mediaRecorder.mimeType || 'audio/webm;codecs=opus';
          const blob = new Blob(webChunksRef.current, { type: mime });

          console.log(`Recording duration: ${durationMs} ms`);
          console.log(`Total chunks: ${webChunksRef.current.length}`);
          webChunksRef.current.forEach((c, idx) => {
            console.log(`  Chunk ${idx + 1}: ${c.size} bytes`);
          });
          console.log(`Final audio size: ${blob.size} bytes`);

          // Stop Web Audio API & MediaStream tracks AFTER creating final Blob
          if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch (e) {}
            audioContextRef.current = null;
          }
          analyserRef.current = null;
          setMicVolume(0);
          setIsMicQuiet(false);
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop());

          setIsRecording(false);
          clearInterval(timerRef.current);
          stopPulse();
          setIsProcessingState(false);

          if (blob.size < 100) {
            console.error('Recording empty:', blob.size, 'bytes');
            Alert.alert(
              'Empty Recording',
              'Microphone recording was empty. Please check microphone permissions and try recording again.'
            );
            return resolve(null);
          }

          if (blob.size < 5000) {
            console.warn('[MIC] Recording size is small:', blob.size, 'bytes. Sending for analysis...');
          }

          webAudioBlobRef.current = blob;
          const url = URL.createObjectURL(blob);
          setRecordingUri(url);
          resolve(blob);
        } catch (err) {
          setIsProcessingState(false);
          console.error('Error on MediaRecorder stop:', err);
          resolve(null);
        }
      };

      try {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.requestData();
        }
      } catch (err) {
        console.log('requestData note:', err?.message);
      }

      setTimeout(() => {
        try {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        } catch (err) {
          console.log('stop note:', err?.message);
        }
      }, 200);
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
      // ── Reset all state for a fresh recording ──
      liveTranscriptRef.current = '';
      webAudioBlobRef.current = null;
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
  const [audioFileName, setAudioFileName] = useState(null);

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
        const asset = result.assets[0];
        setRecordingUri(asset.uri);
        setAudioFileName(asset.name || 'uploaded_audio');
        setTranscript(null);
        setAnalysisVerdict(null);
        setDuration(0);
        Alert.alert('Audio loaded', `Loaded "${asset.name || 'Audio file'}". Tap Analyze Now to begin transcription & scam detection.`);
      }
    } catch (e) {
      Alert.alert('Error picking document', e.message);
    }
  }

  const handleWebFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      webAudioBlobRef.current = file;
      setAudioFileName(file.name);
      const url = URL.createObjectURL(file);
      setRecordingUri(url);
      setTranscript(null);
      setAnalysisVerdict(null);
      setDuration(0);
      Alert.alert('Audio loaded', `Loaded "${file.name}". Tap Analyze Now to begin transcription & scam detection.`);
    }
  };

  async function handleAnalyze() {
    let capturedBlob = webAudioBlobRef.current;

    // ── 1. Turn off microphone automatically if currently recording ───────────
    if (isRecording) {
      console.log('[VOICE] Recording active when Analyze pressed — turning off microphone...');
      capturedBlob = await stopRecording();
      if (capturedBlob) {
        webAudioBlobRef.current = capturedBlob;
        console.log(`[VOICE] Microphone turned off. Captured audio blob: ${capturedBlob.size}B`);
      }
    }

    // ── 2. Snapshot state (avoid stale closure on re-render) ──────────────
    const audioBlob   = capturedBlob || webAudioBlobRef.current || null;
    const audioUri    = recordingUri || null;
    const audioSource = audioBlob || audioUri || null;
    const clientTranscript = (liveTranscriptRef.current || transcript || '').trim() || null;

    if (audioBlob) {
      console.log(`[VOICE] Audio blob ready: ${audioBlob.size}B type=${audioBlob.type} name=${audioBlob.name || audioFileName || ''}`);
    } else if (audioUri) {
      console.log(`[VOICE] Audio URI: ${audioUri}`);
    }
    if (clientTranscript) {
      console.log(`[VOICE] Client transcript: ${clientTranscript.length} chars`);
    }

    if (!audioSource && !clientTranscript) {
      Alert.alert('No audio source', 'Please record a call, upload an audio file, or enter a transcript first.');
      return;
    }

    // ── 3. Reject empty blobs ──────────────────────────────────
    if (audioBlob && audioBlob.size < 100) {
      Alert.alert(
        'Empty Audio Recording',
        'The recording contains no audio bytes. Please record again or upload an audio file.'
      );
      return;
    }

    setLoading(true);
    try {
      const rawName = audioBlob?.name || audioFileName || (audioUri ? audioUri.split('/').pop()?.split('?')[0] : null);
      const ext = rawName && rawName.includes('.') ? rawName.split('.').pop().toLowerCase() : (IS_WEB ? 'webm' : 'm4a');
      const format = ext || (IS_WEB ? 'webm' : 'm4a');

      const res = await api.analyzeVoice(audioSource, format, clientTranscript, selectedLanguage, rawName);

      // Normalize result shape
      if (!res.input_data) {
        res.input_data = res.raw?.transcript || res.transcript || clientTranscript || '[Voice Call Recording]';
      }

      const previewUrl = audioBlob ? URL.createObjectURL(audioBlob) : (audioUri || null);
      if (previewUrl) {
        res.audioUri = previewUrl;
      }

      const entry = await addScan(res);
      setCurrentResult(entry || res);
      setTranscript(res.raw?.transcript || res.transcript || clientTranscript || '');
      setAnalysisVerdict(res.verdict);
      setAnalysisConfidence(res.confidence || 0);
      setLoading(false);

      // ── 4. Reset ephemeral refs so next analyze is a clean slate ─────
      liveTranscriptRef.current = '';
      webAudioBlobRef.current = null;

      if (IS_WEB && typeof document !== 'undefined' && document.activeElement) {
        try { document.activeElement.blur(); } catch (e) {}
      }
      navigation.navigate('Result');
    } catch (e) {
      setLoading(false);
      const msg = e?.response?.data?.detail || e?.message || 'Cannot reach the backend.';
      Alert.alert('Analysis failed', msg);
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
      {loading && <ScanLineLoader isDark={isDark} label="Extracting text with Whisper AI and analyzing..." />}
      <Header
        title="Voice Scanner"
        subtitle="Record or upload audio to spot scams"
        isDark={isDark}
        onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main', { screen: 'Home' });
          }
        }}
      />

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
        {/* Language Selector Bar */}
        <View style={[{ padding: 14, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }, Shadow.sm]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="language-outline" size={16} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: colors.textSecondary, fontFamily: Typography.monoBold }}>
              SPOKEN AUDIO LANGUAGE
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[
              { id: 'auto', label: '🌐 Auto Detect' },
              { id: 'en', label: '🇬🇧 English' },
              { id: 'hi', label: '🇮🇳 Hindi (हिंदी)' },
              { id: 'te', label: '🇮🇳 Telugu (తెలుగు)' },
              { id: 'ta', label: '🇮🇳 Tamil (தமிழ்)' },
            ].map((lang) => {
              const active = selectedLanguage === lang.id;
              return (
                <TouchableOpacity
                  key={lang.id}
                  onPress={() => setSelectedLanguage(lang.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    borderWidth: 1,
                    backgroundColor: active ? (isDark ? 'rgba(67, 97, 238, 0.25)' : 'rgba(67, 97, 238, 0.12)') : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: active ? '800' : '600', color: active ? colors.primary : colors.textSecondary, fontFamily: Typography.body }}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

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

          {isRecording && (
            <View style={{ width: '85%', marginTop: 12, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="volume-high-outline" size={14} color={isMicQuiet ? '#F59E0B' : '#10B981'} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11, color: isMicQuiet ? '#F59E0B' : colors.textSecondary, fontWeight: '600' }}>
                  Mic Volume: {micVolume}% {isMicQuiet ? '⚠️ Low input detected' : ''}
                </Text>
              </View>
              <View style={{ width: '100%', height: 6, backgroundColor: isDark ? '#334155' : '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ width: `${Math.max( micVolume, 2 )}%`, height: '100%', backgroundColor: isMicQuiet ? '#F59E0B' : '#10B981' }} />
              </View>
            </View>
          )}

          {recordingUri && !isRecording && (
            <View style={{ marginTop: 14, width: '90%', alignItems: 'center', backgroundColor: isDark ? '#1E293B' : '#F1F5F9', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 11, color: colors.primary, marginBottom: 6, fontWeight: '800', letterSpacing: 0.5 }}>
                AUDIO PREVIEW PLAYER
              </Text>
              {IS_WEB ? (
                <audio src={recordingUri} controls style={{ width: '100%', height: 36 }} />
              ) : (
                <Text style={{ fontSize: 12, color: colors.text }}>
                  Audio recording loaded and ready to analyze.
                </Text>
              )}
            </View>
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
                {isRecording ? 'Stop & Analyze' : (recordingUri ? 'Extract Text & Analyze' : 'Analyze Now')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Threat Score Meter (Confidence Arc) Card */}
        {analysisVerdict ? (
          <View style={[{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border }, Shadow.sm]}>
            <ConfidenceArc
              score={analysisConfidence}
              verdict={analysisVerdict}
              size={170}
              isDark={isDark}
            />
            <Text style={{ marginTop: 10, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: Colors.verdict[analysisVerdict] || colors.primary, fontFamily: Typography.monoBold }}>
              THREAT RISK CONFIDENCE · {analysisVerdict}
            </Text>
          </View>
        ) : null}

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
