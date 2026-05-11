import { Box, Stack, Typography } from '@mui/material'

import type { QualityDistribution } from './types'

type Bucket = { label: string; value: number; color: string; description: string }

const COLORS = {
  high: '#16a34a',
  medium: '#f59e0b',
  low: '#dc2626',
  track: '#eef1f6',
} as const

const SIZE = 220
const STROKE = 36
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function arcStrokeDasharray(value: number, total: number): string {
  if (total <= 0) return `0 ${CIRCUMFERENCE}`
  const portion = (value / total) * CIRCUMFERENCE
  return `${portion} ${CIRCUMFERENCE - portion}`
}

export default function DonutChart({
  distribution,
}: {
  distribution: QualityDistribution
}) {
  const total = distribution.total
  const buckets: Bucket[] = [
    {
      label: 'High',
      value: distribution.high,
      color: COLORS.high,
      description: 'score ≥ 0.70 — safe to lean on as precedent.',
    },
    {
      label: 'Medium',
      value: distribution.medium,
      color: COLORS.medium,
      description: 'score 0.40–0.70 — usable but missing fields the agent relies on.',
    },
    {
      label: 'Low',
      value: distribution.low,
      color: COLORS.low,
      description: 'score < 0.40 — sparse or inconsistent; will mislead retrieval.',
    },
  ]

  let offsetSoFar = 0
  const arcs = buckets.map((b) => {
    // strokeDashoffset offsets where this arc starts. We use negative offsets
    // for a clockwise sweep starting at 12 o'clock.
    const startOffset = -offsetSoFar
    offsetSoFar += total > 0 ? (b.value / total) * CIRCUMFERENCE : 0
    return { ...b, dasharray: arcStrokeDasharray(b.value, total), offset: startOffset }
  })

  const highShare = total > 0 ? Math.round((distribution.high / total) * 100) : 0

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'center' }}>
      <Box
        sx={{
          position: 'relative',
          width: SIZE,
          height: SIZE,
          flexShrink: 0,
        }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          // Rotate so arcs start at 12 o'clock instead of 3 o'clock.
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={COLORS.track}
            strokeWidth={STROKE}
          />
          {/* Arcs */}
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={a.color}
              strokeWidth={STROKE}
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography
            sx={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: '#172033' }}
          >
            {total}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
            records
          </Typography>
          <Typography
            variant="caption"
            sx={{ mt: 0.75, fontWeight: 700, color: COLORS.high }}
          >
            {highShare}% healthy
          </Typography>
        </Box>
      </Box>

      <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
        {buckets.map((b) => {
          const pct = total > 0 ? Math.round((b.value / total) * 100) : 0
          return (
            <Stack
              key={b.label}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'flex-start' }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  bgcolor: b.color,
                  borderRadius: 0.5,
                  mt: '6px',
                  flexShrink: 0,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                  <Typography sx={{ fontWeight: 700, color: '#172033' }}>
                    {b.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {b.value} {b.value === 1 ? 'record' : 'records'} ({pct}%)
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {b.description}
                </Typography>
              </Box>
            </Stack>
          )
        })}
      </Stack>
    </Stack>
  )
}
