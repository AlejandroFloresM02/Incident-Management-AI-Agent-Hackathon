export type Severity = 'P1' | 'P2' | 'P3' | 'P4';

/**
 * An incident ticket.
 *
 * Used as input to /api/incident/analyze and as historical data stored in ChromaDB.
 */
export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  service: string;
  tags?: string[];
  created_at: string;
  resolved_at?: string | null;
  resolution?: string | null;
  rca_summary?: string | null;
  requires_human_approval?: boolean;
}

/**
 * Per-record quality of an incident stored in the vector store. Independent
 * of any query — describes whether the record itself is worth learning from.
 */
export interface SourceQuality {
  score: number;
  resolution_completeness: number;
  clarity: number;
  accuracy_heuristic: number;
  notes: string;
}

/** One similar past incident retrieved from the vector store. */
export interface RetrievalResult {
  incident: Incident;
  similarity: number;
  source_quality?: SourceQuality | null;
  /** Composite: similarity × source_quality.score. The honest "should I lean on this precedent?" number. */
  trust: number;
  /** Set when text match is high but the source record is sparse. */
  warning?: string | null;
}

/** One named quality dimension on the data-quality dashboard. */
export interface MetricScore {
  name: string;
  score: number;
  description: string;
  detail: string;
}

/** Count of records bucketed by their per-record source-quality score. */
export interface QualityDistribution {
  /** score >= 0.70 */
  high: number;
  /** 0.40 <= score < 0.70 */
  medium: number;
  /** score < 0.40 */
  low: number;
  total: number;
}

/** Aggregate quality of the full incident corpus. Returned by GET /api/vectorstore/quality. */
export interface CorpusQuality {
  record_count: number;
  source_quality_distribution: QualityDistribution;
  completeness: MetricScore;
  accuracy_heuristic: MetricScore;
  consistency: MetricScore;
  timeliness: MetricScore;
  relevance_clarity: MetricScore;
  retrieval_readiness: MetricScore;
}

/**
 * Structured Root Cause Analysis.
 *
 * Populated by the agent's RCA node using structured LLM output.
 */
export interface RCA {
  summary: string;
  root_cause: string;
  contributing_factors: string[];
  timeline: string[];
  preventive_actions: string[];
}

/** One step in the agent's execution, surfaced to the UI for transparency. */
export interface TraceStep {
  step: string;
  detail: string;
}

/** The full output of POST /api/incident/analyze. */
export interface AgentResponse {
  summary: string;
  similar_incidents: RetrievalResult[];
  suggested_steps: string[];
  rca: RCA;
  confidence: number;
  trace: TraceStep[];
}
