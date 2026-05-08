"""FastAPI entrypoint.

Run from the backend/ directory:

    uvicorn api.main:app --reload --port 8000

Auto-generated OpenAPI playground: http://localhost:8000/docs
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import CORS_ORIGINS
from shared.schemas import (
    AgentResponse,
    Incident,
    RCA,
    RetrievalResult,
    Severity,
    TraceStep,
)

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


# ---------------------------------------------------------------------------
# Incident analysis (mocked until the agent is wired in)
# ---------------------------------------------------------------------------

def _mock_response(incident: Incident) -> AgentResponse:
    """Hardcoded response so the frontend has a real endpoint to hit on day one.

    The agent owner will replace this with a call into the LangGraph workflow.
    """
    similar = [
        RetrievalResult(
            incident=Incident(
                id="HIST-0042",
                title="payments-api 5xx spike on checkout",
                description=(
                    "Elevated 5xx rate on /v1/charges starting 03:14 UTC, "
                    "correlated with a deploy of v1.18.2 ten minutes prior."
                ),
                severity="P1",
                service="payments-api",
                tags=["5xx", "deploy", "regression"],
                created_at=datetime(2026, 4, 12, 3, 24, tzinfo=timezone.utc),
                resolution=(
                    "Rolled back to v1.18.1 via the deploy console. "
                    "Error rate returned to baseline within 4 minutes."
                ),
                rca_summary=(
                    "A new feature flag default unintentionally enabled an "
                    "unfinished retry path that returned 500 on cache miss."
                ),
            ),
            similarity=0.84,
        ),
        RetrievalResult(
            incident=Incident(
                id="HIST-0119",
                title="Connection pool exhausted on payments-api",
                description=(
                    "p99 latency jumped from 180ms to 4s; pool waits visible "
                    "in metrics. No deploy in the previous 4 hours."
                ),
                severity="P2",
                service="payments-api",
                tags=["latency", "db", "connection-pool"],
                created_at=datetime(2026, 3, 28, 11, 5, tzinfo=timezone.utc),
                resolution=(
                    "Increased pool size from 20 to 50 and added a circuit "
                    "breaker around the slow downstream call."
                ),
                rca_summary=(
                    "An upstream traffic surge combined with a slow downstream "
                    "service caused pool starvation."
                ),
            ),
            similarity=0.71,
        ),
    ]

    suggested_steps = [
        "Check the deploy timeline for payments-api in the last 30 minutes; "
        "if a recent deploy correlates with the alert, roll back as the first action.",
        "Inspect /v1/charges error logs for the 5xx response bodies — group by "
        "stack trace prefix to spot the dominant failure mode.",
        "Verify connection pool saturation and downstream latency dashboards "
        "before assuming the fix is in payments-api itself.",
        "If a rollback resolves the issue, file a follow-up bug to investigate "
        "the regression in v1.18.2 before re-deploying.",
    ]

    rca = RCA(
        summary=(
            "Payments-api returned elevated 5xx errors after a recent deploy. "
            "Most likely a regression similar to the v1.18.2 incident."
        ),
        root_cause=(
            "Likely a recent code change in the payments-api request path; "
            "exact line not yet identified — this is a tentative RCA."
        ),
        contributing_factors=[
            "Deploy occurred during peak traffic window.",
            "No automated canary stage for this service.",
        ],
        timeline=[
            f"{incident.created_at.isoformat()} — incident reported by user",
            "T+? — engineer pastes ticket into copilot",
            "T+? — copilot suggests rollback as first action",
        ],
        preventive_actions=[
            "Add a canary deployment stage for payments-api.",
            "Block deploys during the peak traffic window without explicit override.",
            "Add a synthetic check on /v1/charges that fails the deploy if 5xx > 0.5%.",
        ],
    )

    return AgentResponse(
        summary=(
            f"P{incident.severity[-1]} on {incident.service}: {incident.title}. "
            "Two similar incidents found in the knowledge base; most likely a "
            "deploy-related regression."
        ),
        similar_incidents=similar,
        suggested_steps=suggested_steps,
        rca=rca,
        confidence=0.62,
        trace=[
            TraceStep(step="summarize", detail="Llama 3.1 8B, 1 call"),
            TraceStep(step="retrieve", detail="Chroma top-k=5, 2 above threshold"),
            TraceStep(step="suggest", detail="Llama 3.1 8B, 1 call"),
            TraceStep(step="rca", detail="Llama 3.1 8B, structured output"),
            TraceStep(
                step="MOCKED",
                detail="This response is hardcoded. Agent owner: wire real graph here.",
            ),
        ],
    )


@app.post(
    "/api/incident/analyze",
    response_model=AgentResponse,
    tags=["incidents"],
    summary="Analyze a new incident: summarize, retrieve similar, suggest steps, generate RCA.",
)
def analyze_incident(incident: Incident) -> AgentResponse:
    # TODO(agent-team): replace with `from agent.graph import run_agent; return run_agent(incident)`
    return _mock_response(incident)
