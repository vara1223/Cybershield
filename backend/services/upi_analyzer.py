"""
CyberShield UPI Fraud Analyzer — Multilingual Engine
======================================================
Supports: English (en), Telugu (te), Tamil (ta), Hindi (hi), and Code-Mixed text.
Detects:
  - Reverse Payment / UPI PIN Claim Fraud (Entering PIN to receive funds)
  - Advance Fee / Loan Approval Scam
  - Fraudulent / Impersonation Handles
  - Fake Refund / Cashback Offers
"""

import re
import numpy as np
from sklearn.linear_model import LogisticRegression
from utils.confidence import clamp, score_to_verdict

VALID_UPI_PATTERN = re.compile(r"^[\w.\-]+@[\w.\-]+$")

KNOWN_FRAUD_HANDLES = [
    "paytm-support", "sbi-help", "hdfc-care", "icici-care", "phonepe-help",
    "googlepay-support", "npci-help", "rbi-official", "refund", "cashback",
    "lottery", "winner", "prize", "reward", "cbi", "police", "customs",
]

SUSPICIOUS_WORDS_IN_UPI = [
    "refund", "cashback", "prize", "winner", "lottery", "support", "help",
    "official", "care", "customer", "service", "verify", "kyc", "update",
    "alert", "secure", "safety", "fraud", "crime", "cyber",
]

# ── Multilingual Pattern Library (English, Telugu, Tamil, Hindi) ─────────────
MULTILINGUAL_UPI_PATTERNS = {
    "upi_pin_reverse_fraud": [
        # English
        r"enter.{0,20}pin", r"pin.{0,20}receive", r"scan.{0,20}qr", r"pin.{0,20}cashback",
        r"enter.{0,20}upi.{0,20}pin", r"receive.{0,20}amount",
        # Telugu (Native + Transliterated)
        r"pin.{0,20}ఎంటర్", r"డబ్బులు.{0,20}రావడానికి", r"పిన్.{0,20}కొట్టండి", r"క్యాష్‌బ్యాక్",
        r"pin.{0,20}cheppandi", r"dabulu.{0,20}pampandi", r"pin.{0,20}enter", r"ఖాతాలో.{0,20}పడాలంటే",
        # Tamil
        r"pin.{0,20}போடுங்க", r"பணம்.{0,20}பெற", r"qr.{0,20}ஸ்கேன்", r"பின்.{0,20}நம்பர்",
        r"பணம்.{0,20}வர", r"pin.{0,20}type",
        # Hindi
        r"pin.{0,20}दर्ज", r"पैसे.{0,20}पाने", r"पिन.{0,20}डालें", r"कैशबैक",
        r"पिन.{0,20}दर्ज", r"खाते.{0,20}में.{0,20}आने"
    ],
    "advance_payment_scam": [
        # English
        r"pay.{0,20}first", r"advance.{0,20}fee", r"processing.{0,20}fee", r"registration.{0,20}fee",
        r"pay.{0,20}to.{0,20}claim", r"small.{0,20}fee",
        # Telugu
        r"ముందు.{0,20}pay", r"ముందు.{0,20}డబ్బులు", r"అడ్వాన్స్", r"ముందు.{0,20}చెల్లించండి",
        # Tamil
        r"முன்.{0,20}பணம்", r"முதலில்.{0,20}செலுத்து", r"அட்வான்ஸ்",
        # Hindi
        r"पहले.{0,20}पैसे", r"पहले.{0,20}दें", r"एडवांस", r"रजिस्ट्रेशन.{0,20}फीस"
    ],
    "fake_refund_cashback": [
        # English
        r"claim.{0,20}refund", r"refund.{0,20}link", r"won.{0,20}cashback", r"claim.{0,20}prize",
        # Telugu
        r"రీఫండ్", r"లింక్", r"ఇనాం", r"గెలుచుకున్నారు",
        # Tamil
        r"ரீஃபண்ட்", r"லிங்க்", r"பரிசு",
        # Hindi
        r"रिफंड", r"लिंक", r"इनाम", r"बधाई"
    ]
}


def detect_upi_language(text: str) -> str:
    if not text:
        return "English"
    lower = text.lower()
    has_telugu = bool(re.search(r"[\u0C00-\u0C7F]", text)) or bool(re.search(r"\b(డబ్బులు|పిన్|ఎంటర్|రావడానికి|కొట్టండి|చెప్పండి|పంపండి|అకౌంట్)\b", lower))
    has_tamil = bool(re.search(r"[\u0B80-\u0BFF]", text)) or bool(re.search(r"\b(பணம்|பெற|போடுங்க|நம்பர்|செலுத்து|லிங்க்)\b", lower))
    has_hindi = bool(re.search(r"[\u0900-\u097F]", text)) or bool(re.search(r"\b(पैसे|पाने|दर्ज|डालें|दें|रिफंड)\b", lower))
    has_english = bool(re.search(r"[a-zA-Z]", text))

    if has_telugu and has_english:
        return "Telugu + English"
    elif has_tamil and has_english:
        return "Tamil + English"
    elif has_hindi and has_english:
        return "Hindi + English"
    elif has_telugu:
        return "Telugu"
    elif has_tamil:
        return "Tamil"
    elif has_hindi:
        return "Hindi"
    return "English"


# ── ML Model Setup ──────────────────────────────────────────────────────────
_UPI_COEF = np.array([[2.10, 3.45, 1.80, 1.25, 2.30, 3.10]])
_UPI_INTERCEPT = np.array([-2.50])

_upi_ml_model = LogisticRegression()
_upi_ml_model.coef_ = _UPI_COEF
_upi_ml_model.intercept_ = _UPI_INTERCEPT
_upi_ml_model.classes_ = np.array([0, 1])


