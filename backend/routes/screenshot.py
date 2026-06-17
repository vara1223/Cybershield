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


@router.post("/screenshot", response_model=ScanResponse)
@limiter.limit("10/minute")
async def scan_screenshot(request: Request, body: ScreenshotRequest, db: Session = Depends(get_db)):
    result = analyze_screenshot(body.image)
    tips   = get_tips("screenshot", result["verdict"])
    now    = datetime.now(timezone.utc).isoformat()

    log = ScanLog(
        feature="screenshot_scan",
        input_data="[image]",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw={k: v for k, v in result.items() if k != "extracted_text_full"},
    )
    db.add(log)
    db.commit()

    return ScanResponse(
        feature="screenshot_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
    )
