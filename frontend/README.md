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

## Contract

```ts
// POST http://localhost:8000/api/incident/analyze
// Body:    Incident   (no resolution / rca_summary)
// Returns: AgentResponse
```

The exact shapes live in `backend/shared/schemas.py`. The easiest way to keep the TS types in sync is to paste the Pydantic file into your AI assistant and ask for equivalent interfaces.

## Worth thinking about as a team

The brief grades responsible AI. The frontend is the natural place to surface the affordances that make this a copilot rather than an autopilot — per-incident similarity scores, the agent's confidence, the trace of what ran, and a banner reminding the user to verify before acting. How those compose into the layout is your call.

The backend mock is realistic and stable, so you can iterate the UI without waiting for the agent to be wired in.
