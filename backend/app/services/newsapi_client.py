import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://newsapi.org/v2"


def _parse_item(item: dict, source_label: str) -> Optional[dict]:
    title = (item.get("title") or "").strip()
    url = (item.get("url") or "").strip()
    if not title or not url or title == "[Removed]":
        return None

    source_name = ""
    if isinstance(item.get("source"), dict):
        source_name = item["source"].get("name") or ""

    return {
        "source": f"newsapi/{source_name or source_label}",
        "title": title,
        "summary": item.get("description") or None,
        "url": url,
        "image_url": item.get("urlToImage") or None,
        "published_at": item.get("publishedAt") or None,
    }


async def fetch_newsapi_news(api_key: str) -> list[dict]:
    if not api_key:
        logger.warning("NewsAPI key not set; skipping")
        return []

    endpoints = [
        {
            "url": f"{BASE_URL}/top-headlines",
            "params": {"category": "business", "language": "en", "pageSize": 50},
            "label": "top-headlines",
        },
        {
            "url": f"{BASE_URL}/everything",
            "params": {
                "q": "stocks OR gold OR silver OR economy OR fed",
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": 50,
            },
            "label": "everything",
        },
    ]

    results: list[dict] = []

    async with httpx.AsyncClient(timeout=15) as client:
        for endpoint in endpoints:
            try:
                params = {**endpoint["params"], "apiKey": api_key}
                response = await client.get(endpoint["url"], params=params)
                response.raise_for_status()
                data = response.json()
                articles = data.get("articles") or []
                for article in articles:
                    parsed = _parse_item(article, endpoint["label"])
                    if parsed:
                        results.append(parsed)
                logger.info(f"NewsAPI [{endpoint['label']}]: fetched {len(articles)} items")
            except httpx.HTTPStatusError as e:
                logger.error(f"NewsAPI [{endpoint['label']}] HTTP error {e.response.status_code}: {e}")
            except Exception as e:
                logger.error(f"NewsAPI [{endpoint['label']}] error: {e}")

    return results
