from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Annotated, Optional, Literal
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.voice_analyzer import analyze_voice
from utils.tips import get_tips
from schemas.responses import ScanResponse
from main import limiter

router = APIRouter()

# ~10 MB audio → base64 ~13.3 MB
MAX_AUDIO_B64_CHARS = 14_000_000


class VoiceRequest(BaseModel):
    audio: Annotated[str, Field(min_length=1)]          # base64 encoded audio
    format: Literal["mp3", "m4a", "wav", "webm"] = "mp3"  # allowlisted formats only

    @field_validator("audio")
    @classmethod
    def check_audio_size(cls, v: str) -> str:
        if len(v) > MAX_AUDIO_B64_CHARS:
            raise ValueError(f"Audio too large. Max allowed base64 size is {MAX_AUDIO_B64_CHARS} chars (~10 MB audio).")
        return v


@router.post("/voice", response_model=ScanResponse)
@limiter.limit("5/minute")
async def scan_voice(request: Request, body: VoiceRequest, db: Session = Depends(get_db)):
    result = analyze_voice(body.audio, body.format)
    tips   = get_tips("voice", result["verdict"])
    now    = datetime.now(timezone.utc).isoformat()

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
