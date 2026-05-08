# Vector store

Holds the embedded historical incidents and exposes a similarity-search function the agent calls.

## What this folder must produce

Two things visible to the rest of the codebase:

1. A way to ingest a JSONL file of historical incidents into a persistent ChromaDB collection.
2. A `search(query, k) -> list[RetrievalResult]` function the agent imports. The `RetrievalResult` shape is defined in `backend/shared/schemas.py`.

That's the contract. How it's organized internally is up to the team.

## Conventions

- Read paths and model names from `backend/shared/config.py`, not hardcoded.
- The persistence directory is gitignored. Decide whether re-running ingest is idempotent and document the choice.
- Similarity scores are reported in `[0, 1]` where higher = more similar (LangChain's `similarity_search_with_relevance_scores` does this; the alternative returns raw distances and is easy to use by accident).

## Worth thinking about as a team

What text actually goes into the embedding for each incident? Title alone is short; full description is richer; including the resolution biases retrieval toward "similar fix" rather than "similar problem." There isn't one right answer — try variants against realistic queries and see what shape of result feels most useful to an on-call engineer.
