# API

The FastAPI app — the single backend entrypoint the frontend hits. CORS, health, and the analyze endpoint live here.

## Files

- `main.py` — FastAPI app. Currently returns a hardcoded `AgentResponse` from `_mock_response` so the frontend has something realistic to render against on day one.
- `sample_request.json` — example `Incident` payload for `curl` smoke tests.

## Run

From the `backend/` directory:

```bash
uvicorn api.main:app --reload --port 8000
```

## Plan to swap the mock

Once the agent's entry point is ready, replace `_mock_response(incident)` with a call into it and delete the mock function. Keep `sample_request.json` — it's still the easiest end-to-end smoke test.

## Endpoints to add later

The brief calls for similar-incident lookup, so the vector store will probably also want to expose:

- `GET /api/incidents/search?q=...&k=5`
- `GET /api/incidents/{id}`

Useful for the frontend's "browse the knowledge base" feature and for debugging retrieval quality.
