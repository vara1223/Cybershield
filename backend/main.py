from dotenv import load_dotenv
load_dotenv(override=True)  # 100% Local ML Active (Voice Rate Limit 30/min Active) # force reload 2

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from database import engine, Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cybershield")

# ── Startup security checks ────────────────────────────────────────────────────
_SECRET_KEY = os.getenv("SECRET_KEY", "")
if not _SECRET_KEY or _SECRET_KEY == "change-me-in-production":
    logger.warning(
        "[SECURITY] SECRET_KEY is not set or uses the default placeholder. "
        "Generate a strong key: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

_ADMIN_KEY = os.getenv("ADMIN_API_KEY", "")
if not _ADMIN_KEY:
    logger.warning(
        "[SECURITY] ADMIN_API_KEY is not set. Admin endpoints are accessible without "
        "authentication. Set ADMIN_API_KEY in backend/.env to enable protection."
    )

# ── CORS — restrict to known origins ──────────────────────────────────────────
_RAW_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8081,http://localhost:3000,http://localhost:19006")
ALLOWED_ORIGINS = [o.strip() for o in _RAW_ORIGINS.split(",") if o.strip()]

# ── Rate limiter ────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

from routes import url, screenshot, qr, otp, upi, voice, admin, custom_auth
# Import models so SQLAlchemy registers them before create_all
from models import scan_log, admin_scan_log
from models.otp_store import OTPRecord

from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        # Legacy migrations for scan_logs
        try:
            conn.execute(text("ALTER TABLE scan_logs ADD COLUMN user_name VARCHAR DEFAULT 'Guest User'"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE scan_logs ADD COLUMN user_email VARCHAR DEFAULT 'guest@cybershield.local'"))
        except Exception:
            pass
        # Ensure admin_scan_logs exists (created by create_all, but belt-and-suspenders)
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS admin_scan_logs (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    scan_id    INTEGER NOT NULL UNIQUE,
                    user_id    TEXT,
                    user_name  TEXT NOT NULL DEFAULT 'User',
                    user_email TEXT NOT NULL DEFAULT 'user@cybershield.local',
                    scan_type  TEXT NOT NULL,
                    scan_input TEXT,
                    result     TEXT NOT NULL,
                    confidence REAL,
                    analysis   TEXT,
                    status     TEXT NOT NULL DEFAULT 'completed',
                    created_at DATETIME DEFAULT (datetime('now')),
                    updated_at DATETIME DEFAULT (datetime('now'))
                )
            """))
        except Exception:
            pass
        conn.commit()
    yield


app = FastAPI(title="CyberShield API", version="1.0.0", lifespan=lifespan)

# ── Middleware ─────────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.[1-3]\d\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(url.router,        prefix="/analyze")
app.include_router(screenshot.router, prefix="/analyze")
app.include_router(qr.router,         prefix="/analyze")
app.include_router(otp.router,        prefix="/analyze")
app.include_router(upi.router,        prefix="/analyze")
app.include_router(voice.router,      prefix="/analyze")
app.include_router(admin.router,      prefix="/admin")
app.include_router(custom_auth.router, prefix="/api/custom-auth")

from fastapi.staticfiles import StaticFiles

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

# ── Mount static frontend build if present ──────────────────────────────────────
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

