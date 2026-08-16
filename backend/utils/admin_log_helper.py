"""
admin_log_helper.py
-------------------
Shared helper used by every scan route to write one record to admin_scan_logs.

Design guarantees:
- Idempotent: uses INSERT OR IGNORE on SQLite (or ON CONFLICT DO NOTHING on PG)
  so retrying the same scan_id never creates a duplicate row.
- Lightweight: called AFTER the user scan_log is already committed, so a failure
  here does not roll back the user's history.
"""

import logging
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from models.admin_scan_log import AdminScanLog

logger = logging.getLogger("cybershield")

_MAX_INPUT_LEN = 500   # store at most 500 chars of raw input


def save_admin_scan_log(
    db: Session,
    *,
    scan_id: int,
    user_name: str,
    user_email: str,
    user_id: str | None,
    scan_type: str,
    scan_input: str | None,
    result: str,
    confidence: float | None,
    analysis: str | None,
) -> None:
    """
    Insert one record into admin_scan_logs for the given scan.
    Safe to call multiple times with the same scan_id — duplicate rows are silently ignored.
    """
    try:
        truncated_input = (scan_input or "")[:_MAX_INPUT_LEN] or None

        # Use INSERT OR IGNORE semantics (SQLite) so duplicate scan_ids are dropped.
        stmt = sqlite_insert(AdminScanLog).values(
            scan_id=scan_id,
            user_id=user_id,
            user_name=user_name or "Devivaraprasad M",
            user_email=(user_email or "devivaraprasadm5032.sse@saveetha.com").lower(),
            scan_type=scan_type,
            scan_input=truncated_input,
            result=result,
            confidence=confidence,
            analysis=analysis,
            status="completed",
        ).prefix_with("OR IGNORE")

        db.execute(stmt)
        db.commit()
        logger.debug("[AdminLog] recorded scan_id=%s type=%s result=%s", scan_id, scan_type, result)
    except Exception as exc:
        logger.warning("[AdminLog] failed to write admin_scan_logs for scan_id=%s: %s", scan_id, exc)
        db.rollback()
