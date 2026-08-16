import base64
import os
import tempfile
import re

from utils.confidence import clamp, score_to_verdict

def _clean_audio_b64(b64_str: str) -> str:
    if not b64_str:
        return ""
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    b64_str = re.sub(r'[^A-Za-z0-9+/=]', '', b64_str)
    missing_padding = len(b64_str) % 4
    if missing_padding:
        b64_str += "=" * (4 - missing_padding)
    return b64_str

# ---------------------------------------------------------------------------
# STT: OpenAI Whisper-1 API (primary — same model, hosted, no local setup)
# Set OPENAI_API_KEY in backend/.env to enable.
# Cost: ~$0.006 per minute of audio.
# ---------------------------------------------------------------------------
OPENAI_AVAILABLE = False
_oa_client = None

if os.getenv("OPENAI_API_KEY"):
    try:
        from openai import OpenAI as _OpenAI
        _oa_client = _OpenAI(api_key=os.getenv("OPENAI_API_KEY"), timeout=30.0)
        OPENAI_AVAILABLE = True
    except Exception:
        OPENAI_AVAILABLE = False
        _oa_client = None

# ---------------------------------------------------------------------------
# Fallback STT: local Whisper  (small model, 16 kHz mono, language=en)
# ---------------------------------------------------------------------------
_whisper_model = None
_whisper_tried = False

# ── Whisper model size ──────────────────────────────────────────────────────
# Options (accuracy ↑ / speed ↓): tiny → base → small → medium → large
# 'small' is the recommended sweet-spot for accented/phone-call audio.
WHISPER_MODEL_SIZE = "small"

def _get_ffmpeg_path() -> str:
    """
    Find a working ffmpeg binary on the system PATH or via imageio_ffmpeg.
    Returns the full path to the executable, or empty string if not found.
    """
    import shutil
    # 1. Try system PATH first (user may have installed ffmpeg themselves)
    path = shutil.which("ffmpeg")
    if path:
        return path
    # 2. Fall back to imageio_ffmpeg bundled binary
    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_dir = os.path.dirname(ffmpeg_exe)
        # Expose it on PATH so child processes (including whisper) can find it
        if ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
        return ffmpeg_exe
    except Exception as e:
        print(f"[VOICE] imageio_ffmpeg not available: {e}")
    return ""


def _get_local_whisper():
    global _whisper_model, _whisper_tried
    if _whisper_tried:
        return _whisper_model
    _whisper_tried = True
    _get_ffmpeg_path()          # registers ffmpeg on PATH before model load
    try:
        import warnings
        import whisper
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="FP16 is not supported on CPU")
            _whisper_model = whisper.load_model(WHISPER_MODEL_SIZE)
        print(f"[VOICE] Whisper '{WHISPER_MODEL_SIZE}' model loaded.")
    except Exception as e:
        _whisper_model = None
    return _whisper_model

