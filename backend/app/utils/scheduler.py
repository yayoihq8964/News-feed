import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings as app_settings

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler = None


async def _job_fetch_news():
    """Scheduled job: fetch news from all sources."""
    try:
        from app.services.news_aggregator import aggregate_all_news
        count = await aggregate_all_news()
        logger.info(f"[Scheduler] News fetch complete: {count} new items")
    except Exception as e:
        logger.error(f"[Scheduler] News fetch job failed: {e}")


async def _job_analyze_news():
    """Scheduled job: analyze unanalyzed news items."""
    try:
        from app.services.llm_analyzer import run_analysis_batch
        count = await run_analysis_batch()
        logger.info(f"[Scheduler] Analysis batch complete: {count} items analyzed")
    except Exception as e:
        logger.error(f"[Scheduler] Analysis job failed: {e}")


async def _job_x_sentiment():
    """Scheduled job: refresh social sentiment estimation via Grok."""
    try:
        from app.services.grok_x_monitor import run_x_sentiment_analysis
        result = await run_x_sentiment_analysis()
        if result:
            logger.info("[Scheduler] Social sentiment estimation complete")
        else:
            logger.debug("[Scheduler] Social sentiment skipped (no Grok key)")
    except Exception as e:
        logger.error(f"[Scheduler] Social sentiment job failed: {e}")


async def _get_db_interval(key: str, fallback: int) -> int:
    """Read interval from DB settings, falling back to env/config value."""
    try:
        from app.models.database import get_db, get_setting
        db = await get_db()
        try:
            val = await get_setting(db, key)
            if val is not None:
                return int(val)
        finally:
            await db.close()
    except Exception:
        pass
    return fallback


async def start_scheduler(poll_interval: int = None) -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        logger.warning("Scheduler already running, skipping start")
        return
    _scheduler = AsyncIOScheduler()

    # Read intervals: DB override > function arg > env config
    news_interval = await _get_db_interval("news_poll_interval", poll_interval or app_settings.news_poll_interval)
    x_sentiment_interval = await _get_db_interval("x_sentiment_interval", app_settings.x_sentiment_interval)

    _scheduler.add_job(
        _job_fetch_news,
        trigger=IntervalTrigger(seconds=news_interval),
        id="fetch_news",
        name="Fetch news from all sources",
        replace_existing=True,
        max_instances=1,
    )

    _scheduler.add_job(
        _job_analyze_news,
        trigger=IntervalTrigger(seconds=60),
        id="analyze_news",
        name="Analyze unanalyzed news",
        replace_existing=True,
        max_instances=1,
    )

    _scheduler.add_job(
        _job_x_sentiment,
        trigger=IntervalTrigger(seconds=x_sentiment_interval),
        id="x_sentiment",
        name="Social sentiment estimation (LLM-based)",
        replace_existing=True,
        max_instances=1,
    )

    _scheduler.start()
    logger.info(
        f"Scheduler started: news poll={news_interval}s, analysis=60s, x_sentiment={x_sentiment_interval}s"
    )


def stop_scheduler() -> None:
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def get_scheduler() -> AsyncIOScheduler:
    return _scheduler
