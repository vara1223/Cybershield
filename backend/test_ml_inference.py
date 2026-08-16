import sys
sys.path.insert(0, '.')
from services.voice_analyzer import analyze_voice

tests = [
    ("I am CBI officer, your Aadhaar is linked to crime, pay rupees 50000 immediately or face arrest.", "EXPECTED: SCAM"),
    ("Your HDFC home loan EMI of 3500 rupees is due on the 15th. Please pay via the app.", "EXPECTED: LEGITIMATE"),
    ("Share the OTP now to stop the unauthorised transaction from your account. This is the bank calling.", "EXPECTED: SCAM"),
    ("Congratulations! Your number has won rupees 25 lakh in KBC lucky draw. Pay 5000 processing fee to claim.", "EXPECTED: SCAM"),
    ("Hi, I am from the school administration calling about next week parent teacher meeting.", "EXPECTED: LEGITIMATE"),
]

print("\n== CyberShield ML Voice Classifier Test ==")
print("=" * 60)
for text, expected in tests:
    r = analyze_voice('', 'wav', text)
    print(f"\n{expected}")
    print(f"  Verdict   : {r['verdict']}")
    print(f"  Confidence: {r['confidence']}%")
    print(f"  Class     : {r['classification']}")
    print(f"  Indicators: {', '.join(r['detected_indicators'][:2]) or 'None'}")
    print(f"  ML Model  : {r['ml_model']}")
print("\n" + "=" * 60)
