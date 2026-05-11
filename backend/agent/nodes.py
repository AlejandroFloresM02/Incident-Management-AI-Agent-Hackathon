from __future__ import annotations

import asyncio
import re
from importlib import import_module
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, Field

from shared.schemas import RCA, RetrievalResult, TraceStep

from .llm import get_llm
from .prompts import RCA_PROMPT, SUGGEST_PROMPT, SUMMARIZE_PROMPT

if TYPE_CHECKING:
    from .graph import AgentState


SIMILARITY_THRESHOLD = 0.5
RETRIEVAL_K = 5


def _incident_text(state: "AgentState") -> str:
    return state["incident"].model_dump_json(indent=2)


def _message_text(message: Any) -> str:
    content = getattr(message, "content", message)
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts).strip()
    return str(content).strip()


_TEMPLATE_TOKEN_RE = re.compile(r"<\|[^|>]*\|>")
_CODE_FENCE_RE = re.compile(r"^\s*```[a-zA-Z0-9]*\s*$", re.MULTILINE)


def _clean_llm_text(text: str) -> str:
    """Strip chat-template tokens (e.g. <|im_start|>) and code-fence wrapper lines."""
    if not text:
        return ""
    cleaned = _TEMPLATE_TOKEN_RE.sub("", text)
    cleaned = _CODE_FENCE_RE.sub("", cleaned)
    return "\n".join(line.rstrip() for line in cleaned.splitlines()).strip()


def _format_similar_incidents(results: list[RetrievalResult]) -> str:
    if not results:
        return "No similar incidents were retrieved."

    formatted: list[str] = []
    for index, result in enumerate(results, start=1):
        incident = result.incident
        # Surface the trust signal to the LLM so it can weight reasoning
        # derived from sparse precedents lower. Trust = similarity ×
        # source_quality; a warning fires when text match is high but the
        # source record is sparse.
        if result.warning:
            reliability = (
                f"LOW (trust {result.trust:.2f}) — {result.warning} "
                "Treat any reasoning derived from this record as weak; "
                "hedge accordingly."
            )
        else:
            reliability = f"trust {result.trust:.2f}"
        formatted.append(
            "\n".join(
                [
                    f"{index}. {incident.id} (similarity {result.similarity:.2f})",
                    f"Reliability: {reliability}",
                    f"Title: {incident.title}",
                    f"Service: {incident.service}",
                    f"Severity: {incident.severity}",
                    f"Description: {incident.description}",
                    f"Resolution: {incident.resolution or 'Not available'}",
                    f"RCA summary: {incident.rca_summary or 'Not available'}",
                ]
            )
        )
    return "\n\n".join(formatted)


def _parse_steps(text: str) -> list[str]:
    steps: list[str] = []
    for line in text.splitlines():
        cleaned = line.strip()
        if not cleaned:
            continue
        cleaned = cleaned.lstrip("-* ")
        if ". " in cleaned[:5]:
            cleaned = cleaned.split(". ", 1)[1].strip()
        if cleaned:
            steps.append(cleaned)
    return steps[:5]


def _search_function():
    try:
        module = import_module("vectorstore.search")
        return getattr(module, "search")
    except (ImportError, AttributeError):
        module = import_module("vectorstore")
        return getattr(module, "search")


def _coerce_retrieval_results(raw_results: Any) -> list[RetrievalResult]:
    results: list[RetrievalResult] = []
    for raw in raw_results or []:
        if isinstance(raw, RetrievalResult):
            result = raw
        else:
            result = RetrievalResult.model_validate(raw)
        if result.similarity >= SIMILARITY_THRESHOLD:
            results.append(result)
    return results[:RETRIEVAL_K]


def _ensure_rca_fields(rca_result: RCA, state: "AgentState") -> RCA:
    incident = state["incident"]
    if not rca_result.summary.strip():
        rca_result.summary = (
            f"{incident.severity} incident on {incident.service}: {incident.title}"
        )
    if not rca_result.root_cause.strip():
        rca_result.root_cause = (
            "Root cause is not confirmed from the available incident evidence."
        )
    if not rca_result.contributing_factors:
        rca_result.contributing_factors = [
            "Insufficient confirmed evidence to identify contributing factors."
        ]
    if not rca_result.timeline:
        rca_result.timeline = [
            f"{incident.created_at.isoformat()} - incident reported to the copilot."
        ]
    if not rca_result.preventive_actions:
        rca_result.preventive_actions = [
            "Review the incident evidence and add preventive actions after the fix is confirmed."
        ]
    return rca_result


class _IncidentSummary(BaseModel):
    summary: str = Field(
        description="2-4 sentence plain-prose summary of the incident for an on-call engineer."
    )


