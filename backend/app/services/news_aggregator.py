import logging
from datetime import datetime
from typing import Optional

from app.config import settings as app_settings
from app.models.database import get_db, insert_news_item, get_setting
from app.services.finnhub_client import fetch_finnhub_news
from app.services.newsapi_client import fetch_newsapi_news
from app.services.gnews_client import fetch_gnews_news
from app.services.massive_client import fetch_massive_news
from app.services.googlenews_client import fetch_google_news
from app.services.seekingalpha_client import fetch_seekingalpha_news
from app.utils.dedup import compute_content_hash

logger = logging.getLogger(__name__)


async def _get_api_keys(db) -> dict:
    keys = {}
    for key in ["finnhub_api_key", "newsapi_api_key", "gnews_api_key", "massive_api_key"]:
        val = await get_setting(db, key)
        keys[key] = val or getattr(app_settings, key, "")
    return keys


async def aggregate_all_news() -> int:
    """Fetch news from all sources, deduplicate, and store. Returns count of new items."""
    db = await get_db()
    try:
        keys = await _get_api_keys(db)

        all_items: list[dict] = []

        # Fetch from all sources concurrently
        import asyncio
        results = await asyncio.gather(
            fetch_finnhub_news(keys["finnhub_api_key"]),
            fetch_newsapi_news(keys["newsapi_api_key"]),
            fetch_gnews_news(keys["gnews_api_key"]),
            fetch_massive_news(keys["massive_api_key"]),
            fetch_google_news(),           # Free, no key needed
            fetch_seekingalpha_news(),      # Free, no key needed
            return_exceptions=True,
        )

        for result in results:
            if isinstance(result, Exception):
                logger.error(f"News source fetch error: {result}")
            elif isinstance(result, list):
                all_items.extend(result)

        logger.info(f"Aggregated {len(all_items)} raw news items from all sources")

        now = datetime.utcnow().isoformat() + "Z"
        inserted = 0

        for item in all_items:
            content_hash = compute_content_hash(item["title"], item.get("url", ""))
            record = {
                **item,
                "fetched_at": now,
                "content_hash": content_hash,
            }
            result = await insert_news_item(db, record)
            if result is not None:
                inserted += 1

        logger.info(f"Inserted {inserted} new news items (skipped {len(all_items) - inserted} duplicates)")
        return inserted
    finally:
        await db.close()
