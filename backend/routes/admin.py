from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import csv
import io
from fastapi.responses import StreamingResponse
from database import get_db
from models.scan_log import ScanLog
from schemas.responses import ScanLogOut, AdminStats

router = APIRouter()

@router.get("/logs", response_model=List[ScanLogOut])
async def get_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    feature: Optional[str] = None,
    verdict: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ScanLog)
    if feature:
        q = q.filter(ScanLog.feature == feature)
    if verdict:
        q = q.filter(ScanLog.verdict == verdict)
    q = q.order_by(ScanLog.scanned_at.desc())
    q = q.offset((page - 1) * per_page).limit(per_page)
    return q.all()

@router.get("/stats", response_model=AdminStats)
async def get_stats(db: Session = Depends(get_db)):
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

@router.get("/export/csv")
async def export_csv(db: Session = Depends(get_db)):
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
