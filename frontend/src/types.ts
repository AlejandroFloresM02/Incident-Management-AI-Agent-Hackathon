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

/** One similar past incident retrieved from the vector store. */
export interface RetrievalResult {
  incident: Incident;
  similarity: number;
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
