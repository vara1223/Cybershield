from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Annotated
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.url_analyzer import analyze_url
from utils.tips import get_tips
from schemas.responses import ScanResponse
from main import limiter

router = APIRouter()

MAX_URL_LENGTH = 2048

class URLRequest(BaseModel):
    url: Annotated[str, Field(min_length=1, max_length=MAX_URL_LENGTH)]

    @field_validator("url")
    @classmethod
    def must_look_like_url(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("url must not be blank")
        return stripped


@router.post("/url", response_model=ScanResponse)
@limiter.limit("20/minute")
async def scan_url(request: Request, body: URLRequest, db: Session = Depends(get_db)):
    result = analyze_url(body.url)
    tips   = get_tips("url", result["verdict"])
    now    = datetime.now(timezone.utc).isoformat()

    log = ScanLog(
        feature="url_scan",
        input_data=body.url[:500],
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
