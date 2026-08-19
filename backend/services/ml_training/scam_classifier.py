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
def detect_transcript_languages(text: str) -> tuple[str, list[str], bool]:
    """
    Detect all languages and code-mixed combinations present in the transcript.
    Returns:
      (language_label: str, detected_languages_list: list[str], is_multilingual: bool)
    """
    if not text or not text.strip():
        return "English", ["English"], False

    lower = text.lower()
    languages = []

    # 1. Telugu (Script [\u0C00-\u0C7F] or Romanized Telugu)
    has_telugu = bool(re.search(r"[\u0C00-\u0C7F]", text)) or bool(re.search(r"\b(cheppandi|cheppanu|pampandi|dabbulu|avthundi|chesanu|chesam|avunu|kadu|ippude|ventane|nenu|meeku|miku|gurinchi|daggara|undi|ledu|kavali|cheyandi|vastundi|vachindi|chudandi|adugutunnaru|matladutunnanu|చేయండి|చెప్పండి|అకౌంట్|ఈ|నుంచి|మీకు|డబ్బులు|వెంటనే)\b", lower))
    if has_telugu:
        languages.append("Telugu")

    # 2. Hindi (Script [\u0900-\u097F] or Romanized Hindi/Hinglish)
    has_hindi = bool(re.search(r"[\u0900-\u097F]", text)) or bool(re.search(r"\b(bataiye|batao|kijiye|karo|bol raha|paisa|paise|bhejiye|bhejo|karein|hoga|hogi|aapka|aapki|aapke|mujhe|humko|turant|abhi|suno|sunie|nahin|nahi|hai|hain|kripya|khatra|aadhaar|khata|band|chalu|mera|meri|बताइए|होगा|रहा|हूँ|करिए|आपकी|आपके|मुझे|पैसा|तुरंत)\b", lower))
    if has_hindi:
        languages.append("Hindi")

    # 3. Tamil (Script [\u0B80-\u0BFF] or Romanized Tamil/Tanglish)
    has_tamil = bool(re.search(r"[\u0B80-\u0BFF]", text)) or bool(re.search(r"\b(sollunga|solunga|pannunga|panunga|pesuren|pesukiren|panam|kaasu|udane|ippove|unga|ungalukku|enakku|vandhu|vanthathu|illai|aam|illaye|kudunga|சொல்லுங்கள்|பண்ணுகிறேன்|உங்களுக்கு|பேசுகிறேன்|உடனே|வந்த|பணம்)\b", lower))
    if has_tamil:
        languages.append("Tamil")

    # 4. Kannada (Script [\u0C80-\u0CFF] or Romanized Kannada)
    has_kannada = bool(re.search(r"[\u0C80-\u0CFF]", text)) or bool(re.search(r"\b(heli|helri|kodi|madiri|madbeku|duddu|hana|nimma|nange|ega|ivagale|beku|beda|illa|houdu|ಹೇಳಿ|ಕೊಡಿ|ದುಡ್ಡು|ನಿಮ್ಮ)\b", lower))
    if has_kannada:
        languages.append("Kannada")

    # 5. Malayalam (Script [\u0D00-\u0D7F] or Romanized Malayalam)
    has_malayalam = bool(re.search(r"[\u0D00-\u0D7F]", text)) or bool(re.search(r"\b(parayoo|cheyyoo|panam|kaashu|ippol|udan|njangal|ningal|illa|aannu|ariyilla|പറയൂ|പണം|ഉടൻ)\b", lower))
    if has_malayalam:
        languages.append("Malayalam")

    # 6. Marathi (Devanagari with Marathi specific markers)
    has_marathi = bool(re.search(r"\b(ahe|ahet|kara|karave|sangato|sangte|paise|patva|kashala|amhi|tumhi|tumche|आहे|करा|पैसे|पाठवा)\b", lower))
    if has_marathi and "Hindi" not in languages:
        languages.append("Marathi")

    # 7. Bengali (Script [\u0980-\u09FF])
    has_bengali = bool(re.search(r"[\u0980-\u09FF]", text)) or bool(re.search(r"\b(bolun|korun|taka|ekhon|apnar|amake|বলুন|করুন|টাকা)\b", lower))
    if has_bengali:
        languages.append("Bengali")

    # 8. English
    english_words = re.findall(r"\b[a-zA-Z]{3,}\b", text)
    has_english_vocab = bool(re.search(r"\b(the|is|are|you|your|from|have|been|will|not|this|that|call|bank|officer|police|arrest|customs|immediately|share|code|number|account|payment|sir|cbi|otp|pin|app|kyc|urgent|transfer|money|click|link|message)\b", lower))
    if len(english_words) >= 2 or has_english_vocab or (not languages and bool(re.search(r"[a-zA-Z]", text))):
        languages.append("English")

    if not languages:
        languages = ["English"]

    is_multilingual = len(languages) > 1

    # Formulate precise user-facing label
    if is_multilingual:
        if "Telugu" in languages and "English" in languages and len(languages) == 2:
            label = "Telugu + English (Teluglish / Code-Mixed)"
        elif "Hindi" in languages and "English" in languages and len(languages) == 2:
            label = "Hindi + English (Hinglish / Code-Mixed)"
        elif "Tamil" in languages and "English" in languages and len(languages) == 2:
            label = "Tamil + English (Tanglish / Code-Mixed)"
        elif "Kannada" in languages and "English" in languages and len(languages) == 2:
            label = "Kannada + English (Kanglish / Code-Mixed)"
        else:
            label = " + ".join(languages) + " (Multilingual)"
    else:
        label = languages[0]

    return label, languages, is_multilingual


