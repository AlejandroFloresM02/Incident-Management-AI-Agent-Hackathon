"""FastAPI entrypoint.

Run from the backend/ directory:

    uvicorn api.main:app --reload --port 8000

Auto-generated OpenAPI playground: http://localhost:8000/docs
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agent import run_agent
from shared.config import CORS_ORIGINS
from shared.schemas import AgentResponse, CorpusQuality, Incident

app = FastAPI(
    title="Incident Management AI Copilot",
    description=(
        "Local-first copilot that summarizes, retrieves similar past "
        "incidents, suggests resolution steps, and generates an RCA."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}


@app.post(
    "/api/incident/analyze",
    response_model=AgentResponse,
    tags=["incidents"],
    summary="Analyze a new incident: summarize, retrieve similar, suggest steps, generate RCA.",
)
async def analyze_incident(incident: Incident) -> AgentResponse:
    return await run_agent(incident)


@app.get(
    "/api/vectorstore/quality",
    response_model=CorpusQuality,
    tags=["vectorstore"],
    summary="Aggregate data-quality scores for the ingested incident corpus.",
)
async def vectorstore_quality() -> CorpusQuality:
    # Imported lazily so a Chroma misconfiguration doesn't break /api/health.
    from vectorstore import corpus_quality

    return corpus_quality()
