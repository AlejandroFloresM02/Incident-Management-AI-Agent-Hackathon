# Frontend

React + TypeScript, Vite. Talks to the backend over `fetch` against `http://localhost:8000/api/...`.

## Scaffold (if not already done)

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` — the backend's CORS config already allows that origin.

## What this UI is for

A copilot, not a chatbot. The user pastes an incident into a form, hits submit, and sees the agent's response laid out so they can act on it. The four parts of an `AgentResponse` (see `backend/shared/schemas.py`) — summary, similar incidents, suggested steps, RCA — map naturally to four sections in the result view, but how that's composed visually is a UX call.

## Worth thinking about as a team

The brief grades responsible AI. The frontend is the natural place to surface the affordances that make this a copilot rather than an autopilot — per-incident similarity scores, the agent's confidence, the trace of what ran, and a banner reminding the user to verify before acting. How those compose into the layout is your call.

The backend mock is realistic and stable, so you can iterate the UI without waiting for the agent to be wired in.

## Contract

**Endpoint**: `POST /api/incident/analyze`

Body is an `Incident` without `resolution`, `rca_summary`, or `resolved_at`. Returns an `AgentResponse`.

**Health**: `GET /api/health` -> `{"status": "ok"}`.

**CORS**: the backend allows `http://localhost:5173` and `http://localhost:3000`.

**Types**: use [`./src/types.ts`](./src/types.ts). The source of truth is `backend/shared/schemas.py`; update both files whenever the schema changes.

**Dev fixture**: use [`./src/fixtures/sample-response.json`](./src/fixtures/sample-response.json) in components for offline iteration. It does not require Ollama.

**Errors**

| Scenario | Status | Body | UI response |
|---|---|---|---|
| Bad `Incident` body | 422 | `{"detail": [{"loc":[...], "msg":"...", "type":"..."}]}` | per-field errors |
| Ollama down / agent crash | 500 | `{"detail": "Internal server error"}` | red banner + retry |
| Backend unreachable | network error | (none) | same as 5xx |

**Latency**: first call can take 15-40 s, and subsequent calls usually take 10-20 s. Loading states should communicate "this can take ~30 s on first run" so users do not refresh.

**Future endpoints (not built yet)**

- `GET /api/incidents/search?q=<text>&k=5` -> `RetrievalResult[]`
- `GET /api/incidents/{id}` -> `Incident`

**UX suggestions**

- Severity colors: P1 red, P2 amber, P3 yellow, P4 gray.
- Confidence buckets: `<0.4` low (red), `0.4-0.7` medium (amber), `>0.7` high (green). Always display the numeric value.
