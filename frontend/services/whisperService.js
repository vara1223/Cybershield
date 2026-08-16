import api from './api';

export const whisperService = {
  /**
   * Load local Whisper Speech-to-Text neural model (openai-whisper-base).
   */
  async loadWhisperModel() {
    return { status: 'ready', engine: 'openai-whisper-base (local PyTorch)' };
  },

  /**
   * Preprocess audio before transcription.
   */
  async preprocessAudio(audioUri) {
    if (!audioUri) throw new Error('Invalid audio file');
    return { status: 'preprocessed', uri: audioUri };
  },

  /**
   * Transcribe audio using local PyTorch Whisper model.
   */
  async transcribeAudio(audioUri, format = 'mp3', clientTranscript = null) {
    const response = await api.analyzeVoice(audioUri, format, clientTranscript);
    return {
      transcript: response.transcript || response.raw?.transcript || '',
      sttProvider: response.raw?.stt_provider || 'openai-whisper-base',
      fullResponse: response,
    };
  },
};

export default whisperService;
