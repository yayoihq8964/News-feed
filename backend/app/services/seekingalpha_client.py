import logging
import xml.etree.ElementTree as ET
from typing import Optional
from email.utils import parsedate_to_datetime

import httpx

logger = logging.getLogger(__name__)

SA_FEEDS = [
    "https://seekingalpha.com/market_currents.xml",
    "https://seekingalpha.com/tag/wall-st-breakfast.xml",
]


def _parse_sa_item(item: ET.Element) -> Optional[dict]:
    title_el = item.find("title")
    link_el = item.find("link")
    pub_el = item.find("pubDate")

    title = title_el.text.strip() if title_el is not None and title_el.text else ""
    url = link_el.text.strip() if link_el is not None and link_el.text else ""
    if not title or not url:
        return None

    # Extract tickers from <category> tags
    tickers = []
    for cat in item.findall("category"):
        domain = cat.get("domain", "")
        if "symbol" in domain and cat.text:
            tickers.append(cat.text.upper())

    summary = f"[{', '.join(tickers[:6])}]" if tickers else None

    # Parse date
    published_at = ""
    if pub_el is not None and pub_el.text:
        try:
            dt = parsedate_to_datetime(pub_el.text)
            published_at = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            published_at = pub_el.text

    # Clean tracking params from URL
    if "?" in url:
        url = url.split("?")[0]

    return {
        "source": "seekingalpha",
        "title": title,
        "summary": summary,
        "url": url,
        "image_url": None,
        "published_at": published_at,
    }


async def fetch_seekingalpha_news() -> list[dict]:
    """Fetch news from Seeking Alpha RSS feeds. Free, no API key needed."""
    results: list[dict] = []
    seen_urls: set[str] = set()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for feed_url in SA_FEEDS:
                try:
                    resp = await client.get(
                        feed_url,
                        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
                    )
                    resp.raise_for_status()
                    tree = ET.fromstring(resp.text)
                    items = tree.findall(".//item")

                    count = 0
                    for item in items:
                        parsed = _parse_sa_item(item)
                        if parsed and parsed["url"] not in seen_urls:
                            seen_urls.add(parsed["url"])
                            results.append(parsed)
                            count += 1

                    logger.info(f"Seeking Alpha [{feed_url.split('/')[-1]}]: {count} items")
                except Exception as e:
                    logger.warning(f"Seeking Alpha feed error: {e}")

    except Exception as e:
        logger.error(f"Seeking Alpha fetch error: {e}")

    logger.info(f"Seeking Alpha total: {len(results)} items")
    return results
