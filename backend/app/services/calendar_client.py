import logging
import time
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

CALENDAR_URLS = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json",
]

# Cache: fetch at most once per hour
_calendar_cache: list[dict] = []
_cache_time: float = 0
CACHE_TTL = 3600  # 1 hour

# Map currency codes to country names
COUNTRY_MAP = {
    "USD": "🇺🇸 美国", "EUR": "🇪🇺 欧元区", "GBP": "🇬🇧 英国",
    "JPY": "🇯🇵 日本", "CNY": "🇨🇳 中国", "AUD": "🇦🇺 澳大利亚",
    "CAD": "🇨🇦 加拿大", "CHF": "🇨🇭 瑞士", "NZD": "🇳🇿 新西兰",
}

IMPACT_MAP = {"high": "高", "medium": "中", "low": "低", "holiday": "假日"}


async def fetch_economic_calendar() -> list[dict]:
    """Fetch this week's economic calendar events (cached for 1 hour)."""
    global _calendar_cache, _cache_time
    if _calendar_cache and (time.time() - _cache_time) < CACHE_TTL:
        return _calendar_cache

    try:
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"}
        raw = None
        async with httpx.AsyncClient(timeout=15) as client:
            for url in CALENDAR_URLS:
                try:
                    resp = await client.get(url, headers=headers)
                    resp.raise_for_status()
                    raw = resp.json()
                    logger.info(f"Calendar fetched from {url}")
                    break
                except Exception as e:
                    logger.warning(f"Calendar URL {url} failed: {e}")
                    continue
        if not raw:
            # Fallback: load from local cache file if exists
            import os
            cache_file = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'calendar_cache.json')
            if os.path.exists(cache_file):
                import json as json_mod
                with open(cache_file) as f:
                    raw = json_mod.load(f)
                logger.info(f"Calendar loaded from local cache file")
            else:
                logger.error("All calendar URLs failed and no local cache")
                return []

        events = []
        for e in raw:
            country_code = e.get("country", "")
            impact = (e.get("impact", "") or "").lower()  # normalize to lowercase
            events.append({
                "date": e.get("date", ""),
                "title": e.get("title", ""),
                "country_code": country_code,
                "country": COUNTRY_MAP.get(country_code, country_code),
                "impact": impact,
                "impact_zh": IMPACT_MAP.get(impact, impact),
                "forecast": e.get("forecast", ""),
                "previous": e.get("previous", ""),
                "actual": e.get("actual", ""),
            })

        # Filter: major economies only, keep High/Medium impact + any event with actual results
        major_currencies = {"USD", "EUR", "GBP", "JPY", "CNY", "AUD", "CAD", "CHF"}
        events = [
            e for e in events
            if e["country_code"] in major_currencies
            and (e["impact"] in ("high", "medium") or e["actual"])
        ]
        events.sort(key=lambda x: x["date"])

        logger.info(f"Fetched {len(events)} calendar events (high/medium impact + published results)")
        _calendar_cache = events
        _cache_time = time.time()
        return events

    except Exception as e:
        logger.error(f"Failed to fetch economic calendar: {e}")
        return []
