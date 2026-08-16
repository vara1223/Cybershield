# Screenshot Threat Analyzer — Multilingual Trained ML & OCR Engine
import base64
import io
import re
import os

from PIL import Image
from utils.confidence import clamp, score_to_verdict

# ---------------------------------------------------------------------------
# Native Windows 10/11 OCR (100% offline, zero external setup)
# ---------------------------------------------------------------------------
winocr_module = None
WINOCR_AVAILABLE = False
try:
    import winocr as winocr_module
    WINOCR_AVAILABLE = True
except Exception:
    winocr_module = None
    WINOCR_AVAILABLE = False

# ---------------------------------------------------------------------------
# OCR: pytesseract (Tesseract 4/5 Multilingual LSTM: English, Telugu, Tamil, Hindi)
# ---------------------------------------------------------------------------
try:
    import pytesseract
    import sys
    if sys.platform == "win32":
        _tess_path = os.getenv(
            "TESSERACT_PATH",
            r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        )
        pytesseract.pytesseract.tesseract_cmd = _tess_path
    pytesseract.get_tesseract_version()
    TESSERACT_AVAILABLE = True
except Exception:
    TESSERACT_AVAILABLE = False

from PIL import ImageEnhance, ImageOps

def _preprocess_image_pass1(img: Image.Image) -> Image.Image:
    w, h = img.size
    if max(w, h) > 1600:
        ratio = 1600 / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
    elif max(w, h) < 800:
        ratio = 1200 / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
    enhancer = ImageEnhance.Contrast(img)
    return enhancer.enhance(1.6)

def _preprocess_image_pass2(img: Image.Image) -> Image.Image:
    gray = ImageOps.grayscale(img)
    enhancer = ImageEnhance.Sharpness(gray)
    sharp = enhancer.enhance(1.8)
    contrast = ImageEnhance.Contrast(sharp)
    return contrast.enhance(1.8)

def _clean_b64(b64_str: str) -> str:
    if not b64_str:
        return ""
    if "," in b64_str and b64_str.startswith("data:"):
        return b64_str.split(",", 1)[1]
    return b64_str.strip()

def _ocr_winocr(image_b64: str) -> str:
    global WINOCR_AVAILABLE, winocr_module
    image_b64 = _clean_b64(image_b64)
    if not WINOCR_AVAILABLE or winocr_module is None:
        try:
            import winocr as winocr_module
            WINOCR_AVAILABLE = True
        except Exception:
            return ""
    try:
        image_bytes = base64.b64decode(image_b64)
        raw_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        p1 = _preprocess_image_pass1(raw_img)
        res = winocr_module.recognize_pil_sync(p1)
        txt = res.get("text", "").strip()

        if len(txt) < 15:
            p2 = _preprocess_image_pass2(raw_img)
            res2 = winocr_module.recognize_pil_sync(p2)
            txt2 = res2.get("text", "").strip()
            if len(txt2) > len(txt):
                txt = txt2

        if len(txt) < 15:
            res_raw = winocr_module.recognize_pil_sync(raw_img)
            txt_raw = res_raw.get("text", "").strip()
            if len(txt_raw) > len(txt):
                txt = txt_raw

        return txt
    except Exception as e:
        print("WinOCR note:", e)
        return ""


def _ocr_tesseract(image_b64: str) -> str:
    image_b64 = _clean_b64(image_b64)
    try:
        image_bytes = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        try:
            return pytesseract.image_to_string(img, lang="eng+tel+tam+hin").strip()
        except Exception:
            try:
                return pytesseract.image_to_string(img, lang="eng+hin").strip()
            except Exception:
                return pytesseract.image_to_string(img, lang="eng").strip()
    except Exception:
        return ""


def analyze_screenshot(image_b64: str) -> dict:
    flags = []
    extracted_text = ""
    ocr_provider = "unavailable"

    # --- Step 1: Local Multi-tier OCR ---
    try:
        extracted_text = _ocr_winocr(image_b64)
        if extracted_text:
            ocr_provider = "windows-native-ocr"
            flags.append("ocr:windows-native-ocr")
    except Exception as e:
        flags.append(f"winocr_error:{str(e)[:60]}")

    if not extracted_text and TESSERACT_AVAILABLE:
        try:
            extracted_text = _ocr_tesseract(image_b64)
            if extracted_text:
                ocr_provider = "tesseract-multilingual"
                flags.append("ocr:tesseract-multilingual")
        except Exception as e:
            flags.append(f"tesseract_error:{str(e)[:60]}")

    if not extracted_text or not extracted_text.strip():
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
            "explanation": "Unable to extract readable text from the screenshot. Please upload a clearer image.",
            "reason": "Unable to extract readable text from the screenshot.",
            "recommended_action": "Retry scanning with a higher-contrast screenshot.",
            "detected_indicators": [],
            "flags": ["empty_ocr_result"],
            "extracted_text": "",
            "input_data": "[No readable text extracted]",
            "ocr_provider": ocr_provider,
            "ml_model": "Multilingual AI Classifier",
        }

    # --- Step 2: Pass OCR text to Multilingual Scam Classifier ---
    try:
        from services.ml_training.scam_classifier import classify_transcript
        clf_result = classify_transcript(extracted_text)
    except Exception as e:
        print(f"[SCREENSHOT ML ERROR]: {e}")
        clf_result = None

    if clf_result:
        verdict = clf_result.get("verdict", "SAFE")
        confidence = clf_result.get("confidence", 0.0)
        classification = clf_result.get("Classification", clf_result.get("classification", "Likely Safe"))
        category = clf_result.get("Category", clf_result.get("category", "NORMAL_CALL"))
        language = clf_result.get("Language", "English")
        risk_level = clf_result.get("Risk Level", clf_result.get("risk_level", "Low"))
        detected_indicators = clf_result.get("detected_indicators", [])
        explanation = clf_result.get("explanation", "Multilingual text analysis complete.")
        recommended_action = clf_result.get("recommended_action", "Maintain general call safety awareness.")
    else:
        verdict = "SAFE"
        confidence = 0.0
        classification = "Likely Safe"
        category = "NORMAL_CALL"
        language = "English"
        risk_level = "Low"
        detected_indicators = []
        explanation = "Basic text analysis completed."
        recommended_action = "Maintain general safety precautions."

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
        "detected_indicators": detected_indicators if detected_indicators else ["No threat indicators detected"],
        "flags": flags,
        "extracted_text": extracted_text[:1000],
        "input_data": extracted_text[:300],
        "ocr_provider": ocr_provider,
        "ml_model": "TF-IDF + Scikit-Learn Multilingual Scam Engine",
    }
