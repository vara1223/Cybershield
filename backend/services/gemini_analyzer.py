import os
import json
import base64
from typing import Optional, Dict, Any

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


from dotenv import load_dotenv


def get_gemini_client():
    if not GENAI_AVAILABLE:
        return None
    load_dotenv(override=True)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        print("Gemini client init note:", e)
        return None


def clean_json_response(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def analyze_screenshot_with_gemini(image_b64: str) -> Optional[Dict[str, Any]]:
    # Bypassed: System uses 100% local trained ML models (no API keys required)
    return None


def analyze_text_with_gemini(text: str, feature: str) -> Optional[Dict[str, Any]]:
    # Bypassed: System uses 100% local trained ML models (no API keys required)
    return None
