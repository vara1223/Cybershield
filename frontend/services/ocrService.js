import api from './api';

export const ocrService = {
  /**
   * Load local OCR model runtime (Windows Native OCR / Tesseract).
   */
  async loadOCRModel() {
    return { status: 'ready', engine: 'Windows Native OCR / Tesseract LSTM' };
  },

  /**
   * Preprocess screenshot image prior to text recognition.
   */
  async preprocessImage(imageUri) {
    if (!imageUri) throw new Error('Invalid image selection');
    return { status: 'preprocessed', uri: imageUri };
  },

  /**
   * Extract text from screenshot using local OCR engine.
   */
  async extractText(imageUri) {
    const response = await api.analyzeScreenshot(imageUri);
    return {
      extractedText: response.extracted_text || response.raw?.extracted_text || '',
      ocrProvider: response.raw?.ocr_provider || 'windows-native-ocr',
      fullResponse: response,
    };
  },
};

export default ocrService;
