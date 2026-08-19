import os
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
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

class ResetPasswordRequest(BaseModel):
    email: str
    password: str
    otp: Optional[str] = None

class UpdateCredentialsRequest(BaseModel):
    email: str
    password: Optional[str] = None
    passkey: Optional[str] = None
    current_password: Optional[str] = None
    admin_key: Optional[str] = None


def sync_supabase_user(email: str, password: Optional[str] = None, user_metadata: Optional[dict] = None, passkey: Optional[str] = None):
    """Synchronizes user credentials directly with Supabase Auth using the Service Role Key."""
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        raise HTTPException(status_code=500, detail="Supabase Admin key not configured.")

    base_url = supabase_url.rstrip("/")
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json"
    }

    import json
    import urllib.request
    import urllib.error

    # 1. Fetch user list to check if user exists
    get_req = urllib.request.Request(f"{base_url}/auth/v1/admin/users?page=1&per_page=1000", headers=headers, method='GET')
    users = []
    try:
        with urllib.request.urlopen(get_req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            users = data.get("users", data) if isinstance(data, dict) else data
    except Exception as e:
        logger.warning(f"Error fetching Supabase users: {e}")

    target_user = None
    email_clean = email.strip().lower()
    for u in users:
        if (u.get("email") or "").lower() == email_clean:
            target_user = u
            break

    is_admin = (email_clean == "varaprasadmokharala5@gmail.com")
    meta = {}
    if target_user:
        meta = dict(target_user.get("user_metadata") or {})
    if is_admin:
        meta["role"] = "admin"
        meta["is_admin"] = True
    if passkey:
        meta["admin_passkey"] = passkey
        meta["passkey"] = passkey
    if user_metadata:
        meta.update(user_metadata)
    if "full_name" not in meta:
        meta["full_name"] = "Admin User" if is_admin else email_clean.split("@")[0]

    user_id = None
    if target_user:
        user_id = target_user["id"]
        update_payload = {
            "email_confirm": True,
            "user_metadata": meta
        }
        if password:
            update_payload["password"] = password

        put_req = urllib.request.Request(
            f"{base_url}/auth/v1/admin/users/{user_id}",
            data=json.dumps(update_payload).encode('utf-8'),
            headers=headers,
            method='PUT'
        )
        try:
            with urllib.request.urlopen(put_req) as resp:
                pass
        except Exception as e:
            logger.error(f"Error updating Supabase user {user_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update user in Supabase Auth: {str(e)}")
    else:
        # Create user if doesn't exist
        create_payload = {
            "email": email_clean,
            "password": password or ("admin123" if is_admin else "password123"),
            "email_confirm": True,
            "user_metadata": meta
        }
        post_req = urllib.request.Request(
            f"{base_url}/auth/v1/admin/users",
            data=json.dumps(create_payload).encode('utf-8'),
            headers=headers,
            method='POST'
        )
        try:
            with urllib.request.urlopen(post_req) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                user_id = res_data.get("id") or (res_data.get("user") or {}).get("id")
        except Exception as e:
            logger.error(f"Error creating Supabase user: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create user in Supabase Auth: {str(e)}")

    # 2. Upsert into public.profiles
    if user_id:
        prof_payload = {
            "id": user_id,
            "full_name": meta.get("full_name", email_clean.split("@")[0]),
            "email": email_clean,
        }
        prof_headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        try:
            prof_req = urllib.request.Request(
                f"{base_url}/rest/v1/profiles",
                data=json.dumps(prof_payload).encode('utf-8'),
                headers=prof_headers,
                method='POST'
            )
            with urllib.request.urlopen(prof_req) as _:
                pass
        except Exception as p_err:
            logger.warning(f"Failed to sync public.profiles row: {p_err}")

    return {"user_id": user_id, "email": email_clean, "synced": True}


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

    # 2. Sync to Supabase Auth & profiles
    try:
        res = sync_supabase_user(email=email, password=password, user_metadata={"full_name": full_name})
        # Delete OTP after successful user creation
        db.delete(record)
        db.commit()
        return {"message": "User registered and verified successfully", "user": res}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    password = body.password
    otp_code = (body.otp or "").strip()

    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    # Verify OTP if provided
    record = None
    if otp_code:
        record = db.query(OTPRecord).filter(OTPRecord.email == email).order_by(OTPRecord.created_at.desc()).first()
        if not record:
            raise HTTPException(status_code=400, detail="No OTP found for this email.")
        if record.otp_code != otp_code:
            raise HTTPException(status_code=400, detail="Invalid OTP.")

        now_utc = datetime.now(timezone.utc)
        created_at_utc = record.created_at.replace(tzinfo=timezone.utc) if record.created_at.tzinfo is None else record.created_at
        if (now_utc - created_at_utc) > timedelta(minutes=10):
            raise HTTPException(status_code=400, detail="OTP has expired.")

    # Update password in Supabase Auth & Profiles
    try:
        res = sync_supabase_user(email=email, password=password)
        if record:
            db.delete(record)
            db.commit()
        return {"message": "Password reset successfully and synchronized to Supabase Cloud", "user": res}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset Password Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-credentials")
async def update_credentials(body: UpdateCredentialsRequest):
    email = body.email.strip().lower()
    password = body.password
    passkey = body.passkey

    # Sync to Supabase
    try:
        res = sync_supabase_user(email=email, password=password, passkey=passkey)
        return {"message": "Credentials updated and synchronized to Supabase Cloud", "user": res}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update Credentials Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-admin")
async def sync_admin():
    """Ensures default admin exists in Supabase Auth Cloud."""
    try:
        res = sync_supabase_user(
            email="varaprasadmokharala5@gmail.com",
            password=None, # Will use admin123 if creating
            passkey="1234",
            user_metadata={"role": "admin", "is_admin": True, "full_name": "System Administrator"}
        )
        return {"message": "Admin user synchronized in Supabase Cloud", "user": res}
    except Exception as e:
        logger.error(f"Sync Admin Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache-status")
async def get_cache_status():
    """Public endpoint for mobile app to check sync status of cache flush."""
    from routes.admin import _GLOBAL_LAST_FLUSH_AT
    return {
        "last_flushed_at": _GLOBAL_LAST_FLUSH_AT,
        "status": "synced"
    }

