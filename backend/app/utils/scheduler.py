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
    """Scheduled job: refresh X/Twitter sentiment via Grok."""
    try:
        from app.services.grok_x_monitor import run_x_sentiment_analysis
        result = await run_x_sentiment_analysis()
        if result:
            logger.info(f"[Scheduler] X sentiment refresh complete")
        else:
            logger.debug("[Scheduler] X sentiment skipped (no Grok key)")
    except Exception as e:
        logger.error(f"[Scheduler] X sentiment job failed: {e}")


def start_scheduler(poll_interval: int = None) -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        logger.warning("Scheduler already running, skipping start")
        return
    _scheduler = AsyncIOScheduler()
    interval = poll_interval or app_settings.news_poll_interval

    _scheduler.add_job(
        _job_fetch_news,
        trigger=IntervalTrigger(seconds=interval),
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
        trigger=IntervalTrigger(seconds=1800),  # 30 minutes
        id="x_sentiment",
        name="Refresh X/Twitter sentiment",
        replace_existing=True,
        max_instances=1,
    )

    _scheduler.start()
    logger.info(
        f"Scheduler started: news poll={interval}s, analysis=60s, x_sentiment=1800s"
    )


def stop_scheduler() -> None:
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def get_scheduler() -> AsyncIOScheduler:
    return _scheduler
