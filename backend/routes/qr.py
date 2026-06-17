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
from main import limiter

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


@router.post("/qr", response_model=ScanResponse)
@limiter.limit("30/minute")
async def scan_qr(request: Request, body: QRRequest, db: Session = Depends(get_db)):
    result = analyze_qr(
        image_b64=body.image,
        decoded_content=body.decoded_content,
    )
    tips = get_tips("qr", result["verdict"])
    now  = datetime.now(timezone.utc).isoformat()

    log = ScanLog(
        feature="qr_scan",
        input_data=body.decoded_content or "[image]",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
    )
    db.add(log)
    db.commit()

    return ScanResponse(
        feature="qr_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
    )
