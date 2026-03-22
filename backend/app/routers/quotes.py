import logging
import time
from typing import Optional

import yfinance as yf
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/quotes", tags=["quotes"])

INDICES = {
    "^IXIC": {"name": "NASDAQ", "label": "纳斯达克"},
    "^GSPC": {"name": "S&P 500", "label": "标普500"},
    "^N225": {"name": "Nikkei 225", "label": "日经225"},
    "000001.SS": {"name": "上证指数", "label": "上证"},
}

COMMODITIES = {
    "GC=F": {"name": "Gold", "label": "黄金"},
    "CL=F": {"name": "Crude Oil", "label": "原油"},
    "SI=F": {"name": "Silver", "label": "白银"},
}

ALL_SYMBOLS = {**INDICES, **COMMODITIES}

# Cache to avoid hitting API too frequently
_cache: dict = {"data": None, "ts": 0}
CACHE_TTL = 120  # 2 minutes


def _is_market_open(info) -> bool:
    """Heuristic: if last_price != previous_close, market likely moved today."""
    try:
        return abs(info.last_price - info.previous_close) > 0.001
    except Exception:
        return False


@router.get("")
async def get_market_quotes():
    """Fetch market quotes using yfinance with 52-week range data."""
    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < CACHE_TTL:
        return _cache["data"]

    try:
        symbols_str = " ".join(ALL_SYMBOLS.keys())
        tickers = yf.Tickers(symbols_str)

        quotes = []
        for symbol, meta in ALL_SYMBOLS.items():
            try:
                t = tickers.tickers[symbol]
                info = t.fast_info
                price = info.last_price
                prev = info.previous_close
                change = price - prev if price and prev else None
                change_pct = (change / prev * 100) if change and prev else None
                market_open = _is_market_open(info)

                quotes.append({
                    "symbol": symbol,
                    "name": meta["name"],
                    "label": meta["label"],
                    "price": round(price, 2) if price else None,
                    "change": round(change, 2) if change is not None else None,
                    "changePercent": round(change_pct, 2) if change_pct is not None else None,
                    "previousClose": round(prev, 2) if prev else None,
                    "yearLow": round(info.year_low, 2) if info.year_low else None,
                    "yearHigh": round(info.year_high, 2) if info.year_high else None,
                    "marketOpen": market_open,
                    "type": "commodity" if symbol in COMMODITIES else "index",
                })
            except Exception as e:
                logger.warning(f"Failed to fetch {symbol}: {e}")
                quotes.append({
                    "symbol": symbol,
                    "name": meta["name"],
                    "label": meta["label"],
                    "price": None,
                    "change": None,
                    "changePercent": None,
                    "previousClose": None,
                    "yearLow": None,
                    "yearHigh": None,
                    "marketOpen": False,
                    "type": "commodity" if symbol in COMMODITIES else "index",
                })

        result = {"quotes": quotes}
        _cache["data"] = result
        _cache["ts"] = now
        return result

    except Exception as e:
        logger.warning(f"Failed to fetch market quotes: {e}")
        return {
            "quotes": [
                {
                    "symbol": s,
                    "name": ALL_SYMBOLS[s]["name"],
                    "label": ALL_SYMBOLS[s]["label"],
                    "price": None,
                    "change": None,
                    "changePercent": None,
                    "previousClose": None,
                    "yearLow": None,
                    "yearHigh": None,
                    "marketOpen": False,
                    "type": "commodity" if s in COMMODITIES else "index",
                }
                for s in ALL_SYMBOLS
            ]
        }
