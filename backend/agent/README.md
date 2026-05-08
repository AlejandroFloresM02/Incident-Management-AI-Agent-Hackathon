# Agent

The orchestration layer. When an incident comes in via the API, the agent is what calls the LLM and the vector store in the right order to produce an `AgentResponse` (defined in `backend/shared/schemas.py`).

## What this folder must produce

A callable that takes an `Incident` and returns an `AgentResponse`. The API route in `backend/api/main.py` will import and invoke it once it's ready — see the `_mock_response` function it currently uses; that's the shape you're replacing.

## Conventions

- Use LangGraph for the orchestration. The four logical steps from the architecture doc — summarize, retrieve similar, suggest steps, generate RCA — are a reasonable starting topology, but the team can refine.
- LLM and embedding model names come from `backend/shared/config.py`.
- Populate the `trace` field on the response — the frontend uses it for a transparency panel that shows what the agent did.

## Worth thinking about as a team

ReAct loop versus a deterministic chain — both work, but they fail differently on small local models. Which tradeoff fits a live demo where reliability matters more than flexibility?

Where does the `confidence` score come from? Top retrieval similarity is the easy answer; whether it's the right one depends on what you want the UI to communicate.

How do you make the RCA reliably valid JSON without spending the whole hackathon parsing strings? LangChain has tools for this — worth the 5-minute look.
