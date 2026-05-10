from __future__ import annotations

from functools import cache
from operator import add
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph

from shared.schemas import AgentResponse, Incident, RCA, RetrievalResult, TraceStep

from .nodes import finalize, rca, retrieve, suggest, summarize


class AgentState(TypedDict):
    incident: Incident
    summary: str
    similar_incidents: list[RetrievalResult]
    suggested_steps: list[str]
    rca: RCA
    confidence: float
    trace: Annotated[list[TraceStep], add]


@cache
def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("summarize", summarize)
    graph.add_node("retrieve", retrieve)
    graph.add_node("suggest", suggest)
    graph.add_node("rca", rca)
    graph.add_node("finalize", finalize)

    graph.add_edge(START, "summarize")
    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "suggest")
    graph.add_edge("retrieve", "rca")
    graph.add_edge(["summarize", "suggest", "rca"], "finalize")
    graph.add_edge("finalize", END)

    return graph.compile()


async def run_agent(incident: Incident) -> AgentResponse:
    initial_state: AgentState = {
        "incident": incident,
        "summary": "",
        "similar_incidents": [],
        "suggested_steps": [],
        "rca": RCA(
            summary="",
            root_cause="",
            contributing_factors=[],
            timeline=[],
            preventive_actions=[],
        ),
        "confidence": 0.0,
        "trace": [],
    }
    state = await build_graph().ainvoke(initial_state)

    return AgentResponse(
        summary=state["summary"],
        similar_incidents=state["similar_incidents"],
        suggested_steps=state["suggested_steps"],
        rca=state["rca"],
        confidence=state["confidence"],
        trace=state["trace"],
    )
