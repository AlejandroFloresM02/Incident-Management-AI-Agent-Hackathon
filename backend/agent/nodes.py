from __future__ import annotations

from importlib import import_module
from typing import TYPE_CHECKING, Any

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


def _format_similar_incidents(results: list[RetrievalResult]) -> str:
    if not results:
        return "No similar incidents were retrieved."

    formatted: list[str] = []
    for index, result in enumerate(results, start=1):
        incident = result.incident
        formatted.append(
            "\n".join(
                [
                    f"{index}. {incident.id} ({result.similarity:.2f})",
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


def summarize(state: "AgentState") -> dict:
    chain = SUMMARIZE_PROMPT | get_llm()
    response = chain.invoke({"incident": _incident_text(state)})
    summary = _message_text(response)
    if not summary:
        summary = (
            f"{state['incident'].severity} incident on "
            f"{state['incident'].service}: {state['incident'].title}"
        )

    return {
        "summary": summary,
        "trace": [
            TraceStep(
                step="summarize",
                detail="Generated incident summary with one LLM call.",
            )
        ],
    }


def retrieve(state: "AgentState") -> dict:
    incident = state["incident"]
    query = f"{incident.title}\n{incident.description}"

    try:
        search = _search_function()
        raw_results = search(query, k=RETRIEVAL_K)
        results = _coerce_retrieval_results(raw_results)
        detail = (
            f"Vectorstore search returned {len(results)} incidents above "
            f"similarity threshold {SIMILARITY_THRESHOLD}."
        )
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


def suggest(state: "AgentState") -> dict:
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
    response = chain.invoke(
        {
            "incident": _incident_text(state),
            "similar_incidents": _format_similar_incidents(similar_incidents),
        }
    )
    steps = _parse_steps(_message_text(response))
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


def rca(state: "AgentState") -> dict:
    incident = state["incident"]
    try:
        chain = RCA_PROMPT | get_llm().with_structured_output(RCA)
        rca_result = chain.invoke(
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


def finalize(state: "AgentState") -> dict:
    similar_incidents = [
        result
        for result in state.get("similar_incidents", [])
        if result.similarity >= SIMILARITY_THRESHOLD
    ]
    if similar_incidents:
        confidence = max(0.2, max(result.similarity for result in similar_incidents))
    else:
        confidence = 0.3

    return {
        "confidence": confidence,
        "trace": [
            TraceStep(
                step="finalize",
                detail=(
                    "Assembled final response with "
                    f"{len(similar_incidents)} retrieved incidents and confidence {confidence:.2f}."
                ),
            )
        ],
    }