def detect_transcript_language(text: str) -> str:
    label, _, _ = detect_transcript_languages(text)
    return label


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
        r"\bcbi\s*officer\b", r"\bpolice\s*(officer|department|station)?\b", r"\bcybercrime\s*officer\b",
        r"\bincome\s*tax\s*officer\b", r"\bcustoms\s*(officer|department)?\b", r"\bed\s*officer\b",
        r"\bcourt\s*order\b", r"\bjudiciary\b", r"\bfbi\b", r"\binterpol\b",
        r"\bi\s*am\s*(an?\s*)?agent\b", r"\bcalling\s*from\s*(the\s*)?(bank|rbi|police|customs|telecom|trai)\b",
        r"\bbank\s*(official|manager|executive|representative)\b", r"\brbi\s*officer\b", r"\bgovernment\s*official\b",
        r"\bnarcotics\s*control\s*bureau\b", r"\bncb\b", r"\btelecom\s*department\b", r"\btrai\b",
        r"पुलिस", r"सीबीआई", r"बैंक अधिकारी", r"कोर्ट आदेश", r"सरकारी अधिकारी", r"कस्टम्स",
        r"పోలీస్", r"సిబిఐ", r"బ్యాంక్ అధికారి", r"కోర్టు ఆర్డర్", r"నకిలీ పోలీస్", r"కస్టమ్స్",
        r"போலீஸ்", r"சிபிஐ", r"வங்கி அதிகாரி", r"நீதிமன்ற உத்தரவு", r"சுங்கம்"
    ],
    "digital_arrest": [
        r"\bdigital\s*arrest\b", r"\bstay\s*on\s*(the\s*)?(video\s*call|camera|skype|line)\b",
        r"\bdo\s*not\s*disconnect\b", r"\bvirtual\s*court\b", r"\bvideo\s*investigation\b",
        r"डिजिटल अरेस्ट", r"वीडियो कॉल", r"డిజిటల్ అరెస్ట్", r"వీడియో కాల్"
    ],
    "parcel_customs": [
        r"\b(fedex|dhl|bluedart|courier|parcel|package)\b.*(seized|illegal|drugs|contraband|passport|customs)",
        r"\bparcel\s*(has\s*been\s*)?seized\b", r"\billegal\s*(drugs|items|substances|passport)\b",
        r"पार्सल", r"ड्रग्स", r"కస్టమ్స్ పార్శిల్", r"డ్రగ్స్"
    ],
    "fake_kyc": [
        r"\bkyc\b.*(expire|update|block|suspend|verify|pending|mandatory)", r"\bkyc\s*has\s*expired\b",
        r"\bkyc\s*verify\b", r"\bpan\s*card\b.*(block|update|link)", r"\baadhaar\b.*(block|update|verify|linked)",
        r"\bsim\s*card\b.*(block|deactivat)", r"आधार", r"ఆధార్", r"ఆదార్", r"ஆதார்"
    ],
    "money_demand": [
        r"\btransfer\s*money\b", r"\bsend\s*money\b", r"\bdeposit\s*money\b",
        r"\bpay\s*(the\s*)?(fine|penalty|charges|amount|fee|tax|deposit)\b",
        r"\bpay\s*immediately\b", r"\bpay\s*(right\s*)?now\b",
        r"\bpay\s*\d+\s*(rupees?|lakh|thousand|crore|rs)\b",
        r"\bsecurity\s*deposit\b", r"\bverification\s*account\b", r"\brbi\s*clearance\b",
        r"पैसा भेजो", r"तुरंत भुगतान", r"డబ్బులు పంపు", r"పంపండి", r"చెల్లించండి", r"பணம் அனுப்பு"
    ],
    "arrest_threat": [
        r"\barrest(ed)?\b", r"\bwarrant\b", r"\bjail\b", r"\bprison\b",
        r"\bbehind\s*bars\b", r"\bin\s*custody\b", r"\bfir\b", r"\bnon[- ]bailable\b",
        r"गिरफ्तार", r"जेल", r"वारंट", r"అరెస్ట్", r"జైలు", r"వారెంట్", r"கைது", r"ஜெயில்"
    ],
    "urgency": [
        r"\bimmediately\b", r"\bright\s*now\b", r"\bwithin\s*\d+\s*(hour|minute)s?\b",
        r"\bor\s*else\b", r"\botherwise\b", r"\blast\s*(chance|warning)\b",
        r"\bno\s*time\b", r"\burgent\b", r"\btonight\b", r"\bdon.?t\s*disconnect\b",
        r"\baccount\s*will\s*be\s*blocked\b", r"\bpower\s*will\s*be\s*cut\b",
        r"तुरंत", r"अभी", r"వెంటనే", "ఇప్పుడే", r"ఉடனே", r"இப்போதே"
    ],
    "otp_request": [
        r"\botp\b", r"\bone\s*time\s*password\b", r"\bverification\s*code\b",
        r"\bshare\s*(the\s*)?otp\b", r"\btell\s*me\s*(the\s*)?otp\b",
        r"\bgive\s*me\s*(the\s*)?otp\b", r"\bverify\s*(the\s*)?otp\b",
        r"\bread\s*(the\s*)?code\b", r"\b6[- ]digit\s*code\b",
        r"ओटीपी", r"बताइए", r"ఓటీపీ", r"ఓటిపి",
        r"చెప్పండి", r"ఓటీపీ చెప్పు", r"కోడ్", r"ஓடிபி", r"சொல்லுங்கள்"
    ],
    "remote_access": [
        r"\binstall\s*(an?\s*)?app\b", r"\banydesk\b", r"\bteamviewer\b",
        r"\bquicksupport\b", r"\brustdesk\b", r"\bshare\s*(your\s*)?screen\b", r"\bremote\s*access\b",
        r"एनीडेस्क", r"ఎనీడెస్క్", r"எனிடெஸ்க்"
    ],
    "upi_fraud": [
        r"\bupi\s*pin\b", r"\bscan\s*(this\s*)?qr\b", r"\benter\s*(your\s*)?upi\b",
        r"\bupi\s*(link|payment|request)\b", r"\benter\s*pin\s*to\s*receive\b",
        r"\bscan\s*to\s*receive\b", r"\bcashback\s*reward\b"
    ],
    "prize_lottery": [
        r"\bcongratulations\b", r"\blucky\s*(draw|winner)\b", r"\bwon\s*(a\s*)?(prize|rupees|lakh)\b",
        r"\bkbc\b", r"\blottery\b", r"इनाम", r"గెలుచుకున్నారు", r"బహుమతి", r"பரிசு"
    ],
    "electricity_bill": [
        r"\belectricity\s*bill\b", r"\bpower\s*(cut|disconnected|supply)\b",
        r"\belectricity\s*(office|helpline|officer)\b", r"\bbijli\s*bill\b",
        r"కరెంట్ బిల్లు", r"విద్యుత్", r"மின் கட்டணம்"
    ],
    "loan_fraud": [
        r"\bloan\s*approved\b", r"\bpre[- ]approved\s*loan\b", r"\bprocessing\s*(fee|charges)\b",
        r"\bdisbursement\s*fee\b", r"\bloan\s*sanction\b", r"लोन", r"రుణం"
    ]
}

