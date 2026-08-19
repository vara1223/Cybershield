from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Annotated, Optional
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.upi_analyzer import analyze_upi
from utils.tips import get_tips
from schemas.responses import ScanResponse
from limiter import limiter

router = APIRouter()

# Standard UPI ID max length is ~256 chars; we allow a safe headroom
MAX_UPI_LENGTH     = 512
MAX_MESSAGE_LENGTH = 2000


class UPIRequest(BaseModel):
    upi_id:  Annotated[str, Field(min_length=1, max_length=MAX_UPI_LENGTH)]
    message: Annotated[Optional[str], Field(max_length=MAX_MESSAGE_LENGTH)] = None

    @field_validator("upi_id")
    @classmethod
    def strip_upi(cls, v: str) -> str:
        return v.strip()


from utils.user_helper import extract_user_info
from utils.admin_log_helper import save_admin_scan_log

@router.post("/upi", response_model=ScanResponse)
@limiter.limit("30/minute")
async def scan_upi(request: Request, body: UPIRequest, db: Session = Depends(get_db)):
    result = analyze_upi(body.upi_id, body.message or "")
    tips   = get_tips("upi", result["verdict"])
    now    = datetime.now(timezone.utc).isoformat()
    user_name, user_email = extract_user_info(request)

    log = ScanLog(
        feature="upi_scan",
        input_data=body.upi_id,
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
        scan_type="upi_scan",
        scan_input=body.upi_id[:200],
        result=result["verdict"],
        confidence=result["confidence"],
        analysis=result["explanation"],
    )

    return ScanResponse(
        feature="upi_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
        classification=result.get("Classification", result.get("classification", "Likely Safe")),
        category=result.get("Category", result.get("category", "UPI_FRAUD")),
        language=result.get("Language", result.get("language", "English")),
        risk_level=result.get("Risk Level", result.get("risk_level", "Low")),
        reason=result.get("reason", result["explanation"]),
        recommended_action=result.get("recommended_action", tips[0] if tips else ""),
        detected_indicators=result.get("detected_indicators", []),
        input_data=body.upi_id,
    )
