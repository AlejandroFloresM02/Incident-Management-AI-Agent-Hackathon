# Backend

Python 3.11+, FastAPI, LangChain, LangGraph, ChromaDB, Ollama.

## Setup (once)

```bash
python -m venv .venv
source .venv/bin/activate                # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                     # then edit if needed
```

Make sure Ollama is running locally and the models are pulled — see the [root README](../README.md#quickstart).

## Run

```bash
uvicorn api.main:app --reload --port 8000
```

OpenAPI playground: <http://localhost:8000/docs>.

Smoke test (from the `backend/` directory, in a second terminal):

```bash
curl http://localhost:8000/api/health
# {"status":"ok"}

curl -X POST http://localhost:8000/api/incident/analyze \
  -H "Content-Type: application/json" \
  --data-binary @api/sample_request.json | jq .summary
# Note: `--data-binary` not `-d` — `-d` strips newlines and breaks JSON parsing.
```

## Folder map

- `shared/` — Pydantic contract used by every other component. Don't edit without team agreement.
- `data_gen/` — synthetic incident generator. Outputs to `data_gen/output/incidents.jsonl`.
- `vectorstore/` — ChromaDB ingest + retriever. Persists to `vectorstore/chroma_db/`.
- `agent/` — LangGraph state machine that orchestrates the four agent steps.
- `api/` — FastAPI app. The single entrypoint the frontend hits.

Each subfolder has its own README.

## Conventions

- All cross-component types live in `shared/schemas.py`. Import from there: `from shared.schemas import Incident, AgentResponse`.
- All runtime config (model names, paths, CORS origins) lives in `shared/config.py` and reads from `.env`. Don't hardcode.
- Don't commit `.env`, `chroma_db/`, or `data_gen/output/incidents.jsonl` — already in `.gitignore`.
