import json
import logging
from datetime import datetime
from typing import Any, Optional

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = "data/macrolens.db"

CREATE_NEWS_ITEMS = """
CREATE TABLE IF NOT EXISTS news_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT NOT NULL,
    image_url TEXT,
    published_at TEXT,
    fetched_at TEXT NOT NULL,
    content_hash TEXT NOT NULL UNIQUE,
    analysis_status TEXT DEFAULT 'pending',
    analysis_attempts INTEGER DEFAULT 0,
    analysis_error TEXT DEFAULT ''
)
"""

CREATE_ANALYSES = """
CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id INTEGER NOT NULL REFERENCES news_items(id),
    title_zh TEXT DEFAULT '',
    headline_summary TEXT DEFAULT '',
    overall_sentiment INTEGER NOT NULL,
    classification TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    affected_stocks TEXT NOT NULL DEFAULT '[]',
    affected_sectors TEXT NOT NULL DEFAULT '[]',
    affected_commodities TEXT NOT NULL DEFAULT '[]',
    logic_chain TEXT NOT NULL,
    key_factors TEXT NOT NULL DEFAULT '[]',
    llm_provider TEXT NOT NULL,
    llm_model TEXT NOT NULL,
    analyzed_at TEXT NOT NULL,
    UNIQUE(news_id)
)
"""

CREATE_X_SENTIMENTS = """
CREATE TABLE IF NOT EXISTS x_sentiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    trending_tickers TEXT NOT NULL DEFAULT '[]',
    retail_sentiment_score INTEGER NOT NULL,
    key_narratives TEXT NOT NULL DEFAULT '[]',
    meme_stocks TEXT NOT NULL DEFAULT '[]',
    raw_analysis TEXT NOT NULL,
    fear_greed_estimate INTEGER DEFAULT 50,
    analyzed_at TEXT NOT NULL
)
"""

CREATE_SETTINGS = """
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
)
"""


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db() -> None:
    logger.info("Initializing database tables...")
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_NEWS_ITEMS)
        await db.execute(CREATE_ANALYSES)
        await db.execute(CREATE_X_SENTIMENTS)
        await db.execute(CREATE_SETTINGS)
        # Migrate existing tables: add analysis status columns if missing
        for col, definition in [
            ("analysis_status", "TEXT DEFAULT 'pending'"),
            ("analysis_attempts", "INTEGER DEFAULT 0"),
            ("analysis_error", "TEXT DEFAULT ''"),
        ]:
            try:
                await db.execute(f"ALTER TABLE news_items ADD COLUMN {col} {definition}")
            except Exception:
                pass  # Column already exists
        # Migration: add title_zh to analyses
        try:
            await db.execute("ALTER TABLE analyses ADD COLUMN title_zh TEXT DEFAULT ''")
        except Exception:
            pass  # Column already exists
        await db.commit()
    logger.info("Database tables initialized successfully")


def row_to_dict(row: aiosqlite.Row) -> dict:
    return dict(row)


def parse_json_fields(d: dict, fields: list[str]) -> dict:
    for field in fields:
        if field in d and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except (json.JSONDecodeError, TypeError):
                d[field] = []
    return d


# --- news_items ---

async def insert_news_item(db: aiosqlite.Connection, item: dict) -> Optional[int]:
    try:
        cursor = await db.execute(
            """INSERT INTO news_items (source, title, summary, url, image_url, published_at, fetched_at, content_hash)
               VALUES (:source, :title, :summary, :url, :image_url, :published_at, :fetched_at, :content_hash)""",
            item,
        )
        await db.commit()
        return cursor.lastrowid
    except aiosqlite.IntegrityError:
        return None  # duplicate


