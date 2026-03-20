import hashlib
import re


def _normalize_title(title: str) -> str:
    """Normalize a news title for deduplication."""
    title = title.lower().strip()
    # Remove extra whitespace
    title = re.sub(r"\s+", " ", title)
    # Remove common trailing punctuation
    title = title.rstrip(".,!?;:")
    return title


def compute_content_hash(title: str, url: str = "") -> str:
    """
    Compute a deduplication hash from the normalized title.
    Falls back to URL if title is empty.
    """
    normalized = _normalize_title(title)
    if not normalized and url:
        normalized = url.strip().lower()

    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
