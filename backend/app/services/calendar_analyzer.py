import json
import logging
from typing import Optional

from app.config import settings as app_settings
from app.models.database import get_db, get_setting
from app.services.llm_providers import (
    BaseLLMProvider,
    OpenAIProvider,
    AnthropicProvider,
    GrokProvider,
    OllamaProvider,
)

logger = logging.getLogger(__name__)

# In-memory cache: maps a cache key to the analyzed event list
_analysis_cache: dict[str, list[dict]] = {}

CALENDAR_SYSTEM_PROMPT = """You are a senior macro-economic analyst specializing in US equities and precious metals markets.
Analyze the following list of economic calendar events and assess their likely impact on stocks and commodities.

You MUST respond in valid JSON with this exact schema:
{
  "events": [
    {
      "title": "<original event title, must match exactly>",
      "title_zh": "<Chinese translation of the event title>",
      "stock_impact": "<bullish|bearish|neutral>",
      "commodity_impact": "<bullish|bearish|neutral>",
      "explanation": "<Chinese explanation of why, 1-2 sentences>"
    }
  ]
}

Rules:
- Return one entry per input event, preserving original title exactly
- ALL explanation and title_zh text MUST be in Chinese
- stock_impact refers to broad US equity market impact
- commodity_impact refers mainly to Gold, Silver, and other precious metals
- Consider both direct and indirect market effects"""


def _get_provider(provider_name: str, model: str, api_key: str, overrides: dict = {}) -> BaseLLMProvider:
    if provider_name == "anthropic":
        return AnthropicProvider(api_key=api_key, model=model)
    elif provider_name == "grok":
        grok_base_url = overrides.get("grok_base_url") or app_settings.grok_base_url
        return GrokProvider(api_key=api_key, model=model, base_url=grok_base_url)
    elif provider_name == "ollama":
        return OllamaProvider(base_url=overrides.get("ollama_base_url") or app_settings.ollama_base_url, model=model)
    else:
        openai_base_url = overrides.get("openai_base_url") or app_settings.openai_base_url
        return OpenAIProvider(api_key=api_key, model=model, base_url=openai_base_url)


def _resolve_api_key(provider: str, overrides: dict) -> str:
    key_map = {
        "openai": overrides.get("openai_api_key") or app_settings.openai_api_key or overrides.get("default_llm_api_key") or app_settings.default_llm_api_key,
        "anthropic": overrides.get("anthropic_api_key") or app_settings.anthropic_api_key or overrides.get("default_llm_api_key") or app_settings.default_llm_api_key,
        "grok": overrides.get("grok_api_key") or app_settings.grok_api_key or overrides.get("default_llm_api_key") or app_settings.default_llm_api_key,
        "ollama": "",
    }
    return key_map.get(provider, "")


def _cache_key(events: list[dict]) -> str:
    titles = sorted(e.get("title", "") for e in events)
    return "|".join(titles)


def get_cached_analysis(events: list[dict]) -> Optional[list[dict]]:
    return _analysis_cache.get(_cache_key(events))


def merge_analysis(events: list[dict], analyzed: list[dict]) -> list[dict]:
    """Merge AI analysis results into the events list by matching title."""
    lookup = {a["title"]: a for a in analyzed}
    result = []
    for e in events:
        merged = dict(e)
        match = lookup.get(e.get("title", ""))
        if match:
            merged["title_zh"] = match.get("title_zh", "")
            merged["stock_impact"] = match.get("stock_impact", "neutral")
            merged["commodity_impact"] = match.get("commodity_impact", "neutral")
            merged["explanation"] = match.get("explanation", "")
        result.append(merged)
    return result


async def analyze_calendar_events(events: list[dict]) -> list[dict]:
    """Run LLM analysis on calendar events. Returns analyzed event dicts and caches result."""
    cache_key = _cache_key(events)
    if cache_key in _analysis_cache:
        logger.info("Returning cached calendar analysis")
        return _analysis_cache[cache_key]

    db = await get_db()
    try:
        overrides = {}
        for key in ["default_llm_provider", "default_llm_model", "default_llm_api_key",
                    "openai_api_key", "anthropic_api_key", "grok_api_key", "ollama_base_url",
                    "openai_base_url", "grok_base_url"]:
            val = await get_setting(db, key)
            if val is not None:
                overrides[key] = val
    finally:
        await db.close()

    provider_name = overrides.get("default_llm_provider") or app_settings.default_llm_provider
    model = overrides.get("default_llm_model") or app_settings.default_llm_model
    api_key = _resolve_api_key(provider_name, overrides)

    provider = _get_provider(provider_name, model, api_key, overrides)

    event_list = "\n".join(
        f"- {e.get('title', '')} ({e.get('country', '')} {e.get('impact', '')} impact, {e.get('date', '')})"
        for e in events
    )
    user_prompt = f"Analyze these economic calendar events:\n\n{event_list}"

    raw_response = ""
    try:
        raw_response = await provider.analyze(user_prompt, CALENDAR_SYSTEM_PROMPT)
        parsed = json.loads(raw_response)
        analyzed = parsed.get("events", [])
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse calendar LLM JSON: {e}\nRaw: {raw_response[:500]}")
        return []
    except Exception as e:
        logger.error(f"Calendar LLM analysis failed: {e}")
        return []

    _analysis_cache[cache_key] = analyzed
    logger.info(f"Calendar analysis complete: {len(analyzed)} events analyzed")
    return analyzed
