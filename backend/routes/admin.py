import os
from fastapi import APIRouter, Depends, Query, HTTPException, Security, Request
from fastapi.security import APIKeyQuery
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import csv
import io
from fastapi.responses import StreamingResponse
from database import get_db
from models.scan_log import ScanLog
from schemas.responses import ScanLogOut, AdminStats
from main import limiter

router = APIRouter()

# ── Admin API-Key guard ────────────────────────────────────────────────────────
# If ADMIN_API_KEY is set in .env this is enforced on every /admin route.
# If it is NOT set the check is skipped (backward-compatible — shows a warning
# in the startup log instead).

_ADMIN_API_KEY   = os.getenv("ADMIN_API_KEY", "")
_api_key_header  = APIKeyHeader(name="X-Admin-Key", auto_error=False)
_api_key_query   = APIKeyQuery(name="api_key", auto_error=False)

VALID_FEATURES = {"url_scan", "screenshot_scan", "qr_scan", "otp_scan", "upi_scan", "voice_scan"}
VALID_VERDICTS = {"SAFE", "SUSPICIOUS", "DANGEROUS"}

async def verify_admin(
    api_key_header: Optional[str] = Security(_api_key_header),
    api_key_query: Optional[str] = Security(_api_key_query),
):
    """Dependency — enforces X-Admin-Key when ADMIN_API_KEY env var is configured."""
    if not _ADMIN_API_KEY:
        # Key not configured: allow through (backward-compat dev mode)
        return
    api_key = api_key_header or api_key_query
    if api_key != _ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-Key header or api_key parameter.")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/logs", response_model=List[ScanLogOut], dependencies=[Depends(verify_admin)])
@limiter.limit("20/minute")
async def get_logs(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    feature: Optional[str] = None,
    verdict: Optional[str] = None,
    db: Session = Depends(get_db),
):
    # Allowlist filter values — prevent unexpected query parameters
    if feature and feature not in VALID_FEATURES:
        raise HTTPException(status_code=400, detail=f"Invalid feature. Allowed: {sorted(VALID_FEATURES)}")
    if verdict and verdict not in VALID_VERDICTS:
        raise HTTPException(status_code=400, detail=f"Invalid verdict. Allowed: {sorted(VALID_VERDICTS)}")

    q = db.query(ScanLog)
    if feature:
        q = q.filter(ScanLog.feature == feature)
    if verdict:
        q = q.filter(ScanLog.verdict == verdict)
    q = q.order_by(ScanLog.scanned_at.desc())
    q = q.offset((page - 1) * per_page).limit(per_page)
    return q.all()


@router.get("/stats", response_model=AdminStats, dependencies=[Depends(verify_admin)])
@limiter.limit("20/minute")
async def get_stats(request: Request, db: Session = Depends(get_db)):
    total = db.query(func.count(ScanLog.id)).scalar() or 0
    threats = db.query(func.count(ScanLog.id)).filter(
        ScanLog.verdict.in_(["DANGEROUS", "SUSPICIOUS"])
    ).scalar() or 0
    safe_rate = round(((total - threats) / total * 100), 1) if total > 0 else 100.0

    by_category_rows = (
        db.query(ScanLog.feature, func.count(ScanLog.id))
        .group_by(ScanLog.feature)
        .all()
    )
    by_category = {row[0]: row[1] for row in by_category_rows}

    today = datetime.now(timezone.utc).date()
    today_count = db.query(func.count(ScanLog.id)).filter(
        func.date(ScanLog.scanned_at) == today
    ).scalar() or 0

    daily_counts = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = db.query(func.count(ScanLog.id)).filter(
            func.date(ScanLog.scanned_at) == day
        ).scalar() or 0
        daily_counts.append({"date": day.isoformat(), "count": count, "label": day.strftime("%a")})

    return AdminStats(
        total=total,
        threats=threats,
        safe_rate=safe_rate,
        by_category=by_category,
        daily_counts=daily_counts,
        today_count=today_count,
    )


@router.get("/export/csv", dependencies=[Depends(verify_admin)])
@limiter.limit("20/minute")
async def export_csv(request: Request, db: Session = Depends(get_db)):
    logs = db.query(ScanLog).order_by(ScanLog.scanned_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Feature", "Input", "Verdict", "Confidence", "Explanation", "Scanned At"])
    for log in logs:
        writer.writerow([
            log.id, log.feature, log.input_data, log.verdict,
            log.confidence, log.explanation, log.scanned_at,
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cybershield_logs.csv"},
    )
