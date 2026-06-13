from dotenv import load_dotenv
load_dotenv()  # must run before any service imports that read os.getenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import engine, Base
from routes import url, screenshot, qr, otp, upi, voice, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="CyberShield API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(url.router, prefix="/analyze")
app.include_router(screenshot.router, prefix="/analyze")
app.include_router(qr.router, prefix="/analyze")
app.include_router(otp.router, prefix="/analyze")
app.include_router(upi.router, prefix="/analyze")
app.include_router(voice.router, prefix="/analyze")
app.include_router(admin.router, prefix="/admin")

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