# ---------------------------------------------------------------------------
# Scam pattern library (Multilingual: English, Hindi, Telugu, Tamil)
# ---------------------------------------------------------------------------
SCAM_CALL_PATTERNS = [
    ("fake_authority", [
        # English
        "cbi officer", "police officer", "cybercrime officer",
        "income tax officer", "customs officer", "ed officer",
        "court order", "judiciary", "fbi", "interpol",
        "i am an agent", "i am agent", "calling from bank",
        "bank official", "rbi officer", "government official",
        "calling from the bank", "calling from your bank",
        # Hindi
        "पुलिस", "सीबीआई", "बैंक अधिकारी", "कोर्ट आदेश", "सरकारी अधिकारी", "इन्कम टैक्स", "कस्टम अधिकारी", "पुलिस अधिकारी", "गिरफ्तारी", "सीबीआई अफसर",
        # Telugu (Native + Transliterated)
        "పోలీస్", "సిబిఐ", "బ్యాంక్ అధికారి", "కోర్టు ఆర్డర్", "అరెస్ట్", "ఇన్కమ్ టాక్స్", "కస్టమ్స్", "కేసు", "పోలీసాఫీసర్", "నకిలీ పోలీస్",
        "police", "cbi", "officer", "bank nundi", "police station", "cbi officer", "court order",
        # Tamil
        "போலீஸ்", "சிபிஐ", "வங்கி அதிகாரி", "நீதிமன்ற உத்தரவு", "கைது", "வருமான வரி", "கஸ்டம்ஸ்", "காவல்துறை",
    ]),
    ("aadhaar_link", [
        "aadhaar", "aadhar", "linked to illegal", "linked to crime",
        "aadhaar suspended", "pan card blocked",
        "आधार", "आधार कार्ड", "आधार ब्लॉक",
        "ఆధార్", "ఆధార్ కార్డ్", "ఆధార్ లింక్", "ఆధార్ బ్లాక్", "aadhaar card", "pan card",
        "ஆதார்", "ஆதார் கார்டு",
    ]),
    ("money_demand", [
        "transfer money", "send money", "deposit money",
        "pay fine", "pay penalty", "pay immediately",
        "₹", "lakh", "crore", "rupees", "transfer the amount",
        "send the amount", "pay the amount",
        "पैसा भेजो", "तुरंत भुगतान", "पेनाल्टी", "जुर्माना", "लाख", "करोड़", "पैसा ट्रांसफर",
        "డబ్బులు పంపు", "వెంటనే చెల్లించండి", "జరిమానా", "లక్ష", "కోటి", "ఖాతాలో వేయండి", "డబ్బులు", "ఖాతా", "రకమ",
        "dabulu", "dabbulu", "pampandi", "money transfer", "fine pay",
        "பணம் அனுப்பு", "உடனே செலுத்து", "அபராதம்", "லட்சம்", "கோடி",
    ]),
    ("arrest_threat", [
        "arrest", "arrested", "warrant", "jail", "prison",
        "behind bars", "in custody", "fir",
        "गिरफ्तार", "जेल", "वारंट", "हिरासत",
        "అరెస్ట్", "జైలు", "వారెంట్", "కేసు నమోదు", "అరెస్టు", "స్టేషన్",
        "arrest", "jail", "warrant", "case",
        "கைது", "ஜெயில்", "வாரண்ட்",
    ]),
    ("urgency", [
        "immediately", "right now", "within 1 hour", "or else",
        "otherwise", "last chance", "no time", "urgent",
        "as soon as possible", "asap", "within 24 hours",
        "तुरंत", "अभी", "अंतिम मौका", "जरूरी",
        "వెంటనే", "ఇప్పుడే", "ఆఖరి అవకాశం", "అర్జెంట్", "త్వరగా",
        "ventane", "ippude", "urgent", "asap",
        "உடனே", "இப்போதே", "கடைசி வாய்ப்பு", "அவசரம்",
    ]),
    ("personal_data_request", [
        "otp", "one time password",
        "your pin", "your password", "account number", "account details",
        "bank details", "card number", "cvv",
        "date of birth", "mother's name", "aadhaar number", "pan number",
        "share the otp", "share otp", "share your otp", "tell me the otp",
        "tell me your otp", "give me the otp", "what is the otp",
        "verify the otp", "confirm the otp", "enter the otp",
        "ओटीपी", "ओटीपी बताओ", "ओटीपी शेयर", "पिन", "खाता संख्या",
        "ఓటీపీ", "ఓటీపీ చెప్పు", "పిన్", "ఖాతా సంఖ్య",
        "ఓటిపి", "ఓటిపి చెప్పు", "ఒటిపి", "ఒటిపి చెప్పు",
        "otp cheppandi", "share cheyandi", "pin cheppandi",
        "ஓடிபி", "ஓடிபி சொல்", "பின்", "கணக்கு எண்",
    ]),
    ("remote_access", [
        "install app", "download anydesk", "download teamviewer",
        "share screen", "remote access", "screen share",
        "screen sharing", "anydesk", "teamviewer", "quick support",
        "ऐप डाउनलोड करो", "स्क्रीन शेयर", "एनीडेस्क",
        "యాప్ డౌన్‌లోడ్ చేయి", "స్క్రీన్ షేర్", "ఎనీడెస్క్",
        "app download", "screen share", "anydesk",
        "ஆப் பதிவிறக்கு", "ஸ்கிரீன் ஷேர்", "எனிடெஸ்க்",
    ]),
]


