import base64
import os
import tempfile

from utils.confidence import clamp, score_to_verdict

# ---------------------------------------------------------------------------
# STT: OpenAI Whisper-1 API (primary — same model, hosted, no local setup)
# Set OPENAI_API_KEY in backend/.env to enable.
# Cost: ~$0.006 per minute of audio.
# ---------------------------------------------------------------------------
try:
    from openai import OpenAI as _OpenAI
    _oa_client = _OpenAI(api_key=os.getenv("OPENAI_API_KEY"), timeout=30.0)
    OPENAI_AVAILABLE = bool(os.getenv("OPENAI_API_KEY"))
except ImportError:
    OPENAI_AVAILABLE = False
    _oa_client = None

# ---------------------------------------------------------------------------
# Fallback STT: local Whisper (if no API key set)
# ---------------------------------------------------------------------------
_whisper_model = None
_whisper_tried = False

def _get_local_whisper():
    global _whisper_model, _whisper_tried
    if _whisper_tried:
        return _whisper_model
    _whisper_tried = True
    try:
        import static_ffmpeg
        static_ffmpeg.add_paths()
        import whisper
        _whisper_model = whisper.load_model("base")
    except Exception:
        _whisper_model = None
    return _whisper_model

# ---------------------------------------------------------------------------
# Scam pattern library
# ---------------------------------------------------------------------------
SCAM_CALL_PATTERNS = [
    ("fake_authority", [
        "cbi officer", "police officer", "cybercrime officer",
        "income tax officer", "customs officer", "ed officer",
        "court order", "judiciary", "fbi", "interpol",
        "i am an agent", "i am agent", "calling from bank",
        "bank official", "rbi officer", "government official",
        "calling from the bank", "calling from your bank",
    ]),
    ("aadhaar_link", [
        "aadhaar", "aadhar", "linked to illegal", "linked to crime",
        "aadhaar suspended", "pan card blocked",
    ]),
    ("money_demand", [
        "transfer money", "send money", "deposit money",
        "pay fine", "pay penalty", "pay immediately",
        "₹", "lakh", "crore", "rupees", "transfer the amount",
        "send the amount", "pay the amount",
    ]),
    ("arrest_threat", [
        "arrest", "arrested", "warrant", "jail", "prison",
        "behind bars", "in custody", "fir",
    ]),
    ("urgency", [
        "immediately", "right now", "within 1 hour", "or else",
        "otherwise", "last chance", "no time", "urgent",
        "as soon as possible", "asap", "within 24 hours",
    ]),
    ("personal_data_request", [
        # OTP — any mention is high risk in an unsolicited call
        "otp", "one time password",
        # PIN / account
        "your pin", "your password", "account number", "account details",
        "bank details", "card number", "cvv",
        # Personal info
        "date of birth", "mother's name", "aadhaar number", "pan number",
        # Phrasing variants
        "share the otp", "share otp", "share your otp", "tell me the otp",
        "tell me your otp", "give me the otp", "what is the otp",
        "verify the otp", "confirm the otp", "enter the otp",
    ]),
    ("remote_access", [
        "install app", "download anydesk", "download teamviewer",
        "share screen", "remote access", "screen share",
        "screen sharing", "anydesk", "teamviewer", "quick support",
    ]),
]


