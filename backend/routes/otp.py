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


@router.post("/otp", response_model=ScanResponse)
@limiter.limit("20/minute")
async def scan_otp(request: Request, body: OTPRequest, db: Session = Depends(get_db)):
    result = analyze_otp(body.message)
    tips   = get_tips("otp", result["verdict"])
    now    = datetime.now(timezone.utc).isoformat()

    log = ScanLog(
        feature="otp_scan",
        input_data=body.message[:200],
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
    )
    db.add(log)
    db.commit()

    return ScanResponse(
        feature="otp_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
    )
