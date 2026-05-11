import { useEffect, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import TroubleshootOutlinedIcon from '@mui/icons-material/TroubleshootOutlined'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import DonutChart from './DonutChart'
import type { CorpusQuality, MetricScore } from './types'

type Props = {
  apiBase: string
}

function scoreColor(score: number): 'error' | 'warning' | 'success' {
  if (score < 0.4) return 'error'
  if (score < 0.7) return 'warning'
  return 'success'
}

function scoreHex(score: number): string {
  if (score < 0.4) return '#dc2626'
  if (score < 0.7) return '#f59e0b'
  return '#16a34a'
}

function MetricCard({
  metric,
  icon,
  caveat,
}: {
  metric: MetricScore
  icon: React.ReactNode
  caveat?: string
}) {
  const pct = Math.round(metric.score * 100)
  const color = scoreHex(metric.score)
  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: '#e9f2ff', color: '#1f6feb' }}>
            {icon}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h2" sx={{ fontSize: '1rem' }}>
              {metric.name}
            </Typography>
          </Box>
          <Chip
            size="small"
            color={scoreColor(metric.score)}
            label={`${pct}%`}
            sx={{ fontWeight: 700 }}
          />
        </Stack>

        <Box>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#eef1f6',
              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 },
            }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
          {metric.description}
        </Typography>

        {metric.detail && (
          <Box
            sx={{
              border: '1px solid #e4e8f0',
              borderRadius: 1.5,
              p: 1.25,
              bgcolor: '#fafbfd',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                color: '#172033',
              }}
            >
              {metric.detail}
            </Typography>
          </Box>
        )}

        {caveat && (
          <Alert severity="info" sx={{ py: 0.5 }} icon={false}>
            <Typography variant="caption">{caveat}</Typography>
          </Alert>
        )}
      </Stack>
    </Paper>
  )
}

const formulaBoxSx = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '0.78rem',
  whiteSpace: 'pre-wrap' as const,
  bgcolor: '#fafbfd',
  border: '1px solid #e4e8f0',
  borderRadius: 1.5,
  p: 1.25,
  color: '#172033',
}

function FormulaCard() {
  return (
    <Paper sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
          <Avatar
            sx={{ width: 34, height: 34, bgcolor: '#e9f2ff', color: '#1f6feb' }}
          >
            <CalculateOutlinedIcon fontSize="small" />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h2" sx={{ fontSize: '1rem' }}>
              How scores are computed
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Every number on this page is derived from the formulas below. No LLM
              calls, no embeddings — just deterministic metadata math, so the
              dashboard is fast and reproducible.
            </Typography>
          </Box>
        </Stack>

        <Box sx={formulaBoxSx}>
{`source_quality = 0.55 × resolution_completeness
               + 0.25 × clarity
               + 0.20 × accuracy_heuristic

trust          = similarity × source_quality      (per retrieved card)
confidence     = max(trust over kept retrievals)  (overall response)`}
        </Box>

        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 700 }}>
              resolution_completeness — are the fields the agent uses populated?
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={formulaBoxSx}>
{`resolution_completeness =
   0.45 × score(resolution)   [≥30 chars = 1.0, present-but-short = 0.4, empty = 0.0]
 + 0.45 × score(rca_summary)  [≥50 chars = 1.0, present-but-short = 0.4, empty = 0.0]
 + 0.10 × score(tags)         [≥2 tags = 1.0, exactly 1 tag = 0.5, no tags = 0.0]`}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Heaviest single dimension. A record can pass everything else but if
              <code> resolution</code> or <code>rca_summary</code> is empty, the
              agent has nothing to draft suggestions from.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 700 }}>
              clarity — is the content readable?
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={formulaBoxSx}>
{`clarity =
   0.55 × description_length_score   [≥160 chars = 1.0, ramp down to 0 at 0 chars]
 + 0.30 × rca_sentence_structure     [≥2 terminators (.!?) = 1.0, 1 = 0.5, 0 = 0.0]
 + 0.15 × title_token_count          [multi-token title = 1.0, single token = 0.0]`}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Penalises one-word titles, single-line "broken" descriptions, and
              terminator-less RCA strings that read like labels rather than text.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 700 }}>
              accuracy_heuristic — do the fields agree with each other?
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={formulaBoxSx}>
{`accuracy_heuristic = checks_passed / checks_total

Structural plausibility:
  • resolved_at ≥ created_at
  • severity ∈ {P1, P2, P3, P4}
  • bool(resolution) == bool(rca_summary)   (no half-records)
  • resolution set ⇒ resolved_at set

Semantic coherence (token-overlap, no LLM):
  • tag tokens appear in description
  • service name appears in description
  • Jaccard(title, description)        ≥ 0.05
  • Jaccard(description, rca_summary)  ≥ 0.05
  • Jaccard(description, resolution)   ≥ 0.03`}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              The semantic-coherence checks catch the failure mode where every
              field is filled but the contents disagree — e.g. an engineer
              under pressure pastes a description from a different incident,
              or writes a title that doesn't match the body. Token-overlap is a
              cheap proxy; it can miss subtle paraphrase mismatches but reliably
              flags the obvious ones. <i>Not</i> ground-truth accuracy — that
              would require labeled human review we don't have.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 700 }}>
              Corpus-level aggregates (Consistency, Timeliness, Retrieval readiness)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={formulaBoxSx}>
{`Consistency        = 1 − (singleton_tag_count / unique_tag_count)
Timeliness         = 0.5 × age_score + 0.5 × resolved_share
                      age_score = clamp(1 − max(0, median_age_days − 30) / 365)
Retrieval readiness = share of records with resolution_completeness ≥ 0.70
Bucketing          = high if score ≥ 0.70, medium if ≥ 0.40, else low`}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              These don't have per-record meaning — they live at the corpus
              level. Consistency penalises singleton tags because every
              one-off tag fragments the embedding space; Timeliness rewards
              fresh, closed-out records; Retrieval readiness is the share of
              records the agent could realistically use as precedent.
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Paper>
  )
}


