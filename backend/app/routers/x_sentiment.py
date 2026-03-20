import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from app.models.database import get_db, get_latest_x_sentiment, get_x_sentiment_history
from app.services.grok_x_monitor import run_x_sentiment_analysis

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/x-sentiment", tags=["x-sentiment"])


@router.get("")
async def get_latest_sentiment():
    db = await get_db()
    try:
        sentiment = await get_latest_x_sentiment(db)
        if not sentiment:
            return {"message": "No X sentiment data yet. Trigger a refresh to get started.", "data": None}
        return {"data": sentiment}
    finally:
        await db.close()


@router.post("/refresh")
async def refresh_x_sentiment(background_tasks: BackgroundTasks):
    """Trigger a new X/Twitter sentiment analysis via Grok."""
    background_tasks.add_task(run_x_sentiment_analysis)
    return {"status": "triggered", "message": "X sentiment analysis started in background"}


@router.get("/history")
async def x_sentiment_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    db = await get_db()
    try:
        total, items = await get_x_sentiment_history(db, page=page, page_size=page_size)
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": items,
        }
    finally:
        await db.close()
