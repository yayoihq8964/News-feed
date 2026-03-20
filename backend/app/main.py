import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.database import init_db
from app.utils.scheduler import start_scheduler, stop_scheduler
from app.routers import news, analysis, x_sentiment, settings, calendar

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
    start_scheduler()

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

# CORS - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(news.router)
app.include_router(analysis.router)
app.include_router(x_sentiment.router)
app.include_router(settings.router)
app.include_router(calendar.router)


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
