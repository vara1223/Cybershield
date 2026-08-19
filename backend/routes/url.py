from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Annotated
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.url_analyzer import analyze_url
from utils.tips import get_tips
from schemas.responses import ScanResponse
from limiter import limiter

router = APIRouter()

MAX_URL_LENGTH = 2048

class URLRequest(BaseModel):
    url: Annotated[str, Field(min_length=1, max_length=MAX_URL_LENGTH)]

    @field_validator("url")
    @classmethod
    def must_look_like_url(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("url must not be blank")
        return stripped


from utils.user_helper import extract_user_info
from utils.admin_log_helper import save_admin_scan_log

@router.post("/url", response_model=ScanResponse)
@limiter.limit("20/minute")
async def scan_url(request: Request, body: URLRequest, db: Session = Depends(get_db)):
    result = analyze_url(body.url)
    tips   = get_tips("url", result["verdict"])
    now    = datetime.now(timezone.utc).isoformat()
    user_name, user_email = extract_user_info(request)

    log = ScanLog(
        feature="url_scan",
        input_data=body.url[:500],
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
        scan_type="url_scan",
        scan_input=body.url[:500],
        result=result["verdict"],
        confidence=result["confidence"],
        analysis=result["explanation"],
    )

    return ScanResponse(
        feature="url_scan",
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
        input_data=body.url,
    )