async def get_news_items(
    db: aiosqlite.Connection,
    page: int = 1,
    page_size: int = 20,
    source: Optional[str] = None,
) -> tuple[int, list[dict]]:
    offset = (page - 1) * page_size
    where = "WHERE source = ?" if source else ""
    params_count: list[Any] = [source] if source else []
    params_list: list[Any] = [source] if source else []
    params_list += [page_size, offset]

    async with db.execute(f"SELECT COUNT(*) FROM news_items {where}", params_count) as cur:
        row = await cur.fetchone()
        total = row[0] if row else 0

    # Major news: |sentiment| >= 50 AND confidence >= 70 AND published within 4 hours => pinned
    from datetime import datetime, timedelta, timezone
    pin_cutoff = (datetime.now(timezone.utc) - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%S")

    async with db.execute(
        f"""SELECT n.*, 
            a.id as analysis_id, a.title_zh, a.headline_summary, a.overall_sentiment, a.classification, 
            a.confidence, a.affected_stocks, a.affected_sectors, a.affected_commodities,
            a.logic_chain, a.key_factors, a.llm_provider, a.llm_model, a.analyzed_at,
            CASE 
                WHEN a.id IS NOT NULL 
                     AND ABS(a.overall_sentiment) >= 50 
                     AND a.confidence >= 70 
                     AND n.published_at >= ?
                THEN 1 ELSE 0 
            END as is_pinned
        FROM news_items n
        LEFT JOIN analyses a ON a.news_id = n.id
        {where} ORDER BY is_pinned DESC, n.published_at DESC LIMIT ? OFFSET ?""",
        [pin_cutoff] + params_list,
    ) as cur:
        rows = await cur.fetchall()

    items = []
    for r in rows:
        d = row_to_dict(r)
        pinned = bool(d.pop("is_pinned", 0))
        # Extract analysis fields into nested object
        if d.get("analysis_id"):
            analysis = {
                "id": d.pop("analysis_id"),
                "news_id": d["id"],
                "title_zh": d.pop("title_zh", ""),
                "headline_summary": d.pop("headline_summary", ""),
                "overall_sentiment": d.pop("overall_sentiment", 0),
                "classification": d.pop("classification", "neutral"),
                "confidence": d.pop("confidence", 0),
                "affected_stocks": d.pop("affected_stocks", "[]"),
                "affected_sectors": d.pop("affected_sectors", "[]"),
                "affected_commodities": d.pop("affected_commodities", "[]"),
                "logic_chain": d.pop("logic_chain", ""),
                "key_factors": d.pop("key_factors", "[]"),
                "llm_provider": d.pop("llm_provider", ""),
                "llm_model": d.pop("llm_model", ""),
                "analyzed_at": d.pop("analyzed_at", ""),
            }
            parse_json_fields(analysis, ["affected_stocks", "affected_sectors", "affected_commodities", "key_factors"])
            d["analysis"] = analysis
        else:
            # Remove None analysis columns
            for k in ["analysis_id", "title_zh", "headline_summary", "overall_sentiment", "classification",
                       "confidence", "affected_stocks", "affected_sectors", "affected_commodities",
                       "logic_chain", "key_factors", "llm_provider", "llm_model", "analyzed_at"]:
                d.pop(k, None)
            d["analysis"] = None
        d["is_pinned"] = pinned
        items.append(d)
    return total, items


async def get_news_item_by_id(db: aiosqlite.Connection, news_id: int) -> Optional[dict]:
    async with db.execute("SELECT * FROM news_items WHERE id = ?", (news_id,)) as cur:
        row = await cur.fetchone()
    return row_to_dict(row) if row else None


MAX_ANALYZABLE = 50  # Only analyze the 50 most recent news items

async def skip_old_news(db: aiosqlite.Connection) -> int:
    """Mark news outside the top-50 window as 'skipped' to save LLM tokens."""
    cursor = await db.execute(
        """UPDATE news_items SET analysis_status = 'skipped'
           WHERE analysis_status = 'pending'
           AND id NOT IN (
               SELECT id FROM news_items ORDER BY published_at DESC LIMIT ?
           )""",
        (MAX_ANALYZABLE,),
    )
    await db.commit()
    return cursor.rowcount

async def get_unanalyzed_news(db: aiosqlite.Connection, limit: int = 5) -> list[dict]:
    # First skip any old news outside the analysis window
    skipped = await skip_old_news(db)
    if skipped:
        logger.info(f"Skipped {skipped} old news items (outside top-{MAX_ANALYZABLE} window)")

    async with db.execute(
        "SELECT * FROM news_items WHERE analysis_status = 'pending' ORDER BY published_at DESC LIMIT ?",
        (limit,),
    ) as cur:
        rows = await cur.fetchall()
    return [row_to_dict(r) for r in rows]


async def claim_news_for_analysis(db: aiosqlite.Connection, news_id: int) -> bool:
    """Mark a news item as 'processing' to prevent duplicate LLM calls. Returns True if claim succeeded."""
    cursor = await db.execute(
        "UPDATE news_items SET analysis_status = 'processing', analysis_attempts = analysis_attempts + 1 WHERE id = ? AND analysis_status IN ('pending', 'failed')",
        (news_id,),
    )
    await db.commit()
    return cursor.rowcount > 0


async def mark_analysis_completed(db: aiosqlite.Connection, news_id: int) -> None:
    await db.execute("UPDATE news_items SET analysis_status = 'completed' WHERE id = ?", (news_id,))
    await db.commit()


async def mark_analysis_failed(db: aiosqlite.Connection, news_id: int, error: str) -> None:
    await db.execute(
        "UPDATE news_items SET analysis_status = CASE WHEN analysis_attempts >= 3 THEN 'failed' ELSE 'pending' END, analysis_error = ? WHERE id = ?",
        (error[:500], news_id),
    )
    await db.commit()


# --- analyses ---

async def insert_analysis(db: aiosqlite.Connection, analysis: dict) -> int:
    cursor = await db.execute(
        """INSERT OR IGNORE INTO analyses
           (news_id, title_zh, headline_summary, overall_sentiment, classification, confidence, affected_stocks,
            affected_sectors, affected_commodities, logic_chain, key_factors,
            llm_provider, llm_model, analyzed_at)
           VALUES (:news_id, :title_zh, :headline_summary, :overall_sentiment, :classification, :confidence,
                   :affected_stocks, :affected_sectors, :affected_commodities,
                   :logic_chain, :key_factors, :llm_provider, :llm_model, :analyzed_at)""",
        analysis,
    )
    await db.commit()
    return cursor.lastrowid


async def get_analyses(
    db: aiosqlite.Connection,
    page: int = 1,
    page_size: int = 20,
    classification: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> tuple[int, list[dict]]:
    offset = (page - 1) * page_size
    conditions = []
    params: list[Any] = []

    if classification:
        conditions.append("a.classification = ?")
        params.append(classification)
    if date_from:
        conditions.append("a.analyzed_at >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("a.analyzed_at <= ?")
        params.append(date_to)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    async with db.execute(
        f"SELECT COUNT(*) FROM analyses a {where}", params
    ) as cur:
        row = await cur.fetchone()
        total = row[0] if row else 0

    async with db.execute(
        f"""SELECT a.*, n.title as news_title, n.source as news_source, n.url as news_url
            FROM analyses a
            JOIN news_items n ON n.id = a.news_id
            {where}
            ORDER BY a.analyzed_at DESC
            LIMIT ? OFFSET ?""",
        params + [page_size, offset],
    ) as cur:
        rows = await cur.fetchall()

    items = [parse_json_fields(row_to_dict(r), ["affected_stocks", "affected_sectors", "affected_commodities", "key_factors"]) for r in rows]
    return total, items


async def get_latest_analyses(db: aiosqlite.Connection, limit: int = 10) -> list[dict]:
    async with db.execute(
        """SELECT a.*, n.title as news_title, n.source as news_source, n.url as news_url
           FROM analyses a
           JOIN news_items n ON n.id = a.news_id
           ORDER BY a.analyzed_at DESC
           LIMIT ?""",
        (limit,),
    ) as cur:
        rows = await cur.fetchall()
    return [parse_json_fields(row_to_dict(r), ["affected_stocks", "affected_sectors", "affected_commodities", "key_factors"]) for r in rows]


async def get_analysis_for_news(db: aiosqlite.Connection, news_id: int) -> Optional[dict]:
    async with db.execute(
        "SELECT * FROM analyses WHERE news_id = ?", (news_id,)
    ) as cur:
        row = await cur.fetchone()
    if not row:
        return None
    return parse_json_fields(row_to_dict(row), ["affected_stocks", "affected_sectors", "affected_commodities", "key_factors"])


async def get_analysis_stats(db: aiosqlite.Connection) -> dict:
    async with db.execute(
        """SELECT
               COUNT(*) as total,
               AVG(overall_sentiment) as avg_sentiment,
               SUM(CASE WHEN classification='bullish' THEN 1 ELSE 0 END) as bullish,
               SUM(CASE WHEN classification='bearish' THEN 1 ELSE 0 END) as bearish,
               SUM(CASE WHEN classification='neutral' THEN 1 ELSE 0 END) as neutral
           FROM analyses"""
    ) as cur:
        row = await cur.fetchone()
    stats = row_to_dict(row) if row else {}

    # Sector breakdown
    async with db.execute("SELECT affected_sectors FROM analyses") as cur:
        rows = await cur.fetchall()

    sector_counts: dict[str, int] = {}
    for r in rows:
        sectors = json.loads(r[0]) if r[0] else []
        for s in sectors:
            sector_counts[s] = sector_counts.get(s, 0) + 1

    # Top stocks
    async with db.execute("SELECT affected_stocks FROM analyses") as cur:
        rows = await cur.fetchall()

    stock_scores: dict[str, list[int]] = {}
    for r in rows:
        stocks = json.loads(r[0]) if r[0] else []
        for s in stocks:
            ticker = s.get("ticker", "")
            if ticker:
                stock_scores.setdefault(ticker, []).append(s.get("impact_score", 0))

    top_stocks = sorted(
        [{"ticker": t, "avg_impact": sum(v) / len(v), "mention_count": len(v)} for t, v in stock_scores.items()],
        key=lambda x: x["mention_count"],
        reverse=True,
    )[:10]

    async with db.execute(
        "SELECT COUNT(*) FROM news_items WHERE analysis_status IN ('pending', 'processing')"
    ) as cur:
        row = await cur.fetchone()
        pending_count = row[0] if row else 0

    return {
        "total_analyzed": stats.get("total", 0) or 0,
        "avg_sentiment": round(stats.get("avg_sentiment") or 0, 2),
        "bullish_count": stats.get("bullish", 0) or 0,
        "bearish_count": stats.get("bearish", 0) or 0,
        "neutral_count": stats.get("neutral", 0) or 0,
        "pending_count": pending_count,
        "sector_breakdown": sector_counts,
        "top_affected_stocks": top_stocks,
    }


# --- x_sentiments ---

async def insert_x_sentiment(db: aiosqlite.Connection, sentiment: dict) -> int:
    cursor = await db.execute(
        """INSERT INTO x_sentiments
           (query, trending_tickers, retail_sentiment_score, key_narratives, meme_stocks, raw_analysis, fear_greed_estimate, analyzed_at)
           VALUES (:query, :trending_tickers, :retail_sentiment_score, :key_narratives, :meme_stocks, :raw_analysis, :fear_greed_estimate, :analyzed_at)""",
        sentiment,
    )
    await db.commit()
    return cursor.lastrowid


async def get_latest_x_sentiment(db: aiosqlite.Connection) -> Optional[dict]:
    async with db.execute(
        "SELECT * FROM x_sentiments ORDER BY analyzed_at DESC LIMIT 1"
    ) as cur:
        row = await cur.fetchone()
    if not row:
        return None
    return parse_json_fields(row_to_dict(row), ["trending_tickers", "key_narratives", "meme_stocks"])


async def get_x_sentiment_history(
    db: aiosqlite.Connection, page: int = 1, page_size: int = 20
) -> tuple[int, list[dict]]:
    offset = (page - 1) * page_size

    async with db.execute("SELECT COUNT(*) FROM x_sentiments") as cur:
        row = await cur.fetchone()
        total = row[0] if row else 0

    async with db.execute(
        "SELECT * FROM x_sentiments ORDER BY analyzed_at DESC LIMIT ? OFFSET ?",
        (page_size, offset),
    ) as cur:
        rows = await cur.fetchall()

    items = [parse_json_fields(row_to_dict(r), ["trending_tickers", "key_narratives", "meme_stocks"]) for r in rows]
    return total, items


# --- settings ---

async def get_setting(db: aiosqlite.Connection, key: str) -> Optional[Any]:
    async with db.execute("SELECT value FROM settings WHERE key = ?", (key,)) as cur:
        row = await cur.fetchone()
    if not row:
        return None
    try:
        return json.loads(row[0])
    except (json.JSONDecodeError, TypeError):
        return row[0]


async def set_setting(db: aiosqlite.Connection, key: str, value: Any) -> None:
    serialized = json.dumps(value)
    await db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, serialized),
    )
    await db.commit()


async def get_all_settings(db: aiosqlite.Connection) -> dict[str, Any]:
    async with db.execute("SELECT key, value FROM settings") as cur:
        rows = await cur.fetchall()
    result = {}
    for row in rows:
        try:
            result[row[0]] = json.loads(row[1])
        except (json.JSONDecodeError, TypeError):
            result[row[0]] = row[1]
    return result
