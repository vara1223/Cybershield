from fastapi import APIRouter, Depends, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from database import get_db
from models.scan_log import ScanLog
from services.voice_analyzer import analyze_voice_bytes
from utils.tips import get_tips
from schemas.responses import ScanResponse
from limiter import limiter

router = APIRouter()

# ~10 MB raw audio
MAX_AUDIO_BYTES = 10_485_760


@router.post("/voice", response_model=ScanResponse)
@limiter.limit("30/minute")
async def scan_voice(
    request: Request,
    audio: UploadFile = File(default=None, description="Audio file (webm/m4a/wav/mp3/ogg)"),
    format: str = Form(default="webm"),
    transcript: Optional[str] = Form(default=None),
    language: str = Form(default="auto"),
    db: Session = Depends(get_db),
):
    # ── Read uploaded audio bytes ─────────────────────────────────────────────
    audio_bytes = b""
    audio_filename = "unknown"
    audio_mime = "unknown"

    if audio is not None:
        try:
            audio_bytes = await audio.read()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read uploaded audio: {e}")
        audio_filename = audio.filename or "recording.webm"
        audio_mime = audio.content_type or "audio/webm"

    audio_size = len(audio_bytes)
    client_transcript = (transcript or "").strip()

    print(f"[VOICE] filename={audio_filename!r} mime={audio_mime!r} size={audio_size}B "
          f"format={format!r} transcript_chars={len(client_transcript)} language={language!r}")

    # ── Require at least audio or transcript ──────────────────────────────────
    if audio_size == 0 and not client_transcript:
        raise HTTPException(
            status_code=422,
            detail="No audio received and no transcript provided. "
                   "Please record audio or enter a transcript."
        )

    if audio_size > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio too large ({audio_size} bytes). Maximum is {MAX_AUDIO_BYTES} bytes (~10 MB)."
        )

    if audio_size > 0 and audio_size < 500:
        print(f"[VOICE] WARNING: audio is very small ({audio_size}B) — likely an empty/incomplete recording")

    # ── Run analysis ──────────────────────────────────────────────────────────
    try:
        result = analyze_voice_bytes(audio_bytes, format, client_transcript, language)
    except Exception as e:
        import traceback
        print(f"[VOICE] analyze_voice_bytes exception: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Voice analysis failed: {str(e)}")

    # ── Persist & return ──────────────────────────────────────────────────────
    tips = get_tips("voice", result["verdict"])
    now  = datetime.now(timezone.utc).isoformat()
    transcript_text = result.get("transcript") or client_transcript or "[Voice Audio File]"
    from utils.user_helper import extract_user_info
    from utils.admin_log_helper import save_admin_scan_log
    user_name, user_email = extract_user_info(request)

    log = ScanLog(
        feature="voice_scan",
        input_data=transcript_text[:500],
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw={k: v for k, v in result.items() if k != "audio"},
        user_name=user_name,
        user_email=user_email,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    # ── Write to admin monitoring table (idempotent) ──
    user_id = request.headers.get("X-User-Id") or None
    save_admin_scan_log(
        db,
        scan_id=log.id,
        user_name=user_name,
        user_email=user_email,
        user_id=user_id,
        scan_type="voice_scan",
        scan_input=transcript_text[:300],
        result=result["verdict"],
        confidence=result["confidence"],
        analysis=result["explanation"],
    )

    return ScanResponse(
        feature="voice_scan",
        verdict=result["verdict"],
        confidence=result["confidence"],
        explanation=result["explanation"],
        tips=tips,
        raw=result,
        scanned_at=now,
        classification=result.get("classification", "Likely Safe"),
        category=result.get("Category", result.get("category", "NORMAL_CALL")),
        language=result.get("Language", result.get("language", language)),
        detected_languages=result.get("detected_languages", [result.get("Language", "English")]),
        is_multilingual=result.get("is_multilingual", False),
        risk_level=result.get("risk_level", "Low"),
        reason=result.get("reason", result["explanation"]),
        recommended_action=result.get("recommended_action", tips[0] if tips else ""),
        detected_indicators=result.get("detected_indicators", []),
        transcript=transcript_text,
        input_data=transcript_text,
    )