def _detect_audio_suffix(audio_bytes: bytes, fallback_format: str = "m4a") -> str:
    if not audio_bytes or len(audio_bytes) < 12:
        fmt = (fallback_format or "m4a").strip().lstrip(".")
        return f".{fmt}" if fmt else ".m4a"
    # WebM / Matroska (EBML) header
    if audio_bytes.startswith(b"\x1a\x45\xdf\xa3"):
        return ".webm"
    # WAV header
    if audio_bytes.startswith(b"RIFF") and audio_bytes[8:12] == b"WAVE":
        return ".wav"
    # Ogg header
    if audio_bytes.startswith(b"OggS"):
        return ".ogg"
    # FLAC header
    if audio_bytes.startswith(b"fLaC"):
        return ".flac"
    # MP3 header
    if audio_bytes.startswith(b"ID3") or audio_bytes[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return ".mp3"
    # MP4 / M4A header (ftyp box)
    if b"ftyp" in audio_bytes[:32]:
        return ".m4a"
    fmt = (fallback_format or "m4a").strip().lstrip(".")
    return f".{fmt}" if fmt else ".m4a"


def _convert_to_16k_wav(input_path: str) -> str:
    """
    Use ffmpeg to convert any audio format to 16 kHz, mono, 16-bit PCM WAV.
    Returns path to the converted WAV file (caller must delete it).
    Raises RuntimeError if ffmpeg is unavailable or conversion fails.
    """
    import subprocess
    ffmpeg = _get_ffmpeg_path()
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found — cannot preprocess audio")

    out_fd, out_path = tempfile.mkstemp(suffix=".wav")
    os.close(out_fd)
    cmd = [
        ffmpeg,
        "-y",                  # overwrite output without prompt
        "-i", input_path,
        "-ar", "16000",        # resample to 16 kHz
        "-ac", "1",            # mono channel
        "-sample_fmt", "s16",  # 16-bit PCM
        "-vn",                 # no video stream
        out_path,
    ]
    result = subprocess.run(
        cmd, capture_output=True, timeout=30
    )
    if result.returncode != 0:
        stderr = result.stderr.decode(errors="replace")[:400]
        raise RuntimeError(f"ffmpeg preprocessing failed: {stderr}")
    return out_path


def _transcribe_local(audio_bytes: bytes, audio_format: str, language: str = "auto") -> str:
    """
    Transcribe audio bytes using the local Whisper model.
    Pipeline:
      1. Write raw bytes to a temp file (preserving original format).
      2. Convert to 16 kHz mono WAV via ffmpeg.
      3. Transcribe with Whisper (supporting language selection: en/hi/te/ta/auto + English translation).
    """
    model = _get_local_whisper()
    if not model or not audio_bytes:
        print("[VOICE] Skipping local STT: model or audio unavailable")
        return ""

    suffix = _detect_audio_suffix(audio_bytes, audio_format)
    print(f"[VOICE] Writing {len(audio_bytes)} bytes as {suffix} for STT (language={language})")

    # Track temp files so we always clean up even on early exceptions
    _tmp_files = []

    # Write raw input to a temp file
    raw_fd, raw_path = tempfile.mkstemp(suffix=suffix)
    _tmp_files.append(raw_path)
    try:
        with os.fdopen(raw_fd, "wb") as f:
            f.write(audio_bytes)

        # Preprocess: any format → 16 kHz mono WAV
        wav_path = None
        try:
            wav_path = _convert_to_16k_wav(raw_path)
            _tmp_files.append(wav_path)
            transcribe_path = wav_path
            print(f"[VOICE] ffmpeg → 16kHz WAV done ({transcribe_path})")
        except Exception as ffmpeg_err:
            print(f"[VOICE] ffmpeg skipped ({ffmpeg_err}), using raw file")
            transcribe_path = raw_path

        # Transcribe with language support (en/hi/te/ta or None for auto)
        lang_arg = None if (not language or language == "auto") else language.lower()
        import warnings
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="FP16 is not supported on CPU")
            result = model.transcribe(
                transcribe_path,
                language=lang_arg,
                fp16=False,
                verbose=False,
            )
        txt = result.get("text", "").strip() if isinstance(result, dict) else ""

        # If regional language selected (e.g. te, hi, ta), also translate to English for 100% scam scoring accuracy
        if lang_arg and lang_arg != "en":
            try:
                with warnings.catch_warnings():
                    warnings.filterwarnings("ignore", message="FP16 is not supported on CPU")
                    trans_res = model.transcribe(
                        transcribe_path,
                        language=lang_arg,
                        task="translate",
                        fp16=False,
                        verbose=False,
                    )
                trans_txt = trans_res.get("text", "").strip() if isinstance(trans_res, dict) else ""
                if trans_txt and trans_txt != txt:
                    txt = f"{txt} | English Translation: {trans_txt}"
            except Exception as tr_err:
                print(f"[VOICE] Translation pass note: {tr_err}")

        print(f"[VOICE] Whisper transcript ({len(txt)} chars, lang={lang_arg}): '{txt[:120]}'")
        return txt

    except Exception as e:
        print(f"[VOICE] Whisper transcription error: {e}")
        return ""
    finally:
        for p in _tmp_files:
            try:
                os.unlink(p)
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


