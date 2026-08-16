from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timezone
from database import Base

class OTPRecord(Base):
    __tablename__ = "password_reset_otps"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    otp_code = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
