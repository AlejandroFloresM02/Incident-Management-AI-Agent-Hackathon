"""Top-level vectorstore seam.

Exposes a module-level `search(query, k)` function the agent imports as
`vectorstore.search`. Wraps a lazily initialized `IncidentVectorStore`
singleton and auto-ingests `incidents.jsonl` the first time the
collection is empty so a fresh checkout works without a manual setup
step.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from shared.schemas import RetrievalResult

from .vector_store import IncidentVectorStore

logger = logging.getLogger(__name__)

_INCIDENTS_JSONL = Path(__file__).parent / "incidents.jsonl"
_singleton: Optional[IncidentVectorStore] = None


def _get_store() -> IncidentVectorStore:
    global _singleton
    if _singleton is not None:
        return _singleton

    store = IncidentVectorStore()
    try:
        count = store._chroma_store._collection.count()
    except Exception:
        count = 0

    if count == 0 and _INCIDENTS_JSONL.exists():
        logger.info(
            "Vector collection is empty; ingesting %s on first use.", _INCIDENTS_JSONL
        )
        store.ingest(str(_INCIDENTS_JSONL))

    _singleton = store
    return _singleton


def search(query: str, k: int = 5) -> list[RetrievalResult]:
    """Similarity-search historical incidents. Returns up to k results."""
    return _get_store().search(query, k=k)


__all__ = ["search", "IncidentVectorStore"]
