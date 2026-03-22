import logging
from datetime import datetime
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://finnhub.io/api/v1"


def _parse_item(item: dict) -> Optional[dict]:
    """Normalize a Finnhub news item to our internal schema."""
    title = (item.get("headline") or "").strip()
    url = (item.get("url") or "").strip()
    if not title or not url:
        return None

    published_ts = item.get("datetime")
    published_at = None
    if published_ts:
        try:
            published_at = datetime.utcfromtimestamp(int(published_ts)).isoformat() + "Z"
        except (ValueError, OSError):
            published_at = None

    return {
        "source": f"finnhub/{item.get('source', 'unknown')}",
        "title": title,
        "summary": item.get("summary") or None,
        "url": url,
        "image_url": item.get("image") or None,
        "published_at": published_at,
    }


async def fetch_finnhub_news(api_key: str) -> list[dict]:
    if not api_key:
        logger.warning("Finnhub API key not set; skipping")
        return []

    categories = ["general", "forex", "merger"]
    results: list[dict] = []

    async with httpx.AsyncClient(timeout=15) as client:
        # Market news categories
        for category in categories:
            try:
                response = await client.get(
                    f"{BASE_URL}/news",
                    params={"category": category, "token": api_key},
                )
                response.raise_for_status()
                items = response.json()
                for item in items:
                    parsed = _parse_item(item)
                    if parsed:
                        results.append(parsed)
                logger.info(f"Finnhub [{category}]: fetched {len(items)} items")
            except httpx.HTTPStatusError as e:
                logger.error(f"Finnhub [{category}] HTTP error {e.response.status_code}: {e}")
            except Exception as e:
                logger.error(f"Finnhub [{category}] error: {e}")

        # Company news for key tickers (more real-time)
        today = datetime.utcnow().strftime("%Y-%m-%d")
        for symbol in ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "GLD", "SPY"]:
            try:
                response = await client.get(
                    f"{BASE_URL}/company-news",
                    params={"symbol": symbol, "from": today, "to": today, "token": api_key},
                )
                response.raise_for_status()
                items = response.json()
                for item in items[:10]:  # cap per symbol
                    parsed = _parse_item(item)
                    if parsed:
                        results.append(parsed)
            except Exception:
                pass  # best-effort per symbol

        logger.info(f"Finnhub total: {len(results)} items")

    return results
