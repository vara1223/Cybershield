from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.otp_analyzer import analyze_otp
from utils.tips import get_tips
from schemas.responses import ScanResponse

router = APIRouter()

class OTPRequest(BaseModel):
    message: str

@router.post("/otp", response_model=ScanResponse)
async def scan_otp(request: OTPRequest, db: Session = Depends(get_db)):
    result = analyze_otp(request.message)
    tips = get_tips("otp", result["verdict"])
    now = datetime.now(timezone.utc).isoformat()

    log = ScanLog(
        feature="otp_scan",
        input_data=request.message[:200],
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