def _transcribe_local(audio_bytes: bytes, audio_format: str) -> str:
    model = _get_local_whisper()
    if not model:
        return ""
    suffix = f".{audio_format}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        result = model.transcribe(tmp_path)
        return result["text"].strip()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _transcribe_openai(audio_bytes: bytes, audio_format: str) -> str:
    suffix = f".{audio_format}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as f:
            result = _oa_client.audio.transcriptions.create(
                model="whisper-1", file=f, response_format="text",
                timeout=30.0
            )
        return result.strip() if isinstance(result, str) else result
    except Exception as e:
        print(f"OpenAI transcription request failed or timed out: {e}")
        return ""
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def analyze_voice(audio_b64: str, audio_format: str = "m4a") -> dict:
    transcript = ""
    flags = []
    score = 0
    stt_provider = "unavailable"

    audio_bytes = base64.b64decode(audio_b64)

    # --- Step 1: Speech-to-Text (OpenAI Whisper API preferred, local fallback) ---
    if OPENAI_AVAILABLE:
        try:
            transcript = _transcribe_openai(audio_bytes, audio_format)
            stt_provider = "whisper-1-api"
            flags.append("stt:whisper-1-api")
        except Exception as e:
            flags.append(f"stt_api_error:{str(e)[:80]}")

    if not transcript and _get_local_whisper():
        try:
            transcript = _transcribe_local(audio_bytes, audio_format)
            stt_provider = "whisper-base-local"
            flags.append("stt:whisper-base-local")
        except Exception as e:
            flags.append(f"stt_local_error:{str(e)[:80]}")

    # --- Step 2: Scam pattern analysis on transcript ---
    if transcript:
        text_lower = transcript.lower()
        pattern_scores = []

        for pattern_name, keywords in SCAM_CALL_PATTERNS:
            hits = [kw for kw in keywords if kw in text_lower]
            if hits:
                pattern_scores.append((pattern_name, hits))
                flags.append(f"{pattern_name}:{hits[0]}")

        if len(pattern_scores) >= 3:
            score = 85 + min(10, (len(pattern_scores) - 3) * 3)
        elif len(pattern_scores) == 2:
            score = 65
        elif len(pattern_scores) == 1:
            score = 45
        else:
            score = 10

        # High-signal patterns — any one alone is near-definitive
        if any(p[0] == "personal_data_request" for p in pattern_scores):
            score = max(score, 80)   # asking for OTP/PIN on a call = scam
        if any(p[0] == "money_demand" for p in pattern_scores):
            score = max(score, 65)
        if any(p[0] == "fake_authority" for p in pattern_scores):
            score += 15
        if any(p[0] == "arrest_threat" for p in pattern_scores):
            score += 20
        if any(p[0] == "urgency" for p in pattern_scores):
            score += 10
    else:
        score = 15

    score = clamp(score)
    verdict = score_to_verdict(score)

    return {
        "verdict": verdict,
        "confidence": round(score, 1),
        "explanation": _build_explanation(verdict, flags, transcript),
        "flags": flags,
        "transcript": transcript,
        "highlighted_phrases": _highlight_phrases(transcript),
        "stt_provider": stt_provider,
        "ml_model": "openai-whisper-base" if stt_provider == "whisper-base-local" else stt_provider,
    }


def _highlight_phrases(transcript: str) -> list:
    if not transcript:
        return []
    text_lower = transcript.lower()
    keywords = [
        "otp", "cbi officer", "police", "arrest", "warrant",
        "transfer money", "send money", "lakh", "crore",
        "immediately", "illegal", "aadhaar", "suspended",
        "fine", "penalty", "share", "verify", "account details",
        "pin", "password", "anydesk", "teamviewer",
    ]
    return [kw for kw in keywords if kw in text_lower][:8]


def _build_explanation(verdict: str, flags: list, transcript: str) -> str:
    if not flags or verdict == "SAFE":
        return (
            "The voice recording does not match known scam call patterns. "
            "Whisper transcription and pattern analysis found no significant fraud indicators."
        )
    reasons = []
    for flag in flags:
        if flag.startswith("fake_authority"):
            reasons.append("the caller claims to be a government/law enforcement official — real officials never call to demand money")
        if flag.startswith("money_demand"):
            reasons.append("the caller demands a money transfer or payment — a defining characteristic of phone scams")
        if flag.startswith("arrest_threat"):
            reasons.append("the caller threatens arrest or legal action to create panic — a classic intimidation tactic")
        if flag.startswith("urgency"):
            reasons.append("the caller creates extreme urgency, leaving no time to verify or consult others")
        if flag.startswith("aadhaar_link"):
            reasons.append("claims your Aadhaar is linked to illegal activity — a known CBI/cybercrime scam script")
        if flag.startswith("remote_access"):
            reasons.append("asks you to install remote access software — this gives scammers control of your device")
    tier = "a high-confidence scam call" if verdict == "DANGEROUS" else "a suspicious call"
    return (
        f"This recording matches the pattern of {tier}. Whisper ML transcription and scam analysis shows "
        f"{'; '.join(reasons[:3])}. Real government agencies, police, and courts NEVER demand money over a phone call."
    )
