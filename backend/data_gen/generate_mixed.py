"""Generate a mixed-quality incident corpus.

Real production knowledge bases are never uniformly clean: most records are
decent, some are rushed, and a few are nearly useless. This script produces
a corpus with that realistic mix so the data-quality dashboard actually has
something to surface.

Run:
    python -m data_gen.generate_mixed

Writes to backend/vectorstore/incidents.jsonl (overwrites). After running,
delete the persisted Chroma collection so the auto-ingest picks up the new
data:
    rm -rf backend/vectorstore/chroma_db
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

OUT = Path(__file__).resolve().parent.parent / "vectorstore" / "incidents.jsonl"

# Tiered distribution. Tuned to look like a real system: most records are
# fine, a meaningful minority are rushed, a small slice is bad enough that
# retrieving them as precedent would mislead the agent.
N_HIGH = 30
N_MEDIUM = 15
N_LOW = 10

SERVICES = [
    "payments-api",
    "auth-service",
    "user-db",
    "checkout-web",
    "fraud-scoring",
    "notification-svc",
    "search-api",
    "session-cache",
    "inventory-svc",
    "billing-worker",
]

ERROR_TYPES = [
    "TIMEOUT",
    "5xx_SPIKE",
    "OOM",
    "DEADLOCK",
    "CERT_EXPIRED",
    "DNS_RESOLUTION_FAILED",
    "RATE_LIMITED",
    "CONNECTION_REFUSED",
    "JWT_EXPIRED",
    "MAX_CONNECTIONS",
]

ENV_TAGS = [
    "prod-us-east-1",
    "prod-eu-west-1",
    "prod-ap-south-1",
    "staging",
]

ROOT_CAUSES = [
    "configuration drift after the v{ver} deploy",
    "cache-miss path was not exercised in pre-prod",
    "TLS certificate expired without renewal pager",
    "downstream timeout was too tight for the new payload size",
    "DB connection pool exhausted before autoscaling kicked in",
    "circuit breaker mis-tuned, opening on transient failures",
    "log shipper consumed the file descriptor budget",
    "feature flag toggled with stale config in one region",
]

PREVENTIVE = [
    "Add regression test for the failure path",
    "Wire a canary check before regional rollout",
    "Add an alert on this specific failure mode",
    "Document the runbook so on-call can self-serve",
    "Audit the timeout budget across the upstream chain",
]

SEVERITIES = ["P1", "P2", "P3", "P4"]
SEVERITY_WEIGHTS = [0.15, 0.35, 0.35, 0.15]


def _rng() -> random.Random:
    return random.Random(20260511)  # deterministic so the demo is reproducible


def _ts(rng: random.Random, days_ago_max: int) -> datetime:
    days_ago = rng.randint(1, days_ago_max)
    hour = rng.randint(0, 23)
    return datetime(2026, 5, 11, hour, 0, 0, tzinfo=timezone.utc) - timedelta(
        days=days_ago
    )


def _mttr_hours(rng: random.Random, tier: Literal["high", "medium", "low"]) -> float:
    if tier == "high":
        return rng.uniform(0.5, 8.0)
    if tier == "medium":
        return rng.uniform(2.0, 24.0)
    return rng.uniform(4.0, 72.0)


def _title(service: str, error: str) -> str:
    pretty = error.replace("_", " ").title()
    svc = " ".join(part.capitalize() for part in service.split("-"))
    return f"{svc} {pretty}"


def _high_quality_record(rng: random.Random, idx: int) -> dict:
    service = rng.choice(SERVICES)
    error = rng.choice(ERROR_TYPES)
    severity = rng.choices(SEVERITIES, weights=SEVERITY_WEIGHTS, k=1)[0]
    created = _ts(rng, days_ago_max=180)
    mttr = _mttr_hours(rng, "high")
    resolved = created + timedelta(hours=mttr)

    error_rate = rng.uniform(2.0, 22.0)
    upstream = rng.choice([s for s in SERVICES if s != service])
    description = (
        f"{service} returning {error} errors after the v1.{rng.randint(10, 30)}.{rng.randint(0, 9)} "
        f"deploy. Error rate climbed to {error_rate:.1f}% under load; upstream calls from "
        f"{upstream} began failing shortly after. Region: {rng.choice(ENV_TAGS)}."
    )
    resolution = (
        f"Rolled back {service} to the previous stable version. "
        f"Patched the affected component with a targeted fix. "
        f"Re-deployed after regression coverage was added for the failure path. "
        f"Validated p95 latency and 5xx rate returned to baseline."
    )
    rca = (
        f"{rng.choice(ROOT_CAUSES).format(ver=rng.randint(11, 30))}. "
        f"The failure mode was {error.replace('_', ' ').lower()}, surfaced first by the "
        f"{upstream} upstream. Resolved by rollback + targeted regression coverage."
    )

    tags = [
        rng.choice(ENV_TAGS),
        error,
        rng.choice(
            ["deploy-regression", "downstream-cascade", "retry-storm", "db-pool", "thread-starvation"]
        ),
        rng.choice(["mitigated", "rolled-back"]),
    ]
    return {
        "id": f"INC-2026-{1000 + idx:04d}",
        "title": _title(service, error),
        "description": description,
        "severity": severity,
        "service": service,
        "tags": tags,
        "created_at": created.isoformat().replace("+00:00", "Z"),
        "resolved_at": resolved.isoformat().replace("+00:00", "Z"),
        "resolution": resolution,
        "rca_summary": rca,
        "requires_human_approval": severity in ("P1", "P2"),
    }


def _medium_quality_record(rng: random.Random, idx: int) -> dict:
    """Rushed records: short resolution, single-sentence RCA, one tag."""
    service = rng.choice(SERVICES)
    error = rng.choice(ERROR_TYPES)
    severity = rng.choices(SEVERITIES, weights=SEVERITY_WEIGHTS, k=1)[0]
    created = _ts(rng, days_ago_max=180)
    mttr = _mttr_hours(rng, "medium")
    resolved = created + timedelta(hours=mttr)

    description = (
        f"{service} hit {error.replace('_', ' ').lower()} during business hours. "
        f"Customer impact reported."
    )
    resolution = rng.choice(
        [
            f"Restarted {service}.",
            "Bumped resources and moved on.",
            "Failover to secondary region.",
            "Cleared the backlog manually.",
        ]
    )
    rca = rng.choice(
        [
            f"{error.replace('_', ' ').lower()} under load",
            "traffic spike",
            "downstream timeout",
            "deploy went sideways",
        ]
    )
    return {
        "id": f"INC-2026-{2000 + idx:04d}",
        "title": _title(service, error),
        "description": description,
        "severity": severity,
        "service": service,
        "tags": [rng.choice(ENV_TAGS)],  # only one tag
        "created_at": created.isoformat().replace("+00:00", "Z"),
        "resolved_at": resolved.isoformat().replace("+00:00", "Z"),
        "resolution": resolution,
        "rca_summary": rca,
        "requires_human_approval": False,
    }


def _low_quality_record(rng: random.Random, idx: int) -> dict:
    """Sparse / inconsistent records — the ones that make retrieval misleading
    if the agent trusts them. Each picks several failure modes from the menu,
    including semantic-coherence failures the user would actually produce
    when they're rushed or confused about the cause."""
    service = rng.choice(SERVICES)
    error = rng.choice(ERROR_TYPES)
    severity = rng.choices(SEVERITIES, weights=SEVERITY_WEIGHTS, k=1)[0]
    created = _ts(rng, days_ago_max=400)  # older, less timely
    mttr = _mttr_hours(rng, "low")
    resolved = created + timedelta(hours=mttr)

    record = {
        "id": f"INC-2026-{3000 + idx:04d}",
        "title": _title(service, error),
        "description": (
            f"{service} experiencing {error.replace('_', ' ').lower()} "
            f"in production. Error rate climbing under load."
        ),
        "severity": severity,
        "service": service,
        "tags": [rng.choice(ENV_TAGS), error],
        "created_at": created.isoformat().replace("+00:00", "Z"),
        "resolved_at": resolved.isoformat().replace("+00:00", "Z"),
        "resolution": (
            f"Rolled back {service} and re-deployed the previous build "
            "after validation."
        ),
        "rca_summary": (
            f"The {error.replace('_', ' ').lower()} was identified during "
            "the postmortem and a fix was deployed."
        ),
        "requires_human_approval": False,
    }

    # The source-quality composite is weighted heavily toward resolution
    # completeness, so one failure mode rarely pushes a record into the low
    # bucket. Pick 3 failure modes per record AND always include either
    # empty_resolution or empty_rca (the heaviest-weighted dimensions).
    pool = [
        "no_tags",
        "single_word_title",
        "tiny_description",
        "tag_desc_mismatch",
        "missing_resolved_at",
        # Semantic-coherence failure modes — the "user was confused" cases
        # the metric is supposed to catch:
        "wrong_description",   # description is about a different service/error
        "title_mismatch",      # title describes a different incident
        "boilerplate_rca",     # rca_summary uses generic text unrelated to the description
    ]
    modes = [rng.choice(["empty_resolution", "empty_rca"])] + rng.sample(pool, k=2)
    # Half the low records get a second resolution/rca strike for variety.
    if rng.random() < 0.5:
        modes.append(
            "empty_rca" if "empty_resolution" in modes else "empty_resolution"
        )
    if "empty_resolution" in modes:
        record["resolution"] = ""
    if "empty_rca" in modes:
        record["rca_summary"] = ""
    if "no_tags" in modes:
        record["tags"] = []
    if "single_word_title" in modes:
        record["title"] = rng.choice(["Outage", "Bug", "Issue", "Crash"])
    if "tiny_description" in modes:
        record["description"] = rng.choice(
            ["broken", "down", "errors in prod", "users complaining"]
        )
    if "tag_desc_mismatch" in modes:
        # Tags that have no token overlap with the description text.
        record["tags"] = ["misc", "wontfix", "untriaged"]
    if "missing_resolved_at" in modes:
        record["resolved_at"] = None
    if "wrong_description" in modes:
        # User wrote a description that's actually about a different
        # incident — wrong service, wrong error type. This is exactly
        # what happens when an on-call engineer is confused about the
        # cause and pastes the wrong context into the ticket.
        other_service = rng.choice([s for s in SERVICES if s != service])
        other_error = rng.choice([e for e in ERROR_TYPES if e != error])
        record["description"] = (
            f"{other_service} reporting {other_error.replace('_', ' ').lower()} "
            f"across multiple regions. Customers seeing checkout failures."
        )
    if "title_mismatch" in modes:
        # Title and description describe different things.
        other_service = rng.choice([s for s in SERVICES if s != service])
        other_error = rng.choice([e for e in ERROR_TYPES if e != error])
        record["title"] = _title(other_service, other_error)
    if "boilerplate_rca" in modes:
        # Generic RCA copy-pasted from a template, no relation to the
        # actual incident content.
        record["rca_summary"] = (
            "Standard recovery procedure executed. Incident reviewed in "
            "the next operational meeting. No further action required."
        )
    return record


def main() -> None:
    rng = _rng()
    records: list[dict] = []
    for i in range(N_HIGH):
        records.append(_high_quality_record(rng, i))
    for i in range(N_MEDIUM):
        records.append(_medium_quality_record(rng, i))
    for i in range(N_LOW):
        records.append(_low_quality_record(rng, i))

    rng.shuffle(records)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r) + "\n")

    print(
        f"Wrote {len(records)} records to {OUT} "
        f"({N_HIGH} high / {N_MEDIUM} medium / {N_LOW} low quality)."
    )
    print("Next: rm -rf vectorstore/chroma_db && restart the backend to re-ingest.")


if __name__ == "__main__":
    main()