def analyze_upi(upi_id: str, message: str = "") -> dict:
    flags = []
    detected_indicators = []
    upi_lower = upi_id.lower().strip()
    msg_lower = message.lower() if message else ""
    language = detect_upi_language(f"{upi_id} {message}")

    # Feature extraction
    f_invalid = 1.0 if not VALID_UPI_PATTERN.match(upi_id) else 0.0
    if f_invalid:
        flags.append("invalid_upi_format")
        detected_indicators.append("Invalid UPI ID syntax (missing @ or bank suffix)")

    parts = upi_lower.split("@")
    handle = parts[0] if parts else upi_lower
    vpa = parts[1] if len(parts) > 1 else ""

    f_fraud_handle = 0.0
    for fraud_handle in KNOWN_FRAUD_HANDLES:
        if fraud_handle in handle:
            f_fraud_handle = 1.0
            flags.append(f"fraud_handle_pattern:{fraud_handle}")
            detected_indicators.append(f"Impersonation handle pattern: '{fraud_handle}'")
            break

    sus_words = [w for w in SUSPICIOUS_WORDS_IN_UPI if w in handle]
    f_sus_words = min(len(sus_words), 5) / 5.0
    if sus_words:
        flags.append(f"suspicious_handle_words:{','.join(sus_words[:3])}")
        detected_indicators.append(f"Suspicious words in handle: {', '.join(sus_words[:3])}")

    digit_count = sum(c.isdigit() for c in handle)
    digit_ratio = digit_count / max(len(handle), 1)
    f_digit_ratio = 1.0 if digit_ratio > 0.5 else 0.0
    if digit_count > 6:
        flags.append("numeric_heavy_handle")
        detected_indicators.append("Excessive numeric characters in UPI handle")

    # Multilingual Pattern Check
    matched_patterns = 0
    if message:
        for ptype, plist in MULTILINGUAL_UPI_PATTERNS.items():
            for pat in plist:
                if re.search(pat, msg_lower):
                    matched_patterns += 1
                    if ptype == "upi_pin_reverse_fraud" and "UPI PIN requested to receive money (Reverse payment fraud)" not in detected_indicators:
                        detected_indicators.append("UPI PIN requested to receive money (Reverse payment fraud)")
                        flags.append("upi_pin_reverse_fraud")
                    elif ptype == "advance_payment_scam" and "Advance payment or processing fee requested" not in detected_indicators:
                        detected_indicators.append("Advance payment or processing fee requested")
                        flags.append("advance_payment_scam")
                    elif ptype == "fake_refund_cashback" and "Fake cashback or refund claim" not in detected_indicators:
                        detected_indicators.append("Fake cashback or refund claim")
                        flags.append("fake_refund_cashback")
                    break

    f_msg_patterns = min(matched_patterns, 5) / 5.0
    f_advance_fee = 1.0 if "advance_payment_scam" in flags or "upi_pin_reverse_fraud" in flags else 0.0

    # Scikit-Learn Prediction
    feature_vec = np.array([[f_invalid, f_fraud_handle, f_sus_words, f_digit_ratio, f_msg_patterns, f_advance_fee]])
    try:
        ml_prob = float(_upi_ml_model.predict_proba(feature_vec)[0][1]) * 100
    except Exception:
        ml_prob = 0.0

    score = 0
    if f_invalid:
        score += 30
    if f_fraud_handle:
        score += 40
    if sus_words:
        score += min(30, len(sus_words) * 10)
    if digit_count > 6:
        score += 15
    if matched_patterns:
        score += min(45, matched_patterns * 20)
    if f_advance_fee:
        score += 35

    final_score = clamp((ml_prob * 0.5) + (score * 0.5))
    verdict = score_to_verdict(final_score)

    category = "UPI_FRAUD" if verdict != "SAFE" else "NORMAL_TRANSACTION"
    classification = "SCAM" if verdict == "DANGEROUS" else ("SUSPICIOUS" if verdict == "SUSPICIOUS" else "NORMAL_TRANSACTION")
    risk_level = "HIGH" if verdict == "DANGEROUS" else ("MEDIUM" if verdict == "SUSPICIOUS" else "LOW")

    explanation = _build_explanation(verdict, flags, upi_id, detected_indicators)

    return {
        "Language": language,
        "Classification": classification,
        "Category": category,
        "Risk Level": risk_level,
        "Confidence": f"{round(final_score)}%",
        "verdict": verdict,
        "confidence": round(final_score, 1),
        "ml_score": round(ml_prob, 1),
        "ml_model": "Multilingual Scikit-Learn Logistic Regression + Rule Engine",
        "explanation": explanation,
        "reason": explanation,
        "recommended_action": "Never enter your UPI PIN to receive money. PIN entry ALWAYS deducts money from your account." if verdict != "SAFE" else "Verify recipient details before transferring.",
        "detected_indicators": detected_indicators if detected_indicators else ["No suspicious indicators detected"],
        "flags": list(set(flags)),
        "upi_id": upi_id,
        "handle": handle,
        "vpa": vpa,
    }


def _build_explanation(verdict: str, flags: list, upi_id: str, detected_indicators: list) -> str:
    if verdict == "SAFE":
        return f"The UPI ID '{upi_id}' follows legitimate bank formats and shows no multilingual fraud patterns."

    reasons = detected_indicators[:3] if detected_indicators else ["matches known fraud patterns"]
    tier = "a high-risk fraudulent UPI handle" if verdict == "DANGEROUS" else "a suspicious UPI transaction"
    return (
        f"'{upi_id}' is flagged as {tier}. "
        f"Detected signals: {'; '.join(reasons)}. "
        "CRITICAL WARNING: Entering your UPI PIN or scanning a QR code ALWAYS transfers money OUT of your bank account. You NEVER need a PIN to receive money."
    )
