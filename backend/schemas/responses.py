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
    classification: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    risk_level: Optional[str] = None
    reason: Optional[str] = None
    recommended_action: Optional[str] = None
    detected_indicators: Optional[List[str]] = None
    extracted_text: Optional[str] = None
    input_data: Optional[str] = None
    transcript: Optional[str] = None

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
    user_name: Optional[str] = "User"
    user_email: Optional[str] = "user@cybershield.local"


class AdminScanRecord(BaseModel):
    id: Any
    user_id: Optional[str] = None
    user_name: str
    user_email: str
    scan_type: str
    result: str
    confidence: float
    analysis: str
    created_at: datetime
    status: str = "completed"

    class Config:
        from_attributes = True

class UserScanSummary(BaseModel):

    user_name: str
    user_email: str
    total_scans: int
    threats: int
    safe_rate: float
    last_scanned_at: Optional[datetime] = None

class AdminStats(BaseModel):
    total: int
    threats: int
    safe_rate: float
    by_category: Dict[str, int]
    daily_counts: List[Dict[str, Any]]
    today_count: int
    total_profiles: Optional[int] = 0

class UserDetailsOut(BaseModel):
    user_name: str
    user_email: str
    total_scans: int
    threats: int
    safe_rate: float
    last_scanned_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    by_category: Dict[str, int]
    scan_history: List[ScanLogOut]


class AdminMonitorScan(BaseModel):
    id: int
    scan_id: int
    user_id: Optional[str] = None
    user_name: str
    user_email: str
    scan_type: str
    scan_input: Optional[str] = None
    result: str
    confidence: Optional[float] = None
    analysis: Optional[str] = None
    status: str = "completed"
    created_at: datetime

    class Config:
        from_attributes = True
