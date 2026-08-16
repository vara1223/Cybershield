from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Annotated
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.otp_analyzer import analyze_otp
from utils.tips import get_tips
from schemas.responses import ScanResponse
from main import limiter

router = APIRouter()

MAX_MESSAGE_LENGTH = 2000


class OTPRequest(BaseModel):
    message: Annotated[str, Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)]

    @field_validator("message")
    @classmethod
    def strip_message(cls, v: str) -> str:
        return v.strip()


from utils.user_helper import extract_user_info
from utils.admin_log_helper import save_admin_scan_log

@router.post("/otp", response_model=ScanResponse)
@limiter.limit("20/minute")
async def scan_otp(request: Request, body: OTPRequest, db: Session = Depends(get_db)):
    result = analyze_otp(body.message)
    tips   = get_tips("otp", result["verdict"])
    now    = datetime.now(timezone.utc).isoformat()
    user_name, user_email = extract_user_info(request)

    log = ScanLog(
        feature="otp_scan",
        input_data=body.message[:200],
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
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
        scan_type="otp_scan",
        scan_input=body.message[:200],
        result=result["verdict"],
        confidence=result["confidence"],
        analysis=result["explanation"],
    )

    return ScanResponse(
        feature="otp_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
        classification=result.get("Classification", result.get("classification", "Likely Safe")),
        category=result.get("Category", result.get("category", "OTP_REQUEST")),
        language=result.get("Language", result.get("language", "English")),
        risk_level=result.get("Risk Level", result.get("risk_level", "Low")),
        reason=result.get("reason", result["explanation"]),
        recommended_action=result.get("recommended_action", tips[0] if tips else ""),
        detected_indicators=result.get("detected_indicators", []),
        input_data=body.message,
    )
