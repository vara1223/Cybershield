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

# ── 3. Voice Analyzer (Local PyTorch Whisper STT + Scam Classifier) ────────────
print()
print(SEP)
print("TEST 3: Voice Analyzer (Local PyTorch Whisper STT + Scam Classifier)")
print(SEP)
try:
    from services.voice_analyzer import _get_local_whisper, analyze_voice
    import base64 as _b64

    model = _get_local_whisper()
    print(f"  Local PyTorch Whisper model loaded: {model is not None}")

    # 1-second silent WAV
    silent_wav = (
        b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
        b"D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    )
    b64_audio = _b64.b64encode(silent_wav).decode()
    r = analyze_voice(b64_audio, "wav")
    print(f"  Silent audio verdict: {r['verdict']}  stt_provider: {r['stt_provider']}  ml_model: {r['ml_model']}")

    from services.voice_analyzer import _highlight_phrases
    fake_transcript = "Sir this is CBI officer Sharma. Transfer ₹50,000 or you will be arrested immediately."
    phrases = _highlight_phrases(fake_transcript)
    print(f"  Scam keyword highlight: {phrases}")

except Exception as e:
    print(f"  FAIL FAILED: {e}")

# ── 4. OTP / UPI Analyzers (Local Scikit-Learn Trained Models) ─────────────────
print()
print(SEP)
print("TEST 4: OTP + UPI Analyzers (Scikit-Learn Trained Models)")
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
        print(f"  OTP: verdict={r['verdict']}  confidence={r['confidence']}%  ml_score={r['ml_score']}  model={r['ml_model']}")

    upi_cases = ["paytm@paytm", "sbi.rajesh123@okaxis", "lottery-winner-9876@ybl"]
    for upi in upi_cases:
        r = analyze_upi(upi)
        print(f"  UPI: verdict={r['verdict']}  confidence={r['confidence']}%  ml_score={r['ml_score']}  model={r['ml_model']}")
except Exception as e:
    print(f"  FAIL FAILED: {e}")

print()
print(SEP)
print("All 100% Local Trained ML Tests Complete (No API Keys Required).")
print(SEP)
