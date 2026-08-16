from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class AdminScanLog(Base):
    """
    Dedicated admin monitoring table.
    Every scan writes one record here (idempotent via unique scan_id constraint).
    user_id links to Supabase profile so the admin portal can always show the
    latest user name/email via a join rather than a stale snapshot.
    """
    __tablename__ = "admin_scan_logs"

    id          = Column(Integer, primary_key=True, index=True)
    # Reference to the original user-history scan record
    scan_id     = Column(Integer, unique=True, nullable=False, index=True)
    # Supabase UUID — nullable for anonymous / pre-auth scans
    user_id     = Column(String, nullable=True, index=True)
    # Snapshot at scan time (fallback display when profile is gone)
    user_name   = Column(String, nullable=False, default="User")
    user_email  = Column(String, nullable=False, default="user@cybershield.local", index=True)
    # Scan details
    scan_type   = Column(String, nullable=False, index=True)   # url_scan, otp_scan, ...
    scan_input  = Column(String, nullable=True)                # truncated, no raw secrets
    result      = Column(String, nullable=False, index=True)   # SAFE / SUSPICIOUS / DANGEROUS
    confidence  = Column(Float,  nullable=True)
    analysis    = Column(String, nullable=True)
    status      = Column(String, nullable=False, default="completed")
    # Timestamps
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("scan_id", name="uq_admin_scan_logs_scan_id"),
    )