INDICATOR_TEXTS = {
    "fake_authority": "Caller claims to be from bank or law enforcement authority",
    "digital_arrest": "Digital arrest scam attempting unauthorized video surveillance or interrogation",
    "parcel_customs": "Fake customs/courier parcel interception containing contraband",
    "fake_kyc": "Fake KYC expiration or urgent verification demanded",
    "money_demand": "Immediate money transfer, deposit, or fine demanded",
    "arrest_threat": "Threat of arrest, legal prosecution, or jail",
    "urgency": "Urgency and high-pressure intimidation tactics applied",
    "otp_request": "OTP or verification code requested over phone call",
    "remote_access": "Request to install remote screen sharing software (AnyDesk, TeamViewer)",
    "upi_fraud": "UPI PIN entry or QR code reverse payment scam",
    "prize_lottery": "Unsolicited lottery or prize winnings claimed",
    "electricity_bill": "Fake electricity disconnection warning demanding payment",
    "loan_fraud": "Advance-fee pre-approved loan scam"
}


def classify_category(matched_cats: list, text: str) -> str:
    lower = text.lower()
    if "remote_access" in matched_cats or "anydesk" in lower or "teamviewer" in lower:
        return "REMOTE_ACCESS_REQUEST"
    if "digital_arrest" in matched_cats or "digital arrest" in lower:
        return "DIGITAL_ARREST_SCAM"
    if "parcel_customs" in matched_cats or "fedex" in lower or "customs" in lower:
        return "PARCEL_CUSTOMS_SCAM"
    if "electricity_bill" in matched_cats or "electricity" in lower or "power" in lower:
        return "ELECTRICITY_BILL_SCAM"
    if "loan_fraud" in matched_cats or "loan" in lower:
        return "LOAN_FRAUD"
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
    if "arrest_threat" in matched_cats:
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
    language_label, detected_langs, is_multi = detect_transcript_languages(text)

    if not text:
        return {
            "Language": language_label,
            "language": language_label,
            "detected_languages": detected_langs,
            "is_multilingual": is_multi,
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
            "language": language_label,
            "detected_languages": detected_langs,
            "is_multilingual": is_multi,
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
    is_digital_arrest = "digital_arrest" in matched_cats
    is_parcel = "parcel_customs" in matched_cats
    is_remote = "remote_access" in matched_cats
    is_upi = "upi_fraud" in matched_cats
    is_prize = "prize_lottery" in matched_cats
    is_util = "electricity_bill" in matched_cats
    is_loan = "loan_fraud" in matched_cats

    context_scam_score = 0.0

    # Severe high-risk triggers
    if is_remote:
        context_scam_score = max(context_scam_score, 94.0)
    if is_upi:
        context_scam_score = max(context_scam_score, 92.0)
    if is_digital_arrest or (is_arrest and (is_auth or is_urgency or is_money)):
        context_scam_score = max(context_scam_score, 95.0)
    if is_parcel:
        context_scam_score = max(context_scam_score, 92.0)
    if is_prize:
        context_scam_score = max(context_scam_score, 88.0)
    if is_util and (is_urgency or is_money):
        context_scam_score = max(context_scam_score, 90.0)
    elif is_util:
        context_scam_score = max(context_scam_score, 78.0)
    if is_loan and (is_money or is_urgency):
        context_scam_score = max(context_scam_score, 88.0)

    if is_otp and (is_auth or is_urgency or is_kyc):
        context_scam_score = max(context_scam_score, 94.0)
        if "Verification pressure applied" not in detected_indicators:
            detected_indicators.append("Verification pressure applied")
    elif is_otp:
        context_scam_score = max(context_scam_score, 80.0)

    if is_auth and (is_money or is_arrest or is_urgency):
        context_scam_score = max(context_scam_score, 92.0)
    elif is_auth:
        context_scam_score = max(context_scam_score, 70.0)

    if is_kyc and (is_urgency or is_money):
        context_scam_score = max(context_scam_score, 88.0)
    elif is_kyc:
        context_scam_score = max(context_scam_score, 68.0)

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
        "language": language_label,
        "detected_languages": detected_langs,
        "is_multilingual": is_multi,
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
