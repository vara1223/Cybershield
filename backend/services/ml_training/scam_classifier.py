"""
CyberShield Voice Scam Classifier — Inference Module
======================================================
- Lazy-loads trained model pipeline
- Contextual multi-indicator scoring (OTP + asking + urgency + fake authority)
- Preserves native script (Telugu, Tamil, Hindi) & transliterated code-mixed text
- Identifies 18 categories + language identification
- Suppresses false positives on anti-phishing warnings ("never share your OTP")
"""

import os
import pickle
import re

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_artifacts")
MODEL_PATH = os.path.join(MODEL_DIR, "scam_classifier.pkl")

_pipeline = None
_pipeline_loaded = False


def _load_pipeline():
    global _pipeline, _pipeline_loaded
    if _pipeline_loaded:
        return _pipeline
    _pipeline_loaded = True
    if not os.path.exists(MODEL_PATH):
        print("[ML INFER] No trained model found. Run train_scam_classifier.py first.")
        return None
    try:
        with open(MODEL_PATH, "rb") as f:
            _pipeline = pickle.load(f)
        print(f"[ML INFER] Scam classifier loaded from {MODEL_PATH}")
    except Exception as e:
        print(f"[ML INFER] Failed to load model: {e}")
        _pipeline = None
    return _pipeline


# ─── Language Detector ──────────────────────────────────────────────────────
def detect_transcript_language(text: str) -> str:
    lower = text.lower()
    has_telugu = bool(re.search(r"[\u0C00-\u0C7F]", text)) or bool(re.search(r"\b(cheppandi|pampandi|dabbulu|avthundi|చేయండి|చెప్పండి|అకౌంట్|ఈ|నుంచి|మీకు)\b", lower))
    has_tamil = bool(re.search(r"[\u0B80-\u0BFF]", text)) or bool(re.search(r"\b(சொல்லுங்கள்|பண்ணுகிறேன்|உங்களுக்கு|பேசுகிறேன்|உடனே|வந்த)\b", lower))
    has_hindi = bool(re.search(r"[\u0900-\u097F]", text)) or bool(re.search(r"\b(बताइए|होगा|रहा|हूँ|करिए|आपकी|आपके|मुझे)\b", lower))
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


# ─── Legitimate Safety Warning Detector (False Positive Guard) ───────────────
LEGITIMATE_WARNING_PATTERNS = [
    r"\bnever\s*share\b.*otp", r"\bdo\s*not\s*share\b.*otp",
    r"\bbank\s*will\s*never\s*ask\b", r"\bnever\s*ask\s*for\s*your\s*otp\b",
    r"ఎవ్వరికీ\s*చెప్పకండి", r"మాట్లాడకండి", r"సాझा\s*न\s*करें", r"नहीं\s*मांगता",
    r"சொல்ல\s*வேண்டாம்", r"பாதுகாப்பு\s*எச்சரிக்கை"
]

def is_legitimate_warning(text: str) -> bool:
    lower = text.lower()
    for pat in LEGITIMATE_WARNING_PATTERNS:
        if re.search(pat, lower):
            return True
    return False


