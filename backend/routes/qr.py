from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Annotated, Optional
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.qr_analyzer import analyze_qr
from utils.tips import get_tips
from schemas.responses import ScanResponse
from limiter import limiter

router = APIRouter()

MAX_IMAGE_B64_CHARS    = 7_000_000   # ~5 MB image
MAX_DECODED_CONTENT    = 4096        # QR payload max realistic length


class QRRequest(BaseModel):
    image:           Optional[Annotated[str, Field(min_length=1)]] = None  # base64 image
    decoded_content: Optional[Annotated[str, Field(max_length=MAX_DECODED_CONTENT)]] = None

    @field_validator("image")
    @classmethod
    def check_image_size(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > MAX_IMAGE_B64_CHARS:
            raise ValueError(f"Image too large. Max {MAX_IMAGE_B64_CHARS} base64 chars (~5 MB).")
        return v


from utils.user_helper import extract_user_info
from utils.admin_log_helper import save_admin_scan_log

@router.post("/qr", response_model=ScanResponse)
@limiter.limit("30/minute")
async def scan_qr(request: Request, body: QRRequest, db: Session = Depends(get_db)):
    result = analyze_qr(
        image_b64=body.image,
        decoded_content=body.decoded_content,
    )
    tips = get_tips("qr", result["verdict"])
    now  = datetime.now(timezone.utc).isoformat()
    user_name, user_email = extract_user_info(request)

    log = ScanLog(
        feature="qr_scan",
        input_data=body.decoded_content or "[image]",
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
        scan_type="qr_scan",
        scan_input=(body.decoded_content or "[QR image]")[:300],
        result=result["verdict"],
        confidence=result["confidence"],
        analysis=result["explanation"],
    )

    return ScanResponse(
        feature="qr_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
        classification=result.get("classification", "Likely Safe" if result["verdict"] == "SAFE" else "Scam"),
        risk_level=result.get("risk_level", "Low" if result["verdict"] == "SAFE" else "High"),
        reason=result.get("reason", result["explanation"]),
        recommended_action=result.get("recommended_action", tips[0] if tips else ""),
        detected_indicators=result.get("detected_indicators", []),
        input_data=body.decoded_content or "[QR Code Payload]",
    )
