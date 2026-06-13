from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.url_analyzer import analyze_url
from utils.tips import get_tips
from schemas.responses import ScanResponse

router = APIRouter()

class URLRequest(BaseModel):
    url: str

@router.post("/url", response_model=ScanResponse)
async def scan_url(request: URLRequest, db: Session = Depends(get_db)):
    result = analyze_url(request.url)
    tips = get_tips("url", result["verdict"])
    now = datetime.now(timezone.utc).isoformat()

    log = ScanLog(
        feature="url_scan",
        input_data=request.url,
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
    )
    db.add(log)
    db.commit()

    return ScanResponse(
        feature="url_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
    )
