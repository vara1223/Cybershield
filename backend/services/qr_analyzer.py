import base64
import io
from services.url_analyzer import analyze_url
from utils.confidence import clamp, score_to_verdict

try:
    from PIL import Image
    from pyzbar.pyzbar import decode as pyzbar_decode
    QR_DECODE_AVAILABLE = True
except Exception:
    QR_DECODE_AVAILABLE = False

def analyze_qr(image_b64: str = None, decoded_content: str = None) -> dict:
    flags = []
    qr_content = decoded_content

    if not qr_content and image_b64 and QR_DECODE_AVAILABLE:
        try:
            image_data = base64.b64decode(image_b64)
            image = Image.open(io.BytesIO(image_data))
            decoded = pyzbar_decode(image)
            if decoded:
                qr_content = decoded[0].data.decode("utf-8", errors="replace")
                flags.append("qr_decoded_from_image")
            else:
                return {
                    "verdict": "SUSPICIOUS",
                    "confidence": 50,
                    "explanation": "Could not decode the QR code from the image. It may be damaged, encrypted, or use an unsupported format.",
                    "flags": ["qr_decode_failed"],
                    "qr_content": None,
                }
        except Exception as e:
            return {
                "verdict": "SUSPICIOUS",
                "confidence": 40,
                "explanation": f"QR code processing failed: {str(e)[:100]}",
                "flags": ["qr_processing_error"],
                "qr_content": None,
            }

    if not qr_content:
        if not QR_DECODE_AVAILABLE:
            flags.append("qr_lib_unavailable")
        return {
            "verdict": "SUSPICIOUS",
            "confidence": 35,
            "explanation": "No QR content could be extracted. Install pyzbar for image-based QR decoding.",
            "flags": flags + ["no_content"],
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
