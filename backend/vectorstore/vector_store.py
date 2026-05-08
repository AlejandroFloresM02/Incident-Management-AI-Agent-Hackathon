# vector_store.py
"""
Vector Store Contract:
- ingest(jsonl_path) -> None: Idempotent upsert of historical incidents
- search(query, k) -> List[RetrievalResult]: Similarity search with [0,1] scores

Design Decisions:
1. Idempotency: Uses `id` as Chroma document ID. Re-running ingest upserts existing records.
2. Embedding Text: Problem context only (title + description + tags). Resolution/RCA stored as metadata.
3. Similarity Scoring: Normalizes cosine distance [0, 2] -> [0, 1].
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import List, Literal, Optional

import chromadb
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# INLINE SCHEMAS (Temporary for immediate testing. Revert to backend.shared.schemas later)
# ---------------------------------------------------------------------------
Severity = Literal["P1", "P2", "P3", "P4"]

class Incident(BaseModel):
    id: str
    title: str
    description: str
    severity: Severity
    service: str
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None
    rca_summary: Optional[str] = None
    requires_human_approval: bool = False

class RetrievalResult(BaseModel):
    incident: Incident
    similarity: float = Field(ge=0.0, le=1.0, description="Cosine similarity score in [0, 1].")

logger = logging.getLogger(__name__)

class IncidentVectorStore:
    def __init__(
        self,
        persist_directory: str = "./chroma_incidents",
        collection_name: str = "historical_kb",
        embedding_model: str = "gte-large",
    ):
        self.persist_dir = persist_directory
        self.collection_name = collection_name
        self.embedder = OllamaEmbeddings(model=embedding_model)
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

# ---------------------------------------------------------------------------
# Quick Test Runner
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # 1. Initialize VDB
    vdb = IncidentVectorStore(persist_directory="./chroma_incidents")
    
    # 2. Ingest JSONL (creates/updates the DB)
    if os.path.exists("incidents.jsonl"):
        vdb.ingest("incidents.jsonl")
    else:
        print("⚠️ incidents.jsonl not found. Place your generated file in the same directory.")

    # 3. Test Search
    query = "payment service timing out during traffic spike"
    print(f"\n🔍 Searching: '{query}'")
    results = vdb.search(query, k=2)
    for i, res in enumerate(results, 1):
        print(f"\n#{i} | Similarity: {res.similarity:.3f} | ID: {res.incident.id}")
        print(f"   Title: {res.incident.title}")
        print(f"   Resolution: {res.incident.resolution}")
