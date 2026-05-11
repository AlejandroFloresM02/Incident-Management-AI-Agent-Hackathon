"""Pure-Python quality scoring for incident records.

Two scopes:
- score_source_quality(incident) -> SourceQuality
    Per-record. Answers "is this stored record worth learning from?"
    Used at retrieval time so each retrieved chunk carries its own quality
    score back to the UI, alongside the similarity score.

- score_corpus(incidents) -> CorpusQuality
    Aggregate over the whole collection, for the data-quality dashboard.

No LLM calls, no embedding calls — just metadata math. Fast and
deterministic so the demo doesn't depend on model state.
"""
from __future__ import annotations

import re
import statistics
from collections import Counter
from datetime import datetime, timezone
from typing import Iterable

from shared.schemas import (
    CorpusQuality,
    Incident,
    MetricScore,
    QualityDistribution,
    SourceQuality,
)


# Bucket thresholds — same values the UI uses for the trust chips so the
# headline donut, the per-card colors, and the per-record chips all agree.
HIGH_THRESHOLD = 0.70
LOW_THRESHOLD = 0.40


def _bucket(score: float) -> str:
    if score >= HIGH_THRESHOLD:
        return "high"
    if score >= LOW_THRESHOLD:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

# Description length sweet spot: too short = sparse, too long = log-dump.
DESC_MIN_CHARS = 80
DESC_OK_CHARS = 160
DESC_MAX_CHARS = 1200

# Resolution / RCA fields are the ones we actually use to solve a new
# incident — empty or trivial values here are the dangerous failure mode.
RESOLUTION_MIN_CHARS = 30
RCA_MIN_CHARS = 50

# Warning threshold: high text match but low source quality. This is the
# "this record looks similar but has nothing useful to say" case.
WARNING_SIMILARITY = 0.65
WARNING_QUALITY = 0.5

_TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9_-]{2,}")

# Filtered out so token-overlap checks aren't fooled by common filler.
_STOPWORDS = frozenset(
    {
        "the", "and", "for", "with", "from", "this", "that", "was", "were",
        "are", "has", "have", "had", "but", "not", "all", "any", "can", "may",
        "out", "via", "due", "into", "over", "under", "after", "before",
        "during", "between", "shortly", "began", "started", "stopped",
        "production", "service", "issue", "errors", "error", "issues",
    }
)


def _tokens(text: str) -> set[str]:
    return {tok.lower() for tok in _TOKEN_RE.findall(text or "")}


_SPLIT_RE = re.compile(r"[_\-]")


def _content_tokens(text: str) -> set[str]:
    """Tokens with stopwords and very short words removed. Used for the
    semantic-coherence checks where we want signal, not noise.

    Compound identifiers ("JWT_EXPIRED", "billing-worker") are also split
    into their parts so a title that uses the spaced form ("Jwt Expired")
    overlaps with a description that uses the original token form.
    """
    expanded: set[str] = set()
    for tok in _tokens(text):
        expanded.add(tok)
        for part in _SPLIT_RE.split(tok):
            if part:
                expanded.add(part)
    return {t for t in expanded if t not in _STOPWORDS and len(t) >= 3}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _service_tokens(service: str) -> set[str]:
    """Service identifiers like 'payments-api' should appear in the
    description when the description is actually about this service."""
    if not service:
        return set()
    raw = service.lower().replace("_", "-")
    parts = {p for p in raw.split("-") if len(p) >= 3}
    parts.add(raw)
    return parts


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


# Jaccard thresholds calibrated against the synthetic corpus: well-formed
# records easily clear 0.05, garbage-stuffed ones land below 0.02.
TITLE_DESC_THRESHOLD = 0.05
DESC_RCA_THRESHOLD = 0.05
RESOLUTION_DESC_THRESHOLD = 0.03


# ---------------------------------------------------------------------------
# Per-record scoring
# ---------------------------------------------------------------------------


