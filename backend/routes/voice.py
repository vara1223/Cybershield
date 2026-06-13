from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.voice_analyzer import analyze_voice
from utils.tips import get_tips
from schemas.responses import ScanResponse

router = APIRouter()

class VoiceRequest(BaseModel):
    audio: str          # base64 encoded audio
    format: str = "mp3" # mp3 or m4a

@router.post("/voice", response_model=ScanResponse)
async def scan_voice(request: VoiceRequest, db: Session = Depends(get_db)):
    result = analyze_voice(request.audio, request.format)
    tips = get_tips("voice", result["verdict"])
    now = datetime.now(timezone.utc).isoformat()

    log = ScanLog(
        feature="voice_scan",
        input_data=result.get("transcript", "")[:200],
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw={k: v for k, v in result.items() if k != "audio"},
    )
    db.add(log)
    db.commit()

    return ScanResponse(
        feature="voice_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
    )
