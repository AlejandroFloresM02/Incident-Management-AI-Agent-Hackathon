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
    resolved_at: Optional[datetime] = None
    # Only present on historical incidents (in the vector store)
    resolution: Optional[str] = None
    rca_summary: Optional[str] = None
    requires_human_approval: bool = False


class SourceQuality(BaseModel):
    """Per-record quality of an incident in the vector store.

    Measures whether the stored record is worth learning from — independent
    of how similar it is to any query. A retrieved chunk is only useful for
    solving a new incident if BOTH the similarity and the source quality
    are high.
    """

    score: float = Field(
        ge=0.0,
        le=1.0,
        description="Composite source-quality score in [0, 1]. Weighted blend of "
        "resolution_completeness, clarity, and accuracy_heuristic.",
    )
    resolution_completeness: float = Field(
        ge=0.0,
        le=1.0,
        description="Are the fields we'd actually use to solve a new incident "
        "(resolution, rca_summary, tags) populated and non-trivial?",
    )
    clarity: float = Field(
        ge=0.0,
        le=1.0,
        description="Readability heuristic: description length in a sensible range, "
        "RCA contains sentence structure, title is not a single token.",
    )
    accuracy_heuristic: float = Field(
        ge=0.0,
        le=1.0,
        description="Share of plausibility checks passed: timestamp ordering, "
        "valid severity, at least one tag token appears in description, "
        "rca_summary present when resolution present.",
    )
    notes: str = Field(
        default="",
        description="Human-readable summary of which checks fired, for UI tooltips.",
    )


class RetrievalResult(BaseModel):
    """One similar past incident retrieved from the vector store."""

    incident: Incident
    similarity: float = Field(
        ge=0.0,
        le=1.0,
        description="Cosine similarity score in [0, 1]. Higher = more similar.",
    )
    source_quality: Optional[SourceQuality] = Field(
        default=None,
        description="Quality of the stored record itself. Independent of similarity.",
    )
    trust: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Composite confidence that THIS retrieved record is useful for "
        "solving the new incident. trust = similarity * source_quality.score. "
        "Surfaces the failure mode where a sparse record happens to text-match.",
    )
    warning: Optional[str] = Field(
        default=None,
        description="Set when similarity is high but source_quality is low — the "
        "engineer should be cautioned that the precedent looks similar on the "
        "surface but has little usable content to draw on.",
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


class MetricScore(BaseModel):
    """One named quality dimension in the corpus dashboard."""

    name: str
    score: float = Field(
        ge=0.0,
        le=1.0,
        description="Aggregate score in [0, 1]. Higher is better.",
    )
    description: str = Field(
        description="One-sentence plain-English explanation of what this measures."
    )
    detail: str = Field(
        default="",
        description="Concrete breakdown to show under the score (e.g. '12 of 50 "
        "records missing rca_summary').",
    )


class QualityDistribution(BaseModel):
    """Count of records bucketed by their per-record source-quality score.

    Buckets follow the same thresholds the UI uses for the inline 'trust'
    chips: high >= 0.7, medium in [0.4, 0.7), low < 0.4.
    """

    high: int = Field(ge=0, description="Records with source_quality.score >= 0.70")
    medium: int = Field(ge=0, description="Records with score in [0.40, 0.70)")
    low: int = Field(ge=0, description="Records with score < 0.40")
    total: int = Field(ge=0, description="Sum of the three buckets.")


class CorpusQuality(BaseModel):
    """Aggregate quality of the entire incident corpus in the vector store.

    Returned by GET /api/vectorstore/quality. All metrics are computed in
    pure Python from record metadata — no LLM calls — so the dashboard is
    fast and deterministic.
    """

    record_count: int = Field(description="Total incidents in the collection.")
    source_quality_distribution: QualityDistribution = Field(
        description="Per-record count of incidents bucketed by their overall "
        "source-quality score. This is the headline 'how much of our corpus "
        "is degraded?' number — surfaces variance the aggregate scores hide."
    )
    completeness: MetricScore
    accuracy_heuristic: MetricScore = Field(
        description="Plausibility checks only. Real accuracy requires labeled "
        "ground truth we do not have."
    )
    consistency: MetricScore
    timeliness: MetricScore
    relevance_clarity: MetricScore
    retrieval_readiness: MetricScore = Field(
        description="Share of records whose resolution-relevant fields "
        "(resolution, rca_summary) are populated. Predicts whether the system "
        "can produce useful suggestions regardless of any specific query."
    )


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
