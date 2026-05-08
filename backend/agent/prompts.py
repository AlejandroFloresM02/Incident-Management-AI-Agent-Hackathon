from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate


SUMMARIZE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an incident management copilot. Ground your answer only in "
            "the incident fields provided. Do not invent facts, metrics, or "
            "causes that are not present in the incident.",
        ),
        (
            "human",
            "Summarize this incident for an on-call engineer in 2-4 concise "
            "sentences of plain prose.\n\nIncident:\n{incident}",
        ),
    ]
)

SUGGEST_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an incident management copilot. Suggest operational next "
            "steps that are grounded in the current incident and the retrieved "
            "similar incidents. Do not claim a retrieved incident proves the "
            "cause; use it only as supporting context.",
        ),
        (
            "human",
            "Return 3-5 concrete resolution steps, one per line. Avoid preamble "
            "and avoid JSON.\n\nCurrent incident:\n{incident}\n\nRetrieved "
            "similar incidents:\n{similar_incidents}",
        ),
    ]
)

RCA_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an incident management copilot generating a structured "
            "root cause analysis. Ground the RCA in the current incident and "
            "retrieved similar incidents. If evidence is incomplete, say so "
            "clearly instead of inventing details.",
        ),
        (
            "human",
            "Create an RCA for this incident.\n\nCurrent incident:\n{incident}\n\n"
            "Retrieved similar incidents:\n{similar_incidents}",
        ),
    ]
)
