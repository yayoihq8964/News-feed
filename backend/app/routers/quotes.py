import logging

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/quotes", tags=["quotes"])

SYMBOLS = {
    "^IXIC": {"name": "NASDAQ", "label": "纳斯达克"},
    "^GSPC": {"name": "S&P 500", "label": "标普500"},
    "^N225": {"name": "Nikkei 225", "label": "日经225"},
    "000001.SS": {"name": "上证指数", "label": "上证"},
}

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


@router.get("")
async def get_market_quotes():
    """Fetch live market index quotes for NASDAQ, S&P 500, Nikkei 225, and Shanghai Composite."""
    symbols_str = ",".join(SYMBOLS.keys())
    url = (
        f"https://query1.finance.yahoo.com/v7/finance/quote"
        f"?symbols={symbols_str}"
        f"&fields=regularMarketPrice,regularMarketPreviousClose,regularMarketChangePercent,regularMarketChange"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=_HEADERS)
            resp.raise_for_status()
            data = resp.json()

        results = data.get("quoteResponse", {}).get("result", [])
        quotes = []
        for r in results:
            symbol = r.get("symbol", "")
            meta = SYMBOLS.get(symbol, {"name": symbol, "label": symbol})
            quotes.append({
                "symbol": symbol,
                "name": meta["name"],
                "label": meta["label"],
                "price": r.get("regularMarketPrice"),
                "change": r.get("regularMarketChange"),
                "changePercent": r.get("regularMarketChangePercent"),
                "previousClose": r.get("regularMarketPreviousClose"),
            })

        # Preserve declaration order
        order = list(SYMBOLS.keys())
        quotes.sort(key=lambda q: order.index(q["symbol"]) if q["symbol"] in order else 99)
        return {"quotes": quotes}

    except Exception as e:
        logger.warning(f"Failed to fetch market quotes: {e}")
        return {
            "quotes": [
                {
                    "symbol": s,
                    "name": SYMBOLS[s]["name"],
                    "label": SYMBOLS[s]["label"],
                    "price": None,
                    "change": None,
                    "changePercent": None,
                    "previousClose": None,
                }
                for s in SYMBOLS
            ]
        }
