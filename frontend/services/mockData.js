export const MOCK_HISTORY = [
  {
    id: 1,
    feature: 'url_scan',
    input_data: 'paymentgateway-secure.in',
    verdict: 'DANGEROUS',
    confidence: 92,
    explanation:
      'The domain impersonates a payment gateway using a fake subdomain. It was registered 3 days ago, has no SSL, and matches 4 known phishing patterns in our database.',
    tips: [
      'Do not click or open this link under any circumstances',
      'Report this URL to your bank or the impersonated organization',
      'Never enter personal details or OTP on suspicious pages',
    ],
    raw: { domain: 'paymentgateway-secure.in', flags: ['no_https', 'phishing_keywords:3'] },
    scanned_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    feature: 'upi_scan',
    input_data: 'paytm-support@upi.co',
    verdict: 'SUSPICIOUS',
    confidence: 54,
    explanation:
      "The UPI handle contains 'support' — scammers add service-like words to appear legitimate. The VPA (.co) is also non-standard.",
    tips: [
      "Verify the recipient's identity before sending money",
      'Official merchants use verified UPI IDs — check for the blue tick',
      'Never pay upfront fees to receive a prize or refund',
    ],
    raw: { upi_id: 'paytm-support@upi.co', handle: 'paytm-support', vpa: 'upi.co' },
    scanned_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    feature: 'qr_scan',
    input_data: 'https://hdfc.paymentlink.co/pay?amount=5000',
    verdict: 'SAFE',
    confidence: 18,
    explanation:
      'QR code — HDFC payment link scan. The QR leads to a standard HTTPS page with no known phishing indicators.',
    tips: [
      'Always review the URL after scanning before proceeding',
      'Prefer official apps over QR-based payment flows',
    ],
    raw: { qr_content: 'https://hdfc.paymentlink.co/pay?amount=5000' },
    scanned_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    feature: 'voice_scan',
    input_data: 'Sir, this is CBI officer Sharma calling...',
    verdict: 'DANGEROUS',
    confidence: 91,
    explanation:
      'Fake authority + money demand pattern detected. The caller claims to be a CBI officer and demands an immediate transfer — a classic phone scam.',
    tips: [
      'Hang up immediately — this is a scam call pattern',
      'Real police, CBI, or courts never demand money over phone',
      'Report to cybercrime helpline: 1930',
    ],
    raw: {
      transcript: 'Sir this is CBI officer Sharma calling. Your Aadhaar is linked to illegal activity. You must transfer ₹50,000 to clear your name immediately or we will...',
      highlighted_phrases: ['CBI officer', 'illegal activity', 'transfer ₹50,000'],
    },
    scanned_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 5,
    feature: 'otp_scan',
    input_data: 'Your SBI OTP is 847291. Share it with our representative to unlock your account.',
    verdict: 'DANGEROUS',
    confidence: 88,
    explanation:
      'This message asks you to share an OTP — legitimate banks never do this. It also impersonates SBI and creates urgency around account locking.',
    tips: [
      'Never share OTPs with anyone — your bank will never ask for it',
      'Block the sender number immediately',
      'If you shared an OTP, contact your bank fraud helpline now',
    ],
    raw: { flags: ['otp_sharing_pattern:1', 'bank_impersonation:1', 'urgency_language:1'] },
    scanned_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
];

export const MOCK_STATS = {
  total: 142,
  threats: 17,
  safe_rate: 88,
  today_count: 6,
  by_category: {
    url_scan: 68,
    otp_scan: 31,
    upi_scan: 22,
    qr_scan: 11,
    screenshot_scan: 7,
    voice_scan: 3,
  },
  daily_counts: [
    { date: '2026-05-22', count: 18, label: 'Thu' },
    { date: '2026-05-23', count: 24, label: 'Fri' },
    { date: '2026-05-24', count: 12, label: 'Sat' },
    { date: '2026-05-25', count: 8, label: 'Sun' },
    { date: '2026-05-26', count: 21, label: 'Mon' },
    { date: '2026-05-27', count: 33, label: 'Tue' },
    { date: '2026-05-28', count: 6, label: 'Wed' },
  ],
};

export const FEATURE_LABELS = {
  url_scan: 'URL Scan',
  otp_scan: 'OTP Scan',
  upi_scan: 'UPI Fraud',
  qr_scan: 'QR Code',
  screenshot_scan: 'Screenshot',
  voice_scan: 'Voice Scan',
};
