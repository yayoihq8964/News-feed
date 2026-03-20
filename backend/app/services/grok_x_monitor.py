import json
import logging
from datetime import datetime
from typing import Optional

from app.config import settings as app_settings
from app.models.database import get_db, insert_x_sentiment, get_setting
from app.services.llm_providers.grok_provider import GrokProvider

logger = logging.getLogger(__name__)

X_SENTIMENT_PROMPT = """You are a social media financial sentiment analyst. Analyze current trending financial discussions on X/Twitter.

Based on your knowledge of recent X/Twitter financial discussions, provide a JSON response:
{
  "trending_tickers": [
    {"ticker": "<ticker>", "mention_sentiment": "<bullish|bearish|mixed>", "buzz_level": "<high|medium|low>", "narrative": "<what people are saying>"}
  ],
  "overall_retail_sentiment": <-100 to 100>,
  "key_narratives": ["<narrative1>", ...],
  "meme_stock_alerts": [
    {"ticker": "<ticker>", "risk_level": "<high|medium|low>", "description": "<what's happening>"}
  ],
  "fear_greed_estimate": <0-100, 0=extreme fear, 100=extreme greed>
}

Provide your best assessment based on recent financial social media trends. Include at least 5 trending tickers."""

X_SYSTEM_PROMPT = "You are a financial social media analyst specializing in retail investor sentiment on X/Twitter. Provide structured JSON analysis of current financial discussions and trending topics."


async def run_x_sentiment_analysis() -> Optional[dict]:
    """Run Grok-based X sentiment analysis and store results."""
    db = await get_db()
    try:
        # Get API key (check DB overrides first)
        grok_key = await get_setting(db, "grok_api_key")
        if not grok_key:
            grok_key = app_settings.grok_api_key
        if not grok_key:
            logger.warning("Grok API key not configured; skipping X sentiment analysis")
            return None

        grok_model = await get_setting(db, "grok_model") or "grok-4.20-beta"
        grok_base_url = await get_setting(db, "grok_base_url") or app_settings.grok_base_url
        provider = GrokProvider(api_key=grok_key, model=grok_model, base_url=grok_base_url)

        try:
            raw = await provider.analyze(X_SENTIMENT_PROMPT, X_SYSTEM_PROMPT)
            # Strip <think>...</think> tags from reasoning models
            import re
            cleaned = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL).strip()
            # Find the JSON object in the response
            json_start = cleaned.find('{')
            json_end = cleaned.rfind('}')
            if json_start >= 0 and json_end > json_start:
                cleaned = cleaned[json_start:json_end + 1]
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Grok X sentiment JSON: {e}\nRaw: {raw[:500]}")
            return None
        except Exception as e:
            logger.error(f"Grok X sentiment analysis failed: {e}")
            return None

        trending = parsed.get("trending_tickers", [])
        meme_stocks = parsed.get("meme_stock_alerts", [])

        sentiment_record = {
            "query": "X/Twitter financial sentiment analysis",
            "trending_tickers": json.dumps(trending),
            "retail_sentiment_score": int(parsed.get("overall_retail_sentiment", 0)),
            "key_narratives": json.dumps(parsed.get("key_narratives", [])),
            "meme_stocks": json.dumps(meme_stocks),
            "raw_analysis": raw,
            "fear_greed_estimate": int(parsed.get("fear_greed_estimate", 50)),
            "analyzed_at": datetime.utcnow().isoformat(),
        }

        sentiment_id = await insert_x_sentiment(db, sentiment_record)
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
