# Synthetic data generation

We don't have real incidents to seed the knowledge base, so this folder is responsible for producing plausible historical tickets that the vector store will ingest. The quality of these incidents directly shapes retrieval quality at demo time — a thin or repetitive corpus will produce thin or repetitive matches.

## What this folder must produce

A JSON Lines file, one complete `Incident` per line, written somewhere under `output/`. Historical incidents need both `resolution` and `rca_summary` populated; the exact field shapes live in `backend/shared/schemas.py`.

## Conventions

- Anything in `output/` is gitignored except an explicitly allow-listed `seed_incidents.jsonl`. If you want a small representative sample committed for the rest of the team to develop against, that's the filename to use.
- Use the local models we already have (`llama3.1:8b` via Ollama). No API keys.

## Worth thinking about as a team

How do you generate breadth — variety of services, symptoms, severities — without manually enumerating every combination? How do you know when the corpus is "realistic enough" to stop? How do you sanity-check what the model produced before committing it?
