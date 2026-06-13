from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from sqlalchemy.sql import func
from database import Base

class ScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    feature = Column(String, index=True)
    input_data = Column(String)
    verdict = Column(String, index=True)
    confidence = Column(Float)
    explanation = Column(String)
    tips = Column(JSON)
    raw = Column(JSON)
    scanned_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
