from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.qr_analyzer import analyze_qr
from utils.tips import get_tips
from schemas.responses import ScanResponse

router = APIRouter()

class QRRequest(BaseModel):
    image: Optional[str] = None        # base64 image
    decoded_content: Optional[str] = None  # pre-decoded by frontend camera

@router.post("/qr", response_model=ScanResponse)
async def scan_qr(request: QRRequest, db: Session = Depends(get_db)):
    result = analyze_qr(
        image_b64=request.image,
        decoded_content=request.decoded_content,
    )
    tips = get_tips("qr", result["verdict"])
    now = datetime.now(timezone.utc).isoformat()

    log = ScanLog(
        feature="qr_scan",
        input_data=request.decoded_content or "[image]",
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
