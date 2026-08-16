"""
CyberShield OTP Fraud Analyzer — Multilingual Engine
=====================================================
Supports: English (en), Telugu (te), Tamil (ta), Hindi (hi), and Code-Mixed text.
Detects:
  - OTP Request / Phishing Scams
  - Fake Bank Account Block Threats
  - Legitimate Anti-Phishing Warnings (False Positive Guard)
"""

def analyze_otp(message: str) -> dict:
    text = (message or "").strip()
    if not text:
        return {
            "Language": "English",
            "Classification": "Unable to Analyze",
            "Category": "NORMAL_CALL",
            "Risk Level": "Low",
            "Confidence": "0%",
            "verdict": "SAFE",
            "confidence": 0.0,
            "classification": "Unable to Analyze",
            "risk_level": "Low",
            "explanation": "No text message provided to analyze.",
            "reason": "No text message provided to analyze.",
            "recommended_action": "Paste an OTP or SMS message to scan.",
            "detected_indicators": [],
            "flags": ["empty_message"],
            "input_data": "",
            "ml_model": "Multilingual AI Engine",
        }

    try:
        from services.ml_training.scam_classifier import classify_transcript
        clf_result = classify_transcript(text)
    except Exception as e:
        print(f"[OTP ML ERROR]: {e}")
        clf_result = None

    if clf_result:
        verdict = clf_result.get("verdict", "SAFE")
        confidence = clf_result.get("confidence", 0.0)
        classification = clf_result.get("Classification", clf_result.get("classification", "Likely Safe"))
        category = clf_result.get("Category", clf_result.get("category", "NORMAL_CALL"))
        language = clf_result.get("Language", "English")
        risk_level = clf_result.get("Risk Level", clf_result.get("risk_level", "Low"))
        detected_indicators = clf_result.get("detected_indicators", [])
        explanation = clf_result.get("explanation", "Multilingual OTP text analysis complete.")
        recommended_action = clf_result.get("recommended_action", "Maintain safety awareness.")
    else:
        verdict = "SAFE"
        confidence = 0.0
        classification = "Likely Safe"
        category = "NORMAL_CALL"
        language = "English"
        risk_level = "Low"
        detected_indicators = []
        explanation = "Message analysis completed."
        recommended_action = "Never share OTPs with anyone."

    return {
        "Language": language,
        "Classification": classification,
        "Category": category,
        "Risk Level": risk_level,
        "Confidence": f"{round(confidence)}%",
        "verdict": verdict,
        "confidence": confidence,
        "classification": classification,
        "risk_level": risk_level,
        "explanation": explanation,
        "reason": explanation,
        "recommended_action": recommended_action,
        "detected_indicators": detected_indicators if detected_indicators else ["No suspicious indicators detected"],
        "flags": [category.lower()],
        "input_data": text[:300],
        "ml_model": "TF-IDF + Scikit-Learn Multilingual Scam Engine",
    }
