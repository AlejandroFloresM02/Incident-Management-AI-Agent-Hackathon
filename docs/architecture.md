# Architecture

This document describes the design of the Incident Management AI Copilot. It covers the data flow, the cross-team contract, the REST API, and the rationale behind the major decisions. For setup and quickstart, see the [root README](../README.md).

## What it does

An on-call engineer pastes an incident ticket into the UI and gets back four things, in order:

1. A short natural-language **summary** of the incident.
2. A list of **similar past incidents** retrieved from a knowledge base, each with a similarity score.
3. **Suggested resolution steps**, grounded in those past incidents.
4. A structured **root cause analysis** with timeline, contributing factors, and preventive actions.

The system is a copilot, not an autopilot — it never executes anything. The engineer applies the fix.

## End-to-end flow

```
┌──────────┐  POST /api/incident/analyze   ┌──────────────────────────────┐
│ Frontend │ ─────────────────────────────▶│ FastAPI                       │
│  React   │                                │   ↓                          │
│   + TS   │                                │ LangGraph state machine      │
└──────────┘                                │   ↓                          │
     ▲                                      │ ┌─────────────────────────┐  │
     │                                      │ │ summarize  ──▶ Llama    │  │
     │                                      │ │ retrieve   ──▶ Chroma   │  │
     │                                      │ │ suggest    ──▶ Llama    │  │
     │                                      │ │ rca        ──▶ Llama    │  │
     │                                      │ └─────────────────────────┘  │
     │  AgentResponse JSON                  │   ↓                          │
     └──────────────────────────────────────│ return AgentResponse         │
                                            └──────────────────────────────┘
```

The agent is a **linear LangGraph chain**, not a ReAct loop. The four steps are deterministic, and a linear chain is more reliable on small local models than tool-calling loops, which can drop format mid-execution.

## The cross-team contract: `backend/shared/schemas.py`

This is the single most important file in the repo. The frontend, vector store, agent, and data-gen all import from here. **Schema changes require team agreement first** — they ripple outward.

The Pydantic models are:

- **`Incident`** — a single ticket. Used both as input (without `resolution`/`rca_summary`) and as historical data in Chroma (with them).
- **`RetrievalResult`** — one similar past incident with its similarity score (0–1).
- **`RCA`** — the structured root-cause analysis (summary, root cause, contributing factors, timeline, preventive actions).
- **`AgentResponse`** — the full output of `/api/incident/analyze`: summary + similar incidents + suggested steps + RCA + confidence + agent trace.

See the actual code for the field-level definitions; comments and types are kept current there.

## REST API

All endpoints live under `/api`. Implemented in `backend/api/routes.py`.

| Method | Path | Body | Returns | Status |
|---|---|---|---|---|
| `GET` | `/api/health` | — | `{"status": "ok"}` | scaffolded |
| `POST` | `/api/incident/analyze` | `Incident` (no resolution/rca) | `AgentResponse` | scaffolded with mock; agent wires in later |
| `GET` | `/api/incidents/search?q=...&k=5` | — | `List[RetrievalResult]` | added by vector-store owner |
| `GET` | `/api/incidents/{id}` | — | `Incident` | added by vector-store owner |

Auto-generated OpenAPI docs are at `http://localhost:8000/docs` once the server is running.

## Components

Each folder under `backend/` and the `frontend/` folder owns one part of the system. Each folder has its own README describing the contract it must honor; the implementation choices are open.

### Synthetic data (`backend/data_gen/`)

Produces a JSONL file of historical incidents that the vector store ingests. Quality and variety of this corpus shapes retrieval quality.

### Vector store (`backend/vectorstore/`)

ChromaDB persisted to a local directory, with embeddings from Ollama's `nomic-embed-text` (chosen for its 8192-token context window and benchmark performance against alternatives). Exposes a `search(query, k)` function returning `RetrievalResult` objects.

### Agent (`backend/agent/`)

A LangGraph state machine that orchestrates the four logical steps the system performs on each incident. Exposes a callable that takes an `Incident` and returns an `AgentResponse`. The `trace` field on the response is for the UI's transparency panel.

### Frontend (`frontend/`)

React + TypeScript. Renders a form for new incidents and a result view for the agent's response. Surfaces responsible-AI affordances — similarity scores, confidence, agent trace, "verify before acting" reminder — visibly enough that the user understands they're seeing AI suggestions.

## Stack rationale

**Local models via Ollama (Llama 3.1 8B + nomic-embed-text)** — incidents contain internal logs and customer data, so privacy matters; zero per-call cost lets engineers query freely; no internet dependency for the demo. Tradeoff: an 8B local model reasons less well than GPT-4-class models, which is why fine-tuning on the synthetic corpus is the natural next step.

**Llama 3.1 8B specifically** — best-in-class tool-calling format among ~8B local models, fits in 16 GB RAM so all four laptops can run it. Llama 3.2 3B is a fallback if any laptop struggles.

**ChromaDB** — zero infra, persists to a local file, one-line LangChain integration. Pinecone is better at scale but needs an account and adds network dependency. FAISS is even lighter but doesn't persist metadata cleanly out of the box.

**LangGraph + linear chain** — orchestrates the four agent steps with typed state. Linear instead of ReAct because small local models can drop tool-call format mid-loop, which would freeze a live demo. The four steps are deterministic anyway, so the loop adds no functionality.

**FastAPI** — auto OpenAPI docs (great for the demo), async streaming if we want to add it, and Pydantic models double as the cross-team contract.

**Monorepo with folder boundaries** — four people, ~5 hours. Cross-repo coordination cost would dominate. One repo, one folder per concern, one shared schemas file as the only true cross-cutting artifact keeps integration tractable.

## Responsible AI

Three layers, in this order:

- **Grounding** — every suggestion is derived from retrieved past incidents, not open-ended generation. Prompts explicitly instruct the model to base answers on retrieved context.
- **Transparency** — the UI shows retrieved sources next to the suggestion so the engineer can audit each claim.
- **Friction** — a persistent "AI-generated, verify before acting" banner plus a confidence score on every response. The agent never executes anything.

## What we deliberately defer

- **JIRA ticket creation** (the brief's bonus) — mock as a button if time permits.
- **Streaming SSE** — return the full response at the end is fine for the demo.
- **Authentication** — not in the scope.
- **Fine-tuning** — discussed as next-steps; the synthetic dataset is the starting corpus.
- **Production deployment** — local `uvicorn` and `npm run dev` are the demo runtime.
