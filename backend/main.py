from dotenv import load_dotenv
load_dotenv()  # must run before any service imports that read os.getenv()

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

from routes import url, screenshot, qr, otp, upi, voice, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
