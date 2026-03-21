import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.database import init_db
from app.utils.scheduler import start_scheduler, stop_scheduler
from app.routers import news, analysis, x_sentiment, settings, calendar
from app.routers import quotes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Ensure data directory exists
os.makedirs("data", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MacroLens backend...")

    # Initialize database
    await init_db()

    # Start background scheduler
    await start_scheduler()

    logger.info("MacroLens backend ready")
    yield

    # Shutdown
    logger.info("Shutting down MacroLens backend...")
    stop_scheduler()
    logger.info("MacroLens backend stopped")


app = FastAPI(
    title="MacroLens API",
    description="Macro news sentiment analysis platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
_cors_origins = os.environ.get("CORS_ORIGINS", "").split(",")
_cors_origins = [o.strip() for o in _cors_origins if o.strip()]
if not _cors_origins:
    # Development fallback: allow all origins without credentials
    _cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=("*" not in _cors_origins),  # credentials not allowed with wildcard
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(news.router)
app.include_router(analysis.router)
app.include_router(x_sentiment.router)
app.include_router(settings.router)
app.include_router(calendar.router)
app.include_router(quotes.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "MacroLens"}


@app.get("/")
async def root():
    return {
        "service": "MacroLens API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": [
            "/api/news",
            "/api/analysis",
            "/api/x-sentiment",
            "/api/settings",
        ],
    }