export default function QualityDashboard({ apiBase }: Props) {
  const [data, setData] = useState<CorpusQuality | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQuality = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`${apiBase}/api/vectorstore/quality`)
      if (!resp.ok) {
        const body = await resp.text()
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 240)}`)
      }
      const json: CorpusQuality = await resp.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuality()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
        >
          <Box>
            <Typography variant="h2">Vector Store Data Quality</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Health of the historical incidents the copilot retrieves from. Real
              environments are messy — these metrics surface where the data is
              thin so retrieval results can be read honestly.
            </Typography>
            {data && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Corpus size: <b>{data.record_count}</b> records. Computed from metadata only — no LLM calls.
              </Typography>
            )}
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshOutlinedIcon />}
            onClick={fetchQuality}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchQuality} disabled={loading}>
              Retry
            </Button>
          }
        >
          Failed to load corpus quality: {error}
        </Alert>
      )}

      {loading && !data && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress size={22} />
            <Typography color="text.secondary">Scoring the corpus...</Typography>
          </Stack>
        </Paper>
      )}

      {data && (
        <>
          <Paper sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
                <Avatar
                  sx={{ width: 34, height: 34, bgcolor: '#e9f2ff', color: '#1f6feb' }}
                >
                  <DonutLargeOutlinedIcon fontSize="small" />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h2" sx={{ fontSize: '1rem' }}>
                    Source-quality distribution
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Every stored incident scored on its own merits, then bucketed.
                    This is the headline "how much of our corpus is degraded?" view —
                    aggregate scores can hide a long tail.
                  </Typography>
                </Box>
              </Stack>
              <DonutChart distribution={data.source_quality_distribution} />
            </Stack>
          </Paper>

          <FormulaCard />


          <MetricCard
            metric={data.retrieval_readiness}
            icon={<TroubleshootOutlinedIcon fontSize="small" />}
            caveat="Predicts whether retrieval can produce useful suggestions at all, before any specific query."
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 3,
            }}
          >
            <MetricCard
              metric={data.completeness}
              icon={<CheckCircleOutlinedIcon fontSize="small" />}
            />
            <MetricCard
              metric={data.accuracy_heuristic}
              icon={<FactCheckOutlinedIcon fontSize="small" />}
              caveat="Heuristic only. True accuracy needs labeled ground-truth review, which a synthetic / fresh corpus does not have."
            />
            <MetricCard
              metric={data.consistency}
              icon={<HubOutlinedIcon fontSize="small" />}
            />
            <MetricCard
              metric={data.timeliness}
              icon={<ScheduleOutlinedIcon fontSize="small" />}
            />
            <MetricCard
              metric={data.relevance_clarity}
              icon={<InsightsOutlinedIcon fontSize="small" />}
              caveat="Per-query relevance is reported inline on each retrieved card as Similarity."
            />
            <Paper sx={{ p: 2.5, height: '100%', bgcolor: '#f7faff' }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
                  <Avatar sx={{ width: 34, height: 34, bgcolor: '#1f6feb', color: 'white' }}>
                    <AssessmentOutlinedIcon fontSize="small" />
                  </Avatar>
                  <Typography variant="h2" sx={{ fontSize: '1rem' }}>
                    How to read these numbers
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  Similarity says a retrieved past incident <i>looks like</i> the new
                  one. Source quality says the past record is <i>worth learning
                  from</i>. Multiplied together they form <b>trust</b>, shown on each
                  Similar Past Incident card. When text match is high but source
                  quality is low, the card surfaces an amber warning — that is the
                  case where the copilot would otherwise mislead.
                </Typography>
              </Stack>
            </Paper>
          </Box>
        </>
      )}
    </Stack>
  )
}
