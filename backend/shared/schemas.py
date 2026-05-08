"""Cross-team data contracts.

These Pydantic models are the single source of truth for the shape of every
object that crosses a component boundary. Frontend TS types should mirror
these — keep them in sync.

Do not change without team agreement: changes here ripple to the frontend,
the agent, the vector store, and the data generator simultaneously.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Domain primitives
# ---------------------------------------------------------------------------

Severity = Literal["P1", "P2", "P3", "P4"]


class Incident(BaseModel):
    """An incident ticket.

    Used in two places:
    - As input to /api/incident/analyze (resolution and rca_summary will be None)
    - As historical data stored in ChromaDB (resolution and rca_summary populated)
    """

    id: str
    title: str
    description: str
    severity: Severity
    service: str = Field(
        description="The affected service, e.g. 'payments-api', 'checkout-web'."
    )
    tags: List[str] = Field(default_factory=list)
    created_at: datetime

    # Only present on historical incidents (in the vector store)
    resolution: Optional[str] = None
    rca_summary: Optional[str] = None


class RetrievalResult(BaseModel):
    """One similar past incident retrieved from the vector store."""

    incident: Incident
    similarity: float = Field(
        ge=0.0,
        le=1.0,
        description="Cosine similarity score in [0, 1]. Higher = more similar.",
    )


class RCA(BaseModel):
    """Structured Root Cause Analysis. Populated by the rca node of the agent
    using `llm.with_structured_output(RCA)` so the JSON shape is guaranteed."""

    summary: str = Field(description="One-paragraph executive summary of the RCA.")
    root_cause: str = Field(description="The single underlying cause, in 1–2 sentences.")
    contributing_factors: List[str] = Field(
        default_factory=list,
        description="Things that made the incident worse or harder to detect.",
    )
    timeline: List[str] = Field(
        default_factory=list,
        description="Chronological events. Each entry like '08:14 — alert fired'.",
    )
    preventive_actions: List[str] = Field(
        default_factory=list,
        description="Concrete actions to prevent recurrence.",
    )


class TraceStep(BaseModel):
    """One step in the agent's execution, surfaced to the UI for transparency."""

    step: str = Field(description="Node name, e.g. 'summarize', 'retrieve'.")
    detail: str = Field(default="", description="Human-readable detail for the UI.")


class AgentResponse(BaseModel):
    """The full output of POST /api/incident/analyze."""

    summary: str
    similar_incidents: List[RetrievalResult] = Field(default_factory=list)
    suggested_steps: List[str] = Field(default_factory=list)
    rca: RCA
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Self-reported model confidence in [0, 1]. Surface in the UI.",
    )
    trace: List[TraceStep] = Field(
        default_factory=list,
        description="Per-node trace, for the UI's transparency panel.",
    )
