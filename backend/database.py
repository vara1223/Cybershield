import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Allow DATABASE_URL override via environment variable for production deployments
# (e.g. PostgreSQL: postgresql://user:pass@host/dbname or SQLite)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cybershield.db")

# Fix Render / Heroku / Supabase postgres:// URL dialect prefix for SQLAlchemy 2.0+
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
engine_kwargs = {}

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    # Ensure directory exists if SQLite path has subdirectories (e.g. /data/cybershield.db or ./cybershield.db)
    clean_path = SQLALCHEMY_DATABASE_URL.split(":///")[-1]
    if "/" in clean_path or "\\" in clean_path:
        db_dir = os.path.dirname(clean_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
else:
    # Production pool settings for PostgreSQL
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

