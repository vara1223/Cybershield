"""
Run from backend/ directory:  python test_ml.py
Tests each ML component independently so you can see what's working.
"""

import os
import sys
import base64
import io

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv()

SEP = "-" * 60

# ── 1. URL Analyzer (scikit-learn logistic regression) ────────────────────────
print(SEP)
print("TEST 1: URL Analyzer (scikit-learn LogisticRegression)")
print(SEP)
try:
    from services.url_analyzer import analyze_url

    tests = [
        ("https://google.com", "SAFE"),
        ("http://sbi-bank-update-kyc-urgent.tk/verify?otp=123456", "DANGEROUS"),
        ("https://bit.ly/abc123", "SUSPICIOUS"),
    ]
    for url, expected in tests:
        r = analyze_url(url)
        ok = "OK" if r["verdict"] == expected else "?"
        print(f"  {ok} {url[:55]:<55}  verdict={r['verdict']}  ml={r.get('ml_score','?')}  rule={r.get('rule_score','?')}")
    print("  ML model: scikit-learn LogisticRegression with pretrained phishing coefficients")
except Exception as e:
    print(f"  FAIL FAILED: {e}")

# ── 2. Screenshot Analyzer (Tesseract OCR + BERT text classifier) ─────────────
print()
print(SEP)
print("TEST 2: Screenshot Analyzer (Tesseract OCR + BERT classifier)")
print(SEP)
try:
    from PIL import Image, ImageDraw, ImageFont
    from services.screenshot_analyzer import analyze_screenshot, TESSERACT_AVAILABLE, _get_classifier

    # Build a tiny white image with scam text
    img = Image.new("RGB", (400, 120), "white")
    d = ImageDraw.Draw(img)
    d.text((10, 10), "URGENT: Your SBI account is suspended!", fill="black")
    d.text((10, 40), "Click here to verify your OTP immediately.", fill="black")
    d.text((10, 70), "Transfer ₹500 penalty or account will be blocked.", fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    print(f"  Tesseract available: {TESSERACT_AVAILABLE}")
    clf = _get_classifier()
    print(f"  BERT classifier loaded: {clf is not None}")

    r = analyze_screenshot(b64)
    print(f"  Verdict: {r['verdict']}  Confidence: {r['confidence']}%")
    print(f"  OCR provider: {r['ocr_provider']}")
    print(f"  ML model: {r['ml_model']}")
    print(f"  Extracted text: {r['extracted_text'][:80]!r}")
    print(f"  Flags: {r['flags']}")
except Exception as e:
    print(f"  FAIL FAILED: {e}")

# ── 3. Voice Analyzer (OpenAI Whisper API) ────────────────────────────────────
print()
print(SEP)
print("TEST 3: Voice Analyzer — OpenAI Whisper API connectivity")
print(SEP)
try:
    from services.voice_analyzer import OPENAI_AVAILABLE, _oa_client, _get_local_whisper

    key = os.getenv("OPENAI_API_KEY", "")
    print(f"  OPENAI_API_KEY set: {bool(key)}  (first 8 chars: {key[:8]}...)")
    print(f"  OPENAI_AVAILABLE flag: {OPENAI_AVAILABLE}")

    if OPENAI_AVAILABLE:
        # Minimal API connectivity check (list models — cheap)
        try:
            models = _oa_client.models.list()
            whisper_ok = any("whisper" in m.id for m in models.data)
            print(f"  OpenAI API reachable: OK  whisper-1 model present: {whisper_ok}")
        except Exception as e:
            print(f"  OpenAI API error: {e}")
    else:
        print("  Skipping API check (no key). Checking local Whisper fallback...")
        model = _get_local_whisper()
        print(f"  Local Whisper loaded: {model is not None}")

    # Test scam pattern matching on a transcript (no audio needed)
    from services.voice_analyzer import analyze_voice
    import base64 as _b64

    # 1-second silent WAV (44 bytes) — Whisper will return empty string but patterns still run
    silent_wav = (
        b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
        b"D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    )
    b64_audio = _b64.b64encode(silent_wav).decode()
    r = analyze_voice(b64_audio, "wav")
    print(f"  Silent audio verdict: {r['verdict']}  stt_provider: {r['stt_provider']}")
    print(f"  (Expected: SAFE with low confidence for silence)")

    # Pattern matching test (inject transcript directly)
    from services.voice_analyzer import _build_explanation, _highlight_phrases
    fake_transcript = "Sir this is CBI officer Sharma. Transfer ₹50,000 or you will be arrested immediately."
    phrases = _highlight_phrases(fake_transcript)
    print(f"  Pattern highlight on scam text: {phrases}")

except Exception as e:
    print(f"  FAIL FAILED: {e}")

# ── 4. OTP / UPI analyzers (rule-based, no ML) ───────────────────────────────
print()
print(SEP)
print("TEST 4: OTP + UPI Analyzers (rule-based)")
print(SEP)
try:
    from services.otp_analyzer import analyze_otp
    from services.upi_analyzer import analyze_upi

    otp_cases = [
        "Your OTP for SBI NetBanking is 482910. Do NOT share with anyone.",
        "Your OTP is 123456. Share with our agent to verify your account.",
    ]
    for msg in otp_cases:
        r = analyze_otp(msg)
        print(f"  OTP: {r['verdict']}  {r['confidence']}%  | {msg[:55]}")

    upi_cases = ["paytm@paytm", "sbi.rajesh123@okaxis", "lottery-winner-9876@ybl"]
    for upi in upi_cases:
        r = analyze_upi(upi)
        print(f"  UPI: {r['verdict']}  {r['confidence']}%  | {upi}")
except Exception as e:
    print(f"  FAIL FAILED: {e}")

print()
print(SEP)
print("All tests done. OK = passed, ? = unexpected verdict, FAIL = exception")
print(SEP)
