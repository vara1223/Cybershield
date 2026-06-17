import os
from fastapi import APIRouter, Depends, Query, HTTPException, Security, Request
from fastapi.security import APIKeyQuery
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import io
from fastapi.responses import StreamingResponse
from database import get_db
from models.scan_log import ScanLog
from schemas.responses import ScanLogOut, AdminStats
from main import limiter
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

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
    
    # Create an in-memory workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "CyberShield Logs"
    ws.views.sheetView[0].showGridLines = True

    # Styling definitions
    font_family = "Segoe UI"
    header_fill = PatternFill(start_color="2F6EFF", end_color="2F6EFF", fill_type="solid") # Royal Blue
    header_font = Font(name=font_family, size=11, bold=True, color="FFFFFF")
    
    safe_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
    safe_font = Font(name=font_family, size=10, bold=True, color="375623")
    
    suspicious_fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
    suspicious_font = Font(name=font_family, size=10, bold=True, color="7F6000")
    
    dangerous_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
    dangerous_font = Font(name=font_family, size=10, bold=True, color="C65911")
    
    border_thin = Border(
        left=Side(style="thin", color="D9D9D9"),
        right=Side(style="thin", color="D9D9D9"),
        top=Side(style="thin", color="D9D9D9"),
        bottom=Side(style="thin", color="D9D9D9")
    )
    data_font = Font(name=font_family, size=10)
    
    # Headers
    headers = ["ID", "Feature", "Input Data", "Verdict", "Confidence", "Explanation", "Scanned At"]
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border_thin

    # Fill data
    for row_idx, log in enumerate(logs, start=2):
        # Format scanned_at to date/time format: YYYY-MM-DD HH:MM:SS
        scanned_at_str = ""
        if log.scanned_at:
            scanned_at_str = log.scanned_at.strftime("%Y-%m-%d %H:%M:%S")

        row_data = [
            f"#LOG-{log.id:04d}" if isinstance(log.id, int) else str(log.id),
            str(log.feature or "").replace("_scan", "").upper(),
            str(log.input_data or ""),
            str(log.verdict or ""),
            f"{log.confidence}%" if log.confidence is not None else "N/A",
            str(log.explanation or ""),
            scanned_at_str
        ]

        for col_idx, val in enumerate(row_data, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = data_font
            cell.border = border_thin
            
            # Alignments
            if col_idx in [1, 2, 5, 7]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                
            # Verdict Column Color Styling
            if col_idx == 4:
                if val == "SAFE":
                    cell.fill = safe_fill
                    cell.font = safe_font
                elif val == "SUSPICIOUS":
                    cell.fill = suspicious_fill
                    cell.font = suspicious_font
                elif val == "DANGEROUS":
                    cell.fill = dangerous_fill
                    cell.font = dangerous_font

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        # Give safety padding, cap width to avoid insanely long fields
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 10), 50)

    # Save to dynamic BytesIO stream
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    # Add dynamic date and time to the filename
    current_time_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"cybershield_logs_{current_time_str}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
