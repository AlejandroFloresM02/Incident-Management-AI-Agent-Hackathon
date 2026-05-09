"""IncidentVectorStore: idempotent upsert + cosine similarity search over Chroma.

Contract:
- ingest(jsonl_path) -> int: upserts historical incidents, returns count.
- search(query, k) -> list[RetrievalResult]: similarity scores normalized to [0, 1].

Embedding text covers problem context only (title + description + tags); resolution
and RCA are stored as metadata so retrieval matches "similar problem" rather than
"similar fix". Distances are converted from cosine [0, 2] to similarity [0, 1].
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List

import chromadb
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings

from shared.config import (
    CHROMA_COLLECTION,
    CHROMA_PERSIST_DIR,
    EMBEDDING_MODEL,
    OLLAMA_BASE_URL,
)
from shared.schemas import Incident, RetrievalResult

logger = logging.getLogger(__name__)

class IncidentVectorStore:
    def __init__(
        self,
        persist_directory: str = CHROMA_PERSIST_DIR,
        collection_name: str = CHROMA_COLLECTION,
        embedding_model: str = EMBEDDING_MODEL,
    ):
        self.persist_dir = persist_directory
        self.collection_name = collection_name
        self.embedder = OllamaEmbeddings(
            model=embedding_model, base_url=OLLAMA_BASE_URL
        )
        self._client, self._chroma_store = self._init_chroma()

    def _init_chroma(self) -> tuple[chromadb.PersistentClient, Chroma]:
        client = chromadb.PersistentClient(path=self.persist_dir)
        collection = client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        store = Chroma(
            client=client,
            collection_name=self.collection_name,
            embedding_function=self.embedder,
        )
        return client, store

    @staticmethod
    def _build_embedding_text(incident: Incident) -> str:
        tags_str = ", ".join(incident.tags) if incident.tags else "none"
        return (
            f"Title: {incident.title}\n"
            f"Description: {incident.description}\n"
            f"Tags: {tags_str}"
        )

    def ingest(self, jsonl_path: str) -> int:
        path = Path(jsonl_path)
        if not path.exists():
            raise FileNotFoundError(f"JSONL not found: {jsonl_path}")

        texts, metadatas, ids = [], [], []

        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line: continue
                data = json.loads(line)
                incident = Incident.model_validate(data)

                texts.append(self._build_embedding_text(incident))
                metadatas.append({
                    "id": incident.id,
                    "title": incident.title,
                    "description": incident.description,
                    "severity": incident.severity,
                    "service": incident.service,
                    "tags": "|".join(incident.tags),
                    "created_at": incident.created_at.isoformat(),
                    "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
                    "resolution": incident.resolution or "",
                    "rca_summary": incident.rca_summary or "",
                    "requires_human_approval": incident.requires_human_approval,
                })
                ids.append(incident.id)

        self._chroma_store.add_texts(
            texts=texts,
            metadatas=metadatas,
            ids=ids,
        )
        logger.info(f"✅ Upserted {len(ids)} incidents into '{self.collection_name}'")
        return len(ids)

    def search(self, query: str, k: int = 5) -> List[RetrievalResult]:
        docs_scores = self._chroma_store.similarity_search_with_score(query, k=k)
        results = []

        for doc, distance in docs_scores:
            similarity = max(0.0, min(1.0, 1.0 - (distance / 2.0)))
            meta = doc.metadata

            incident = Incident(
                id=meta["id"],
                title=meta["title"],
                description=meta["description"],
                severity=meta["severity"],
                service=meta["service"],
                tags=meta["tags"].split("|") if meta.get("tags") else [],
                created_at=datetime.fromisoformat(meta["created_at"].replace("Z", "+00:00")),
                resolved_at=datetime.fromisoformat(meta["resolved_at"].replace("Z", "+00:00")) if meta.get("resolved_at") else None,
                resolution=meta.get("resolution") or None,
                rca_summary=meta.get("rca_summary") or None,
                requires_human_approval=meta.get("requires_human_approval", False),
            )
            results.append(RetrievalResult(incident=incident, similarity=similarity))

        return results

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    vdb = IncidentVectorStore()
    jsonl_path = Path(__file__).parent / "incidents.jsonl"
    if jsonl_path.exists():
        vdb.ingest(str(jsonl_path))
    else:
        print(f"incidents.jsonl not found at {jsonl_path}")

    query = "payment service timing out during traffic spike"
    print(f"\nSearching: {query!r}")
    for i, res in enumerate(vdb.search(query, k=2), 1):
        print(f"#{i} | similarity {res.similarity:.3f} | {res.incident.id}: {res.incident.title}")
        print(f"   resolution: {res.incident.resolution}")