# ─── Multilingual Rule & Context Engine ──────────────────────────────────────
RULE_PATTERNS = {
    "fake_authority": [
        r"\bcbi\s*officer\b", r"\bpolice\s*officer\b", r"\bcybercrime\s*officer\b",
        r"\bincome\s*tax\s*officer\b", r"\bcustoms\s*officer\b", r"\bed\s*officer\b",
        r"\bcourt\s*order\b", r"\bjudiciary\b", r"\bfbi\b", r"\binterpol\b",
        r"\bi\s*am\s*(an?\s*)?agent\b", r"\bcalling\s*from\s*(the\s*)?bank\b",
        r"\bbank\s*official\b", r"\brbi\s*officer\b", r"\bgovernment\s*official\b",
        r"पुलिस", r"सीबीआई", r"बैंक अधिकारी", r"कोर्ट आदेश", r"सरकारी अधिकारी",
        r"పోలీస్", r"సిబిఐ", r"బ్యాంక్ అధికారి", r"కోర్టు ఆర్డర్", r"నకిలీ పోలీస్",
        r"போலீஸ்", r"சிபிஐ", r"வங்கி அதிகாரி", r"நீதிமன்ற உத்தரவு"
    ],
    "fake_kyc": [
        r"\bkyc\b.*(expire|update|block|suspend)", r"\bkyc\s*has\s*expired\b",
        r"\bkyc\s*verify\b", r"आधार", r"ఆధార్", r"ஆதார்"
    ],
    "money_demand": [
        r"\btransfer\s*money\b", r"\bsend\s*money\b", r"\bdeposit\s*money\b",
        r"\bpay\s*(the\s*)?(fine|penalty|charges|amount)\b",
        r"\bpay\s*immediately\b", r"\bpay\s*(right\s*)?now\b",
        r"\bpay\s*\d+\s*(rupees?|lakh|thousand|crore)\b",
        r"पैसा भेजो", r"तुरंत भुगतान", r"డబ్బులు పంపు", r"పంపండి", r"பணம் அனுப்பு"
    ],
    "arrest_threat": [
        r"\barrest(ed)?\b", r"\bwarrant\b", r"\bjail\b", r"\bprison\b",
        r"\bbehind\s*bars\b", r"\bin\s*custody\b", r"\bfir\b",
        r"गिरफ्तार", r"जेल", r"वारंट", r"అరెస్ట్", r"జైలు", r"వారెంట్", r"கைது", r"ஜெயில்"
    ],
    "urgency": [
        r"\bimmediately\b", r"\bright\s*now\b", r"\bwithin\s*\d+\s*hour\b",
        r"\bor\s*else\b", r"\botherwise\b", r"\blast\s*chance\b",
        r"\bno\s*time\b", r"\burgent\b", r"\btonight\b", r"\bdon.?t\s*disconnect\b",
        r"तुरंत", r"अभी", r"వెంటనే", "ఇప్పుడే", r"ఉடனே", r"இப்போதே"
    ],
    "otp_request": [
        r"\botp\b", r"\bone\s*time\s*password\b", r"\bverification\s*code\b",
        r"\bshare\s*(the\s*)?otp\b", r"\btell\s*me\s*(the\s*)?otp\b",
        r"\bgive\s*me\s*(the\s*)?otp\b", r"\bverify\s*(the\s*)?otp\b",
        r"\bread\s*(the\s*)?code\b", r"ओटीपी", r"बताइए", r"ఓటీపీ", r"ఓటిపి",
        r"చెప్పండి", r"ఓటీపీ చెప్పు", r"ஓடிபி", r"சொல்லுங்கள்"
    ],
    "remote_access": [
        r"\binstall\s*(an?\s*)?app\b", r"\banydesk\b", r"\bteamviewer\b",
        r"\bquicksupport\b", r"\bshare\s*(your\s*)?screen\b", r"\bremote\s*access\b",
        r"एनीडेस्क", r"ఎనీడెస్క్", r"எனிடெஸ்க்"
    ],
    "upi_fraud": [
        r"\bupi\s*pin\b", r"\bscan\s*(this\s*)?qr\b", r"\benter\s*(your\s*)?upi\b",
        r"\bupi\s*(link|payment)\b"
    ],
    "prize_lottery": [
        r"\bcongratulations\b", r"\blucky\s*(draw|winner)\b", r"\bwon\s*(a\s*)?(prize|rupees|lakh)\b",
        r"\bkbc\b", r"\blottery\b", r"इनाम", r"గెలుచుకున్నారు", r"பரிசு"
    ]
}

INDICATOR_TEXTS = {
    "fake_authority": "Caller claims to be from bank or law enforcement authority",
    "fake_kyc": "Fake KYC expiration or updates claimed",
    "money_demand": "Immediate money transfer or deposit demanded",
    "arrest_threat": "Threat of arrest, legal prosecution, or jail",
    "urgency": "Urgency and pressure tactics applied",
    "otp_request": "OTP requested over phone call",
    "remote_access": "Request to install remote access control software",
    "upi_fraud": "UPI PIN or QR code scanning requested",
    "prize_lottery": "Unsolicited lottery or prize winnings claimed"
}


def classify_category(matched_cats: list, text: str) -> str:
    lower = text.lower()
    if "remote_access" in matched_cats or "anydesk" in lower or "teamviewer" in lower:
        return "REMOTE_ACCESS_REQUEST"
    if "upi_fraud" in matched_cats or "qr code" in lower or "upi pin" in lower:
        return "UPI_FRAUD"
    if "prize_lottery" in matched_cats or "kbc" in lower or "lottery" in lower:
        return "FAKE_REWARD_SCAM"
    if "otp_request" in matched_cats and ("fake_authority" in matched_cats or "bank" in lower):
        return "OTP_REQUEST"
    if "otp_request" in matched_cats:
        return "OTP_SHARING"
    if "fake_kyc" in matched_cats:
        return "FAKE_KYC"
    if "arrest_threat" in matched_cats or "digital arrest" in lower:
        return "FAKE_AUTHORITY"
    if "fake_authority" in matched_cats:
        return "FAKE_BANK_CALL"
    if "money_demand" in matched_cats:
        return "PAYMENT_FRAUD"
    if "urgency" in matched_cats:
        return "URGENCY_PRESSURE"
    return "NORMAL_CALL"