def score_source_quality(incident: Incident) -> SourceQuality:
    """Score a single stored incident on the dimensions that matter for
    using it as a precedent: how complete are the resolution-relevant
    fields, how readable is the content, and does the record pass cheap
    plausibility checks.
    """
    notes: list[str] = []

    # --- resolution_completeness (the most important dimension) --------
    parts: list[float] = []

    resolution = (incident.resolution or "").strip()
    if len(resolution) >= RESOLUTION_MIN_CHARS:
        parts.append(1.0)
    elif resolution:
        parts.append(0.4)
        notes.append("resolution is very short")
    else:
        parts.append(0.0)
        notes.append("resolution is empty")

    rca = (incident.rca_summary or "").strip()
    if len(rca) >= RCA_MIN_CHARS:
        parts.append(1.0)
    elif rca:
        parts.append(0.4)
        notes.append("rca_summary is very short")
    else:
        parts.append(0.0)
        notes.append("rca_summary is empty")

    if len(incident.tags) >= 2:
        parts.append(1.0)
    elif incident.tags:
        parts.append(0.5)
    else:
        parts.append(0.0)
        notes.append("no tags")

    # Weighted: resolution and rca matter most, tags are supporting context.
    resolution_completeness = _clamp(
        0.45 * parts[0] + 0.45 * parts[1] + 0.10 * parts[2]
    )

    # --- clarity --------------------------------------------------------
    desc_len = len(incident.description or "")
    if desc_len >= DESC_OK_CHARS and desc_len <= DESC_MAX_CHARS:
        desc_score = 1.0
    elif desc_len >= DESC_MIN_CHARS:
        # linear ramp between MIN and OK
        desc_score = 0.5 + 0.5 * (desc_len - DESC_MIN_CHARS) / max(
            1, DESC_OK_CHARS - DESC_MIN_CHARS
        )
    elif desc_len > 0:
        desc_score = 0.5 * desc_len / DESC_MIN_CHARS
        notes.append("description is short")
    else:
        desc_score = 0.0
        notes.append("description is empty")

    # RCA having at least two sentence terminators suggests structure
    # rather than a one-line label.
    sentence_marks = sum(rca.count(c) for c in ".!?")
    rca_structure = 1.0 if sentence_marks >= 2 else (0.5 if sentence_marks == 1 else 0.0)

    title = (incident.title or "").strip()
    title_score = 1.0 if len(title.split()) >= 2 else 0.0
    if title_score == 0.0:
        notes.append("title is a single token")

    clarity = _clamp(0.55 * desc_score + 0.30 * rca_structure + 0.15 * title_score)

    # --- accuracy_heuristic (plausibility + semantic-coherence checks) -
    # Two flavors of check live here:
    # (a) Structural plausibility: timestamps in order, severity valid,
    #     internal-consistency rules like "if resolution is set, resolved_at
    #     should be too." These catch malformed records.
    # (b) Semantic coherence: do the fields tell the same story? A user
    #     can fill every field but put a wrong description, or write a
    #     title that doesn't match the body. Caught with token-overlap
    #     across (title, description, rca_summary, resolution, service,
    #     tags). No LLM calls — deterministic, fast.
    checks_total = 0
    checks_passed = 0

    desc_content = _content_tokens(incident.description)
    title_content = _content_tokens(incident.title)
    rca_content = _content_tokens(rca)
    resolution_content = _content_tokens(resolution)
    # Tags often arrive as compounds ("jwt_expired", "prod-eu-west-1");
    # expand into parts so a description that uses the spaced form
    # ("jwt expired") still counts as overlapping.
    tag_tokens: set[str] = set()
    for raw in incident.tags:
        t = raw.lower()
        tag_tokens.add(t)
        for part in _SPLIT_RE.split(t):
            if part:
                tag_tokens.add(part)
    svc_tokens = _service_tokens(incident.service)

    # (a) Structural plausibility --------------------------------------

    # Timestamp ordering.
    checks_total += 1
    if incident.resolved_at is None or incident.resolved_at >= incident.created_at:
        checks_passed += 1
    else:
        notes.append("resolved_at is before created_at")

    # Severity is one of the valid literals (Pydantic enforces this on
    # parse, but if it slipped through metadata we'd still flag it).
    checks_total += 1
    if incident.severity in ("P1", "P2", "P3", "P4"):
        checks_passed += 1

    # If resolution is filled, rca_summary should also be filled (and
    # vice versa). Half-records are a real failure mode.
    checks_total += 1
    if bool(resolution) == bool(rca):
        checks_passed += 1
    else:
        notes.append("resolution and rca_summary are inconsistent")

    # If resolution is filled, resolved_at should also be filled.
    checks_total += 1
    if resolution and incident.resolved_at is None:
        notes.append("resolution set but resolved_at missing")
    else:
        checks_passed += 1

    # (b) Semantic coherence -------------------------------------------
    # Each check fires only when both fields are non-empty — empty fields
    # are already penalised by resolution_completeness; we don't want to
    # double-count.

    # Tag tokens should appear somewhere in the description (e.g.
    # "JWT_EXPIRED", "deploy-regression"). Env-only tags like
    # "prod-eu-west-1" are exempted because they're labels, not symptoms.
    checks_total += 1
    if not tag_tokens or tag_tokens & desc_content:
        checks_passed += 1
    else:
        notes.append("tags don't overlap with description")

    # Service name appears in the description. If the description is
    # supposedly about service X but never mentions X, something's wrong.
    checks_total += 1
    if not svc_tokens or svc_tokens & desc_content:
        checks_passed += 1
    else:
        notes.append("service name not mentioned in description")

    # Title <-> description coherence. If the title is "Database deadlock"
    # but the description is about an auth timeout, the record will
    # mislead retrieval.
    if title_content and desc_content:
        checks_total += 1
        if _jaccard(title_content, desc_content) >= TITLE_DESC_THRESHOLD:
            checks_passed += 1
        else:
            notes.append("title doesn't match description")

    # Description <-> RCA coherence. The RCA should talk about whatever
    # the description described.
    if desc_content and rca_content:
        checks_total += 1
        if _jaccard(desc_content, rca_content) >= DESC_RCA_THRESHOLD:
            checks_passed += 1
        else:
            notes.append("rca_summary doesn't match description")

    # Resolution <-> description coherence. A resolution like "Restarted
    # service" still gets credit (overlap on "service"), but copy-pasted
    # generic boilerplate that mentions nothing from the actual incident
    # gets flagged.
    if desc_content and resolution_content:
        checks_total += 1
        if _jaccard(desc_content, resolution_content) >= RESOLUTION_DESC_THRESHOLD:
            checks_passed += 1
        else:
            notes.append("resolution doesn't reference description")

    accuracy_heuristic = _clamp(checks_passed / checks_total)

    # --- composite ------------------------------------------------------
    score = _clamp(
        0.55 * resolution_completeness + 0.25 * clarity + 0.20 * accuracy_heuristic
    )

    return SourceQuality(
        score=score,
        resolution_completeness=resolution_completeness,
        clarity=clarity,
        accuracy_heuristic=accuracy_heuristic,
        notes="; ".join(notes) if notes else "all source-quality checks passed",
    )


