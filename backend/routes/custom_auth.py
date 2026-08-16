import os
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models.otp_store import OTPRecord
import logging

logger = logging.getLogger("cybershield")
router = APIRouter()

class SendOTPRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

def send_email_sync(to_email: str, otp_code: str):
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")

    if not all([smtp_server, smtp_port, smtp_user, smtp_pass]):
        logger.info(f"mocking email send: OTP for {to_email} is {otp_code}")
        print(f"\n==============================================")
        print(f"MOCK EMAIL: Password Reset OTP for {to_email}")
        print(f"OTP CODE: {otp_code}")
        print(f"==============================================\n")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "CyberShield Verification Code"
        msg["From"] = f"CyberShield <{smtp_user}>"
        msg["To"] = to_email

        text = f"Your CyberShield verification OTP is: {otp_code}"
        html = f"""
        <h2>CyberShield Verification Code</h2>
        <p>Your 6-digit verification code (OTP) is:</p>
        <h1 style="letter-spacing: 4px; color: #2f6eff;">{otp_code}</h1>
        <p>Please enter this code in the app to complete verification.</p>
        """

        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        msg.attach(part1)
        msg.attach(part2)

        port = int(smtp_port)
        try:
            if port == 465:
                with smtplib.SMTP_SSL(smtp_server, port) as server:
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_user, to_email, msg.as_string())
            else:
                with smtplib.SMTP(smtp_server, port) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_user, to_email, msg.as_string())
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP Auth Error: {e}")
            raise Exception("Authentication failed. Google rejected the App Password. Make sure the App Password was generated for the exact email in .env.")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise Exception(f"Failed to send email: {str(e)}")

@router.post("/send-otp")
async def send_otp(body: SendOTPRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    otp_code = str(random.randint(100000, 999999))
    
    # Store OTP in DB
    record = OTPRecord(email=email, otp_code=otp_code)
    db.add(record)
    db.commit()

    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    is_mock = not all([smtp_server, smtp_port, smtp_user, smtp_pass])

    # Try sending email synchronously so we can catch errors
    try:
        send_email_sync(email, otp_code)
    except Exception as e:
        # Delete the record if email failed
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))

    res_msg = f"Dynamic 6-digit OTP sent to registered admin email ({email})."
    if is_mock:
        return {"message": res_msg, "mock_otp": otp_code, "is_mock": True}
    return {"message": res_msg}

@router.post("/verify-otp")
async def verify_otp(body: VerifyOTPRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    otp_code = body.otp.strip()

    # Find the most recent OTP for this email
    record = db.query(OTPRecord).filter(OTPRecord.email == email).order_by(OTPRecord.created_at.desc()).first()

    if not record:
        raise HTTPException(status_code=400, detail="No OTP found for this email.")

    if record.otp_code != otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP.")

    # Check expiration (10 minutes)
    now_utc = datetime.now(timezone.utc)
    # Ensure created_at is timezone aware for comparison
    created_at_utc = record.created_at.replace(tzinfo=timezone.utc) if record.created_at.tzinfo is None else record.created_at
    
    if (now_utc - created_at_utc) > timedelta(minutes=10):
        raise HTTPException(status_code=400, detail="OTP has expired.")

    return {"message": "OTP verified successfully"}

class RegisterUserRequest(BaseModel):
    email: str
    password: str
    full_name: str
    otp: str

@router.post("/register-user")
async def register_user(body: RegisterUserRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    otp_code = body.otp.strip()
    password = body.password
    full_name = body.full_name.strip()

    # 1. Verify OTP
    record = db.query(OTPRecord).filter(OTPRecord.email == email).order_by(OTPRecord.created_at.desc()).first()
    if not record:
        raise HTTPException(status_code=400, detail="No OTP found for this email.")
    if record.otp_code != otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP.")

    now_utc = datetime.now(timezone.utc)
    created_at_utc = record.created_at.replace(tzinfo=timezone.utc) if record.created_at.tzinfo is None else record.created_at
    if (now_utc - created_at_utc) > timedelta(minutes=10):
        raise HTTPException(status_code=400, detail="OTP has expired.")

    # 2. Call Supabase Admin API to create user with email_confirm = True
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        raise HTTPException(status_code=500, detail="Supabase Admin key not configured.")

    admin_url = f"{supabase_url.rstrip('/')}/auth/v1/admin/users"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {"full_name": full_name}
    }

    import json
    import urllib.request
    import urllib.error

    req = urllib.request.Request(admin_url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            user_res = json.loads(resp.read().decode('utf-8'))
            
            # Upsert into public.profiles
            user_id = user_res.get("id") or (user_res.get("user") or {}).get("id")
            if user_id:
                profile_url = f"{supabase_url.rstrip('/')}/rest/v1/profiles"
                prof_payload = {
                    "id": user_id,
                    "full_name": full_name,
                    "email": email
                }
                prof_headers = {
                    "apikey": service_role_key,
                    "Authorization": f"Bearer {service_role_key}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates"
                }
                try:
                    prof_req = urllib.request.Request(profile_url, data=json.dumps(prof_payload).encode('utf-8'), headers=prof_headers, method='POST')
                    with urllib.request.urlopen(prof_req) as _:
                        pass
                except Exception as p_err:
                    logger.warning(f"Failed to create public.profiles row: {p_err}")

            # Delete OTP after successful user creation
            db.delete(record)
            db.commit()

            return {"message": "User registered and verified successfully", "user": user_res}
    except urllib.error.HTTPError as e:
        err_text = e.read().decode('utf-8')
        logger.error(f"Supabase Admin Create User Error: {err_text}")
        if "already registered" in err_text.lower() or "already been registered" in err_text.lower():
            raise HTTPException(status_code=400, detail="This email is already registered. Please log in.")
        raise HTTPException(status_code=400, detail="Failed to create user account. Please try again.")
    except Exception as e:
        logger.error(f"Registration Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
