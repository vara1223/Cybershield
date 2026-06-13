from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.screenshot_analyzer import analyze_screenshot
from utils.tips import get_tips
from schemas.responses import ScanResponse

router = APIRouter()

class ScreenshotRequest(BaseModel):
    image: str  # base64

@router.post("/screenshot", response_model=ScanResponse)
async def scan_screenshot(request: ScreenshotRequest, db: Session = Depends(get_db)):
    result = analyze_screenshot(request.image)
    tips = get_tips("screenshot", result["verdict"])
    now = datetime.now(timezone.utc).isoformat()

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