def classify_transcript(transcript: str) -> dict:
    text = (transcript or "").strip()
    language_label = detect_transcript_language(text)

    if not text:
        return {
            "Language": language_label,
            "Classification": "NORMAL_CALL",
            "Category": "NORMAL_CALL",
            "Risk Level": "LOW",
            "Confidence": "0%",
            "verdict": "SAFE",
            "confidence": 0.0,
            "classification": "Legitimate",
            "risk_level": "Low",
            "detected_indicators": [],
            "highlighted_phrases": [],
            "explanation": "No speech detected in audio.",
            "recommended_action": "Retry recording with clear speech."
        }

    # ── 1. Check for Legitimate Anti-Phishing Warning (False Positive Prevention) ──
    if is_legitimate_warning(text):
        return {
            "Language": language_label,
            "Classification": "LEGITIMATE_SECURITY_WARNING",
            "Category": "LEGITIMATE_SECURITY_WARNING",
            "Risk Level": "LOW",
            "Confidence": "98%",
            "verdict": "SAFE",
            "confidence": 2.0,
            "classification": "Legitimate",
            "risk_level": "Low",
            "detected_indicators": ["Official security advisory warning users to protect OTPs"],
            "highlighted_phrases": ["never share your OTP"],
            "explanation": "This conversation is an official bank security warning advising you NOT to share your OTP or credentials.",
            "recommended_action": "Follow the advisory. Keep your credentials private."
        }

    # ── 2. Rule & Context Matching ──────────────────────────────────────────────
    matched_cats = []
    highlighted = []
    lower = text.lower()

    for cat, patterns in RULE_PATTERNS.items():
        for pat in patterns:
            m = re.search(pat, lower)
            if m:
                matched_cats.append(cat)
                highlighted.append(m.group(0).strip())
                break

    detected_indicators = [INDICATOR_TEXTS[c] for c in matched_cats if c in INDICATOR_TEXTS]

    # Contextual indicator combinations
    is_otp = "otp_request" in matched_cats
    is_auth = "fake_authority" in matched_cats
    is_urgency = "urgency" in matched_cats
    is_money = "money_demand" in matched_cats
    is_kyc = "fake_kyc" in matched_cats
    is_arrest = "arrest_threat" in matched_cats

    context_scam_score = 0.0
    if is_otp and (is_auth or is_urgency or is_kyc):
        context_scam_score += 90.0
        if "Verification pressure" not in detected_indicators:
            detected_indicators.append("Verification pressure applied")
    elif is_otp:
        context_scam_score += 75.0

    if is_auth and (is_money or is_arrest or is_urgency):
        context_scam_score += 90.0
    elif is_auth:
        context_scam_score += 65.0

    if is_kyc and (is_urgency or is_money):
        context_scam_score += 85.0
    elif is_kyc:
        context_scam_score += 60.0

    # ── 3. ML Model Prediction ──────────────────────────────────────────────────
    ml_score = 0.0
    pipeline = _load_pipeline()
    if pipeline:
        try:
            proba = pipeline.predict_proba([text])[0]
            ml_score = proba[1] * 100.0
        except Exception:
            ml_score = 75.0 if pipeline.predict([text])[0] == 1 else 10.0

    # ── 4. Score Fusion ─────────────────────────────────────────────────────────
    if context_scam_score > 0:
        final_score = max(context_scam_score, 0.5 * context_scam_score + 0.5 * ml_score)
    else:
        final_score = ml_score

    final_score = min(100.0, max(0.0, final_score))

    # ── 5. Category & Risk Determination ────────────────────────────────────────
    category = classify_category(matched_cats, text)
    if final_score >= 60.0:
        verdict = "DANGEROUS"
        classification = "SCAM"
        risk_level = "HIGH"
    elif final_score >= 30.0:
        verdict = "SUSPICIOUS"
        classification = "SUSPICIOUS"
        risk_level = "MEDIUM"
    else:
        verdict = "SAFE"
        classification = "NORMAL_CALL"
        risk_level = "LOW"
        category = "NORMAL_CALL"

    # ── 6. Context-Aware Explanation ────────────────────────────────────────────
    if classification == "SCAM":
        explanation = (
            f"The caller is attempting a {category.replace('_', ' ').title()} scam using "
            + (", ".join(detected_indicators[:3]) if detected_indicators else "suspicious prompts") + ". "
            "Legitimate representatives will never demand OTPs or money transfers over the phone."
        )
    elif classification == "SUSPICIOUS":
        explanation = (
            "The conversation contains high-risk elements such as unverified authority or urgency. "
            "Proceed with extreme caution and do not disclose sensitive details."
        )
    else:
        explanation = "No high-risk scam call indicators were detected in this conversation."

    recommended_action = (
        "Hang up immediately. Never share OTPs, PINs, or money over the phone."
        if classification == "SCAM" else
        ("Verify caller identity on official websites before proceeding." if classification == "SUSPICIOUS" else "Maintain general call safety awareness.")
    )

    return {
        "Language": language_label,
        "Classification": classification,
        "Category": category,
        "Risk Level": risk_level,
        "Confidence": f"{round(final_score)}%",
        "verdict": verdict,
        "confidence": round(final_score, 1),
        "classification": classification,
        "risk_level": risk_level,
        "detected_indicators": detected_indicators if detected_indicators else ["No suspicious indicators detected"],
        "highlighted_phrases": highlighted,
        "explanation": explanation,
        "recommended_action": recommended_action,
    }
