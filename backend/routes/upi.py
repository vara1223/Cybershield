from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.upi_analyzer import analyze_upi
from utils.tips import get_tips
from schemas.responses import ScanResponse

router = APIRouter()

class UPIRequest(BaseModel):
    upi_id: str
    message: Optional[str] = None

@router.post("/upi", response_model=ScanResponse)
async def scan_upi(request: UPIRequest, db: Session = Depends(get_db)):
    result = analyze_upi(request.upi_id, request.message or "")
    tips = get_tips("upi", result["verdict"])
    now = datetime.now(timezone.utc).isoformat()

    log = ScanLog(
        feature="upi_scan",
        input_data=request.upi_id,
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