def analyze_voice(audio_b64: str, audio_format: str = "m4a", client_transcript: str = None) -> dict:
    transcript = (client_transcript or "").strip()
    stt_provider = "client-speech-api" if transcript else "unavailable"

    cleaned_b64 = _clean_audio_b64(audio_b64)
    try:
        audio_bytes = base64.b64decode(cleaned_b64) if cleaned_b64 else b""
    except Exception as e:
        print(f"[VOICE] base64 decode exception: {e}")
        audio_bytes = b""

    print(f"[VOICE] b64_len={len(audio_b64 or '')}, audio_bytes={len(audio_bytes)}, format={audio_format}")

    # ── Step 1: Speech-to-Text via local Whisper ────────────────────────────
    if len(transcript) < 15 and _get_local_whisper() and audio_bytes:
        try:
            whisper_txt = _transcribe_local(audio_bytes, audio_format)
            print(f"[VOICE] Whisper STT: '{whisper_txt}'")
            if whisper_txt and len(whisper_txt) > len(transcript):
                transcript = whisper_txt
                stt_provider = "whisper-base-local"
        except Exception as e:
            print(f"[VOICE] Whisper exception: {e}")

    # ── Step 2: ML + Rule-Based Classification ──────────────────────────────
    try:
        from services.ml_training.scam_classifier import classify_transcript
        clf_result = classify_transcript(transcript)
    except Exception as e:
        print(f"[VOICE] ML classifier error: {e}")
        clf_result = None

    if clf_result:
        verdict = clf_result["verdict"]
        confidence = clf_result["confidence"]
        classification = clf_result["classification"]
        risk_level = clf_result["risk_level"]
        detected_indicators = clf_result["detected_indicators"]
        highlighted_phrases = clf_result["highlighted_phrases"]
        explanation = clf_result["explanation"]
        recommended_action = clf_result["recommended_action"]
        ml_model_label = (
            "TF-IDF + SVM/RF Ensemble + Rule Engine (Local Sklearn)"
            if clf_result.get("ml_available")
            else "Rule Engine (Local)"
        )
    else:
        # Hard fallback to old pattern engine if import fails
        from utils.confidence import clamp as _clamp, score_to_verdict as _s2v
        score = 0
        lower_txt = transcript.lower()
        for cat, keywords in SCAM_CALL_PATTERNS:
            for kw in keywords:
                if kw in lower_txt:
                    score += 25
                    break
        score = _clamp(score)
        verdict = _s2v(score)
        confidence = float(score)
        classification = "Scam" if verdict == "DANGEROUS" else "Suspicious" if verdict == "SUSPICIOUS" else "Likely Safe"
        risk_level = "High" if verdict == "DANGEROUS" else "Medium" if verdict == "SUSPICIOUS" else "Low"
        detected_indicators = []
        highlighted_phrases = []
        explanation = "Rule-based analysis (ML model unavailable)."
        recommended_action = "Hang up immediately." if verdict == "DANGEROUS" else "Exercise caution."
        ml_model_label = "Rule Engine Fallback"

    if not transcript or not transcript.strip():
        return {
            "verdict": "SAFE",
            "confidence": 0.0,
            "classification": "Unable to Analyze",
            "risk_level": "Low",
            "explanation": "No clear speech detected in the audio. Please retry with clearer audio.",
            "reason": "No clear speech detected in the audio. Please retry with clearer audio.",
            "recommended_action": "Please retry with a clearer audio recording.",
            "detected_indicators": [],
            "flags": ["silent_audio"],
            "transcript": "",
            "input_data": "Unable to extract clear transcript from audio",
            "highlighted_phrases": [],
            "stt_provider": stt_provider,
            "ml_model": ml_model_label,
        }

    return {
        "verdict": verdict,
        "confidence": confidence,
        "classification": classification,
        "risk_level": risk_level,
        "explanation": explanation,
        "reason": explanation,
        "recommended_action": recommended_action,
        "detected_indicators": detected_indicators,
        "flags": highlighted_phrases,
        "transcript": transcript,
        "input_data": transcript,
        "highlighted_phrases": highlighted_phrases,
        "stt_provider": stt_provider,
        "ml_model": ml_model_label,
    }