def compute_trust(similarity: float, source_quality: SourceQuality) -> tuple[float, str | None]:
    """Combine similarity and source quality into a single trust score for
    this retrieved chunk, and decide whether a warning chip should fire.

    The warning is the demo-critical signal: text looks similar but the
    record itself has little usable content.
    """
    trust = _clamp(similarity * source_quality.score)
    warning: str | None = None
    if similarity >= WARNING_SIMILARITY and source_quality.score < WARNING_QUALITY:
        warning = (
            "Strong text match, but the stored record is sparse — "
            "derived suggestions may be weak."
        )
    return trust, warning


# ---------------------------------------------------------------------------
# Corpus-level scoring
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    """Ollama metadata round-trips can come back tz-naive. Treat naive
    timestamps as UTC for the timeliness math."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def score_corpus(incidents: list[Incident]) -> CorpusQuality:
    """Aggregate quality of the full incident corpus."""
    n = len(incidents)
    if n == 0:
        empty = MetricScore(
            name="—",
            score=0.0,
            description="No records ingested yet.",
            detail="Run vector_store.ingest() to populate the collection.",
        )
        return CorpusQuality(
            record_count=0,
            source_quality_distribution=QualityDistribution(
                high=0, medium=0, low=0, total=0
            ),
            completeness=empty.model_copy(update={"name": "Completeness"}),
            accuracy_heuristic=empty.model_copy(update={"name": "Heuristic accuracy"}),
            consistency=empty.model_copy(update={"name": "Consistency"}),
            timeliness=empty.model_copy(update={"name": "Timeliness"}),
            relevance_clarity=empty.model_copy(update={"name": "Relevance & Clarity"}),
            retrieval_readiness=empty.model_copy(update={"name": "Retrieval readiness"}),
        )

    # --- completeness ---------------------------------------------------
    # Count records missing each resolution-relevant field.
    missing_resolution = sum(
        1 for inc in incidents if not (inc.resolution or "").strip()
    )
    missing_rca = sum(1 for inc in incidents if not (inc.rca_summary or "").strip())
    missing_tags = sum(1 for inc in incidents if not inc.tags)
    missing_resolved_at = sum(1 for inc in incidents if inc.resolved_at is None)

    # Score every record once; we reuse the per-record scores for the
    # aggregate metrics AND for the source-quality distribution.
    per_record = [score_source_quality(inc) for inc in incidents]
    bucket_counts = Counter(_bucket(q.score) for q in per_record)
    distribution = QualityDistribution(
        high=bucket_counts.get("high", 0),
        medium=bucket_counts.get("medium", 0),
        low=bucket_counts.get("low", 0),
        total=n,
    )
    completeness_score = statistics.fmean(q.resolution_completeness for q in per_record)
    completeness = MetricScore(
        name="Completeness",
        score=completeness_score,
        description=(
            "Share of resolution-relevant fields (resolution, rca_summary, tags) "
            "populated and non-trivial. Higher means more records carry the "
            "content the agent uses to draft suggestions."
        ),
        detail=(
            f"missing resolution: {missing_resolution}/{n}, "
            f"missing rca_summary: {missing_rca}/{n}, "
            f"missing tags: {missing_tags}/{n}, "
            f"missing resolved_at: {missing_resolved_at}/{n}"
        ),
    )

    # --- accuracy_heuristic --------------------------------------------
    accuracy_score = statistics.fmean(q.accuracy_heuristic for q in per_record)
    flagged = sum(1 for q in per_record if q.accuracy_heuristic < 1.0)
    accuracy = MetricScore(
        name="Heuristic accuracy",
        score=accuracy_score,
        description=(
            "Plausibility + semantic-coherence checks. Structural: timestamp "
            "ordering, valid severity, resolution/rca/resolved_at consistency. "
            "Semantic: do the fields agree? Tag tokens appear in description, "
            "service name appears in description, title overlaps with "
            "description, rca_summary overlaps with description, resolution "
            "references the described problem. Catches records where every "
            "field is filled but the contents disagree with each other. Does "
            "NOT measure correctness against ground truth — that requires "
            "labeled review data we do not have."
        ),
        detail=f"{flagged}/{n} records failed at least one accuracy check",
    )

    # --- consistency ---------------------------------------------------
    # Tag vocabulary health: singleton tags (used once) indicate ad-hoc
    # tagging rather than a controlled vocabulary.
    tag_counts: Counter[str] = Counter()
    for inc in incidents:
        tag_counts.update(inc.tags)
    singleton_tags = sum(1 for c in tag_counts.values() if c == 1)
    unique_tags = len(tag_counts)
    # Healthy vocabulary: most tags reused.
    consistency_score = (
        _clamp(1.0 - (singleton_tags / unique_tags)) if unique_tags else 0.0
    )

    # Service-name consistency: look for near-duplicate service strings
    # (e.g. "payments-api" vs "payment-api"). Cheap signal: count distinct
    # services vs distinct service-base-tokens.
    services = [inc.service.strip().lower() for inc in incidents if inc.service]
    distinct_services = len(set(services))

    consistency = MetricScore(
        name="Consistency",
        score=consistency_score,
        description=(
            "Health of the controlled vocabulary: are tags reused across records "
            "or are most of them one-offs? Singleton-heavy vocabularies hurt "
            "retrieval because the embedding space gets fragmented."
        ),
        detail=(
            f"{unique_tags} unique tags, {singleton_tags} appear only once, "
            f"{distinct_services} distinct services"
        ),
    )

    # --- timeliness -----------------------------------------------------
    now = _now()
    ages_days = [
        (now - _as_utc(inc.created_at)).total_seconds() / 86400.0 for inc in incidents
    ]
    mttrs_hours = [
        (_as_utc(inc.resolved_at) - _as_utc(inc.created_at)).total_seconds() / 3600.0
        for inc in incidents
        if inc.resolved_at is not None
    ]
    median_age = statistics.median(ages_days) if ages_days else 0.0
    median_mttr = statistics.median(mttrs_hours) if mttrs_hours else 0.0
    share_resolved = (n - missing_resolved_at) / n

    # Score: corpus is "timely" if it covers recent history (median age
    # under a year) and most records are closed out (resolved_at set).
    age_score = _clamp(1.0 - (max(0.0, median_age - 30) / 365.0))
    timeliness_score = _clamp(0.5 * age_score + 0.5 * share_resolved)
    timeliness = MetricScore(
        name="Timeliness",
        score=timeliness_score,
        description=(
            "Freshness of the corpus and share of incidents closed out. Stale or "
            "open-ended records reduce the value of precedent retrieval."
        ),
        detail=(
            f"median age {median_age:.0f} days, median MTTR {median_mttr:.1f} h, "
            f"{n - missing_resolved_at}/{n} records resolved"
        ),
    )

    # --- relevance_clarity ---------------------------------------------
    # Relevance against a specific query is per-retrieval (similarity).
    # At corpus level the meaningful part is clarity.
    clarity_score = statistics.fmean(q.clarity for q in per_record)
    relevance_clarity = MetricScore(
        name="Relevance & Clarity",
        score=clarity_score,
        description=(
            "Per-record clarity: description length in a sensible range, RCA "
            "with sentence structure, multi-token titles. Per-query relevance "
            "is reported inline on each retrieved card as Similarity."
        ),
        detail=(
            f"average description length "
            f"{int(statistics.fmean(len(i.description or '') for i in incidents))} chars"
        ),
    )

    # --- retrieval_readiness -------------------------------------------
    ready = sum(1 for q in per_record if q.resolution_completeness >= 0.7)
    readiness_score = ready / n
    retrieval_readiness = MetricScore(
        name="Retrieval readiness",
        score=readiness_score,
        description=(
            "Share of records whose resolution-relevant fields are populated "
            "enough to derive a suggestion from. Predicts whether the system "
            "can give a useful answer regardless of any specific query."
        ),
        detail=f"{ready}/{n} records pass the resolution-completeness threshold (>=0.70)",
    )

    return CorpusQuality(
        record_count=n,
        source_quality_distribution=distribution,
        completeness=completeness,
        accuracy_heuristic=accuracy,
        consistency=consistency,
        timeliness=timeliness,
        relevance_clarity=relevance_clarity,
        retrieval_readiness=retrieval_readiness,
    )


def iter_records(incidents: Iterable[Incident]) -> list[Incident]:
    """Stable list materialization to share across scoring + dashboard."""
    return list(incidents)
