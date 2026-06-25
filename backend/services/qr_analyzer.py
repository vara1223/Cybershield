# QR Analyzer module supporting OpenCV and Pyzbar
import base64
import io
from services.url_analyzer import analyze_url
from utils.confidence import clamp, score_to_verdict

try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except Exception:
    OPENCV_AVAILABLE = False

try:
    from PIL import Image
    from pyzbar.pyzbar import decode as pyzbar_decode
    PYZBAR_AVAILABLE = True
except Exception:
    PYZBAR_AVAILABLE = False

def analyze_qr(image_b64: str = None, decoded_content: str = None) -> dict:
    flags = []
    qr_content = decoded_content

    if not qr_content and image_b64:
        # Try OpenCV first
        if OPENCV_AVAILABLE:
            try:
                image_data = base64.b64decode(image_b64)
                nparr = np.frombuffer(image_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if img is not None:
                    detector = cv2.QRCodeDetector()
                    data, bbox, _ = detector.detectAndDecode(img)
                    if data:
                        qr_content = data
                        flags.append("qr_decoded_via_opencv")
            except Exception as e:
                pass

        # Fallback to pyzbar
        if not qr_content and PYZBAR_AVAILABLE:
            try:
                image_data = base64.b64decode(image_b64)
                image = Image.open(io.BytesIO(image_data))
                decoded = pyzbar_decode(image)
                if decoded:
                    qr_content = decoded[0].data.decode("utf-8", errors="replace")
                    flags.append("qr_decoded_via_pyzbar")
            except Exception:
                pass

        if not qr_content:
            return {
                "verdict": "SUSPICIOUS",
                "confidence": 50,
                "explanation": "Could not decode any QR code content from the uploaded image. The code may be blurry, damaged, or in an unsupported layout.",
                "flags": ["qr_decode_failed"],
                "qr_content": None,
            }

    if not qr_content:
        return {
            "verdict": "SUSPICIOUS",
            "confidence": 35,
            "explanation": "No QR content was provided or could be extracted from the request.",
            "flags": ["no_content"],
            "qr_content": None,
        }

    # Analyze the decoded content
    if qr_content.startswith(("http://", "https://", "www.")):
        url_result = analyze_url(qr_content)
        return {
            "verdict": url_result["verdict"],
            "confidence": url_result["confidence"],
            "explanation": f"QR code leads to: {url_result['explanation']}",
            "flags": flags + url_result.get("flags", []) + ["qr_url_analyzed"],
            "qr_content": qr_content,
            "url_analysis": url_result,
        }

    # UPI payment QR (upi://pay?...)
    if qr_content.startswith("upi://"):
        import urllib.parse
        parsed = urllib.parse.urlparse(qr_content)
        params = dict(urllib.parse.parse_qsl(parsed.query))
        pa = params.get("pa", "")
        pn = params.get("pn", "")
        amount = params.get("am", "")

        upi_score = 10
        upi_flags = ["upi_payment_qr"] + flags

        suspicious_terms = ["refund", "cashback", "prize", "lottery", "support", "help"]
        if any(t in pa.lower() or t in pn.lower() for t in suspicious_terms):
            upi_score += 40
            upi_flags.append("suspicious_upi_payee")

        if amount:
            upi_score += 5
            upi_flags.append(f"preset_amount:{amount}")

        upi_score = clamp(upi_score)
        verdict = score_to_verdict(upi_score)
        return {
            "verdict": verdict,
            "confidence": round(upi_score, 1),
            "explanation": f"This is a UPI payment QR code for {pn or 'unknown merchant'} ({pa}). "
                          + ("The payee details look suspicious." if verdict != "SAFE" else "The payee appears legitimate."),
            "flags": upi_flags,
            "qr_content": qr_content,
            "upi_details": {"pa": pa, "pn": pn, "amount": amount},
        }

    # Generic text QR
    return {
        "verdict": "SAFE",
        "confidence": 15,
        "explanation": f"This QR code contains plain text: '{qr_content[:100]}'. No URL or payment data detected.",
        "flags": flags + ["plain_text_qr"],
        "qr_content": qr_content,
    }
