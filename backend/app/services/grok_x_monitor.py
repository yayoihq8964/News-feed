import json
import logging
import re
from datetime import datetime
from typing import Optional

from app.config import settings as app_settings
from app.models.database import get_db, insert_x_sentiment, get_setting
from app.services.llm_providers.grok_provider import GrokProvider

logger = logging.getLogger(__name__)

# Track last error for API visibility
_last_error: Optional[str] = None


def get_last_error() -> Optional[str]:
    return _last_error


X_SENTIMENT_PROMPT = """You are a financial sentiment analyst. Based on your training knowledge and understanding of current market conditions, estimate what retail investor sentiment on social media (X/Twitter) likely looks like right now.

NOTE: This is an LLM-based estimation, NOT real-time data. Provide your best-effort assessment in the following JSON format:
{
  "trending_tickers": [
    {"ticker": "<ticker>", "mention_sentiment": "<bullish|bearish|mixed>", "buzz_level": "<high|medium|low>", "narrative": "<estimated discussion topic>"}
  ],
  "overall_retail_sentiment": <-100 to 100>,
  "key_narratives": ["<narrative1>", ...],
  "meme_stock_alerts": [
    {"ticker": "<ticker>", "risk_level": "<high|medium|low>", "description": "<what might be happening>"}
  ],
  "fear_greed_estimate": <0-100, 0=extreme fear, 100=extreme greed>
}

Include at least 5 tickers you estimate are likely trending. Be honest about the speculative nature of this analysis."""

X_SYSTEM_PROMPT = "You are a financial market analyst. You estimate retail investor sentiment based on your knowledge of market trends and social media patterns. Your outputs are LLM-based estimations, not real-time social media data. Provide structured JSON analysis."


async def run_x_sentiment_analysis() -> Optional[dict]:
    """Run Grok-based sentiment estimation (LLM-estimated, not real-time X data)."""
    global _last_error
    db = await get_db()
    try:
        # Get API key (check DB overrides first)
        grok_key = await get_setting(db, "grok_api_key")
        if not grok_key:
            grok_key = app_settings.grok_api_key
        if not grok_key:
            _last_error = "Grok API key not configured"
            logger.warning(_last_error)
            return None

        grok_model = await get_setting(db, "grok_model") or "grok-4.20-beta"
        grok_base_url = await get_setting(db, "grok_base_url") or app_settings.grok_base_url
        provider = GrokProvider(api_key=grok_key, model=grok_model, base_url=grok_base_url)

        try:
            raw = await provider.analyze(X_SENTIMENT_PROMPT, X_SYSTEM_PROMPT)
            # Strip <think>...</think> tags from reasoning models
            cleaned = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL).strip()
            # Find the JSON object in the response
            json_start = cleaned.find('{')
            json_end = cleaned.rfind('}')
            if json_start >= 0 and json_end > json_start:
                cleaned = cleaned[json_start:json_end + 1]
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            _last_error = f"JSON parse error: {e}"
            logger.error(f"Failed to parse Grok X sentiment JSON: {e}\nRaw: {raw[:500]}")
            return None
        except Exception as e:
            # Extract upstream details if available
            error_detail = str(e)
            if hasattr(e, 'response'):
                try:
                    error_detail = f"HTTP {e.response.status_code}: {e.response.text[:200]}"
                except Exception:
                    pass
            _last_error = f"Grok API error: {error_detail}"
            logger.error(f"Grok X sentiment analysis failed: {error_detail}")
            return None

        trending = parsed.get("trending_tickers", [])
        meme_stocks = parsed.get("meme_stock_alerts", [])

        sentiment_record = {
            "query": "LLM-estimated social media financial sentiment (not real-time data)",
            "trending_tickers": json.dumps(trending),
            "retail_sentiment_score": int(parsed.get("overall_retail_sentiment", 0)),
            "key_narratives": json.dumps(parsed.get("key_narratives", [])),
            "meme_stocks": json.dumps(meme_stocks),
            "raw_analysis": raw,
            "fear_greed_estimate": int(parsed.get("fear_greed_estimate", 50)),
            "analyzed_at": datetime.utcnow().isoformat(),
        }

        sentiment_id = await insert_x_sentiment(db, sentiment_record)
        _last_error = None  # Clear error on success
        logger.info(f"X sentiment analysis stored with id={sentiment_id}")

        return {
            "id": sentiment_id,
            "trending_tickers": trending,
            "retail_sentiment_score": sentiment_record["retail_sentiment_score"],
            "key_narratives": parsed.get("key_narratives", []),
            "meme_stocks": meme_stocks,
            "fear_greed_estimate": parsed.get("fear_greed_estimate"),
            "analyzed_at": sentiment_record["analyzed_at"],
        }
    finally:
        await db.close()