async def summarize(state: "AgentState") -> dict:
    detail = "Generated incident summary with one LLM call."
    summary = ""
    try:
        chain = SUMMARIZE_PROMPT | get_llm().with_structured_output(_IncidentSummary)
        result = await chain.ainvoke({"incident": _incident_text(state)})
        if not isinstance(result, _IncidentSummary):
            result = _IncidentSummary.model_validate(result)
        summary = _clean_llm_text(result.summary)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        detail = (
            "Structured summary generation failed; using deterministic fallback. "
            f"Reason: {type(exc).__name__}: {exc}"
        )

    if not summary:
        summary = (
            f"{state['incident'].severity} incident on "
            f"{state['incident'].service}: {state['incident'].title}"
        )

    return {
        "summary": summary,
        "trace": [TraceStep(step="summarize", detail=detail)],
    }


async def retrieve(state: "AgentState") -> dict:
    incident = state["incident"]
    query = f"{incident.title}\n{incident.description}"

    try:
        search = _search_function()
        raw_results = await asyncio.to_thread(search, query, RETRIEVAL_K)
        results = _coerce_retrieval_results(raw_results)
        detail = (
            f"Vectorstore search returned {len(results)} incidents above "
            f"similarity threshold {SIMILARITY_THRESHOLD}."
        )
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        results = []
        detail = (
            "Vectorstore unavailable or search failed; continuing without "
            f"retrieved incidents. Reason: {type(exc).__name__}: {exc}"
        )

    return {
        "similar_incidents": results,
        "trace": [TraceStep(step="retrieve", detail=detail)],
    }


async def suggest(state: "AgentState") -> dict:
    similar_incidents = state.get("similar_incidents", [])
    if not similar_incidents:
        return {
            "suggested_steps": [
                "Confirm current customer impact, affected region, and error budget burn before taking action.",
                "Check recent deploys, configuration changes, and dependency health for the affected service.",
                "Mitigate the highest-confidence cause first, then capture evidence and hand off follow-up fixes.",
            ],
            "trace": [
                TraceStep(
                    step="suggest",
                    detail="No retrieved incidents available; returned a generic incident response playbook.",
                )
            ],
        }

    chain = SUGGEST_PROMPT | get_llm()
    response = await chain.ainvoke(
        {
            "incident": _incident_text(state),
            "similar_incidents": _format_similar_incidents(similar_incidents),
        }
    )
    steps = _parse_steps(_clean_llm_text(_message_text(response)))
    if len(steps) < 3:
        steps.extend(
            [
                "Validate the active alert symptoms against logs and dashboards for the affected service.",
                "Use the most similar historical resolution as a candidate mitigation, but verify it fits current evidence.",
                "Document the action taken and create follow-up work for any recurring failure mode.",
            ]
        )
        steps = steps[:3]

    return {
        "suggested_steps": steps,
        "trace": [
            TraceStep(
                step="suggest",
                detail="Generated suggested steps grounded in retrieved incidents.",
            )
        ],
    }


async def rca(state: "AgentState") -> dict:
    incident = state["incident"]
    try:
        chain = RCA_PROMPT | get_llm().with_structured_output(RCA)
        rca_result = await chain.ainvoke(
            {
                "incident": _incident_text(state),
                "similar_incidents": _format_similar_incidents(
                    state.get("similar_incidents", [])
                ),
            }
        )
        if not isinstance(rca_result, RCA):
            rca_result = RCA.model_validate(rca_result)
        rca_result = _ensure_rca_fields(rca_result, state)
        detail = "Generated structured RCA with one LLM call."
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        rca_result = RCA(
            summary="Unable to produce structured RCA",
            root_cause=(
                "The agent could not produce a validated structured RCA from the available evidence."
            ),
            contributing_factors=[
                "Structured RCA generation failed; human review is required."
            ],
            timeline=[
                f"{incident.created_at.isoformat()} - incident reported to the copilot."
            ],
            preventive_actions=[
                "Have an on-call engineer review the incident details and create follow-up actions manually."
            ],
        )
        detail = (
            "Structured RCA generation failed; returned a minimal valid RCA and "
            f"confidence should be treated as low. Reason: {type(exc).__name__}: {exc}"
        )

    return {
        "rca": rca_result,
        "trace": [TraceStep(step="rca", detail=detail)],
    }


async def finalize(state: "AgentState") -> dict:
    similar_incidents = [
        result
        for result in state.get("similar_incidents", [])
        if result.similarity >= SIMILARITY_THRESHOLD
    ]
    if similar_incidents:
        # Confidence reflects the best retrieved precedent's *usefulness*, not
        # just its text similarity. trust = similarity * source_quality.score,
        # populated upstream in vector_store.search(). This makes the overall
        # confidence drop automatically when retrieval hits sparse records.
        best_trust = max(result.trust for result in similar_incidents)
        best_similarity = max(result.similarity for result in similar_incidents)
        confidence = max(0.2, best_trust)
        detail = (
            f"Assembled final response with {len(similar_incidents)} retrieved "
            f"incidents. Best similarity {best_similarity:.2f}, best trust "
            f"{best_trust:.2f}; confidence reflects trust to penalize sparse "
            f"records."
        )
    else:
        confidence = 0.3
        detail = (
            f"Assembled final response with {len(similar_incidents)} retrieved "
            f"incidents and confidence {confidence:.2f}."
        )

    return {
        "confidence": confidence,
        "trace": [TraceStep(step="finalize", detail=detail)],
    }