def analyze_voice_bytes(audio_bytes: bytes, audio_format: str = "webm", client_transcript: str = None, language: str = "auto") -> dict:
    """
    Main entry point used by the multipart /analyze/voice endpoint.
    Accepts raw audio bytes directly — no base64 involved.

    Pipeline:
      1. (Optional) Run Whisper STT if audio_bytes is large enough.
      2. Merge with client_transcript if provided.
      3. Run ML + rule-based classifier on the transcript.
      4. Return structured result dict.
    """
    transcript = (client_transcript or "").strip()
    stt_provider = "client_text" if transcript else "unavailable"
    audio_size = len(audio_bytes)

    print(f"[VOICE] analyze_voice_bytes: audio_size={audio_size}B format={audio_format!r} "
          f"client_transcript_chars={len(transcript)} language={language!r}")

    if audio_size < 5000 and audio_size > 0:
        print(f"[VOICE ERROR] Audio recording too small: {audio_size} bytes")

    # ── Reject truly empty audio with no transcript ──────────────────────────
    if audio_size == 0 and not transcript:
        raise ValueError("No audio and no transcript received — nothing to analyze.")

    # ── Step 1: Whisper STT ──────────────────────────────────────────────────
    whisper_available = _get_local_whisper() is not None
    MIN_AUDIO_BYTES = 1000  # anything smaller is almost certainly corrupt/empty

    if audio_size >= MIN_AUDIO_BYTES and whisper_available and len(transcript) < 15:
        print(f"[VOICE] Running Whisper on {audio_size}B of audio (language={language})...")
        try:
            whisper_txt = _transcribe_local(audio_bytes, audio_format, language)
            print(f"[VOICE] Whisper STT result: {len(whisper_txt)} chars → {repr(whisper_txt[:100])}")
            if whisper_txt and len(whisper_txt.strip()) > 0:
                transcript = whisper_txt.strip()
                stt_provider = "whisper"
        except Exception as e:
            import traceback
            print(f"[VOICE] Whisper STT error:\n{traceback.format_exc()}")
    elif audio_size < MIN_AUDIO_BYTES and audio_size > 0:
        print(f"[VOICE] Audio too small ({audio_size}B < {MIN_AUDIO_BYTES}B minimum) — skipping Whisper. "
              f"Check that the recording was fully saved before upload.")
    elif not whisper_available:
        print("[VOICE] Whisper model not loaded — STT skipped.")

    # ── Step 2: ML + Rule-Based Classification ───────────────────────────────
    try:
        from services.ml_training.scam_classifier import classify_transcript
        clf_result = classify_transcript(transcript)
    except Exception as e:
        import traceback
        print(f"[VOICE] ML classifier error:\n{traceback.format_exc()}")
        clf_result = None

    if clf_result:
        verdict          = clf_result["verdict"]
        confidence       = clf_result["confidence"]
        classification   = clf_result["classification"]
        risk_level       = clf_result["risk_level"]
        detected_indicators = clf_result["detected_indicators"]
        highlighted_phrases = clf_result["highlighted_phrases"]
        explanation      = clf_result["explanation"]
        recommended_action = clf_result["recommended_action"]
        ml_model_label   = (
            "TF-IDF + SVM/RF Ensemble + Rule Engine (Local Sklearn)"
            if clf_result.get("ml_available") else "Rule Engine (Local)"
        )
    else:
        from utils.confidence import clamp as _clamp, score_to_verdict as _s2v
        score = 0
        lower_txt = transcript.lower()
        for cat, keywords in SCAM_CALL_PATTERNS:
            for kw in keywords:
                if kw in lower_txt:
                    score += 25
                    break
        score = _clamp(score)
        verdict          = _s2v(score)
        confidence       = float(score)
        classification   = "Scam" if verdict == "DANGEROUS" else "Suspicious" if verdict == "SUSPICIOUS" else "Likely Safe"
        risk_level       = "High" if verdict == "DANGEROUS" else "Medium" if verdict == "SUSPICIOUS" else "Low"
        detected_indicators = []
        highlighted_phrases = []
        explanation      = "Rule-based analysis (ML model unavailable)."
        recommended_action = "Hang up immediately." if verdict == "DANGEROUS" else "Exercise caution."
        ml_model_label   = "Rule Engine Fallback"

    # ── No transcript → cannot classify reliably ─────────────────────────────
    if not transcript or not transcript.strip():
        if audio_size < 5000 and audio_size > 0:
            msg = (
                f"Very little microphone audio was captured ({audio_size} bytes). "
                "Please speak clearly for a few seconds and try again."
            )
        else:
            msg = "No usable speech was detected in the audio. Please check your microphone or record again."

        return {
            "verdict": "SAFE",
            "confidence": 0.0,
            "classification": "Unable to Analyze",
            "risk_level": "UNKNOWN",
            "explanation": msg,
            "reason": msg,
            "recommended_action": "Please check your microphone and record again for 3-5 seconds while speaking clearly.",
            "detected_indicators": [],
            "flags": ["silent_audio"],
            "transcript": "",
            "input_data": f"[No usable speech detected — {audio_size}B received]",
            "highlighted_phrases": [],
            "stt_provider": stt_provider,
            "ml_model": ml_model_label,
        }

    print(f"[VOICE] Final verdict: {verdict} ({confidence}%) — transcript: {repr(transcript[:80])}")

    return {
        "verdict": verdict,
        "confidence": confidence,
        "classification": classification,
        "risk_level": risk_level,
        "explanation": explanation,
        "reason": explanation,
        "recommended_action": recommended_action,
        "detected_indicators": detected_indicators,
        "flags": highlighted_phrases,
        "transcript": transcript,
        "input_data": transcript,
        "highlighted_phrases": highlighted_phrases,
        "stt_provider": stt_provider,
        "ml_model": ml_model_label,
    }


