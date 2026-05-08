# Backend

Python 3.11+, FastAPI, LangChain, LangGraph, ChromaDB, Ollama.

## Setup (once)

The team is on TCS-issued Windows laptops, so commands below are PowerShell. Adapt to bash on macOS/Linux.

We use `uv` for fast dependency installs. On TCS machines pass `--native-tls` so uv trusts the corporate root CA:

```powershell
# from backend/
uv venv
.venv\Scripts\Activate.ps1
uv pip install --native-tls -r requirements.txt
```

If `Activate.ps1` is blocked by execution policy:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

To avoid passing `--native-tls` every time, set it once for your user:

```powershell
[Environment]::SetEnvironmentVariable("UV_NATIVE_TLS", "true", "User")
```

`.env` is optional — the committed defaults in [.env.example](.env.example) target the models pre-installed on TCS laptops (`qwen-2.5.1-coder-it:latest` for generation, `gte-large:latest` for embeddings). Override only if needed:

```powershell
Copy-Item .env.example .env
```

Make sure Ollama is running locally before starting the API.

## Run

```powershell
uvicorn api.main:app --reload --port 8000
```

OpenAPI playground: <http://localhost:8000/docs>.

## Smoke test

In a second PowerShell window from `backend/`:

```powershell
# Health
curl.exe http://localhost:8000/api/health

# Analyze the sample incident
curl.exe -X POST http://localhost:8000/api/incident/analyze `
  -H "Content-Type: application/json" `
  --data-binary "@api/sample_request.json"
```

Use `curl.exe` (not `curl`) on Windows — PowerShell aliases `curl` to `Invoke-WebRequest`, which doesn't accept these flags. Backtick (`` ` ``) is line-continuation.

## Folder map

- `shared/` — Pydantic contract used by every other component. Don't edit without team agreement.
- `data_gen/` — synthetic incident generator. Outputs to `data_gen/output/incidents.jsonl`.
- `vectorstore/` — ChromaDB ingest + retriever. Persists to `vectorstore/chroma_db/`.
- `agent/` — LangGraph state machine that orchestrates the four agent steps.
- `api/` — FastAPI app. The single entrypoint the frontend hits.

Each subfolder has its own README.

## Conventions

- All cross-component types live in `shared/schemas.py`. Import: `from shared.schemas import Incident, AgentResponse`.
- All runtime config (model names, paths, CORS origins) lives in `shared/config.py` and reads from `.env`. Don't hardcode.
- Don't commit `.env`, `chroma_db/`, or `data_gen/output/incidents.jsonl` — already gitignored.
