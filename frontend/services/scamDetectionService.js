import api from './api';

export const scamDetectionService = {
  /**
   * Load local Scam Detection ML Threat Model.
   */
  async loadModel() {
    return { status: 'ready', engine: 'scikit-learn NLP + PyTorch BERT' };
  },

  /**
   * Analyze text for scam, phishing, and social-engineering indicators.
   */
  async analyzeText(text, feature = 'otp_scan') {
    if (feature === 'otp_scan') return await api.analyzeOTP(text);
    if (feature === 'url_scan') return await api.analyzeURL(text);
    if (feature === 'upi_scan') return await api.analyzeUPI(text);
    return await api.analyzeOTP(text);
  },

  /**
   * Calculate risk level from numerical confidence score.
   */
  calculateRisk(score) {
    if (score >= 60) return { level: 'High', color: '#EF4444' };
    if (score >= 30) return { level: 'Medium', color: '#F59E0B' };
    return { level: 'Low', color: '#10B981' };
  },

  /**
   * Generate human-readable explanation from scan indicators.
   */
  generateExplanation(classification, indicators, reason) {
    if (reason) return reason;
    if (indicators && indicators.length > 0) {
      return `Scam analysis detected key threat signals: ${indicators.join(', ')}.`;
    }
    return `The content was classified as ${classification}.`;
  },
};

export default scamDetectionService;