def _build_voice_structured_output(verdict: str, score: float, flags: list, transcript: str, stt_provider: str, ml_model: str) -> dict:
    if not transcript or not transcript.strip():
        return {
            "verdict": "SAFE",
            "confidence": 0.0,
            "classification": "Unable to Analyze",
            "risk_level": "Low",
            "explanation": "Unable to extract enough information for reliable analysis. No clear speech detected in the audio file.",
            "reason": "Unable to extract enough information for reliable analysis.",
            "recommended_action": "Please retry with a clearer audio recording or better-quality voice file.",
            "detected_indicators": [],
            "flags": flags + ["silent_audio"],
            "transcript": "",
            "input_data": "Unable to extract clear transcript from audio",
            "highlighted_phrases": [],
            "stt_provider": stt_provider,
            "ml_model": ml_model,
        }

    if verdict == "DANGEROUS":
        classification = "Scam"
        risk_level = "High"
    elif verdict == "SUSPICIOUS":
        classification = "Suspicious"
        risk_level = "High" if score >= 60 else "Medium"
    else:
        classification = "Likely Safe"
        risk_level = "Low"

    indicator_map = {
        "fake_authority": "Fake Police / Government Authority Impersonation",
        "money_demand": "Immediate Money Transfer / Payment Request",
        "arrest_threat": "Threat of Arrest / Legal Intimidation",
        "urgency": "High Pressure Urgency Tactics",
        "personal_data_request": "Request for OTP / PIN / Credentials",
        "aadhaar_link": "Claims Aadhaar Linked to Crime",
        "remote_access": "Request to Install Remote Access App",
    }

    detected_indicators = []
    for flag in flags:
        for key, val in indicator_map.items():
            if flag.startswith(key):
                if val not in detected_indicators:
                    detected_indicators.append(val)

    if not detected_indicators and classification != "Likely Safe":
        detected_indicators = ["Suspicious social-engineering conversation patterns"]

    if classification == "Scam":
        recommended_action = "Hang up immediately. Never share OTPs, PINs, or transfer money over the phone. Report to Cybercrime Helpline 1930."
    elif classification == "Suspicious":
        recommended_action = "Do not share personal details or complete any money transfers. Verify caller identity with official organizations."
    else:
        recommended_action = "No scam call patterns detected. Maintain general call safety awareness."

    reason = _build_explanation(verdict, flags, transcript)

    return {
        "verdict": verdict,
        "confidence": round(score, 1),
        "classification": classification,
        "risk_level": risk_level,
        "explanation": reason,
        "reason": reason,
        "recommended_action": recommended_action,
        "detected_indicators": detected_indicators,
        "flags": flags,
        "transcript": transcript,
        "input_data": transcript[:300],
        "highlighted_phrases": _highlight_phrases(transcript),
        "stt_provider": stt_provider,
        "ml_model": ml_model,
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
