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
from main import limiter

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


@router.post("/upi", response_model=ScanResponse)
@limiter.limit("30/minute")
async def scan_upi(request: Request, body: UPIRequest, db: Session = Depends(get_db)):
    result = analyze_upi(body.upi_id, body.message or "")
    tips   = get_tips("upi", result["verdict"])
    now    = datetime.now(timezone.utc).isoformat()

    log = ScanLog(
        feature="upi_scan",
        input_data=body.upi_id,
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
    )
    db.add(log)
    db.commit()

    return ScanResponse(
        feature="upi_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
    )
