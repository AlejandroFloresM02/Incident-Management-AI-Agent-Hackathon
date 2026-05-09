"""Single place for environment-driven config.

Loads from .env (via python-dotenv) on import. Defaults match the values in
.env.example so the app runs out of the box if Ollama is set up.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Look for .env in the backend/ directory (one level up from this file)
_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")


# --- Ollama ---------------------------------------------------------------
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.2-3b-it:latest")
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "gte-large:latest")


# --- ChromaDB -------------------------------------------------------------
CHROMA_PERSIST_DIR: str = os.getenv(
    "CHROMA_PERSIST_DIR", str(_BACKEND_DIR / "vectorstore" / "chroma_db")
)
CHROMA_COLLECTION: str = os.getenv("CHROMA_COLLECTION", "incidents")


# --- CORS -----------------------------------------------------------------
CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")
    if o.strip()
]
