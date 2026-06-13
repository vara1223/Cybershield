from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime

class ScanResponse(BaseModel):
    feature: str
    verdict: str
    confidence: float
    explanation: str
    tips: List[str]
    raw: Dict[str, Any]
    scanned_at: str

class ScanLogOut(BaseModel):
    id: int
    feature: str
    input_data: str
    verdict: str
    confidence: float
    explanation: str
    tips: List[str]
    raw: Optional[Dict[str, Any]]
    scanned_at: datetime

    class Config:
        from_attributes = True

class AdminStats(BaseModel):
    total: int
    threats: int
    safe_rate: float
    by_category: Dict[str, int]
    daily_counts: List[Dict[str, Any]]
    today_count: int
