from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Annotated
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.screenshot_analyzer import analyze_screenshot
from utils.tips import get_tips
from schemas.responses import ScanResponse
from main import limiter

router = APIRouter()

# ~5 MB image → base64 is ~33% larger → ~6.7 MB base64 string
MAX_IMAGE_B64_CHARS = 7_000_000


class ScreenshotRequest(BaseModel):
    image: Annotated[str, Field(min_length=1)]  # base64

    @field_validator("image")
    @classmethod
    def check_size(cls, v: str) -> str:
        if len(v) > MAX_IMAGE_B64_CHARS:
            raise ValueError(f"Image too large. Max allowed base64 size is {MAX_IMAGE_B64_CHARS} chars (~5 MB image).")
        return v


from utils.user_helper import extract_user_info
from utils.admin_log_helper import save_admin_scan_log

@router.post("/screenshot", response_model=ScanResponse)
@limiter.limit("10/minute")
def scan_screenshot(request: Request, body: ScreenshotRequest, db: Session = Depends(get_db)):
    result = analyze_screenshot(body.image)
    tips   = get_tips("screenshot", result["verdict"])
    now    = datetime.now(timezone.utc).isoformat()
    user_name, user_email = extract_user_info(request)

    input_text = result.get("input_data") or result.get("extracted_text") or "[screenshot image]"

    log = ScanLog(
        feature="screenshot_scan",
        input_data=input_text[:500],
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw={k: v for k, v in result.items() if k != "extracted_text_full"},
        user_name=user_name,
        user_email=user_email,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    # ── Write to admin monitoring table (idempotent) ──
    user_id = request.headers.get("X-User-Id") or None
    save_admin_scan_log(
        db,
        scan_id=log.id,
        user_name=user_name,
        user_email=user_email,
        user_id=user_id,
        scan_type="screenshot_scan",
        scan_input=input_text[:300],
        result=result["verdict"],
        confidence=result["confidence"],
        analysis=result["explanation"],
    )

    return ScanResponse(
        feature="screenshot_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
        classification=result.get("Classification", result.get("classification", "Likely Safe")),
        category=result.get("Category", result.get("category", "NORMAL_CALL")),
        language=result.get("Language", result.get("language", "English")),
        risk_level=result.get("Risk Level", result.get("risk_level", "Low")),
        reason=result.get("reason", result["explanation"]),
        recommended_action=result.get("recommended_action", tips[0] if tips else ""),
        detected_indicators=result.get("detected_indicators", []),
        extracted_text=result.get("extracted_text", ""),
        input_data=input_text,
    )
